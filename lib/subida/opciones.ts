// Lleva lo que escribió una persona a UNA de las opciones de un campo:
//   1. igual (sin mayúsculas ni tildes): "sedan" → "Sedán"
//   2. sinónimos del oficio: "4WD" → "4x4", "TSI" → "Turbo", "hibrido" → "Híbrido"
//   3. una opción contenida en lo escrito o al revés: "Frenos de tambor" → "Tambor"
//   4. error de tipeo: la más parecida si es claramente la más parecida ("Tambro" → "Tambor")
// Si nada encaja, null: el dato no se guarda y se pide corregirlo.

import { distancia, plano } from './texto';

/** Sinónimos por opción (en texto plano), para las opciones que se escriben de mil formas. */
const SINONIMOS: Record<string, string[]> = {
  // Tracción
  '4x4': ['4wd', 'reductora', '4x4 con reductora'],
  'Integral (AWD)': ['awd', 'integral', 'total', 'traccion total', '4motion', 'all wheel drive', 'xdrive', 'quattro', 'e four', 'efour', 'todas las ruedas'],
  Trasera: ['rwd', 'propulsion', 'posterior', 'traccion trasera'],
  Delantera: ['fwd', '4x2', 'traccion delantera', 'frontal', 'anterior'],
  // Inducción
  Turbo: ['turbo', 'tsi', 'tfsi', 'ecoboost', 't gdi', 'tgdi', 'tce', 'turbocargado', 'turboalimentado'],
  Supercargado: ['supercargador', 'compresor', 'supercharger', 'supercharged'],
  Atmosférico: ['atmosferico', 'aspirado', 'aspiracion natural', 'naturalmente aspirado', 'natural', 'na'],
  // Tren motriz
  Diesel: ['diesel', 'disel', 'acpm', 'gasoil'],
  Gasolina: ['gasolina', 'nafta', 'gas'],
  Eléctrico: ['electrico', 'ev', 'bev', '100 electrico'],
  Híbrido: ['hibrido', 'hev', 'hibrido autorecargable', 'full hybrid', 'mhev', 'mild hybrid', 'hibrido suave'],
  'Híbrido Enchufable': ['hibrido enchufable', 'phev', 'plug in', 'plug in hybrid', 'enchufable'],
  // Carrocería
  SUV: ['camioneta', 'suv', 'crossover', 'todoterreno'],
  Hatchback: ['hatch', 'hb', 'hatchback'],
  Pickup: ['pick up', 'pickup', 'platon', 'camioneta con platon'],
  Van: ['furgon', 'furgoneta', 'minivan', 'van'],
  // Frenos
  Disco: ['disco', 'discos', 'disco ventilado', 'discos ventilados'],
  Tambor: ['tambor', 'tambores'],
  // Repuesto
  'Tamaño completo': ['completa', 'full size', 'normal', 'de tamano completo'],
  Temporal: ['galleta', 'temporal', 'de emergencia', 'tipo galleta'],
  'Kit de reparación': ['kit', 'kit de reparacion', 'kit antipinchazos', 'sellante'],
  'No trae': ['no', 'no trae', 'sin repuesto', 'ninguna'],
  // Techo / vidrios
  Corredizo: ['sunroof', 'quemacocos', 'corredizo'],
  Panorámico: ['panoramico', 'panoramico corredizo'],
  'Adelante y atrás': ['4', 'cuatro', 'todos', 'las 4', 'delanteros y traseros'],
  'Solo adelante': ['2', 'dos', 'delanteros', 'solo delanteros'],
};

export function opcionMasCercana(escrito: string, opciones: readonly string[], key?: string): string | null {
  const v = plano(escrito);
  if (!v) return null;
  const planas = opciones.map(o => ({ o, p: plano(o) }));

  // 1. Igual
  const igual = planas.find(x => x.p === v);
  if (igual) return igual.o;

  // 2. Sinónimos (solo de las opciones de este campo). La inducción combina: "turbo y compresor".
  if (key?.endsWith('.inductionType')) {
    const turbo = SINONIMOS.Turbo.some(s => new RegExp(`\\b${s}\\b`).test(v));
    const sc = SINONIMOS.Supercargado.some(s => new RegExp(`\\b${s}\\b`).test(v));
    if (turbo && sc && opciones.includes('Turbo y supercargado')) return 'Turbo y supercargado';
  }
  const porSinonimo = planas.filter(x => (SINONIMOS[x.o] ?? []).some(s => v === s || new RegExp(`\\b${s}\\b`).test(v)));
  if (porSinonimo.length === 1) return porSinonimo[0].o;

  // 3. Contenida: "frenos de tambor" → "tambor"; "latin ncap 2024" → "latin ncap".
  const contenida = planas.filter(x => new RegExp(`\\b${x.p}\\b`).test(v) || new RegExp(`\\b${v}\\b`).test(x.p));
  if (contenida.length === 1) return contenida[0].o;

  // 4. Tipeo: la más parecida, si está cerca y es claramente la más parecida.
  const candidatos = planas
    .flatMap(x => [x.p, ...(SINONIMOS[x.o] ?? [])].map(p => ({ o: x.o, d: distancia(v, p) / Math.max(p.length, v.length, 1) })))
    .sort((a, b) => a.d - b.d);
  const mejor = candidatos[0];
  const otro = candidatos.find(c => c.o !== mejor?.o);
  if (mejor && mejor.d <= 0.34 && (!otro || otro.d - mejor.d >= 0.1)) return mejor.o;
  return null;
}
