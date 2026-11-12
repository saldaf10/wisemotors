// ============================================================================
// Un carro ya publicado, escrito como guía de subida (nov-2026).
//
// Sirve para "Subir versión nueva": la guía de la versión base se lee con el
// mismo lector de siempre (lib/subida/leer.ts) y lo que la guía nueva no traiga
// se toma de ahí. Cada dato lleva su letra de trazabilidad (O/C/X/E) y su nota
// al pie, así la versión nueva hereda también de dónde salió cada dato.
// ============================================================================

import { FORMATO, TRENES, aplica, keyDe, type Tren } from './formato';

export interface AtributoGuardado {
  attributeKey: string;
  valueNum: number | null;
  valueBool: boolean | null;
  valueText: string | null;
  estimado?: boolean | null;
  origen?: string | null;
  nota?: string | null;
}

export interface VehiculoGuia {
  brand: string;
  model: string;
  year: number;
  fuelType: string;
  type: string;
  vehicleType: string;
  price: number;
  specifications?: unknown;
}

/**
 * Número como lo lee la guía: coma decimal y sin separador de miles. Con tres
 * decimales se agrega un cero ("0,2850"): "0,285" se leería como 285 (miles).
 */
export function numeroGuia(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const [ent, dec = ''] = String(Number(n.toFixed(4))).split('.');
  return dec ? `${ent},${dec.length === 3 ? `${dec}0` : dec}` : ent;
}

function deSpecs(specs: unknown, key: string): unknown {
  let nodo: any = typeof specs === 'string' ? (() => { try { return JSON.parse(specs); } catch { return {}; } })() : specs;
  for (const p of key.split('.')) {
    if (nodo === null || typeof nodo !== 'object') return undefined;
    nodo = nodo[p];
  }
  return nodo;
}

const una = (t: string) => t.replace(/\s+/g, ' ').trim();

export function guiaDeVehiculo(v: VehiculoGuia, atributos: AtributoGuardado[]): string {
  const tren: Tren = (TRENES as readonly string[]).includes(v.fuelType) ? (v.fuelType as Tren) : 'Gasolina';
  const porKey = new Map(atributos.map(a => [a.attributeKey, a]));
  const precio = porKey.get('commercial.priceCop');
  const identidad: Record<string, string> = {
    marca: v.brand,
    modelo: v.model,
    anio: String(v.year),
    tren,
    carroceria: v.type,
    categoria: v.vehicleType,
    precio: `${Math.round(v.price)}${precio?.origen ? ` ${precio.origen}` : ''}`,
  };

  const lineas: string[] = [];
  const notas: string[] = [];
  if (precio?.nota) notas.push(`Precio de lista (COP): ${una(precio.nota)}`);
  let seccion = '';
  for (const c of FORMATO) {
    if (!aplica(c, tren, v.type)) continue;
    if (c.seccion !== seccion) {
      if (lineas.length) lineas.push('');
      lineas.push(`# ${c.seccion}`);
      seccion = c.seccion;
    }
    if (c.identidad) {
      lineas.push(`${c.nombre}: ${identidad[c.identidad] ?? ''}`.trimEnd());
      continue;
    }
    const key = keyDe(c, tren)!;
    const a = porKey.get(key);
    let valor: unknown = a ? (a.valueNum ?? a.valueBool ?? a.valueText) : deSpecs(v.specifications, key);
    if (valor === null || valor === undefined || valor === '') {
      lineas.push(`${c.nombre}:`);
      continue;
    }
    const letra = a?.origen ?? (a?.estimado ? 'E' : null);
    let texto = typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : typeof valor === 'number' ? numeroGuia(valor) : una(String(valor));
    // Un texto que termina en una letra suelta ("Clase C") se leería como trazabilidad: va con su letra explícita.
    if (letra) texto += ` ${letra}`;
    else if (/\s[OCXEe]$/.test(texto)) texto += ' O';
    lineas.push(`${c.nombre}: ${texto}`);
    if (a?.nota) notas.push(`${c.nombre}: ${una(a.nota)}`);
  }
  if (notas.length) lineas.push('', '# Notas', ...notas);
  return lineas.join('\n') + '\n';
}
