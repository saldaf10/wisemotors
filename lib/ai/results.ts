// ============================================================================
// Resultados del buscador.
//
// La IA SIEMPRE entiende la búsqueda (categorization.ts). Después:
//   - OBJETIVA ("con turbo", "Toyota diésel 2026"): no hay nada que opinar.
//     Se muestran TODOS los que cumplen, del más barato al más caro, sin podio
//     y sin gastar IA en ordenar.
//   - SUBJETIVA ("para la familia, que no gaste") o HÍBRIDA ("una SUV que no
//     gaste"): filtros duros → orden determinístico con datos reales → la IA
//     afina el orden, lo explica y escoge qué preguntarle al comprador.
//
// Cada carro viaja con `afinar` (precio, combustible, carrocería, caja y
// puntajes de prioridad): el cliente filtra con las preguntas al instante, sin
// volver a la IA (gratis y sin espera).
// ============================================================================

import { urlImagen } from '@/lib/data/imagen';
import { prisma } from '@/lib/prisma';
import { CategorizedIntent, QueryType } from './categorization';
import { rerankWithLLM } from './rerank';
import { ScoredCandidate, scoreCandidates } from './scoring';
import { computeVehicleFeatures, getMarketStats, generateVehicleTags, type VehicleFeatures } from './features';
import { scoreDeterministically } from './deterministic';
import { caja, cumpleEquipamiento, DIMENSIONES, ruedasMotrices, type DatosAfinar, type Dimension, type Prioridad } from './filtros';

export interface ProcessedResults {
  query_type: QueryType;
  total_matches: number;

  /** Podio de la IA (solo subjetiva / híbrida). */
  top_recommendations?: {
    vehicles: any[];
    explanation: string;
  };

  /** El resto (o, en la objetiva, todos los que cumplen). */
  all_matches?: {
    vehicles: any[];
    filters_applied: string[];
  };

  /** Preguntas para afinar, en el orden en que conviene hacerlas. */
  preguntas: Dimension[];

  processing_time_ms: number;
  confidence: number;
  original_query: string;
  /** Aviso honesto para el comprador (p. ej. una marca que no tenemos). */
  aviso?: string;
}

export async function processResults(intent: CategorizedIntent): Promise<ProcessedResults> {
  const faltan = intent.missing_brands ?? [];
  if (faltan.length === 0) return procesar(intent);
  // Marca que no tenemos: se dice una vez, arriba, y se muestran los más cercanos
  // (la búsqueda pasa a ser subjetiva: "algo como un Ferrari").
  const nombres = faltan.join(' ni ');
  const r = await procesar({
    ...intent,
    query_type: intent.query_type === QueryType.OBJECTIVE_FEATURE ? QueryType.SUBJECTIVE_PREFERENCE : intent.query_type,
    subjective_context:
      `${intent.subjective_context ?? ''} (pidió ${nombres}, que no tenemos: recomienda lo más parecido en espíritu, sin repetir que no es ${nombres})`.trim(),
  });
  return { ...r, aviso: `Todavía no tenemos ${nombres} en el catálogo. Estos son los más cercanos a lo que buscas.` };
}

// ---------------------------------------------------------------------------

type Vehiculo = Awaited<ReturnType<typeof traer>>[number];

async function traer(intent: CategorizedIntent) {
  const vehiculos = await prisma.vehicle.findMany({
    where: whereDeFiltros(intent),
    include: { images: { take: 1, select: { url: true } } },
    orderBy: { price: 'asc' },
    take: 500,
  });
  // Equipamiento: contra el dato real de cada ficha (ver filtros.ts).
  const pedidos = intent.objective_filters?.features ?? [];
  return vehiculos.filter(v => pedidos.every(p => cumpleEquipamiento(v, p).cumple));
}

function candidato(v: Vehiculo, contexto: Awaited<ReturnType<typeof getMarketStats>>): ScoredCandidate {
  return {
    id: v.id,
    brand: v.brand,
    model: v.model,
    year: v.year,
    price: v.price,
    fuelType: v.fuelType,
    type: v.type,
    vehicleType: v.vehicleType || '',
    imageUrl: urlImagen(v.id, v.images?.[0]?.url),
    score: 0,
    features: computeVehicleFeatures(v, contexto),
    tags: generateVehicleTags(v),
    specifications: v.specifications,
    familia: v.familia,
  };
}

// Pesos de cada respuesta a "¿qué te importa más?" (claves reales de VehicleFeatures).
const PESOS_PRIORIDAD: Record<Prioridad, Partial<Record<keyof VehicleFeatures, number>>> = {
  comodidad: { comfort_norm: 1, space_norm: 0.4 },
  economia: { quality_price_ratio_norm: 1, efficiency_norm: 1 },
  seguridad: { safety_norm: 1 },
  espacio: { space_norm: 1 },
  desempeno: { power_to_weight_norm: 1, acceleration_norm: 1 },
};

/** Datos para las preguntas, con los puntajes de prioridad calculados DENTRO de estos resultados. */
function datosAfinar(cands: ScoredCandidate[]): Map<string, DatosAfinar> {
  const puntajes = Object.fromEntries(
    (Object.keys(PESOS_PRIORIDAD) as Prioridad[]).map(p => [
      p,
      scoreDeterministically(cands, { weights: PESOS_PRIORIDAD[p], activeProfiles: [], labelsEs: [] }),
    ])
  ) as unknown as Record<Prioridad, Map<string, { score: number }>>;
  return new Map(
    cands.map(c => [
      c.id,
      {
        precio: c.price,
        combustible: c.fuelType,
        carroceria: c.type,
        caja: caja(c),
        traccion: ruedasMotrices(c),
        prioridades: Object.fromEntries(
          (Object.keys(puntajes) as Prioridad[]).map(p => [p, puntajes[p].get(c.id)?.score ?? 50])
        ) as Record<Prioridad, number>,
      },
    ])
  );
}

