// ============================================================================
// Orquestador de la ingesta (plan §5.1):
//   identidad → fuentes (búsqueda web real) → lectura (directa o con web_fetch
//   de Anthropic, incluidos PDF oficiales) → extracción con citas verificadas
//   → reconciliación → validación
//   → precio (encontrado o ESTIMADO con razonamiento) → borrador
//
// El borrador NO toca la base de datos. La publicación es otra llamada,
// después de que el humano acepte o rechace campo por campo.
// ============================================================================

import { z } from 'zod/v4';
import { ATTRIBUTE_REGISTRY } from '@/lib/attributes/registry';
import { esErrorDeCuenta, explicarErrorClaude, pedirJson } from '@/lib/ai/claude';
import { fetchPageText } from './fetcher';
import { buscarFotos, type Angulo } from './fotos';
import { discoverSources } from './sources';
import { buscarFuentes, buscarFuentesPara, leerConClaude, tierPorDominio, type Contenido } from './buscar-fuentes';
import { clavesFaltantes } from '@/lib/attributes/clave';
import { extractFromPage, fuenteViejaDescartable, resolveIdentity } from './extract';
import { normalizarCop, verificarPrecio } from './price-check';
import type { DiscoveredSource, DraftFact, PriceDraft, RawFact, VehicleDraft } from './types';

const PRICE_KEY = 'commercial.priceCop';
/** Discrepancia relativa entre fuentes que marca conflicto (plan §5.1 paso 4). */
const CONFLICT_THRESHOLD = 0.10;

// ---------------------------------------------------------------------------
// Reconciliación multi-fuente: gana el mejor tier; el resto queda como
// alternativa visible. Numéricos con >10% de diferencia → bandera de conflicto.
// ---------------------------------------------------------------------------
function reconcile(raw: RawFact[]): DraftFact[] {
  const byKey = new Map<string, RawFact[]>();
  for (const f of raw) {
    const list = byKey.get(f.key) ?? [];
    list.push(f);
    byKey.set(f.key, list);
  }

  const drafts: DraftFact[] = [];

  byKey.forEach((facts, key) => {
    const def = ATTRIBUTE_REGISTRY.find(d => d.key === key);
    if (!def) return;

    // Mejor tier primero; a igual tier, la fuente de año modelo más reciente
    // (una ficha 2019 y una 2024 de la misma generación: manda la 2024); a
    // igual año, la primera encontrada.
    const sorted = [...facts].sort((a, b) => a.tier - b.tier || (b.anioFuente ?? 0) - (a.anioFuente ?? 0));
    const winner = sorted[0];
    const others = sorted.slice(1);

    let conflict = false;
    if (def.dataType === 'numeric') {
      const w = winner.value as number;
      conflict = others.some(o => {
        const v = o.value as number;
        return w !== 0 && Math.abs(v - w) / Math.abs(w) > CONFLICT_THRESHOLD;
      });
    } else {
      conflict = others.some(o => o.value !== winner.value);
    }

    // Validación física (plan §5.1 paso 5): fuera de rango se marca, no se esconde
    let outOfRange = false;
    if (def.dataType === 'numeric') {
      const v = winner.value as number;
      if (def.expectedMin !== undefined && v < def.expectedMin) outOfRange = true;
      if (def.expectedMax !== undefined && v > def.expectedMax) outOfRange = true;
    }

    // Confianza: base por tier, castigada por conflicto o rango imposible
    const tierBase = winner.tier === 1 ? 0.95 : winner.tier === 2 ? 0.8 : 0.5;
    const agreementBonus = others.length > 0 && !conflict ? 0.05 : 0;
    const confidence = Math.max(
      0.1,
      Math.min(1, tierBase + agreementBonus - (conflict ? 0.3 : 0) - (outOfRange ? 0.4 : 0))
    );

    drafts.push({
      key,
      labelEs: def.labelEs,
      unit: def.unit,
      displayGroup: def.displayGroup,
      value: winner.value,
      confidence: Math.round(confidence * 100) / 100,
      sourceUrl: winner.sourceUrl,
      tier: winner.tier,
      quote: winner.quote,
      vigencia: winner.vigencia,
      conflict,
      outOfRange,
      alternatives: others
        .filter(o => o.value !== winner.value)
        .slice(0, 3)
        .map(o => ({ value: o.value, sourceUrl: o.sourceUrl, tier: o.tier })),
    });
  });

  // Orden estable para la UI: grupo → prioridad del registro
  const priority = new Map(ATTRIBUTE_REGISTRY.map(d => [d.key, d.displayPriority]));
  return drafts.sort((a, b) => {
    if (a.displayGroup !== b.displayGroup) return a.displayGroup.localeCompare(b.displayGroup);
    return (priority.get(b.key) ?? 0) - (priority.get(a.key) ?? 0);
  });
}

