// ============================================================================
// Orquestador de la ingesta (plan §5.1):
//   identidad → fuentes (búsqueda web real) → lectura (directa o con web_fetch
//   de Anthropic, incluidos PDF oficiales) → extracción con citas verificadas
//   → reconciliación → validación
//   → precio (encontrado o ESTIMADO con razonamiento) → borrador
//
// Va POR ETAPAS, cada una en su propia petición (ver "Pipeline por etapas"
// abajo): una sola petición de 300 s no alcanza para una ficha completa.
//
// El borrador NO toca la base de datos. La publicación es otra llamada,
// después de que el humano acepte o rechace campo por campo.
// ============================================================================

import { z } from 'zod/v4';
import { ATTRIBUTE_REGISTRY, fueraDeRango } from '@/lib/attributes/registry';
import { claseDeTipo, claseEnPalabras, type ClaseVehiculo } from '@/lib/attributes/clase';
import { esErrorDeCuenta, explicarErrorClaude, pedirJson } from '@/lib/ai/claude';
import { fetchPageText } from './fetcher';
import { buscarFotos, type Angulo } from './fotos';
import { discoverSources } from './sources';
import { buscarFuentes, buscarFuentesPara, leerConClaude, tierPorDominio, type Contenido } from './buscar-fuentes';
import { clavesFaltantes } from '@/lib/attributes/clave';
import { extractFromPage, fuenteViejaDescartable, resolveIdentity } from './extract';
import { normalizarCop, verificarPrecio } from './price-check';
import { medir, reiniciarTiempos } from './tiempos';
import type { DiscoveredSource, DraftFact, FotoDraft, PriceDraft, RawFact, VehicleDraft } from './types';

const PRICE_KEY = 'commercial.priceCop';
/** Discrepancia relativa entre fuentes que marca conflicto (plan §5.1 paso 4). */
const CONFLICT_THRESHOLD = 0.10;

