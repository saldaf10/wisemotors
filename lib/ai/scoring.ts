// Helper types and functions for candidate scoring and payload generation
import type { VehicleCandidate } from './features';
import { datosClave, leer, millones, specsDe } from '@/lib/vehiculo-datos';
import {
  detectQueryProfile,
  scoreDeterministically,
  rankCandidates,
  type QueryProfile,
} from './deterministic';

export interface ScoredCandidate extends VehicleCandidate {
  /** Puntaje determinístico 0-100 (percentil winsorizado × pesos del perfil). */
  score: number;
  /** Contribución por feature — con esto se explica por qué quedó donde quedó. */
  breakdown?: Record<string, number>;
}

/**
 * Puntúa y ordena los candidatos de forma determinística. Este orden es el
 * ranking base del producto: el LLM después lo afina y lo explica, pero si el
 * LLM falla o no hay API key, este orden ES el resultado — correcto aunque sin
 * prosa, no una ficción de porcentajes inventados.
 */
export function scoreCandidates(
  candidates: VehicleCandidate[],
  query: string
): { ranked: ScoredCandidate[]; profile: QueryProfile } {
  const profile = detectQueryProfile(query);
  const results = scoreDeterministically(candidates, profile);

  const scored: ScoredCandidate[] = candidates.map(c => ({
    ...c,
    score: results.get(c.id)?.score ?? 0,
    breakdown: results.get(c.id)?.breakdown,
  }));

  return { ranked: rankCandidates(scored), profile };
}

/**
 * Lo que la IA ve de cada candidato: SOLO datos reales de la ficha, en las
 * unidades en que se le dicen al comprador. Nada de índices internos (0.91 en
 * "potholes"): la IA los repetía tal cual y confundía, o inventaba a partir de ellos.
 */
export function createCompactPayload(candidates: ScoredCandidate[]): any[] {
  return candidates.map(c => {
    const s = specsDe(c.specifications);
    const datos = datosClave(c).map(d => `${d.etiqueta} ${d.valor}${d.unidad ? ` ${d.unidad}` : ''}`);
    const ncap = leer(s, 'safety.ncapRating');
    if (ncap !== null) datos.push(`NCAP ${ncap} estrellas`);
    const caja = s.combustion?.transmissionType ?? s.hybrid?.transmissionType ?? s.phev?.transmissionType;
    if (typeof caja === 'string' && caja) datos.push(`Caja ${caja}`);
    const largo = leer(s, 'dimensions.length');
    if (largo !== null) datos.push(`Largo ${(largo / 1000).toFixed(2).replace('.', ',')} m`);
    return {
      id: c.id,
      carro: `${c.brand} ${c.model} ${c.year}`,
      // Versiones del mismo carro: la IA escoge la que encaja y no las pone seguidas.
      ...(c.familia?.trim() ? { version_de: `${c.brand} ${c.familia.trim()}` } : {}),
      tipo: c.type,
      combustible: c.fuelType,
      precio: millones(c.price) + (s.commercial?.priceEstimated ? ' (estimado)' : ''),
      datos: datos.join(' · ') || 'sin datos técnicos cargados',
      ...(c.tags.length ? { etiquetas: c.tags } : {}),
      orden_base: c.score,
    };
  });
}