// ---------------------------------------------------------------------------
// Precio: de fuentes si existe; si no, ESTIMACIÓN con razonamiento explícito.
// (Regla original del plan era no estimar nunca; decisión de producto del
// 28-jul-2026: se permite estimar, marcado como estimación, con razonamiento
// visible, y SIEMPRE sujeto a aprobación humana antes de publicar.)
// ---------------------------------------------------------------------------
async function resolvePrice(
  facts: DraftFact[],
  identity: { brand: string; model: string; trim?: string; year: number; fuelType: string; type: string }
): Promise<{ price: PriceDraft | null; remainingFacts: DraftFact[] }> {
  const priceFact = facts.find(f => f.key === PRICE_KEY);
  const remainingFacts = facts.filter(f => f.key !== PRICE_KEY);

  if (priceFact && typeof priceFact.value === 'number' && !priceFact.outOfRange) {
    return {
      price: {
        value: priceFact.value,
        estimated: false,
        reasoningEs: `Precio de la fuente${priceFact.vigencia ? `, vigente a ${priceFact.vigencia}` : ' (la fuente no dice de qué fecha es)'}: "${priceFact.quote}"`,
        sourceUrl: priceFact.sourceUrl,
        confidence: priceFact.confidence,
      },
      remainingFacts,
    };
  }

  // Estimación razonada (una sola llamada)
  if (!process.env.ANTHROPIC_API_KEY) return { price: null, remainingFacts };

  const EstimacionSchema = z.object({
    priceCop: z.number().describe('Precio estimado en pesos colombianos (número completo, ej. 89990000)'),
    reasoning: z
      .string()
      .describe('Razonamiento en español, 2-4 frases: contra qué rivales del mercado colombiano se ancla la estimación y por qué'),
    confidence: z.number().describe('Entre 0 y 1'),
  });

  try {
    const args = await pedirJson({
      schema: EstimacionSchema,
      maxTokens: 8000,
      prompt: `Estima el precio de lista en Colombia (COP, ${identity.trim ? `versión ${identity.trim}` : 'versión de entrada'}) del ${identity.brand} ${identity.model} ${identity.year} (${identity.fuelType}, ${identity.type}).

Ancla el razonamiento en rivales directos que SÍ se venden en Colombia y sus precios conocidos (H1-2026: los 10 más vendidos cotizan entre $75M y $136M base; Tesla Model Y desde $119,99M; el más barato del mercado ~$47M). Ajusta por segmento, tren motriz y posicionamiento de marca. Si el modelo no se vende en Colombia, estima el precio que tendría al importarse (incluye arancel e IVA) y dilo en el razonamiento.`,
    });

    // El modelo a veces contesta "85" por 85 millones: sin este saneo se
    // publicaría un carro de $85 pesos sin que nada chille.
    const valor = normalizarCop(args.priceCop);
    if (valor === null) return { price: null, remainingFacts };

    return {
      price: {
        value: valor,
        estimated: true,
        reasoningEs: String(args.reasoning ?? 'Sin razonamiento — revisar manualmente.'),
        confidence: Math.min(0.6, Number(args.confidence) || 0.4), // una estimación nunca supera 0.6
      },
      remainingFacts,
    };
  } catch {
    return { price: null, remainingFacts };
  }
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function remainingFactsVigencia(facts: DraftFact[]) {
  return facts.find(f => f.key === PRICE_KEY)?.vigencia;
}

/** "octubre de 2025" → meses transcurridos hasta hoy. null si no se entiende. */
export function mesesDesde(vigencia: string | undefined, hoy = new Date()): number | null {
  if (!vigencia) return null;
  const t = vigencia.toLowerCase();
  const anio = t.match(/\b(20\d\d)\b/);
  if (!anio) return null;
  const mes = MESES.findIndex(m => t.includes(m));
  return (hoy.getFullYear() - Number(anio[1])) * 12 + (hoy.getMonth() - (mes >= 0 ? mes : 0));
}

// ---------------------------------------------------------------------------
// Una fuente: lectura directa (rápida y gratis) y, solo si el sitio bloquea o
// es PDF, lectura con web_fetch de Anthropic. Una página que se leyó y no trae
// datos NO se vuelve a leer (costo doble). Fuentes de más de un año modelo
// atrás se descartan: pueden ser otra generación o una versión que ya cambió.
// ---------------------------------------------------------------------------
async function procesarFuente(
  source: DiscoveredSource,
  ctx: { label: string; versionObjetivo: string; versionPedida: boolean; anio: number; fuelType: string },
  soloKeys?: string[]
): Promise<{ source: DiscoveredSource; facts: RawFact[]; ok: boolean; note: string }> {
  const nota = (n: number, descartados: number, como: string) =>
    `${n} datos extraídos${como}${descartados ? ` · ${descartados} descartados por ser de otra versión` : ''}`;
  const extraer = async (c: string | Contenido) => {
    const r = await extractFromPage(c, source.url, source.tier, ctx.label, ctx.versionObjetivo, soloKeys, ctx.fuelType, ctx.versionPedida);
    const anioViejo = fuenteViejaDescartable(r, ctx.anio);
    return { ...r, facts: anioViejo ? [] : r.facts, anioViejo };
  };
  const viejo = (anio: number) => ({ source, facts: [] as RawFact[], ok: false, note: `Es del modelo ${anio} y de otra generación: no sirve para el ${ctx.anio}, se descartó` });

  const esPdf = /\.pdf($|\?)/i.test(source.url);
  const directo = esPdf ? null : await fetchPageText(source.url);
  if (directo && directo.length >= 300) {
    const r = await extraer(directo);
    if (r.anioViejo) return viejo(r.anioModeloFuente);
    return {
      source,
      facts: r.facts,
      ok: r.facts.length > 0,
      note: r.facts.length > 0 ? nota(r.facts.length, r.descartadosPorVersion, '') : 'Se leyó, pero no trae especificaciones de esta versión',
    };
  }
  let contenido: Contenido | null = null;
  try {
    contenido = await leerConClaude(source.url);
  } catch (err) {
    if (esErrorDeCuenta(err)) throw new Error(explicarErrorClaude(err));
    contenido = null;
  }
  if (!contenido) return { source, facts: [], ok: false, note: 'No se pudo leer la página (vacía, bloqueada o no existe)' };
  const r = await extraer(contenido);
  if (r.anioViejo) return viejo(r.anioModeloFuente);
  const como = 'pdfBase64' in contenido ? ' del PDF' : '';
  return {
    source,
    facts: r.facts,
    ok: r.facts.length > 0,
    note:
      r.facts.length > 0
        ? nota(r.facts.length, r.descartadosPorVersion, como)
        : r.descartadosPorVersion > 0
          ? `Se leyó${como}: sus ${r.descartadosPorVersion} datos son de otras versiones, se descartaron`
          : `Se leyó${como}, pero no trae especificaciones de este modelo`,
  };
}

// ---------------------------------------------------------------------------
// Pipeline completo
// ---------------------------------------------------------------------------
/** Ficha técnica o catálogo que mandó el concesionario (PDF o foto). */
export interface DocumentoConcesionario {
  nombre: string;
  contenido: Contenido;
}

export async function runIngestPipeline(input: {
  brand: string;
  model: string;
  year: number;
  country: string;
  /** Documentos del concesionario: la fuente principal; la web solo complementa. */
  documentos?: DocumentoConcesionario[];
  /** Enlaces que eligió el equipo (página oficial, ficha en PDF…): fuentes
   *  principales como los documentos; la web solo complementa. */
  enlaces?: string[];
  /** Vistas que ya tienen foto del concesionario: la IA solo busca las demás. */
  angulosCubiertos?: Angulo[];
}): Promise<VehicleDraft> {
  const warningsEs: string[] = [];
  // Presupuesto de tiempo: la función tiene 300 s (vercel.json). Lo opcional
  // (segunda búsqueda, verificación del precio) se salta si se acerca el
  // límite, en vez de que Vercel corte todo y se pierda la ingesta.
  const inicio = Date.now();
  const segundos = () => (Date.now() - inicio) / 1000;
  const hayTiempo = (hastaSegundo: number) => segundos() < hastaSegundo;

  // 1. Identidad canónica
  const identity = await resolveIdentity(input.brand, input.model, input.year, input.country);
  // Sin versión pedida, el objetivo es la versión de ENTRADA, con nombre propio:
  // si no, una página dedicada a una versión alta (CX-30 Touring) pasaría por "la objetivo".
  const versionObjetivo = identity.trim || identity.versionEntrada;
  if (!identity.trim) {
    warningsEs.push(
      identity.versionEntrada
        ? `No se pidió versión: se tomaron solo datos de la versión de entrada (se supuso "${identity.versionEntrada}"; si en Colombia no existe, la más barata o única que traen las fuentes) o comunes a toda la gama.`
        : 'No se pidió versión y no se identificó la de entrada: revisar con cuidado que los datos no mezclen versiones.'
    );
  }
  // Sin versión pedida, la de entrada va como pista aparte (extractFromPage), no
  // en la etiqueta: el nombre que supone la IA puede ser de otro mercado.
  const version = identity.trim ? `, versión ${identity.trim}` : '';
  const label = `${identity.brand} ${identity.model} ${input.year}${version} (mercado ${input.country})`;
  // El nombre publicado lleva la versión ("Onix RS"): en Colombia se venden
  // como carros distintos. Las fuentes se buscan por el modelo base, que es
  // como las indexa la prensa.
  const modeloPublicado = identity.trim ? `${identity.model} ${identity.trim}` : identity.model;

  // 2. Fuentes reales: búsqueda web (solo URLs que salieron en los resultados).
  //    Si la búsqueda falla o trae muy poco, se completa con las rutas conocidas.
  //    Arranca YA y corre en paralelo con los documentos y los enlaces.
  const candidatosWeb = (async () => {
    let candidates = await buscarFuentes(identity.brand, identity.model, versionObjetivo, input.year).catch(err => {
      // Sin saldo o con la clave mala no tiene sentido seguir: todo lo demás también fallaría.
      if (esErrorDeCuenta(err)) throw new Error(explicarErrorClaude(err));
      warningsEs.push(`La búsqueda web falló (${explicarErrorClaude(err).slice(0, 120)}); se usaron fuentes conocidas.`);
      return [] as DiscoveredSource[];
    });
    if (candidates.length < 2) {
      const conocidas = await discoverSources(identity.brand, identity.model, input.year);
      candidates = [...candidates, ...conocidas.filter(c => !candidates.some(x => x.url === c.url))];
    }
    if (candidates.length === 0) {
      warningsEs.push('No se encontraron fuentes candidatas. Revisar el nombre del modelo.');
    }
    return candidates;
  })();

  // 3+4. Lectura + extracción, fuentes en paralelo (máx 4, por costo).
  //   a) descarga directa (rápida y gratis);
  //   b) solo si el sitio bloquea o es PDF: lectura con web_fetch de Anthropic.
  //      Una página que se leyó y no trae datos NO se vuelve a leer (costo doble).
  const sourcesReport: VehicleDraft['sourcesReport'] = [];
  const rawFacts: RawFact[] = [];

  // 3a. Documentos del concesionario primero: tier 1 y de primeros en la lista,
  //     así ganan cualquier empate con la web en la reconciliación.
  const docs = (input.documentos ?? []).slice(0, 6);
  const leidosDocsP = Promise.allSettled(
    docs.map(async d => {
      const url = `concesionario://${d.nombre}`;
      const r = await extractFromPage(d.contenido, url, 1, label, versionObjetivo, undefined, identity.fuelType, !!identity.trim);
      const anioViejo = fuenteViejaDescartable(r, input.year);
      return { d, url, r, anioViejo };
    })
  );
  const procesar = (source: DiscoveredSource, soloKeys?: string[]) =>
    procesarFuente(source, { label, versionObjetivo, versionPedida: !!identity.trim, anio: input.year, fuelType: identity.fuelType }, soloKeys);
  const reportar = (results: PromiseSettledResult<Awaited<ReturnType<typeof procesar>>>[]) => {
    for (const r of results) {
      if (r.status === 'fulfilled') {
        sourcesReport.push({ url: r.value.source.url, nameEs: r.value.source.nameEs, tier: r.value.source.tier, ok: r.value.ok, note: r.value.note });
        rawFacts.push(...r.value.facts);
      } else {
        if (esErrorDeCuenta(r.reason)) throw new Error(explicarErrorClaude(r.reason));
        warningsEs.push(`Una fuente falló: ${String(r.reason).slice(0, 120)}`);
      }
    }
  };

  // 3b. Enlaces que puso el equipo: también tier 1 y antes que la web.
  const enlaces: DiscoveredSource[] = (input.enlaces ?? []).slice(0, 6).map(url => ({
    url,
    // Tier 1 solo si el dominio es del fabricante en Colombia; un blog o un clasificado no lo es.
    tier: tierPorDominio(url, identity.brand),
    nameEs: `Enlace del equipo: ${new URL(url).hostname.replace(/^www\./, '')}`,
  }));
  const leidosEnlacesP = Promise.allSettled(enlaces.map(source => procesar(source)));

  // 3c. La web complementa (sin repetir los enlaces del equipo).
  const webP = candidatosWeb.then(candidates => {
    const deLaWeb = candidates.filter(c => !enlaces.some(e => e.url === c.url)).slice(0, 4);
    return Promise.allSettled(deLaWeb.map(source => procesar(source))).then(leidas => ({ deLaWeb, leidas }));
  });

  // Todo corre a la vez; el informe se arma en orden de prioridad
  // (documentos → enlaces → web) para que ganen los empates.
  const [leidosDocs, leidosEnlaces, { deLaWeb, leidas: leidasWeb }] = await Promise.all([leidosDocsP, leidosEnlacesP, webP]);
  for (const x of leidosDocs) {
    if (x.status !== 'fulfilled') {
      if (esErrorDeCuenta(x.reason)) throw new Error(explicarErrorClaude(x.reason));
      warningsEs.push(`No se pudo leer un documento: ${String(x.reason).slice(0, 120)}`);
      continue;
    }
    const { d, url, r, anioViejo } = x.value;
    const facts = anioViejo ? [] : r.facts;
    sourcesReport.push({
      url,
      nameEs: `Concesionario: ${d.nombre.slice(0, 40)}`,
      tier: 1,
      ok: facts.length > 0,
      note: anioViejo
        ? `Es del modelo ${r.anioModeloFuente} y de otra generación: no sirve para el ${input.year}, se descartó`
        : facts.length > 0
          ? `${facts.length} datos del documento${r.descartadosPorVersion ? ` · ${r.descartadosPorVersion} de otras versiones descartados` : ''}`
          : 'Se leyó, pero no trae datos de esta versión',
    });
    rawFacts.push(...facts);
  }

  reportar(leidosEnlaces);
  reportar(leidasWeb);
  // Leídas: los enlaces cuentan para las fotos y para no releerlos en la búsqueda dirigida.
  const toProcess = [...enlaces, ...deLaWeb];

  const okSources = sourcesReport.filter(s => s.ok).length;
  if (okSources === 0) {
    warningsEs.push('Ninguna fuente respondió con contenido útil. El borrador está vacío: no publicar.');
  } else if (okSources === 1) {
    warningsEs.push('Solo una fuente respondió: sin reconciliación multi-fuente, revisar con más cuidado.');
  }

  // 4b. Campos clave que faltan (0-100, rendimiento, equipamiento…): una
  //     segunda búsqueda dirigida SOLO a esos datos, en páginas nuevas.
  const valoresDe = (facts: RawFact[]) => Object.fromEntries(facts.map(f => [f.key, f.value]));
  const faltanAntes = clavesFaltantes(identity.fuelType, valoresDe(rawFacts));
  if (faltanAntes.length > 0 && !hayTiempo(150)) {
    warningsEs.push(`No alcanzó el tiempo para buscar los datos que faltan (${faltanAntes.length}): complétalos en la revisión o usa "Complementar" después de publicar.`);
  } else if (faltanAntes.length > 0) {
    const extra = await buscarFuentesPara(
      identity.brand,
      identity.model,
      versionObjetivo,
      input.year,
      faltanAntes.map(c => c.etiqueta),
      toProcess.map(x => x.url)
    ).catch(err => {
      if (esErrorDeCuenta(err)) throw new Error(explicarErrorClaude(err));
      return [] as DiscoveredSource[];
    });
    const soloKeys = faltanAntes.flatMap(c => c.keys);
    const extras = await Promise.allSettled(extra.map(source => procesar(source, soloKeys)));
    for (const r of extras) {
      if (r.status !== 'fulfilled') continue;
      sourcesReport.push({
        url: r.value.source.url,
        nameEs: r.value.source.nameEs,
        tier: r.value.source.tier,
        ok: r.value.ok,
        note: `Búsqueda de datos que faltaban: ${r.value.note}`,
      });
      rawFacts.push(...r.value.facts);
    }
    toProcess.push(...extra);
  }
  const faltan = clavesFaltantes(identity.fuelType, valoresDe(rawFacts));
  if (faltan.length > 0) {
    warningsEs.push(
      `Faltan ${faltan.length} datos clave (${faltan.map(c => c.etiqueta).join(', ')}): complétalos en la revisión o márcalos como "no existe".`
    );
  }

  // 5. Reconciliación + validación
  const allFacts = reconcile(rawFacts);
  const aniosViejos = Array.from(new Set(rawFacts.map(f => f.anioFuente ?? 0).filter(a => a > 1990 && a < input.year - 1))).sort();
  if (aniosViejos.length > 0) {
    warningsEs.push(`Algunas fuentes son del modelo ${aniosViejos.join(', ')} (misma generación): si el carro se renovó, revisa que los datos sigan vigentes.`);
  }
  const conflicted = allFacts.filter(f => f.conflict).length;
  if (conflicted > 0) warningsEs.push(`${conflicted} campos tienen fuentes en desacuerdo (marcados en la revisión).`);
  const impossible = allFacts.filter(f => f.outOfRange).length;
  if (impossible > 0) warningsEs.push(`${impossible} campos quedaron fuera del rango físico esperado (desmarcados por defecto).`);

  // 6. Precio (con verificación contra el catálogo real) y fotos, en paralelo.
  //    Las fotos nunca tumban la ingesta: si fallan, se avisa y se suben a mano.
  const avisosFotos: string[] = [];
  const [{ price: precioCrudo, remainingFacts }, fotos] = await Promise.all([
    resolvePrice(allFacts, { ...identity, trim: versionObjetivo, year: input.year }),
    buscarFotos({
      nombre: `${identity.brand} ${modeloPublicado} ${input.year}`,
      modelo: identity.model,
      fuentes: toProcess,
      avisos: avisosFotos,
      cubiertos: input.angulosCubiertos,
    }).catch(err => {
      if (esErrorDeCuenta(err)) throw new Error(explicarErrorClaude(err));
      avisosFotos.push(`No se pudieron buscar fotos: ${explicarErrorClaude(err).slice(0, 120)}`);
      return [];
    }),
  ]);
  warningsEs.push(...avisosFotos);

  let price = precioCrudo;
  let comparablesPrecio: { etiqueta: string; precio: number }[] = [];

  if (precioCrudo && !hayTiempo(250)) {
    warningsEs.push('No alcanzó el tiempo para verificar el precio contra el catálogo: confírmalo antes de publicar.');
  } else if (precioCrudo) {
    const revision = await verificarPrecio(precioCrudo, { ...identity, trim: versionObjetivo, year: input.year });
    price = revision.price;
    comparablesPrecio = revision.comparables;
    if (revision.notaEs) warningsEs.push(revision.notaEs);
  }

  // Un precio de fuente también envejece: si la fuente dice la fecha y tiene
  // más de 6 meses, se avisa; si no la dice, también.
  if (price && !price.estimated) {
    const vig = remainingFactsVigencia(allFacts);
    const meses = mesesDesde(vig);
    if (!vig) warningsEs.push('La fuente del precio no dice de qué fecha es: confírmalo con el concesionario.');
    else if (meses !== null && meses > 6) warningsEs.push(`El precio es de ${vig} (hace ~${meses} meses): puede estar desactualizado, confírmalo con el concesionario.`);
  }

  if (price?.estimated) {
    warningsEs.push('El precio es una ESTIMACIÓN. Verificar contra el concesionario antes de publicar.');
  } else if (!price) {
    warningsEs.push('Sin precio: ni encontrado ni estimable. Hay que ponerlo a mano.');
  }

  return {
    brand: identity.brand,
    model: modeloPublicado,
    year: input.year,
    country: input.country,
    type: identity.type,
    vehicleType: identity.vehicleType,
    fuelType: identity.fuelType,
    price,
    priceComparables: comparablesPrecio,
    facts: remainingFacts,
    sourcesReport,
    fotos,
    warningsEs,
  };
}