/** Quita las preguntas que el comprador ya respondió al buscar. */
function preguntasUtiles(orden: Dimension[] | null, intent: CategorizedIntent): Dimension[] {
  const f = intent.objective_filters ?? {};
  const pedidos = (f.features ?? []).join(' ').toLowerCase();
  const yaDicho: Partial<Record<Dimension, boolean>> = {
    presupuesto: !!(f.price_range?.min || f.price_range?.max),
    combustible: !!f.fuel_types?.length,
    carroceria: !!f.body_types?.length,
    caja: /autom|manual|mec[aá]nic/.test(pedidos),
    traccion: /4x4|4wd|awd|tracci/.test(pedidos),
  };
  // Primero las que escogió la IA, en su orden; después las demás (una pregunta
  // que la IA no priorizó igual puede servir si la lista sigue larga).
  const base = [...(orden ?? []), ...DIMENSIONES.filter(d => !orden?.includes(d))];
  return base.filter(d => !yaDicho[d]);
}

async function procesar(intent: CategorizedIntent): Promise<ProcessedResults> {
  const inicio = Date.now();
  const [vehiculos, contexto] = await Promise.all([traer(intent), getMarketStats()]);
  const cands = vehiculos.map(v => candidato(v, contexto));
  const afinar = datosAfinar(cands);
  const filtros = Object.keys(whereDeFiltros(intent)).concat(intent.objective_filters?.features?.length ? ['equipamiento'] : []);

  const base = {
    total_matches: cands.length,
    processing_time_ms: 0,
    confidence: intent.confidence,
    original_query: intent.original_query,
  };

  // ── OBJETIVA: todos los que cumplen, sin podio ni IA para ordenar ─────────
  if (intent.query_type === QueryType.OBJECTIVE_FEATURE) {
    const pedidos = intent.objective_filters?.features ?? [];
    const lista = cands.map(c => ({
      ...plano(c),
      reasons: pedidos.map(p => cumpleEquipamiento(c, p).razon),
      afinar: afinar.get(c.id),
    }));
    return {
      ...base,
      query_type: QueryType.OBJECTIVE_FEATURE,
      all_matches: { vehicles: lista, filters_applied: filtros },
      preguntas: preguntasUtiles(null, intent).filter(d => d !== 'prioridad'),
      processing_time_ms: Date.now() - inicio,
    };
  }

  // ── SUBJETIVA / HÍBRIDA: orden con datos reales, la IA afina y explica ────
  const contextoTexto = intent.subjective_context || intent.original_query;
  let ordenados: any[] = [];
  let preguntasIA: Dimension[] | null = null;
  if (cands.length > 0) {
    const { ranked } = scoreCandidates(cands, `${intent.original_query} ${intent.subjective_context ?? ''}`);
    const { recs, preguntas } = await rerankWithLLM(ranked, contextoTexto, intent.original_query);
    preguntasIA = preguntas;
    const vistos = new Set(recs.map(r => r.vehicle.id));
    ordenados = [
      ...recs.map(r => ({ ...plano(r.vehicle), matchPercentage: r.match, reasons: r.reasons, afinar: afinar.get(r.vehicle.id) })),
      // Los que la IA no alcanzó a ver siguen en la lista (en su orden base): afinar los puede subir.
      ...ranked.filter(c => !vistos.has(c.id)).map(c => ({ ...plano(c), reasons: [], afinar: afinar.get(c.id) })),
    ];
  }

  return {
    ...base,
    query_type: intent.query_type,
    top_recommendations: {
      vehicles: ordenados.slice(0, 3),
      explanation: `Recomendaciones basadas en: "${contextoTexto}"`,
    },
    all_matches: { vehicles: ordenados.slice(3), filters_applied: filtros },
    preguntas: preguntasUtiles(preguntasIA, intent),
    processing_time_ms: Date.now() - inicio,
  };
}

function plano(c: { id: string; brand: string; model: string; familia?: string | null; year: number; price: number; fuelType: string; type: string; imageUrl: string | null }) {
  return {
    id: c.id,
    brand: c.brand,
    model: c.model,
    // El cliente agrupa las versiones del mismo carro: muestra la mejor y ofrece las otras.
    familia: c.familia ?? null,
    year: c.year,
    price: c.price,
    fuelType: c.fuelType,
    type: c.type,
    imageUrl: c.imageUrl,
  };
}

// Filtros que son columnas de la tabla. El equipamiento se filtra aparte, contra
// la ficha (filtros.ts). Puertas y puestos no tienen columna: no se filtran aquí.
function whereDeFiltros(intent: CategorizedIntent): any {
  const where: any = {};
  const f = intent.objective_filters;
  if (!f) return where;

  if (f.brands?.length) where.brand = { in: f.brands };
  if (f.body_types?.length) where.type = { in: f.body_types };
  if (f.fuel_types?.length) where.fuelType = { in: f.fuel_types };

  if (f.year_range) {
    const { min, max } = f.year_range;
    if (min && max && min === max) where.year = { equals: min };
    else {
      if (min) where.year = { ...where.year, gte: min };
      if (max) where.year = { ...where.year, lte: max };
    }
  }

  if (f.price_range) {
    const { min, max } = f.price_range;
    if (min) where.price = { ...where.price, gte: min };
    if (max) where.price = { ...where.price, lte: max };
  }
  return where;
}
