// ============================================================================
// Extracción estructurada CONTRA EL REGISTRO (plan §5.1, paso 3).
//
// El LLM no inventa campos: recibe el catálogo de keys válidas del registro
// de atributos y solo puede devolver esas, cada una con su cita textual.
// Un valor sin cita se descarta.
// ============================================================================

import { ATTRIBUTE_REGISTRY, attributeAppliesTo } from '@/lib/attributes/registry';
import { z } from 'zod/v4';
import { pedirJson } from '@/lib/ai/claude';
import type { RawFact, SourceTier } from './types';
import type { Contenido } from './buscar-fuentes';
import { denserWindow, MAX_TEXT_CHARS } from './fetcher';

// Solo atributos que se publican en Colombia y con keys válidas
// (los WiseMetrics son criterio editorial de la casa: ninguna página los trae)
const EXTRACTABLE = ATTRIBUTE_REGISTRY.filter(d => d.coAvailability !== 'never_published' && d.dimension !== 'editorial');
const VALID_KEYS = new Set(EXTRACTABLE.map(d => d.key));

const ExtraccionSchema = z.object({
  facts: z
    .array(
      z.object({
        key: z.string().describe('Key EXACTA del catálogo de atributos proporcionado'),
        value: z
          .union([z.number(), z.string(), z.boolean()])
          .describe('Número puro para numéricos (sin unidad), true para booleanos presentes, string para texto/enum'),
        quote: z.string().describe('Cita textual CORTA (máx 100 caracteres) del fragmento del texto que respalda el valor'),
        aplicaA: z
          .enum(['version_objetivo', 'todas_las_versiones', 'otra_version', 'no_especifica'])
          .describe(
            'A qué versión se refiere el dato según el texto: version_objetivo (el texto lo atribuye a la versión pedida, o la página/documento entero trata SOLO de esa versión), todas_las_versiones (el texto dice que es de serie en toda la gama), otra_version (el texto lo atribuye a otra versión), no_especifica (no queda claro).'
          ),
        vigencia: z.string().describe('Fecha o vigencia que el texto asocia al dato (sobre todo precios), ej. "octubre de 2025". Cadena vacía si no dice.'),
      })
    )
    .describe('Especificaciones encontradas en el texto, solo keys del catálogo'),
  anioModeloFuente: z
    .number()
    .describe('Año modelo del que habla el texto/documento (ej. 2026). 0 si no se puede saber.'),
  mismaGeneracion: z
    .boolean()
    .describe('true si el texto habla de la MISMA generación del vehículo objetivo (aunque el año modelo sea otro: un Blazer 2019 y uno 2026 de la misma generación cuentan). El año del objetivo suele ser el "modelo vigente" supuesto, no un carro nuevo: si la fuente es del mismo modelo y no sabes de una generación más nueva, es la misma. false solo si es otra generación (sabes que hubo un cambio de generación entre medio), otro modelo u otro mercado.'),
  otrasVersiones: z
    .array(z.string())
    .describe('Nombres de las OTRAS versiones de este modelo que aparecen en el texto (ej. "LT", "LTZ", "Premier"), sin la versión objetivo. Vacío si no hay.'),
});

/** Atributos que el extractor puede reportar: los del registro que aplican al tren motriz (si se conoce). */
function extraibles(fuelType?: string) {
  return fuelType ? EXTRACTABLE.filter(d => attributeAppliesTo(d, fuelType)) : EXTRACTABLE;
}

function buildCatalog(soloKeys?: string[], fuelType?: string): string {
  // Catálogo compacto: key | etiqueta | unidad esperada | tipo
  return extraibles(fuelType).filter(d => !soloKeys || soloKeys.includes(d.key))
    .map(d => `${d.key} | ${d.labelEs}${d.unit ? ` (${d.unit})` : ''} | ${d.opciones ? `uno de: ${d.opciones.join(' / ')}` : d.dataType}`)
    .join('\n');
}