// ---------------------------------------------------------------------------
// Reconciliación multi-fuente: gana el mejor tier; el resto queda como
// alternativa visible. Numéricos con >10% de diferencia → bandera de conflicto.
// ---------------------------------------------------------------------------
function reconcile(raw: RawFact[], clase: ClaseVehiculo): DraftFact[] {
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

    // Validación física (plan §5.1 paso 5) con el rango de SU clase (un furgón
    // de 15.000 L no es un error en una van): fuera de rango se marca, no se esconde
    const outOfRange = def.dataType === 'numeric' && fueraDeRango(def, winner.value as number, clase);

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
  identity: { brand: string; model: string; trim?: string; year: number; fuelType: string; type: string },
  signal?: AbortSignal
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
      signal,
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
  ctx: { label: string; versionObjetivo: string; versionPedida: boolean; anio: number; fuelType: string; corte: AbortSignal },
  soloKeys?: string[]
): Promise<{ source: DiscoveredSource; facts: RawFact[]; ok: boolean; note: string }> {
  const nota = (n: number, descartados: number, como: string) =>
    `${n} datos extraídos${como}${descartados ? ` · ${descartados} descartados por ser de otra versión` : ''}`;
  const extraer = async (c: string | Contenido) => {
    const r = await medir(
      `extracción ${source.url}`,
      extractFromPage(c, source.url, source.tier, ctx.label, ctx.versionObjetivo, soloKeys, ctx.fuelType, ctx.versionPedida, ctx.corte)
    );
    const anioViejo = fuenteViejaDescartable(r, ctx.anio);
    return { ...r, facts: anioViejo ? [] : r.facts, anioViejo };
  };
  const sinTiempo = { source, facts: [] as RawFact[], ok: false, note: 'No alcanzó el tiempo: se cortó para no perder la ingesta' };
  if (ctx.corte.aborted) return sinTiempo;
  const viejo = (anio: number) => ({ source, facts: [] as RawFact[], ok: false, note: `Es del modelo ${anio} y de otra generación: no sirve para el ${ctx.anio}, se descartó` });

  const esPdf = /\.pdf($|\?)/i.test(source.url);
  const directo = esPdf ? null : await medir(`descarga ${source.url}`, fetchPageText(source.url));
  if (directo && directo.length >= 300) {
    const r = await extraer(directo).catch(err => {
      if (ctx.corte.aborted) return null;
      throw err;
    });
    if (!r) return sinTiempo;
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
    contenido = await medir(`web_fetch ${source.url}`, leerConClaude(source.url));
  } catch (err) {
    if (esErrorDeCuenta(err)) throw new Error(explicarErrorClaude(err));
    contenido = null;
  }
  if (!contenido) return { source, facts: [], ok: false, note: 'No se pudo leer la página (vacía, bloqueada o no existe)' };
  const r = await extraer(contenido).catch(err => {
    if (ctx.corte.aborted) return null;
    throw err;
  });
  if (!r) return sinTiempo;
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
// Pipeline POR ETAPAS.
//
// Una sola petición de 300 s (el máximo de Vercel) no alcanza: una ficha
// técnica PDF completa tarda 2-3 min en extraerse, y cortar a tiempo era
// entregar menos datos. Por eso cada etapa es su propia petición y el panel
// las encadena (y muestra el avance):
//   1. prepararIngesta         identidad + búsqueda de fuentes (~20 s)
//   2. leerFuente/leerDocumento UNA fuente por petición, todas en paralelo;
//      fotosDeIngesta también en paralelo
//   3. buscarFaltantes         fuentes para los datos CLAVE que no salieron;
//      se leen con leerFuente(…, soloKeys). Corre siempre.
//   4. cerrarIngesta           reconciliación, validación y precio → borrador
// runIngestPipeline las encadena en un solo proceso (scripts, sin límite).
// ---------------------------------------------------------------------------

/** Ficha técnica o catálogo que mandó el concesionario (PDF o foto). */
export interface DocumentoConcesionario {
  nombre: string;
  contenido: Contenido;
}

/** Lo que resolvió la etapa 1 y necesitan las demás (viaja por el panel). */
export interface ContextoIngesta {
  brand: string;
  /** Modelo base, como lo indexa la prensa ("Onix"). */
  model: string;
  /** Nombre publicado, con la versión si se pidió ("Onix RS"). */
  modeloPublicado: string;
  year: number;
  country: string;
  type: string;
  vehicleType: string;
  fuelType: string;
  versionObjetivo: string;
  versionPedida: boolean;
  /** Carro, pickup o van/camión: define rangos válidos y datos clave. */
  clase: ClaseVehiculo;
  label: string;
  warningsEs: string[];
}

/** Resultado de leer una fuente: su línea del informe y sus datos crudos. */
export interface FuenteLeida {
  report: VehicleDraft['sourcesReport'][number];
  facts: RawFact[];
}

/** Tope de una extracción: cabe en los 300 s de su petición con margen. */
const TOPE_EXTRACCION_MS = 280_000;

const valoresDe = (facts: Pick<RawFact, 'key' | 'value'>[]) => Object.fromEntries(facts.map(f => [f.key, f.value]));

/** Etapa 1: identidad canónica + fuentes (enlaces del equipo primero, luego la web). */
export async function prepararIngesta(input: {
  brand: string;
  model: string;
  year: number;
  country: string;
  enlaces?: string[];
  /** La que eligió el equipo al subir; sin ella se deduce de la carrocería. */
  clase?: ClaseVehiculo;
}): Promise<{ ctx: ContextoIngesta; fuentes: DiscoveredSource[] }> {
  reiniciarTiempos();
  const warningsEs: string[] = [];
  const identity = await medir('identidad', resolveIdentity(input.brand, input.model, input.year, input.country, input.clase));
  const clase = input.clase ?? claseDeTipo(identity.type);
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
  // La versión supuesta va como pista aparte (extractFromPage), no en la etiqueta:
  // el nombre que supone la IA puede ser de otro mercado.
  const version = identity.trim ? `, versión ${identity.trim}` : '';
  const ctx: ContextoIngesta = {
    brand: identity.brand,
    model: identity.model,
    // En Colombia cada versión se vende como un carro distinto ("Onix RS").
    modeloPublicado: identity.trim ? `${identity.model} ${identity.trim}` : identity.model,
    year: input.year,
    country: input.country,
    type: identity.type,
    vehicleType: identity.vehicleType,
    fuelType: identity.fuelType,
    versionObjetivo,
    versionPedida: !!identity.trim,
    clase,
    // La clase va en la etiqueta: la IA debe saber que "la caja" es el furgón de un camión.
    label: `${identity.brand} ${identity.model} ${input.year}${version} (${clase === 'auto' ? '' : `${claseEnPalabras(clase)}, `}mercado ${input.country})`,
    warningsEs,
  };

  // Enlaces del equipo: tier 1 solo si el dominio es del fabricante en Colombia.
  const enlaces: DiscoveredSource[] = (input.enlaces ?? []).slice(0, 6).map(url => ({
    url,
    tier: tierPorDominio(url, identity.brand),
    nameEs: `Enlace del equipo: ${new URL(url).hostname.replace(/^www\./, '')}`,
  }));

  // Búsqueda web real (solo URLs que salieron en los resultados); si trae muy
  // poco, se completa con las rutas conocidas.
  let candidatas = await medir('búsqueda web de fuentes', buscarFuentes(identity.brand, identity.model, versionObjetivo, input.year)).catch(err => {
    // Sin saldo o con la clave mala no tiene sentido seguir: todo lo demás también fallaría.
    if (esErrorDeCuenta(err)) throw new Error(explicarErrorClaude(err));
    warningsEs.push(`La búsqueda web falló (${explicarErrorClaude(err).slice(0, 120)}); se usaron fuentes conocidas.`);
    return [] as DiscoveredSource[];
  });
  if (candidatas.length < 2) {
    const conocidas = await discoverSources(identity.brand, identity.model, input.year);
    candidatas = [...candidatas, ...conocidas.filter(c => !candidatas.some(x => x.url === c.url))];
  }
  const deLaWeb = candidatas.filter(c => !enlaces.some(e => e.url === c.url)).slice(0, 4);
  const fuentes = [...enlaces, ...deLaWeb];
  if (fuentes.length === 0) warningsEs.push('No se encontraron fuentes candidatas. Revisar el nombre del modelo.');
  return { ctx, fuentes };
}

/**
 * Etapa 2: UNA fuente web. Nunca lanza salvo errores de cuenta (sin saldo,
 * clave mala): una fuente que falla queda en el informe y la ingesta sigue.
 * Con `soloKeys` es la búsqueda dirigida de datos clave que faltaban.
 */
export async function leerFuente(ctx: ContextoIngesta, source: DiscoveredSource, soloKeys?: string[]): Promise<FuenteLeida> {
  const prefijo = soloKeys ? 'Búsqueda de datos que faltaban: ' : '';
  const corte = AbortSignal.timeout(TOPE_EXTRACCION_MS);
  try {
    const r = await procesarFuente(
      source,
      { label: ctx.label, versionObjetivo: ctx.versionObjetivo, versionPedida: ctx.versionPedida, anio: ctx.year, fuelType: ctx.fuelType, corte },
      soloKeys
    );
    return { report: { url: source.url, nameEs: source.nameEs, tier: source.tier, ok: r.ok, note: prefijo + r.note }, facts: r.facts };
  } catch (err) {
    if (esErrorDeCuenta(err) || /sin saldo|no es válida/i.test(String(err))) throw new Error(explicarErrorClaude(err));
    return {
      report: { url: source.url, nameEs: source.nameEs, tier: source.tier, ok: false, note: `${prefijo}falló la lectura (${String(err instanceof Error ? err.message : err).slice(0, 120)})` },
      facts: [],
    };
  }
}

/** Etapa 2 (documentos): una ficha del concesionario, tier 1. */
export async function leerDocumento(ctx: ContextoIngesta, d: DocumentoConcesionario): Promise<FuenteLeida> {
  const url = `concesionario://${d.nombre}`;
  const nameEs = `Concesionario: ${d.nombre.slice(0, 40)}`;
  try {
    const r = await medir(
      `extracción ${url}`,
      extractFromPage(d.contenido, url, 1, ctx.label, ctx.versionObjetivo, undefined, ctx.fuelType, ctx.versionPedida, AbortSignal.timeout(TOPE_EXTRACCION_MS))
    );
    const anioViejo = fuenteViejaDescartable(r, ctx.year);
    const facts = anioViejo ? [] : r.facts;
    return {
      report: {
        url,
        nameEs,
        tier: 1,
        ok: facts.length > 0,
        note: anioViejo
          ? `Es del modelo ${r.anioModeloFuente} y de otra generación: no sirve para el ${ctx.year}, se descartó`
          : facts.length > 0
            ? `${facts.length} datos del documento${r.descartadosPorVersion ? ` · ${r.descartadosPorVersion} de otras versiones descartados` : ''}`
            : 'Se leyó, pero no trae datos de esta versión',
      },
      facts,
    };
  } catch (err) {
    if (esErrorDeCuenta(err) || /sin saldo|no es válida/i.test(String(err))) throw new Error(explicarErrorClaude(err));
    return { report: { url, nameEs, tier: 1, ok: false, note: `No se pudo leer el documento (${String(err instanceof Error ? err.message : err).slice(0, 120)})` }, facts: [] };
  }
}

/** Etapa 2 (fotos): en paralelo con las fuentes; nunca tumba la ingesta. */
export async function fotosDeIngesta(
  ctx: ContextoIngesta,
  fuentes: DiscoveredSource[],
  angulosCubiertos?: Angulo[]
): Promise<{ fotos: FotoDraft[]; avisos: string[] }> {
  const avisos: string[] = [];
  try {
    const fotos = await medir('fotos (total)', () =>
      buscarFotos({ nombre: `${ctx.brand} ${ctx.modeloPublicado} ${ctx.year}`, modelo: ctx.model, fuentes, avisos, cubiertos: angulosCubiertos })
    );
    return { fotos, avisos };
  } catch (err) {
    if (esErrorDeCuenta(err)) throw new Error(explicarErrorClaude(err));
    return { fotos: [], avisos: [...avisos, `No se pudieron buscar fotos: ${explicarErrorClaude(err).slice(0, 120)}`] };
  }
}

/** Etapa 3: páginas nuevas para los datos CLAVE que no salieron (0-100, consumo…). */
export async function buscarFaltantes(
  ctx: ContextoIngesta,
  facts: Pick<RawFact, 'key' | 'value'>[],
  yaLeidas: string[]
): Promise<{ fuentes: DiscoveredSource[]; soloKeys: string[] }> {
  const faltan = clavesFaltantes(ctx.fuelType, valoresDe(facts), [], ctx.clase);
  if (faltan.length === 0) return { fuentes: [], soloKeys: [] };
  const fuentes = await medir('2.ª búsqueda (datos que faltan)', () =>
    buscarFuentesPara(ctx.brand, ctx.model, ctx.versionObjetivo, ctx.year, faltan.map(c => c.etiqueta), yaLeidas)
  ).catch(err => {
    if (esErrorDeCuenta(err)) throw new Error(explicarErrorClaude(err));
    return [] as DiscoveredSource[];
  });
  return { fuentes, soloKeys: faltan.flatMap(c => c.keys) };
}

/**
 * Etapa 4: reconciliación + validación + precio → borrador. `leidas` va en
 * orden de prioridad (documentos → enlaces → web → búsqueda dirigida): a
 * igual tier y año, gana la primera.
 */
export async function cerrarIngesta(
  ctx: ContextoIngesta,
  leidas: FuenteLeida[],
  fotos: { fotos: FotoDraft[]; avisos: string[] } = { fotos: [], avisos: [] }
): Promise<VehicleDraft> {
  const warningsEs = [...ctx.warningsEs];
  const sourcesReport = leidas.map(l => l.report);
  const rawFacts = leidas.flatMap(l => l.facts);
  const identidad = { brand: ctx.brand, model: ctx.model, trim: ctx.versionObjetivo, year: ctx.year, fuelType: ctx.fuelType, type: ctx.type };

  const okSources = sourcesReport.filter(s => s.ok).length;
  if (okSources === 0) {
    warningsEs.push('Ninguna fuente respondió con contenido útil. El borrador está vacío: no publicar.');
  } else if (okSources === 1) {
    warningsEs.push('Solo una fuente respondió: sin reconciliación multi-fuente, revisar con más cuidado.');
  }
  const faltan = clavesFaltantes(ctx.fuelType, valoresDe(rawFacts), [], ctx.clase);
  if (faltan.length > 0) {
    warningsEs.push(
      `Faltan ${faltan.length} datos clave (${faltan.map(c => c.etiqueta).join(', ')}): complétalos en la revisión o márcalos como "no existe".`
    );
  }

  // Reconciliación + validación
  const allFacts = reconcile(rawFacts, ctx.clase);
  const aniosViejos = Array.from(new Set(rawFacts.map(f => f.anioFuente ?? 0).filter(a => a > 1990 && a < ctx.year - 1))).sort();
  if (aniosViejos.length > 0) {
    warningsEs.push(`Algunas fuentes son del modelo ${aniosViejos.join(', ')} (misma generación): si el carro se renovó, revisa que los datos sigan vigentes.`);
  }
  const conflicted = allFacts.filter(f => f.conflict).length;
  if (conflicted > 0) warningsEs.push(`${conflicted} campos tienen fuentes en desacuerdo (marcados en la revisión).`);
  const impossible = allFacts.filter(f => f.outOfRange).length;
  if (impossible > 0) warningsEs.push(`${impossible} campos quedaron fuera del rango físico esperado (desmarcados por defecto).`);

  // Precio (con verificación contra el catálogo real)
  const { price: precioCrudo, remainingFacts } = await medir('precio', resolvePrice(allFacts, identidad));
  let price = precioCrudo;
  let comparablesPrecio: { etiqueta: string; precio: number }[] = [];
  if (precioCrudo) {
    const revision = await medir('verificar precio', () => verificarPrecio(precioCrudo, identidad));
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

  warningsEs.push(...fotos.avisos);
  if (price?.estimated) {
    warningsEs.push('El precio es una ESTIMACIÓN. Verificar contra el concesionario antes de publicar.');
  } else if (!price) {
    warningsEs.push('Sin precio: ni encontrado ni estimable. Hay que ponerlo a mano.');
  }

  return {
    brand: ctx.brand,
    model: ctx.modeloPublicado,
    year: ctx.year,
    country: ctx.country,
    type: ctx.type,
    vehicleType: ctx.vehicleType,
    fuelType: ctx.fuelType,
    price,
    priceComparables: comparablesPrecio,
    facts: remainingFacts,
    sourcesReport,
    fotos: fotos.fotos,
    warningsEs,
  };
}

/** Las 4 etapas en un solo proceso (scripts de carga; sin límite de tiempo). */
export async function runIngestPipeline(input: {
  brand: string;
  model: string;
  year: number;
  country: string;
  /** Documentos del concesionario: la fuente principal; la web solo complementa. */
  documentos?: DocumentoConcesionario[];
  /** Enlaces que eligió el equipo (página oficial, ficha en PDF…). */
  enlaces?: string[];
  /** Vistas que ya tienen foto del concesionario: la IA solo busca las demás. */
  angulosCubiertos?: Angulo[];
  /** Carro, pickup o van/camión (sin ella se deduce de la carrocería). */
  clase?: ClaseVehiculo;
}): Promise<VehicleDraft> {
  const { ctx, fuentes } = await prepararIngesta(input);
  const fotosP = fotosDeIngesta(ctx, fuentes, input.angulosCubiertos);
  const leidas = await Promise.all([
    ...(input.documentos ?? []).slice(0, 6).map(d => leerDocumento(ctx, d)),
    ...fuentes.map(f => leerFuente(ctx, f)),
  ]);
  const { fuentes: extra, soloKeys } = await buscarFaltantes(ctx, leidas.flatMap(l => l.facts), fuentes.map(f => f.url));
  const extras = await Promise.all(extra.map(f => leerFuente(ctx, f, soloKeys)));
  return cerrarIngesta(ctx, [...leidas, ...extras], await fotosP);
}
