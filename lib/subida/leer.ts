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
//  4. Una letra al final del valor dice de dónde salió (trazabilidad):
//     O oficial · C sitio confiable · X calculado · E estimado ("153 E", "153e").
//     Los E salen en amarillo en la ficha. Sin letra = como antes (oficial).
//  5. Debajo de la lista puede venir una sección de NOTAS ("# Notas",
//     "Fuentes y cálculos"…) con "Campo: explicación": la fuente, la razón o el
//     cálculo de cada dato. Se pegan a su dato; lo que no es de un campo queda
//     como nota general. Un X o un E sin nota sale como aviso.
// ============================================================================

import { fueraDeRango, rangoDe } from '@/lib/attributes/registry';
import { claseDeTipo } from '@/lib/attributes/clase';
import { FORMATO, OPCIONES_IDENTIDAD, RETIRADOS, TRENES, aplica, defDe, keyDe, type CampoFormato, type CampoIdentidad, type Tren } from './formato';
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
  /** El precio vino con "E": no es el de lista oficial. */
  precioEstimado?: boolean;
  precioOrigen?: Origen;
  precioNota?: string;
}

/** De dónde salió un dato: Oficial, sitio Confiable, calculado (X) o Estimado. */
export type Origen = 'O' | 'C' | 'X' | 'E';
export const ORIGENES: Record<Origen, string> = {
  O: 'Oficial',
  C: 'Sitio confiable',
  X: 'Calculado',
  E: 'Estimado',
};

export interface DatoLeido {
  /** Nombre del campo en la plantilla. */
  campo: string;
  key: string;
  valor: number | string | boolean;
  /** Lo que estaba escrito, para mostrar "escribiste X → se entendió Y". */
  escrito: string;
  linea: number;
  /** Vino marcado con "E": dato estimado, no oficial. */
  estimado: boolean;
  /** Letra de trazabilidad (null = no vino letra). */
  origen: Origen | null;
  /** Fuente, razón o cálculo, de la sección de notas. */
  nota?: string;
}

export interface Lectura {
  identidad: Identidad;
  datos: DatoLeido[];
  avisos: Aviso[];
  /** Campos de la plantilla de este carro que quedaron vacíos. */
  vacios: string[];
  /** Notas que no son de un campo en particular. */
  notasGenerales: string[];
}

// ---------------------------------------------------------------------------
// Nombres de campo
// ---------------------------------------------------------------------------

const NOMBRES = FORMATO.flatMap(c => [c.nombre, ...(c.alias ?? [])].map(nombre => ({ c, n: plano(nombre) })));
const RETIRADOS_PLANOS = RETIRADOS.map(plano);

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
/** "No aplica (velocidad limitada a 161 km/h)": vacío aunque traiga números en la explicación. */
const EMPIEZA_VACIO = /^(no aplica|n a|na|sin dato|no disponible|no publicad[oa]|no informad[oa]|nd|desconocid[oa])\b/;
const esVacio = (texto: string) => VACIOS.has(plano(texto)) || EMPIEZA_VACIO.test(plano(texto));