const SYSTEM_PROMPT = `Eres un extractor de especificaciones de vehículos para el mercado colombiano.

REGLAS ABSOLUTAS:
1. Solo reportas datos que estén EXPLÍCITOS en el texto. Nada de conocimiento propio, nada de estimaciones.
2. Solo usas keys del catálogo. Si un dato del texto no corresponde a ninguna key, lo ignoras.
3. Números en la unidad del catálogo: convierte si el texto usa otra (kW→HP: ×1.341; kgf·m→Nm: ×9.807; km/L→km/gal: ×3.785; L/100km→km/gal: 378.5÷valor; m→mm: ×1000; litros de cilindrada→cc: ×1000). La conversión de unidades mal hecha es la fuente #1 de basura en datos automotores — verifica cada una.
4. Cada valor lleva su cita textual. Sin cita, no reportes el dato.
5. VERSIONES — la regla más importante: cada versión (LT, LTZ, RS, Premier…) es un carro distinto. Un dato de otra versión JAMÁS se atribuye a la versión objetivo, aunque sea "parecido" o "probablemente igual". Si el texto dice "el Onix LT trae cámara de reversa" y el objetivo es el Onix RS, ese dato NO existe para el RS. Solo vale: lo que el texto atribuye a la versión objetivo, lo que dice que es de serie en TODAS las versiones, o lo que está en una página/ficha dedicada exclusivamente a la versión objetivo. Si no hay versión objetivo, el objetivo es la versión de entrada (base). Marca siempre 'aplicaA' con honestidad.
5b. TREN MOTRIZ: el vehículo objetivo tiene el tren motriz indicado en el encabezado. Los datos del motor, consumo o batería de OTRO tren motriz (la versión gasolina de un modelo que también es híbrido, la eléctrica, etc.) no se reportan, aunque estén en la misma página.
6. Precios en COP: repórtalos SOLO en la key 'commercial.priceCop' si el texto trae el precio en Colombia de EXACTAMENTE la versión objetivo (con su caja si el texto distingue). Un "desde $X" de la gama, un precio de otra versión, en USD o de otro país NO se reporta. Anota en 'vigencia' la fecha que dé el texto para ese precio.
7. Anota en 'anioModeloFuente' el año modelo del que habla la página o el documento (si lo dice, aunque sea en el título o el nombre del archivo). Año modelo: la prensa y los fabricantes suelen hablar del año anterior o siguiente de la MISMA generación (un Onix 2026 y un 2027 son el mismo carro). Eso cuenta como el vehículo objetivo. Solo si es otra generación, otro modelo u otro mercado, no reportes nada.
8. Que el texto NO mencione algo NO significa que el carro no lo tenga. Si no encuentras un dato, OMITE la key. Jamás reportes false ni 0 para decir "no aparece": eso afirma que el carro carece del equipamiento, que es una mentira distinta a no saberlo.`;

/** Texto comparable para verificar citas: sin tildes, espacios ni puntuación. */
const plano = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * ¿La cita aparece en el texto? Se compara sin espacios ni puntuación y basta
 * con un tramo largo de la cita (el modelo a veces recorta los bordes).
 */
function citaEnTexto(cita: string, textoPlano: string) {
  const c = plano(cita);
  if (c.length < 4) return false;
  if (textoPlano.includes(c)) return true;
  const tramo = Math.max(12, Math.floor(c.length * 0.6));
  for (let i = 0; i + tramo <= c.length; i += 4) if (textoPlano.includes(c.slice(i, i + tramo))) return true;
  return false;
}

// Factores de conversión que el extractor tiene permitido aplicar (ver regla 3 del prompt).
const FACTORES = [1, 1.341, 1 / 1.341, 0.9863, 1 / 0.9863, 9.807, 1 / 9.807, 3.785, 1 / 3.785, 1000, 0.001, 10, 0.1, 1.609, 1 / 1.609];

