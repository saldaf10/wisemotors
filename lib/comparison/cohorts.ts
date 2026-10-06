// ============================================================================
// MOTOR DE COHORTES — la respuesta al "problema del Bugatti".
//
// Nunca se compara contra el catálogo completo. Se compara contra la cohorte:
//   cohorte = f(segmento de carrocería, banda de precio, tren motriz)
// con RELAJACIÓN PROGRESIVA si quedan menos de MIN_COHORT_SIZE miembros,
// y cada relajación se registra para poder decírselo al usuario:
//   "Comparado contra 14 SUV compactas de $115–170M"
//
// Los puntajes son PERCENTILES dentro de la cohorte (winsorizados p5/p95),
// no min-max global: un outlier no aplasta la escala, y el techo es lo que
// realmente se vende en Colombia — no un Bugatti que aquí no existe.
// ============================================================================

import { prisma } from '@/lib/prisma';

export const MIN_COHORT_SIZE = 8;

// Trenes motrices afines para relajación (paso 2)
const POWERTRAIN_GROUPS: Record<string, string[]> = {
  'Gasolina': ['Gasolina', 'Diesel', 'Híbrido'],
  'Diesel': ['Diesel', 'Gasolina', 'Híbrido'],
  'Híbrido': ['Híbrido', 'Gasolina', 'Híbrido Enchufable'],
  'Híbrido Enchufable': ['Híbrido Enchufable', 'Eléctrico', 'Híbrido'],
  'Eléctrico': ['Eléctrico', 'Híbrido Enchufable'],
};

// Segmentos afines para relajación (paso 3)
const BODY_GROUPS: Record<string, string[]> = {
  'Sedán': ['Sedán', 'Hatchback', 'Wagon'],
  'Hatchback': ['Hatchback', 'Sedán', 'Wagon'],
  'Wagon': ['Wagon', 'Sedán', 'Hatchback'],
  'SUV': ['SUV', 'Pickup'],
  'Pickup': ['Pickup', 'SUV'],
  'Deportivo': ['Deportivo', 'Convertible'],
  'Convertible': ['Convertible', 'Deportivo'],
  // Vehículos de trabajo: nunca se comparan contra carros de pasajeros.
  'Van': ['Van', 'Camión'],
  'Camión': ['Camión', 'Van'],
};

export interface CohortMember {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  type: string;
  fuelType: string;
}

export interface Cohort {
  members: CohortMember[];
  /** Descripción legible para el usuario — es un feature de confianza, no debug. */
  descriptionEs: string;
  /** Relajaciones aplicadas, en orden. Vacío = cohorte exacta. */
  relaxations: string[];
  priceBand: { key: string; labelEs: string; minPrice: number; maxPrice: number | null } | null;
}

// ---------------------------------------------------------------------------
// Bandas de precio vigentes (cacheadas 10 min)
// ---------------------------------------------------------------------------
let bandsCache: { at: number; bands: any[] } | null = null;

export async function getActivePriceBands() {
  if (bandsCache && Date.now() - bandsCache.at < 10 * 60 * 1000) return bandsCache.bands;
  const bands = await prisma.priceBand.findMany({
    where: { validTo: null },
    orderBy: { minPrice: 'asc' },
  });
  bandsCache = { at: Date.now(), bands };
  return bands;
}

export async function getPriceBandFor(price: number) {
  const bands = await getActivePriceBands();
  return bands.find(b => price >= b.minPrice && (b.maxPrice == null || price < b.maxPrice)) ?? null;
}

