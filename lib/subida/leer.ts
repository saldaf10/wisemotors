// ============================================================================
// Lee el texto de la guía de subida (lib/subida/formato.ts) sin IA.
//
//  1. Cada línea "Campo: valor" se asigna a SU campo por el nombre (sin
//     importar mayúsculas, tildes, la pista de opciones o un error de tipeo).
//     Nunca se usa la posición: un valor vacío deja el campo vacío y no se
//     corre ningún dato a otro campo.
//  2. Primero se leen los datos de identidad (tren motriz y carrocería), que
//     deciden qué campos van; un campo que no va para este carro se ignora con aviso.
//  3. Cada valor se convierte según el campo: número (coma o punto decimal,
//     miles con punto), Sí/No, una de las opciones (la más parecida) o texto.
//     Lo que no se entiende NO se guarda: queda como error para corregir.
// ============================================================================

import { fueraDeRango, rangoDe } from '@/lib/attributes/registry';
import { claseDeTipo } from '@/lib/attributes/clase';
import { FORMATO, OPCIONES_IDENTIDAD, TRENES, aplica, defDe, keyDe, type CampoFormato, type CampoIdentidad, type Tren } from './formato';
import { distancia, plano } from './texto';
import { opcionMasCercana } from './opciones';

export interface Aviso {
  linea: number;
  campo?: string;
  texto: string;
  tipo: 'error' | 'aviso';
}

export interface Identidad {
  marca?: string;
  modelo?: string;
  anio?: number;
  tren?: Tren;
  carroceria?: string;
  categoria?: string;
  precio?: number;
}

export interface DatoLeido {
  /** Nombre del campo en la plantilla. */
  campo: string;
  key: string;
  valor: number | string | boolean;
  /** Lo que estaba escrito, para mostrar "escribiste X → se entendió Y". */
  escrito: string;
  linea: number;
}

export interface Lectura {
  identidad: Identidad;
  datos: DatoLeido[];
  avisos: Aviso[];
  /** Campos de la plantilla de este carro que quedaron vacíos. */
  vacios: string[];
}

// ---------------------------------------------------------------------------
// Nombres de campo
// ---------------------------------------------------------------------------

const NOMBRES = FORMATO.map(c => ({ c, n: plano(c.nombre) }));

/** Qué campo es esta línea: el nombre más largo que coincide al inicio, o el más parecido. */
export function campoDeLinea(nombreEscrito: string): CampoFormato | null {
  const n = plano(nombreEscrito);
  if (!n) return null;
  // 1. Coincidencia exacta o con la pista de opciones detrás ("traccion delantera trasera…").
  const prefijos = NOMBRES.filter(x => n === x.n || n.startsWith(`${x.n} `)).sort((a, b) => b.n.length - a.n.length);
  if (prefijos.length) return prefijos[0].c;
  // 2. Error de tipeo: el más parecido, si es claramente el más parecido.
  const sinPista = plano(nombreEscrito.replace(/\((?:[^()]|\([^()]*\))*\/(?:[^()]|\([^()]*\))*\)/g, ' ').replace(/\[[^\]]*\]/g, ' '));
  const puntajes = NOMBRES.map(x => ({ c: x.c, d: distancia(sinPista, x.n) / Math.max(x.n.length, 1) })).sort((a, b) => a.d - b.d);
  const [mejor, segundo] = puntajes;
  if (mejor && mejor.d <= 0.25 && (!segundo || segundo.d - mejor.d >= 0.05)) return mejor.c;
  return null;
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

const VACIOS = new Set(['', '-', '--', 'na', 'n a', 'no aplica', 'sin dato', 'no se', 'nd', '?', 'x x']);