/** Números que aparecen en un texto, leídos como se escriben en Colombia y en inglés. */
function numerosEn(texto: string): number[] {
  const out: number[] = [];
  for (const m of texto.match(/\d+(?:[.,]\d+)*/g) ?? []) {
    const a = parseFloat(m.replace(/\./g, '').replace(',', '.'));
    const b = parseFloat(m.replace(/,/g, ''));
    for (const n of [a, b, parseFloat(m.replace(',', '.'))]) if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

/**
 * ¿La cita respalda el número? Debe contener la cifra (o la cifra original antes
 * de una conversión de unidad permitida). Una cita sin ningún dígito no se
 * puede contrastar ("cinco airbags") y se acepta.
 */
export function citaRespaldaValor(valor: number, cita: string): boolean {
  const nums = numerosEn(cita);
  if (nums.length === 0) return true;
  const cerca = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.015);
  return nums.some(n => FACTORES.some(f => cerca(n * f, valor)) || cerca(378.5 / n, valor));
}

/** ¿El texto menciona este nombre de versión como palabra suelta? */
function menciona(texto: string, nombre: string) {
  const n = nombre.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!n) return false;
  return new RegExp(`(^|[^a-z0-9áéíóúñ])${n}([^a-z0-9áéíóúñ]|$)`, 'i').test(texto);
}

/**
 * Lleva un valor de enum a una de sus opciones. Las páginas escriben la
 * tracción de mil formas ("4WD", "AWD", "tracción total", "4x2"): se entienden
 * aquí, en código, y lo que no encaje se descarta en vez de guardarse a medias.
 */
export function normalizarOpcion(key: string, valor: string, opciones: string[]): string | null {
  const v = plano(valor);
  const directa = opciones.find(o => plano(o) === v);
  if (directa) return directa;
  if (key === 'drivetrain.traction') {
    if (/4x4|4wd|reductora/.test(v)) return '4x4';
    if (/awd|integral|total|4motion|allwheel|xdrive|quattro|efour|todaslasruedas/.test(v)) return 'Integral (AWD)';
    if (/rwd|trasera|propulsion|posterior/.test(v)) return 'Trasera';
    if (/fwd|delantera|4x2|traccionanterior|frontal/.test(v)) return 'Delantera';
    return null;
  }
  if (key.endsWith('.inductionType')) {
    const turbo = /turbo|tsi|tfsi|ecoboost|tgdi|tce/.test(v);
    const super_ = /supercarg|compresor|supercharg/.test(v);
    if (turbo && super_) return 'Turbo y supercargado';
    if (turbo) return 'Turbo';
    if (super_) return 'Supercargado';
    if (/atmosf|aspiradonatural|aspiracionnatural|naturalmenteaspirado|natural/.test(v)) return 'Atmosférico';
    return null;
  }
  // Coincidencia parcial: "Frenos de tambor" → "Tambor"; "Latin NCAP 2024" → "Latin NCAP".
  const parcial = opciones.filter(o => v.includes(plano(o)) || plano(o).includes(v));
  return parcial.length === 1 ? parcial[0] : null;
}

export interface ResultadoExtraccion {
  facts: RawFact[];
  /** Datos descartados por ser de otra versión (o sin versión clara), para contarlo en la revisión. */
  descartadosPorVersion: number;
  /** Año modelo del que habla la fuente (0 = no se sabe). */
  anioModeloFuente: number;
  /** La fuente es de la misma generación del objetivo (aunque el año sea otro). */
  mismaGeneracion: boolean;
}

/**
 * ¿La fuente es demasiado vieja? Solo si es de más de un año modelo atrás Y de
 * otra generación. Un modelo que no se renueva cada año (el Blazer RS se vende
 * con la misma generación desde 2019) tiene fichas con años viejos que siguen
 * siendo el carro que se vende hoy.
 */
