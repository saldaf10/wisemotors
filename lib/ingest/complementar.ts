// ============================================================================
// "Complementar con IA": el revisor pega un texto (una investigación hecha con
// otra IA, una ficha copiada, una nota de prensa) y WiseMotors lo reparte en
// los campos del registro de un carro YA publicado.
//
// Mismas reglas que la ingesta: solo keys del registro, cada dato con su cita,
// y la cita tiene que aparecer en el texto pegado (así la IA no agrega nada que
// el texto no diga). Nada se escribe aquí: se devuelve una propuesta —nuevo,
// igual o distinto al dato actual— y el revisor elige qué aplicar.
// ============================================================================

import { prisma } from '@/lib/prisma';
import { ATTRIBUTE_REGISTRY, fueraDeRango } from '@/lib/attributes/registry';
import { claseDeTipo, claseEnPalabras } from '@/lib/attributes/clase';
import { extractFromPage } from './extract';
import { MAX_TEXT_CHARS } from './fetcher';

/** El precio tiene su propio flujo (confirmar en "Por revisar"): aquí no se toca. */
const EXCLUIDAS = new Set(['commercial.priceCop']);
const MAX_TROZOS = 3;

export interface Propuesta {
  key: string;
  etiqueta: string;
  unidad: string | null;
  grupo: string;
  valor: number | string | boolean;
  cita: string;
  actual: number | string | boolean | null;
  estado: 'nuevo' | 'igual' | 'distinto';
}

/** Parte el texto en trozos de ~25k caracteres, cortando en saltos de línea. */
function trozos(texto: string): string[] {
  const out: string[] = [];
  let resto = texto.trim();
  while (resto.length > 0 && out.length < MAX_TROZOS) {
    if (resto.length <= MAX_TEXT_CHARS) {
      out.push(resto);
      break;
    }
    const corte = resto.lastIndexOf('\n', MAX_TEXT_CHARS);
    const fin = corte > MAX_TEXT_CHARS * 0.6 ? corte : MAX_TEXT_CHARS;
    out.push(resto.slice(0, fin));
    resto = resto.slice(fin);
  }
  return out;
}

const iguales = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.005) : String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export async function proponerDesdeTexto(
  vehicleId: string,
  texto: string
): Promise<{ propuestas: Propuesta[]; descartadosPorVersion: number; truncado: boolean }> {
  const v = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { brand: true, model: true, year: true, fuelType: true, type: true, attributes: { select: { attributeKey: true, valueNum: true, valueBool: true, valueText: true } } },
  });
  if (!v) throw new Error('Vehículo no encontrado');

  const partes = trozos(texto);
  const clase = claseDeTipo(v.type);
  const label = `${v.brand} ${v.model} ${v.year} (${clase === 'auto' ? '' : `${claseEnPalabras(clase)}, `}mercado Colombia)`;
  const resultados = await Promise.all(partes.map(t => extractFromPage({ texto: t }, 'texto-pegado', 2, label, '', undefined, v.fuelType)));

  const actuales = new Map(v.attributes.map(a => [a.attributeKey, a.valueNum ?? a.valueBool ?? a.valueText]));
  const def = new Map(ATTRIBUTE_REGISTRY.map(d => [d.key, d]));
  const porKey = new Map<string, Propuesta>();
  for (const r of resultados) {
    for (const f of r.facts) {
      if (EXCLUIDAS.has(f.key) || porKey.has(f.key)) continue;
      const d = def.get(f.key)!;
      // Validación física: un valor imposible no se propone.
      if (typeof f.value === 'number' && fueraDeRango(d, f.value, clase)) continue;
      const actual = actuales.get(f.key) ?? null;
      porKey.set(f.key, {
        key: f.key,
        etiqueta: d.labelEs,
        unidad: d.unit ?? null,
        grupo: d.displayGroup,
        valor: f.value,
        cita: f.quote,
        actual,
        estado: actual === null ? 'nuevo' : iguales(f.value, actual) ? 'igual' : 'distinto',
      });
    }
  }

  const orden = { nuevo: 0, distinto: 1, igual: 2 };
  const prioridad = new Map(ATTRIBUTE_REGISTRY.map(d => [d.key, d.displayPriority]));
  const propuestas = Array.from(porKey.values()).sort(
    (a, b) => orden[a.estado] - orden[b.estado] || a.grupo.localeCompare(b.grupo) || (prioridad.get(b.key) ?? 0) - (prioridad.get(a.key) ?? 0)
  );
  return {
    propuestas,
    descartadosPorVersion: resultados.reduce((t, r) => t + r.descartadosPorVersion, 0),
    truncado: texto.trim().length > MAX_TEXT_CHARS * MAX_TROZOS,
  };
}