// ---------------------------------------------------------------------------
// Construcción de cohorte con relajación progresiva
// ---------------------------------------------------------------------------
export async function buildCohort(vehicle: CohortMember): Promise<Cohort> {
  const relaxations: string[] = [];
  const bands = await getActivePriceBands();
  const band = bands.find(b => vehicle.price >= b.minPrice && (b.maxPrice == null || vehicle.price < b.maxPrice)) ?? null;
  const bandIdx = band ? bands.indexOf(band) : -1;

  const baseWhere = { status: 'Disponible' as const };

  // Paso 0: cohorte exacta — mismo segmento, misma banda, mismo tren motriz
  let priceFilter = band
    ? { gte: band.minPrice, ...(band.maxPrice != null ? { lt: band.maxPrice } : {}) }
    : undefined;

  let members = await fetchMembers({
    ...baseWhere,
    type: vehicle.type,
    fuelType: vehicle.fuelType,
    ...(priceFilter ? { price: priceFilter } : {}),
  });

  // Paso 1: abrir banda de precio a las adyacentes
  if (members.length < MIN_COHORT_SIZE && bandIdx >= 0) {
    const lo = bands[Math.max(0, bandIdx - 1)];
    const hi = bands[Math.min(bands.length - 1, bandIdx + 1)];
    priceFilter = { gte: lo.minPrice, ...(hi.maxPrice != null ? { lt: hi.maxPrice } : {}) };
    members = await fetchMembers({
      ...baseWhere,
      type: vehicle.type,
      fuelType: vehicle.fuelType,
      price: priceFilter,
    });
    if (members.length >= MIN_COHORT_SIZE) relaxations.push('banda_precio_ampliada');
  }

  // Paso 2: agrupar trenes motrices afines
  if (members.length < MIN_COHORT_SIZE) {
    const fuels = POWERTRAIN_GROUPS[vehicle.fuelType] ?? [vehicle.fuelType];
    members = await fetchMembers({
      ...baseWhere,
      type: vehicle.type,
      fuelType: { in: fuels },
      ...(priceFilter ? { price: priceFilter } : {}),
    });
    if (members.length >= MIN_COHORT_SIZE) relaxations.push('banda_precio_ampliada', 'trenes_afines');
  }

  // Paso 3: agrupar segmentos afines
  if (members.length < MIN_COHORT_SIZE) {
    const fuels = POWERTRAIN_GROUPS[vehicle.fuelType] ?? [vehicle.fuelType];
    const types = BODY_GROUPS[vehicle.type] ?? [vehicle.type];
    members = await fetchMembers({
      ...baseWhere,
      type: { in: types },
      fuelType: { in: fuels },
      ...(priceFilter ? { price: priceFilter } : {}),
    });
    relaxations.length = 0;
    relaxations.push('banda_precio_ampliada', 'trenes_afines', 'segmentos_afines');
  }

  // Paso 4 (último recurso): mismo segmento, cualquier precio y tren
  if (members.length < MIN_COHORT_SIZE) {
    members = await fetchMembers({ ...baseWhere, type: vehicle.type });
    relaxations.length = 0;
    relaxations.push('solo_segmento');
  }

  // El vehículo siempre pertenece a su propia cohorte
  if (!members.some(m => m.id === vehicle.id)) members.push(vehicle);

  return {
    members,
    relaxations,
    priceBand: band,
    descriptionEs: describeCohort(members.length, vehicle, band, relaxations),
  };
}

async function fetchMembers(where: any): Promise<CohortMember[]> {
  return prisma.vehicle.findMany({
    where,
    select: { id: true, brand: true, model: true, year: true, price: true, type: true, fuelType: true },
  });
}