export function fuenteViejaDescartable(r: Pick<ResultadoExtraccion, 'anioModeloFuente' | 'mismaGeneracion'>, anioObjetivo: number) {
  return r.anioModeloFuente > 1990 && r.anioModeloFuente < anioObjetivo - 1 && !r.mismaGeneracion;
}

// Palabras que describen carrocería o caja, no la versión: "Premier Sedán" es la versión "Premier".
const GENERICAS = new Set(['sedan', 'sedán', 'hatchback', 'hb', 'automatico', 'automático', 'manual', 'mt', 'at', 'cvt', 'aut', 'mec', 'mecánico', 'mecanico', 'turbo', 'plus', 'version', 'versión', 'de', 'la', 'el']);

/** Palabras que identifican a las otras versiones, sin las genéricas ni las de la versión pedida o el modelo. */
function marcasDeOtras(otras: string[], version: string, modelo: string) {
  const propias = new Set(`${version} ${modelo}`.toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(Boolean));
  const tokens = new Set<string>();
  for (const o of otras) {
    for (const t of o.toLowerCase().split(/[^a-z0-9áéíóúñ]+/)) {
      if (t.length >= 2 && !GENERICAS.has(t) && !propias.has(t)) tokens.add(t);
    }
  }
  return Array.from(tokens);
}