/** "4.270" → 4270 · "10,9" → 10.9 · "1.5" → 1.5 · "113.000.000" → 113000000 · "4270 mm" → 4270. */
export function leerNumero(texto: string): number | null {
  const m = texto.replace(/\s/g, '').match(/-?\d[\d.,]*/);
  if (!m) return null;
  let s = m[0].replace(/[.,]$/, '');
  const puntos = (s.match(/\./g) ?? []).length, comas = (s.match(/,/g) ?? []).length;
  if (puntos && comas) {
    // El último separador es el decimal.
    const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    s = dec === ',' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (comas) {
    s = comas === 1 && !/^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (puntos) {
    if (puntos > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const SI = ['si', 's', 'yes', 'y', 'x', 'true', '1', 'tiene', 'con', 'incluye', 'ok', 'sí'];
const NO = ['no', 'n', 'false', '0', 'sin', 'no tiene', 'no trae', 'no incluye'];

export function leerSiNo(texto: string): boolean | null {
  const v = plano(texto);
  if (SI.includes(v) || /^si\b/.test(v)) return true;
  if (NO.includes(v) || /^no\b/.test(v)) return false;
  // Tipeo: "sii", "nop", "si," …
  if (distancia(v, 'si') <= 1 && v.length <= 3) return true;
  if (distancia(v, 'no') <= 1 && v.length <= 3) return false;
  return null;
}

// ---------------------------------------------------------------------------
// Lectura completa
// ---------------------------------------------------------------------------

interface Linea {
  n: number;
  campo: CampoFormato;
  escrito: string;
}

export function leerGuia(texto: string): Lectura {
  const avisos: Aviso[] = [];
  const lineas: Linea[] = [];
  const vistos = new Set<CampoFormato>();

  texto.split(/\r?\n/).forEach((cruda, i) => {
    const n = i + 1;
    const l = cruda.trim();
    if (!l || l.startsWith('#')) return;
    const dosPuntos = l.indexOf(':');
    if (dosPuntos < 0) {
      avisos.push({ linea: n, tipo: 'aviso', texto: `La línea «${l.slice(0, 60)}» no tiene «:», no se leyó.` });
      return;
    }
    const nombre = l.slice(0, dosPuntos);
    const escrito = l.slice(dosPuntos + 1).trim().replace(/\.$/, '').trim();
    const campo = campoDeLinea(nombre);
    if (!campo) {
      if (escrito) avisos.push({ linea: n, tipo: 'error', texto: `No se reconoce el campo «${nombre.trim()}». Revisa que esté escrito como en la plantilla.` });
      return;
    }
    if (vistos.has(campo)) {
      avisos.push({ linea: n, campo: campo.nombre, tipo: 'aviso', texto: `«${campo.nombre}» está repetido; se usa el primero.` });
      return;
    }
    vistos.add(campo);
    lineas.push({ n, campo, escrito });
  });

  // 1. Identidad
  const identidad: Identidad = {};
  for (const l of lineas.filter(x => x.campo.identidad)) {
    if (VACIOS.has(plano(l.escrito))) continue;
    const id = l.campo.identidad as CampoIdentidad;
    const opciones = OPCIONES_IDENTIDAD[id];
    if (opciones) {
      const op = opcionMasCercana(l.escrito, opciones);
      if (!op) {
        avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${l.escrito}» no es una opción de ${l.campo.nombre}: ${opciones.join(', ')}.` });
        continue;
      }
      if (id === 'tren') identidad.tren = op as Tren;
      else if (id === 'carroceria') identidad.carroceria = op;
      else identidad.categoria = op;
    } else if (id === 'anio') {
      const a = leerNumero(l.escrito);
      if (a && a >= 1990 && a <= 2035) identidad.anio = Math.round(a);
      else avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${l.escrito}» no es un año válido.` });
    } else if (id === 'precio') {
      const p = leerNumero(l.escrito);
      if (p && p >= 5_000_000 && p <= 5_000_000_000) identidad.precio = p;
      else avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${l.escrito}» no parece un precio en pesos (ej. 113.000.000).` });
    } else if (id === 'marca') identidad.marca = l.escrito;
    else identidad.modelo = l.escrito;
  }
  for (const [id, nombre] of [['marca', 'Marca'], ['modelo', 'Modelo'], ['anio', 'Año'], ['tren', 'Tren motriz'], ['carroceria', 'Carrocería'], ['precio', 'Precio de lista (COP)']] as const) {
    if (identidad[id] === undefined) avisos.push({ linea: 0, campo: nombre, tipo: 'error', texto: `Falta ${nombre}.` });
  }

  // 2. Datos: solo si ya se sabe qué carro es (tren motriz y carrocería deciden qué campos van).
  const datos: DatoLeido[] = [];
  const vacios: string[] = [];
  const { tren, carroceria } = identidad;
  if (tren && carroceria) {
    const clase = claseDeTipo(carroceria);
    const conValor = new Set<CampoFormato>();
    for (const l of lineas.filter(x => !x.campo.identidad)) {
      if (VACIOS.has(plano(l.escrito))) continue;
      if (!aplica(l.campo, tren, carroceria)) {
        avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'aviso', texto: `«${l.campo.nombre}» no va en un ${tren.toLowerCase()} ${carroceria.toLowerCase()}; se ignora.` });
        continue;
      }
      const d = defDe(l.campo, tren)!;
      const key = keyDe(l.campo, tren)!;
      let valor: number | string | boolean | null = null;
      if (d.dataType === 'boolean') {
        valor = leerSiNo(l.escrito);
        if (valor === null) avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${l.escrito}» no es Sí o No.` });
      } else if (d.dataType === 'numeric') {
        valor = leerNumero(l.escrito);
        if (valor === null) {
          avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${l.escrito}» no es un número.` });
        } else if (fueraDeRango(d, valor, clase)) {
          const r = rangoDe(d, clase);
          avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `${valor}${d.unit ? ` ${d.unit}` : ''} está fuera de lo normal (${r.min ?? '—'} a ${r.max ?? '—'}${d.unit ? ` ${d.unit}` : ''}). Revisa la unidad.` });
          valor = null;
        }
      } else if (d.opciones?.length) {
        valor = opcionMasCercana(l.escrito, d.opciones, key);
        if (valor === null) avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${l.escrito}» no es una opción: ${d.opciones.join(', ')}.` });
      } else {
        valor = l.escrito.slice(0, 200);
      }
      if (valor === null) continue;
      datos.push({ campo: l.campo.nombre, key, valor, escrito: l.escrito, linea: l.n });
      conValor.add(l.campo);
    }
    for (const c of FORMATO) if (!c.identidad && aplica(c, tren, carroceria) && !conValor.has(c)) vacios.push(c.nombre);
  }
  return { identidad, datos, avisos, vacios };
}