function describeCohort(n: number, v: CohortMember, band: any, relaxations: string[]): string {
  const M = 1_000_000;
  const bandTxt = band
    ? band.maxPrice != null
      ? `de $${Math.round(band.minPrice / M)}–${Math.round(band.maxPrice / M)} millones`
      : `de más de $${Math.round(band.minPrice / M)} millones`
    : '';

  if (relaxations.includes('solo_segmento')) {
    return `Comparado contra ${n} vehículos tipo ${v.type} disponibles en Colombia`;
  }
  const fuelTxt = relaxations.includes('trenes_afines') ? '' : ` ${v.fuelType.toLowerCase()}`;
  const priceTxt = relaxations.includes('banda_precio_ampliada') ? ' de precio similar' : ` ${bandTxt}`;
  return `Comparado contra ${n} ${v.type}${fuelTxt}${priceTxt} disponibles en Colombia`.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// PERCENTILES WINSORIZADOS — el puntaje de un atributo dentro de la cohorte
// ---------------------------------------------------------------------------

/** Percentil (0-100) de `value` dentro de `values`, winsorizado en p5/p95. */
export function winsorizedPercentile(value: number, values: number[]): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const p5 = quantile(sorted, 0.05);
  const p95 = quantile(sorted, 0.95);
  const clamped = Math.min(Math.max(value, p5), p95);
  const clampedValues = sorted.map(x => Math.min(Math.max(x, p5), p95));

  let below = 0, equal = 0;
  for (const x of clampedValues) {
    if (x < clamped) below++;
    else if (x === clamped) equal++;
  }
  // Rango medio para empates → estable y simétrico
  return Math.round(((below + equal / 2) / clampedValues.length) * 100);
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export interface AttributeScore {
  attributeKey: string;
  /** 0-100: percentil en la cohorte, ya orientado (100 = mejor). */
  score: number;
  /** Valor crudo del vehículo. */
  value: number;
  /** Mediana de la cohorte, para la UI de barras divergentes. */
  cohortMedian: number;
  /** Cuántos miembros de la cohorte tienen el dato. */
  sampleSize: number;
  /** false si menos de la mitad de la cohorte tiene el dato → mostrar con cautela. */
  robust: boolean;
}

/**
 * Puntúa los atributos numéricos comparables de un vehículo contra su cohorte.
 * Los atributos con direction=lower_better se invierten (100 = mejor siempre).
 * Atributos donde menos de 3 miembros tienen el dato NO se puntúan: devolver
 * un percentil de una muestra de 2 sería mentir con números.
 */
export async function scoreVehicleInCohort(vehicleId: string, cohort: Cohort): Promise<AttributeScore[]> {
  const memberIds = cohort.members.map(m => m.id);

  const rows = await prisma.vehicleAttribute.findMany({
    where: {
      vehicleId: { in: memberIds },
      valueNum: { not: null },
      definition: { comparable: true, dataType: 'numeric' },
    },
    select: {
      vehicleId: true,
      attributeKey: true,
      valueNum: true,
      definition: { select: { direction: true } },
    },
  });

  // Agrupar por atributo
  type KeyEntry = { direction: string; values: { vehicleId: string; v: number }[] };
  const byKey = new Map<string, KeyEntry>();
  for (const r of rows) {
    const entry: KeyEntry = byKey.get(r.attributeKey) ?? { direction: r.definition.direction, values: [] };
    entry.values.push({ vehicleId: r.vehicleId, v: r.valueNum! });
    byKey.set(r.attributeKey, entry);
  }

  const scores: AttributeScore[] = [];
  const MIN_SAMPLE = 3;

  byKey.forEach((entry, key) => {
    const mine = entry.values.find(x => x.vehicleId === vehicleId);
    if (!mine) return;
    if (entry.values.length < MIN_SAMPLE) return; // muestra insuficiente: no se puntúa

    if (entry.direction === 'neutral') return; // dimensiones físicas etc. no puntúan

    const values = entry.values.map(x => x.v);
    let pct = winsorizedPercentile(mine.v, values);
    if (entry.direction === 'lower_better') pct = 100 - pct;

    const sorted = [...values].sort((a, b) => a - b);

    scores.push({
      attributeKey: key,
      score: pct,
      value: mine.v,
      cohortMedian: quantile(sorted, 0.5),
      sampleSize: values.length,
      robust: values.length >= Math.max(MIN_SAMPLE, Math.floor(cohort.members.length / 2)),
    });
  });

  return scores.sort((a, b) => b.score - a.score);
}