export async function extractFromPage(
  contenido: string | Contenido,
  sourceUrl: string,
  tier: SourceTier,
  vehicleLabel: string,
  /** Versión pedida ("RS"). Vacía = versión de entrada. */
  version = '',
  /** Solo buscar estas keys (búsqueda dirigida de campos clave que faltan). */
  soloKeys?: string[],
  /** Tren motriz del vehículo: filtra el catálogo y descarta lo que no le aplica. */
  fuelType?: string,
  /** false = la persona no pidió versión y `version` es solo la de entrada que
   *  supuso la IA (puede ser de otro mercado: "LT" en un Blazer que en Colombia
   *  solo existe como RS). Entonces es una pista, no una regla. */
  versionPedida = true
): Promise<ResultadoExtraccion> {
  const c: Contenido = typeof contenido === 'string' ? { texto: contenido } : contenido;
  // Documentos (PDF o imagen): no hay texto contra el cual verificar la cita;
  // son fichas del fabricante o del concesionario.
  const esPdf = 'pdfBase64' in c;
  const esImagen = 'imagenBase64' in c;
  const esDocumento = esPdf || esImagen;
  const notaVersion =
    version && !versionPedida
      ? `\nVERSIÓN OBJETIVO: la de ENTRADA (la más barata) que se vende en Colombia. Se SUPONE que se llama "${version}", pero ese nombre puede ser de otro mercado y no existir aquí. Por eso: si ${esDocumento ? 'el documento' : 'el texto'} habla de UNA sola versión (aunque no se llame "${version}"), ESA es la versión objetivo: reporta sus datos con aplicaA = version_objetivo y no la pongas en 'otrasVersiones'. Si habla de varias y ninguna es "${version}", la objetivo es la más barata de ellas.`
      : '';
  const encabezado = `VEHÍCULO OBJETIVO: ${vehicleLabel}${fuelType ? `\nTREN MOTRIZ DEL OBJETIVO: ${fuelType}` : ''}${notaVersion}

CATÁLOGO DE ATRIBUTOS (key | etiqueta | tipo):
${buildCatalog(soloKeys, fuelType)}
`;
  const cierre = `Extrae las especificaciones del vehículo objetivo presentes en ${esDocumento ? 'el documento' : 'el texto'}. Si habla de otro vehículo, no reportes nada.`;

  let parsed: z.infer<typeof ExtraccionSchema>;
  try {
    parsed = await pedirJson({
      schema: ExtraccionSchema,
      system: SYSTEM_PROMPT,
      // Una ficha técnica completa (PDF oficial) trae 100+ datos con su cita:
      // con 8000 la respuesta se cortaba y se perdía la mejor fuente entera.
      maxTokens: 24000,
      prompt: esDocumento
        ? [
            'pdfBase64' in c
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: c.pdfBase64 } }
              : { type: 'image', source: { type: 'base64', media_type: (c as any).mediaType, data: (c as any).imagenBase64 } },
            { type: 'text', text: `${encabezado}\nEl documento adjunto es ${sourceUrl}.\n\n${cierre}` },
          ]
        : `${encabezado}\nTEXTO DE LA PÁGINA (${sourceUrl}):\n"""\n${c.texto.length <= MAX_TEXT_CHARS ? c.texto : denserWindow(c.texto, MAX_TEXT_CHARS)}\n"""\n\n${cierre}`,
    });
  } catch (err) {
    throw new Error(`Claude falló extrayendo de ${sourceUrl}: ${err instanceof Error ? err.message : err}`);
  }

  const anioModeloFuente = Math.round(parsed.anioModeloFuente || 0);
  const textoPlano = esDocumento ? null : plano((c as { texto: string }).texto);
  const facts: RawFact[] = [];
  let descartadosPorVersion = 0;
  // Palabras que delatan otra versión ("Premier", "LTZ"…), comparadas palabra por palabra:
  // la IA puede decir "Premier Sedán" y la cita solo "el Premier".
  const modelo = vehicleLabel.split(' ').slice(1, 3).join(' ');
  // Versión supuesta (no pedida) que no aparece en el texto y una sola versión
  // nombrada: la suposición era de otro mercado ("LT" en un Blazer que en
  // Colombia solo es RS). Esa única versión es la de entrada aquí.
  const textoCrudo = esDocumento ? '' : (c as { texto: string }).texto;
  const unicaVersion =
    !versionPedida && !esDocumento && version && !menciona(textoCrudo, version) && (parsed.otrasVersiones ?? []).length === 1;
  const otras = unicaVersion ? [] : marcasDeOtras(parsed.otrasVersiones ?? [], version, modelo);
  for (const f of parsed.facts ?? []) {
    // El LLM no inventa campos: keys fuera del registro mueren aquí.
    if (!VALID_KEYS.has(f.key)) continue;
    if (soloKeys && !soloKeys.includes(f.key)) continue;
    // Un dato de otro tren motriz (combustion.* en un híbrido) no es de este carro.
    if (fuelType && !extraibles(fuelType).some(d => d.key === f.key)) continue;

    // Regla de versiones, verificada en código y no solo pedida al modelo:
    //  - lo que el modelo marcó como de otra versión, fuera;
    //  - con versión pedida, lo que no quedó claro también fuera;
    //  - el precio solo si es explícitamente de la versión objetivo;
    //  - si la cita nombra otra versión y no la pedida, fuera aunque el modelo la haya aceptado.
    const esPrecio = f.key === 'commercial.priceCop';
    const citaNombraOtra = otras.some(o => menciona(f.quote, o)) && !(version && menciona(f.quote, version));
    if (
      (f.aplicaA === 'otra_version' && !unicaVersion) ||
      (version && f.aplicaA === 'no_especifica' && !unicaVersion) ||
      (esPrecio && f.aplicaA !== 'version_objetivo') ||
      citaNombraOtra
    ) {
      descartadosPorVersion++;
      continue;
    }
    if (f.value === null || f.value === undefined || f.value === '') continue;
    if (typeof f.quote !== 'string' || f.quote.trim() === '') continue;
    // La cita tiene que estar en la página: una cita que no aparece es un dato inventado.
    // (En PDF no hay texto para comparar; son fichas oficiales del fabricante.)
    if (textoPlano !== null && !citaEnTexto(f.quote, textoPlano)) continue;

    const def = EXTRACTABLE.find(d => d.key === f.key)!;
    let value: number | string | boolean = f.value;

    if (def.dataType === 'numeric') {
      const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
      if (!Number.isFinite(n)) continue;
      // Un 0 casi nunca es un dato leído: es el modelo rellenando el catálogo
      // cuando la página no traía especificaciones. Un carro con 0 airbags o
      // 0 estrellas NCAP es una afirmación grave, y ninguna ficha real la hace.
      if (n === 0) continue;
      // La cita tiene que traer la cifra: citar una línea real con otro número no vale.
      if (!citaRespaldaValor(n, f.quote)) continue;
      value = n;
    } else if (def.dataType === 'boolean') {
      // Mismo criterio: "no lo encontré" NO es "no lo tiene". La ausencia se
      // representa con el hecho inexistente (eso es lo que mide la cobertura);
      // publicar `false` la convierte en una negación que nadie verificó.
      if (value !== true && value !== 'true' && value !== 'Sí' && value !== 'si') continue;
      value = true;
    } else if (def.opciones) {
      const opcion = normalizarOpcion(def.key, String(value), def.opciones);
      if (!opcion) continue;
      value = opcion;
    } else {
      value = String(value).slice(0, 200);
    }

    facts.push({ key: f.key, value, quote: f.quote.slice(0, 160), sourceUrl, tier, vigencia: f.vigencia?.trim() || undefined, anioFuente: anioModeloFuente });
  }

  return { facts, descartadosPorVersion, anioModeloFuente, mismaGeneracion: parsed.mismaGeneracion !== false };
}

