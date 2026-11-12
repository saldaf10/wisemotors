// ============================================================================
// Versiones del mismo carro (nov-2026).
//
// Dos vehículos son versiones del mismo carro si tienen la misma marca y la
// misma `familia` ("Seagull EV"): en el catálogo salen en UNA tarjeta con un
// toggle amarillo y en la ficha se pasa de una a otra. Sin familia, el carro va
// solo. La etiqueta de cada versión es el modelo sin la familia:
// "Seagull EV GL" con familia "Seagull EV" → "GL".
//
// Sin base de datos: se usa en el servidor y en el navegador.
// ============================================================================

import { plano } from '@/lib/subida/texto';

export interface ConFamilia {
  id: string;
  brand: string;
  model: string;
  familia?: string | null;
}

/** Clave de agrupación: marca + familia sin mayúsculas ni tildes; sin familia, el propio id. */
export function claveFamilia(v: ConFamilia): string {
  const f = v.familia?.trim();
  return f ? `${plano(v.brand)}|${plano(f)}` : `id:${v.id}`;
}

/**
 * "Seagull EV GL" con familia "Seagull EV" → "GL". Si el modelo ES la familia
 * ("Blazer EV" junto a "Blazer EV RS AWD") → "Base". Si no empieza por ella, el modelo.
 */
export function etiquetaVersion(v: { model: string; familia?: string | null }): string {
  const f = v.familia?.trim();
  if (!f) return v.model;
  const palabrasF = f.split(/\s+/);
  const palabrasM = v.model.trim().split(/\s+/);
  const empieza = palabrasF.every((p, i) => palabrasM[i] !== undefined && plano(palabrasM[i]) === plano(p));
  if (!empieza) return v.model;
  return palabrasM.slice(palabrasF.length).join(' ') || 'Base';
}

/** Nombre del carro sin la versión: "Seagull EV" (o el modelo si no tiene familia). */
export function nombreFamilia(v: { model: string; familia?: string | null }): string {
  return v.familia?.trim() || v.model;
}

/** Agrupa por familia conservando el orden: cada grupo aparece donde estaba su primera versión. */
export function agruparVersiones<T extends ConFamilia>(vs: T[]): T[][] {
  const grupos = new Map<string, T[]>();
  for (const v of vs) {
    const k = claveFamilia(v);
    const g = grupos.get(k);
    if (g) g.push(v);
    else grupos.set(k, [v]);
  }
  return Array.from(grupos.values());
}

/**
 * Familia para una versión nueva subida desde otra: las palabras iniciales que
 * comparten los dos modelos ("Onix LT" + "Onix RS" → "Onix"). Si no comparten
 * ninguna, el modelo de la base.
 */
export function familiaEntre(modeloBase: string, modeloNuevo: string): string {
  const a = modeloBase.trim().split(/\s+/);
  const b = modeloNuevo.trim().split(/\s+/);
  const comunes: string[] = [];
  for (let i = 0; i < Math.min(a.length, b.length) && plano(a[i]) === plano(b[i]); i++) comunes.push(a[i]);
  // Si un modelo es la familia completa ("Blazer EV" y "Blazer EV RS AWD"), la familia es ese.
  return comunes.length ? comunes.join(' ') : modeloBase.trim();
}