/** "75 – 85", "4.350 mm – 4.355 mm", '17" o 18"': dos números como rango o alternativa. */
const RANGO = /\d[\d.,]*\s*[a-zA-Z"'°%/]{0,6}\s*(?:–|—|-|\ba\b|\bo\b|\/)\s*\$?\d/;

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

/**
 * Separa la marca de estimado del final del valor: "153 E", "153e", "153 (E)",
 * "Sí E", "Turbo [e]" → { texto, estimado: true }. La "E" va separada por un
 * espacio o pegada a un número; "Clase E" en un texto también se leería como
 * estimado, por eso no se aplica a la marca ni al modelo.
 */
export function separarEstimado(escrito: string): { texto: string; estimado: boolean } {
  const { texto, origen, soloLetra } = separarOrigen(escrito);
  if (soloLetra) return { texto: escrito, estimado: false };
  return { texto, estimado: origen === 'E' };
}

/**
 * Separa la letra de trazabilidad del final: "232 O", "38.5 X", "Sí C", "3.8e",
 * "Turbo (E)" → { texto, origen }. O, C y X van en MAYÚSCULA (una "o" suelta es
 * la palabra "o"); la E en cualquiera. Va separada por un espacio o pegada a un
 * número. Una letra sola ("E") no es un dato: { texto: '', origen, soloLetra }.
 */
export function separarOrigen(escrito: string): { texto: string; origen: Origen | null; soloLetra?: boolean } {
  const solo = escrito.trim().match(/^[([]?\s*([OCXEe])\s*[)\]]?$/);
  if (solo) return { texto: '', origen: solo[1].toUpperCase() as Origen, soloLetra: true };
  const m = escrito.match(/^(.*?)(?:\s+|(?<=\d))[([]?\s*([OCXEe])\s*[)\]]?$/);
  if (m && m[1].trim()) return { texto: m[1].trim(), origen: m[2].toUpperCase() as Origen };
  return { texto: escrito, origen: null };
}

/** ¿La línea abre la sección de notas? ("# Notas", "Fuentes y cálculos:", "Notas al pie"…) */
const TITULO_NOTAS = /^(notas?|fuentes?|calculos?|explicacion(es)?|justificacion(es)?|referencias?|trazabilidad|observaciones)\b/;
function abreNotas(linea: string): boolean {
  const sinMarca = linea.replace(/^#+\s*/, '').replace(/[*_]/g, '').trim();
  const [nombre, ...resto] = sinMarca.split(':');
  return TITULO_NOTAS.test(plano(nombre)) && !resto.join(':').trim() && plano(nombre).split(' ').length <= 6;
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

  // Notas al pie: campo → texto, y las generales.
  const notas = new Map<CampoFormato, string[]>();
  const notasGenerales: string[] = [];
  let enNotas = false;

  texto.split(/\r?\n/).forEach((cruda, i) => {
    const n = i + 1;
    const l = cruda.trim();
    if (!l) return;
    if (abreNotas(l)) {
      enNotas = true;
      return;
    }
    if (enNotas) {
      // "- Peso en vacío (kg) (E): calculado con…" · "1. Consumo mixto: …" · texto suelto.
      const limpia = l.replace(/^#+\s*/, '').replace(/^([-*•]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim();
      if (!limpia) return;
      const dp = limpia.indexOf(':');
      const campo = dp > 0 ? campoDeLinea(separarOrigen(limpia.slice(0, dp)).texto || limpia.slice(0, dp)) : null;
      const cuerpo = dp > 0 ? limpia.slice(dp + 1).trim() : limpia;
      if (campo && cuerpo) notas.set(campo, [...(notas.get(campo) ?? []), cuerpo]);
      else notasGenerales.push(limpia);
      return;
    }
    if (l.startsWith('#')) return;
    const dosPuntos = l.indexOf(':');
    if (dosPuntos < 0) {
      avisos.push({ linea: n, tipo: 'aviso', texto: `La línea «${l.slice(0, 60)}» no tiene «:», no se leyó.` });
      return;
    }
    const nombre = l.slice(0, dosPuntos);
    const escrito = l.slice(dosPuntos + 1).trim().replace(/\.$/, '').trim();
    // Primero los retirados: "Año de la prueba de choque" empieza como "Año".
    if (RETIRADOS_PLANOS.some(r => plano(nombre) === r || plano(nombre).startsWith(`${r} `))) {
      if (escrito) avisos.push({ linea: n, tipo: 'aviso', texto: `«${nombre.trim()}» ya no se usa en la guía; se ignora.` });
      return;
    }
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
  for (const cruda of lineas.filter(x => x.campo.identidad)) {
    const id = cruda.campo.identidad as CampoIdentidad;
    // La letra de trazabilidad no se separa en la marca ni en el modelo ("Clase C", "Clase E").
    const sep = id === 'marca' || id === 'modelo' ? { texto: cruda.escrito, origen: null } : separarOrigen(cruda.escrito);
    const l = { ...cruda, escrito: sep.texto };
    if (esVacio(l.escrito)) continue;
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
      const texto = l.escrito;
      const p = leerNumero(texto);
      if (p && p >= 5_000_000 && p <= 5_000_000_000) {
        identidad.precio = p;
        if (sep.origen) identidad.precioOrigen = sep.origen;
        if (sep.origen === 'E') identidad.precioEstimado = true;
        const nota = notas.get(l.campo);
        if (nota) identidad.precioNota = nota.join(' · ');
        if (RANGO.test(texto)) avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'aviso', texto: `«${texto}» trae dos precios; se guardó el primero ($${p.toLocaleString('es-CO')}). Cada versión va en su propia guía.` });
      } else avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${l.escrito}» no parece un precio en pesos (ej. 113.000.000).` });
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
      const { texto: escrito, origen, soloLetra } = separarOrigen(l.escrito);
      const estimado = origen === 'E';
      if (soloLetra) {
        avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `Solo trae la letra «${origen}», sin el dato. Escribe el valor o deja el campo vacío.` });
        continue;
      }
      if (esVacio(escrito)) continue;
      if (!aplica(l.campo, tren, carroceria)) {
        avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'aviso', texto: `«${l.campo.nombre}» no va en un ${tren.toLowerCase()} ${carroceria.toLowerCase()}; se ignora.` });
        continue;
      }
      const d = defDe(l.campo, tren)!;
      const key = keyDe(l.campo, tren)!;
      let valor: number | string | boolean | null = null;
      if (d.dataType === 'boolean') {
        valor = leerSiNo(escrito);
        if (valor === null) avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${escrito}» no es Sí o No.` });
      } else if (d.dataType === 'numeric') {
        valor = leerNumero(escrito);
        if (valor !== null && RANGO.test(escrito)) {
          avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'aviso', texto: `«${escrito}» trae dos números; se guardó el primero (${valor}). Si no es el de esta versión, deja uno solo.` });
        }
        if (valor === null) {
          avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${escrito}» no es un número.` });
        } else if (fueraDeRango(d, valor, clase)) {
          const r = rangoDe(d, clase);
          avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `${valor}${d.unit ? ` ${d.unit}` : ''} está fuera de lo normal (${r.min ?? '—'} a ${r.max ?? '—'}${d.unit ? ` ${d.unit}` : ''}). Revisa la unidad.` });
          valor = null;
        }
      } else if (d.opciones?.length) {
        valor = opcionMasCercana(escrito, d.opciones, key);
        if (valor === null) avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'error', texto: `«${escrito}» no es una opción: ${d.opciones.join(', ')}.` });
      } else {
        valor = escrito.slice(0, 200);
      }
      if (valor === null) continue;
      const nota = notas.get(l.campo)?.join(' · ');
      if ((origen === 'X' || origen === 'E') && !nota) {
        avisos.push({ linea: l.n, campo: l.campo.nombre, tipo: 'aviso', texto: `Es ${origen === 'X' ? 'calculado (X)' : 'estimado (E)'} pero no trae nota al pie que explique ${origen === 'X' ? 'el cálculo' : 'de dónde salió'}.` });
      }
      datos.push({ campo: l.campo.nombre, key, valor, escrito: l.escrito, linea: l.n, estimado, origen, nota });
      conValor.add(l.campo);
    }
    for (const c of FORMATO) if (!c.identidad && aplica(c, tren, carroceria) && !conValor.has(c)) vacios.push(c.nombre);
  }
  // Notas de campos que no quedaron con dato (vacíos, retirados o que no aplican): generales.
  const conDato = new Set(datos.map(d => d.campo));
  Array.from(notas.entries()).forEach(([c, ns]) => {
    if (!c.identidad && !conDato.has(c.nombre)) notasGenerales.push(`${c.nombre}: ${ns.join(' · ')}`);
  });
  return { identidad, datos, avisos, vacios, notasGenerales };
}