/** Resolución de identidad canónica (plan §5.1, paso 1): una sola llamada. */
export async function resolveIdentity(
  brand: string,
  model: string,
  year: number,
  country: string
): Promise<{ brand: string; model: string; trim: string; versionEntrada: string; type: string; vehicleType: string; fuelType: string }> {
  const IdentidadSchema = z.object({
    brand: z.string().describe('Marca con capitalización oficial (ej. "Toyota", "BYD")'),
    model: z.string().describe('Modelo canónico SIN marca, año ni versión (ej. "Corolla Cross", "Onix")'),
    trim: z
      .string()
      .describe('Versión/línea que el usuario pidió (ej. "RS", "XEI", "Premier"), con su nombre comercial en el país. Cadena vacía si no pidió ninguna. No inventes una.'),
    versionEntrada: z
      .string()
      .describe('Nombre comercial de la versión de ENTRADA (la más barata) de este modelo en ese país, ej. "Prime", "LT", "Zen". Cadena vacía si no la conoces con seguridad.'),
    type: z.enum(['Sedán', 'SUV', 'Pickup', 'Deportivo', 'Wagon', 'Hatchback', 'Convertible']),
    vehicleType: z.enum(['Automóvil', 'Deportivo', 'Todoterreno', 'Lujo', 'Económico']),
    fuelType: z
      .enum(['Gasolina', 'Diesel', 'Eléctrico', 'Híbrido', 'Híbrido Enchufable'])
      .describe('Tren motriz de la versión pedida; si no se pidió versión, el de la MÁS VENDIDA en el país'),
  });

  const args = await pedirJson({
    schema: IdentidadSchema,
    maxTokens: 4000,
    prompt: `Vehículo: ${brand ? `${brand} ` : ''}${model} ${year}, mercado ${country}. Normaliza su identidad.${brand ? '' : ' La marca no vino: dedúcela del modelo.'} Si el modelo tiene un nombre comercial distinto en ese mercado, usa el del mercado. Separa la versión del modelo: "Onix RS" es modelo "Onix", versión "RS".`,
  });

  return {
    brand: args.brand || brand,
    model: args.model || model,
    trim: args.trim.trim(),
    versionEntrada: args.versionEntrada.trim(),
    type: args.type || 'Sedán',
    vehicleType: args.vehicleType || 'Automóvil',
    fuelType: args.fuelType || 'Gasolina',
  };
}
