// ============================================================================
// ÍNDICES WISEMOTORS (plan §4) — lo que solo tiene sentido en Colombia.
//
//   Altura  — cuánta potencia le queda al carro en cada ciudad.
//   Palmas  — potencia real por tonelada subiendo al Alto de Las Palmas, cargado.
//   Hueco   — despeje + alto de la llanta: ¿sobrevive a una vía colombiana?
//   Resalto — altura al piso + ángulos: ¿raspa en policías acostados y rampas?
//   Pico y placa — sí o no por ciudad (lib/indices/pico-y-placa.ts).
//   CRT     — Costo Real de Tenencia a 5 años en Medellín, en pesos.
//
// Funciones puras (sin BD): reciben la ficha y los parámetros vigentes
// (lib/indices/parametros.ts). Regla de oro: un índice se calcula SOLO con los
// datos que lo sostienen. Si falta uno, el índice dice cuál falta y no se
// muestra un número; nunca se rellena con supuestos. Lo que sí es estimación
// de mercado (seguro, depreciación, mantenimiento) se declara como tal.
// ============================================================================

import { leer, rendimiento, specsDe } from '@/lib/vehiculo-datos';
import type { Valores } from './parametros';
import { picoYPlaca, type ResultadoPicoYPlaca } from './pico-y-placa';

export interface EntradaIndices {
  fuelType: string;
  price: number;
  specifications: unknown;
  /** Confiabilidad percibida de la marca (0-100), de brand_perception_co. */
  confiabilidadMarca?: number | null;
  /** Carrocería y categoría: los de carga no muestran pico y placa. */
  type?: string | null;
  vehicleType?: string | null;
  /** Para las reglas temporales de pico y placa (por defecto, hoy). */
  hoy?: Date;
}

export type Motor = 'atmosferico' | 'turbo' | 'electrico' | 'hibrido';

interface NoDisponible {
  disponible: false;
  faltan: string[];
  nota?: string;
}

export const CIUDADES: { nombre: string; altitud: number }[] = [
  { nombre: 'Barranquilla', altitud: 18 },
  { nombre: 'Cartagena', altitud: 2 },
  { nombre: 'Bucaramanga', altitud: 959 },
  { nombre: 'Cali', altitud: 1018 },
  { nombre: 'Pereira', altitud: 1411 },
  { nombre: 'Medellín', altitud: 1495 },
  { nombre: 'Manizales', altitud: 2160 },
  { nombre: 'Pasto', altitud: 2527 },
  { nombre: 'Bogotá', altitud: 2640 },
  { nombre: 'Tunja', altitud: 2782 },
];

const redondear = (n: number, paso = 1) => Math.round(n / paso) * paso;
const acotar = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/** Potencia máxima del tren motriz que tenga (HP). */
function potencia(s: Record<string, any>) {
  return leer(s, 'combustion.maxPower', 'hybrid.maxPower', 'phev.maxPower', 'electric.maxPower');
}

const esTurbo = (x: unknown) => typeof x === 'string' && /turbo|supercarg/i.test(x);

/**
 * Qué tipo de motor es, en lo que importa para la altura. null = no sabemos si
 * es turbo o atmosférico (no se asume: la diferencia en Bogotá es de 20 puntos).
 */
export function tipoMotor(fuelType: string, s: Record<string, any>): Motor | null {
  if (fuelType === 'Eléctrico') return 'electrico';
  if (fuelType === 'Híbrido' || fuelType === 'Híbrido Enchufable') return 'hibrido';
  const c = s.combustion ?? {};
  if (c.turbo === true || c.supercharger === true || esTurbo(c.inductionType)) return 'turbo';
  if (c.inductionType === 'Atmosférico') return 'atmosferico';
  return null;
}

// ---------------------------------------------------------------------------
// ALTURA
// ---------------------------------------------------------------------------

export interface ResultadoAltura {
  disponible: true;
  motor: Motor;
  potenciaNominal: number;
  ciudades: { nombre: string; altitud: number; potencia: number; perdidaPct: number }[];
  /** Si el híbrido no publica la potencia de su motor a gasolina, la pérdida es un máximo. */
  aproximado: boolean;
  explicacion: string;
}

/** HP que pierde a cierta altura (sin redondear). */
function perdidaHp(e: EntradaIndices, s: Record<string, any>, motor: Motor, altitud: number, p: Valores) {
  const nominal = potencia(s)!;
  const tasa = (m: 'atmosferico' | 'turbo') =>
    (m === 'turbo' ? p['altura.perdidaTurboPor100m'] : p['altura.perdidaAtmosfericoPor100m']) / 100;
  if (motor === 'electrico') return 0;
  if (motor === 'hibrido') {
    // Solo pierde el motor a gasolina; el eléctrico entrega lo mismo en Bogotá.
    const tren = e.fuelType === 'Híbrido' ? 'hybrid' : 'phev';
    const termico = leer(s, `${tren}.enginePower`) ?? nominal; // sin el dato: máximo posible
    const t = esTurbo(s[tren]?.inductionType) ? 'turbo' : 'atmosferico';
    return Math.min(termico, nominal) * tasa(t) * (altitud / 100);
  }
  return nominal * tasa(motor) * (altitud / 100);
}

export function indiceAltura(e: EntradaIndices, p: Valores): ResultadoAltura | NoDisponible {
  const s = specsDe(e.specifications);
  const faltan: string[] = [];
  const nominal = potencia(s);
  const motor = tipoMotor(e.fuelType, s);
  if (nominal === null) faltan.push('la potencia');
  if (motor === null) faltan.push('si el motor es turbo o atmosférico');
  if (nominal === null || motor === null) return { disponible: false, faltan };

  const tren = e.fuelType === 'Híbrido' ? 'hybrid' : 'phev';
  const aproximado = motor === 'hibrido' && leer(s, `${tren}.enginePower`) === null;
  const ciudades = CIUDADES.map(c => {
    const pierde = perdidaHp(e, s, motor, c.altitud, p);
    return {
      nombre: c.nombre,
      altitud: c.altitud,
      potencia: redondear(nominal - pierde),
      perdidaPct: redondear((pierde / nominal) * 100),
    };
  });
  const bogota = ciudades.find(c => c.nombre === 'Bogotá')!;
  const explicacion =
    motor === 'electrico'
      ? `Es eléctrico: el motor no respira aire, así que entrega sus ${nominal} hp igual en Cartagena que en Bogotá.`
      : motor === 'turbo'
        ? `Tiene turbo, que sopla más fuerte cuando el aire es delgado: en Bogotá le quedan unos ${bogota.potencia} hp de ${nominal}.`
        : motor === 'hibrido'
          ? `Es híbrido: el motor eléctrico no pierde nada con la altura y el de gasolina sí. En Bogotá le quedan ${aproximado ? 'al menos ' : 'unos '}${bogota.potencia} hp de ${nominal}.`
          : `Es atmosférico: con la altura cada bocanada trae menos oxígeno. En Bogotá entrega unos ${bogota.potencia} hp de los ${nominal} de la ficha.`;
  return { disponible: true, motor, potenciaNominal: nominal, ciudades, aproximado, explicacion };
}

// ---------------------------------------------------------------------------
// PALMAS
// ---------------------------------------------------------------------------

export interface ResultadoPalmas {
  disponible: true;
  hpPorTonelada: number;
  puntaje: number;
  veredicto: string;
  explicacion: string;
}

export function indicePalmas(e: EntradaIndices, p: Valores): ResultadoPalmas | NoDisponible {
  const s = specsDe(e.specifications);
  const faltan: string[] = [];
  const nominal = potencia(s);
  const peso = leer(s, 'dimensions.curbWeight');
  const motor = tipoMotor(e.fuelType, s);
  if (nominal === null) faltan.push('la potencia');
  if (peso === null) faltan.push('el peso');
  if (motor === null) faltan.push('si el motor es turbo o atmosférico');
  if (nominal === null || peso === null || motor === null) return { disponible: false, faltan };

  const altitud = p['palmas.altitud'];
  const enLaCima = nominal - perdidaHp(e, s, motor, altitud, p);
  const toneladas = (peso + p['palmas.cargaKg']) / 1000;
  const hpT = enLaCima / toneladas;
  const sufre = p['palmas.sufreHasta'];
  const sobrado = p['palmas.sobradoDesde'];
  // 0 = la mitad de lo que "sufre"; 100 = un 20 % por encima de "sobrado".
  const [cero, cien] = [sufre / 2, sobrado * 1.2];
  const puntaje = redondear(acotar(((hpT - cero) / (cien - cero)) * 100));
  const veredicto =
    hpT < sufre ? 'Sube con esfuerzo' : hpT < (sufre + sobrado) / 2 ? 'Cumple' : hpT < sobrado ? 'Sube tranquilo' : 'Sube sobrado';
  const empuje =
    motor === 'electrico' || motor === 'hibrido'
      ? ' Además, el motor eléctrico empuja desde cero, justo lo que pide una curva cerrada en subida.'
      : '';
  const explicacion = `Con cuatro personas y maletas, llegando a ${new Intl.NumberFormat('es-CO').format(altitud)} m le quedan ${redondear(hpT)} hp por cada tonelada que carga.${empuje}`;
  return { disponible: true, hpPorTonelada: redondear(hpT), puntaje, veredicto, explicacion };
}

// ---------------------------------------------------------------------------
// HUECO
// ---------------------------------------------------------------------------

export interface ResultadoHueco {
  disponible: true;
  despejeMm: number;
  flancoMm: number;
  llanta: string;
  puntaje: number;
  veredicto: string;
  explicacion: string;
}

/** "215/55 R17" → { ancho 215, perfil 55, rin 17 }. */
export function leerLlanta(t: unknown): { ancho: number; perfil: number; rin: number } | null {
  if (typeof t !== 'string') return null;
  const m = t.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]{0,2}\s*R?\s*(\d{2})/i);
  if (!m) return null;
  const [ancho, perfil, rin] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ancho < 135 || ancho > 355 || perfil < 25 || perfil > 85 || rin < 12 || rin > 24) return null;
  return { ancho, perfil, rin };
}

export function indiceHueco(e: EntradaIndices, p: Valores): ResultadoHueco | NoDisponible {
  const s = specsDe(e.specifications);
  const despeje = leer(s, 'chassis.groundClearance');
  const llanta = leerLlanta(s.wheels?.tireSize);
  const faltan: string[] = [];
  if (despeje === null) faltan.push('la altura al piso');
  if (llanta === null) faltan.push('la medida de la llanta');
  if (despeje === null || llanta === null) return { disponible: false, faltan };

  const flanco = (llanta.ancho * llanta.perfil) / 100;
  const parte = (x: number, min: number, max: number) => acotar(((x - min) / (max - min)) * 100);
  const puntaje = redondear(0.6 * parte(despeje, p['hueco.despejeMin'], p['hueco.despejeMax']) + 0.4 * parte(flanco, p['hueco.flancoMin'], p['hueco.flancoMax']));
  const veredicto = puntaje < 40 ? 'Sufre en huecos' : puntaje < 65 ? 'Aguanta la ciudad' : puntaje < 85 ? 'Aguanta hueco y resalto' : 'Hecho para trocha';
  const flancoTxt =
    flanco < 100
      ? `una llanta de perfil bajo (${redondear(flanco)} mm de caucho entre el rin y el piso): un hueco puede doblar el rin`
      : `${redondear(flanco)} mm de caucho entre el rin y el piso, que amortiguan el golpe`;
  const explicacion = `Va a ${redondear(despeje)} mm del piso y tiene ${flancoTxt}.`;
  return {
    disponible: true,
    despejeMm: redondear(despeje),
    flancoMm: redondear(flanco),
    llanta: `${llanta.ancho}/${llanta.perfil} R${llanta.rin}`,
    puntaje,
    veredicto,
    explicacion,
  };
}

// ---------------------------------------------------------------------------
// POLICÍAS ACOSTADOS Y RAMPAS
// ---------------------------------------------------------------------------

export interface ResultadoResalto {
  disponible: true;
  despejeMm: number;
  /** Ángulo ventral: publicado o calculado con la altura al piso y la distancia entre ejes. */
  ventral: number;
  ventralCalculado: boolean;
  /** Ángulo de entrada (ataque), si la marca lo publica. */
  entrada: number | null;
  puntaje: number;
  veredicto: string;
  explicacion: string;
}

const grados = (rad: number) => (rad * 180) / Math.PI;

export function indiceResalto(e: EntradaIndices, p: Valores): ResultadoResalto | NoDisponible {
  const s = specsDe(e.specifications);
  const despeje = leer(s, 'chassis.groundClearance');
  const entreEjes = leer(s, 'dimensions.wheelbase');
  const publicado = leer(s, 'offRoad.breakoverAngle');
  const entrada = leer(s, 'offRoad.approachAngle');
  const faltan: string[] = [];
  if (despeje === null) faltan.push('la altura al piso');
  if (publicado === null && entreEjes === null) faltan.push('la distancia entre ejes (o el ángulo ventral)');
  if (despeje === null || (publicado === null && entreEjes === null)) return { disponible: false, faltan };

  // Ventral: el ángulo de la cresta que alcanza a pasar sin que la panza toque.
  const ventral = publicado ?? grados(2 * Math.atan((2 * despeje) / entreEjes!));
  const rampa = grados(Math.atan(p['resalto.rampaPct'] / 100));
  const parte = (x: number, min: number, max: number) => acotar(((x - min) / (max - min)) * 100);
  const pDespeje = parte(despeje, p['resalto.despejeMin'], p['resalto.despejeMax']);
  // 0 = la cresta de la rampa le toca la panza / la trompa; 100 = le sobran 8° (ventral) o 15° (entrada).
  const pVentral = parte(ventral, rampa, rampa + 8);
  const pEntrada = entrada === null ? null : parte(entrada, rampa, rampa + 15);
  const puntaje = redondear(
    pEntrada === null ? 0.55 * pDespeje + 0.45 * pVentral : 0.4 * pDespeje + 0.35 * pVentral + 0.25 * pEntrada
  );
  const veredicto = puntaje < 30 ? 'Raspa si no vas con cuidado' : puntaje < 50 ? 'Despacio y en diagonal' : puntaje < 75 ? 'Pasa tranquilo' : 'Ni los siente';

  const alto = p['resalto.alturaMm'];
  const margen = redondear(despeje - alto);
  const cm = new Intl.NumberFormat('es-CO').format(alto / 10);
  const resalto =
    margen <= 0
      ? `Va a ${redondear(despeje)} mm del piso: un policía acostado alto (${cm} cm) le puede tocar la panza.`
      : `Va a ${redondear(despeje)} mm del piso: a un policía acostado alto (${cm} cm) le saca ${margen} mm.`;
  const holgura = ventral - rampa;
  const cresta =
    holgura >= 3
      ? ` En la parte de arriba de una rampa de parqueadero empinada pasa sin tocar.`
      : holgura >= 0
        ? ` En la parte de arriba de una rampa de parqueadero empinada pasa justo: súbela despacio.`
        : ` En la parte de arriba de una rampa de parqueadero empinada puede rozar la panza: súbela despacio y en diagonal.`;
  const trompa = entrada !== null && entrada < rampa + 4 ? ' La trompa va baja: entra a las rampas en diagonal.' : '';
  return {
    disponible: true,
    despejeMm: redondear(despeje),
    ventral: Math.round(ventral * 10) / 10,
    ventralCalculado: publicado === null,
    entrada,
    puntaje,
    veredicto,
    explicacion: resalto + cresta + trompa,
  };
}

// ---------------------------------------------------------------------------
// COSTO REAL DE TENENCIA
// ---------------------------------------------------------------------------

export interface ComponenteCRT {
  clave: 'depreciacion' | 'energia' | 'seguro' | 'impuesto' | 'mantenimiento' | 'soat';
  nombre: string;
  valor: number;
  detalle: string;
  estimado: boolean;
}

export interface ResultadoCRT {
  disponible: true;
  anios: number;
  total: number;
  porMes: number;
  componentes: ComponenteCRT[];
  valorAlFinal: number;
}

/** kWh que gasta un eléctrico por cada 100 km: publicado, o batería ÷ autonomía (derivado). */
function kwhPor100(s: Record<string, any>): number | null {
  const ciudad = leer(s, 'electric.cityElectricConsumption');
  const carretera = leer(s, 'electric.highwayElectricConsumption');
  if (ciudad !== null && carretera !== null) return (ciudad + carretera) / 2;
  if (ciudad !== null || carretera !== null) return (ciudad ?? carretera)!;
  const bateria = leer(s, 'electric.batteryCapacity');
  const autonomia = leer(s, 'electric.realRangeMixed', 'electric.electricRange');
  return bateria !== null && autonomia !== null ? (bateria / autonomia) * 100 : null;
}

function cilindraje(fuelType: string, s: Record<string, any>) {
  return leer(s, 'combustion.displacement', fuelType === 'Híbrido' ? 'hybrid.displacement' : 'phev.displacement');
}

export function costoRealTenencia(e: EntradaIndices, p: Valores): ResultadoCRT | NoDisponible {
  const s = specsDe(e.specifications);
  const electrico = e.fuelType === 'Eléctrico';
  const diesel = e.fuelType === 'Diesel';
  if (e.fuelType === 'Híbrido Enchufable') {
    return {
      disponible: false,
      faltan: [],
      nota: 'En un híbrido enchufable el gasto depende de cuánto lo cargues en casa: pronto lo calculamos con tu rutina.',
    };
  }
  const faltan: string[] = [];
  if (!(e.price > 0)) faltan.push('el precio');
  const kmGal = electrico ? null : rendimiento(s);
  const kwh = electrico ? kwhPor100(s) : null;
  if (!electrico && kmGal === null) faltan.push('el consumo de combustible');
  if (electrico && kwh === null) faltan.push('el consumo de energía (o batería y autonomía)');
  const cc = electrico ? null : cilindraje(e.fuelType, s);
  if (!electrico && cc === null) faltan.push('el cilindraje (define el SOAT)');
  if (faltan.length) return { disponible: false, faltan };

  const n = p['crt.anios'];
  const kmTotal = p['crt.kmAnio'] * n;
  const fmt = (x: number) => new Intl.NumberFormat('es-CO').format(Math.round(x));

  // Depreciación: la confiabilidad de la marca (Toyota, Mazda) frena la caída.
  const conf = e.confiabilidadMarca ?? null;
  const ajuste = conf === null ? 1 : Math.max(0.8, Math.min(1.2, 1 + (70 - conf) / 150));
  const d1 = (p['crt.depreciacionAnio1'] / 100) * ajuste;
  const dn = (p['crt.depreciacionAnual'] / 100) * ajuste;
  const valores: number[] = []; // valor al inicio de cada año
  let v = e.price;
  for (let a = 0; a < n; a++) {
    valores.push(v);
    v = v * (1 - (a === 0 ? d1 : dn));
  }
  const valorAlFinal = v;

  const tarifaImpuesto = (avaluo: number) =>
    electrico
      ? p['crt.impuestoTarifaElectrico']
      : avaluo <= p['crt.impuestoTope1']
        ? p['crt.impuestoTarifa1']
        : avaluo <= p['crt.impuestoTope2']
          ? p['crt.impuestoTarifa2']
          : p['crt.impuestoTarifa3'];
  const impuesto = valores.reduce((t, x) => t + (x * tarifaImpuesto(x)) / 100, 0);

  const seguro = valores.reduce(
    (t, x) => t + (x * (x <= 120_000_000 ? p['crt.seguroTasaHasta120M'] : p['crt.seguroTasaMas120M'])) / 100,
    0
  );

  const soatAnio = electrico
    ? p['crt.soatMenos1500'] * (1 - p['crt.soatDescuentoElectrico'] / 100)
    : cc! < 1500
      ? p['crt.soatMenos1500']
      : cc! <= 2500
        ? p['crt.soat1500a2500']
        : p['crt.soatMas2500'];

  const energia = electrico
    ? (kmTotal / 100) * kwh! * p['crt.kwh']
    : (kmTotal / kmGal!) * (diesel ? p['crt.galonAcpm'] : p['crt.galonGasolina']);

  const intervalo = leer(s, 'commercial.serviceIntervalKm') ?? p['crt.intervaloServicioKm'];
  const servicios = Math.floor(kmTotal / intervalo);
  const publicado3 = leer(s, 'commercial.maintenanceCost3');
  const porServicio =
    publicado3 !== null
      ? publicado3 / 3
      : electrico
        ? p['crt.servicioElectrico']
        : diesel
          ? p['crt.servicioDiesel']
          : e.fuelType === 'Híbrido'
            ? p['crt.servicioHibrido']
            : p['crt.servicioGasolina'];

  const componentes: ComponenteCRT[] = [
    {
      clave: 'depreciacion',
      nombre: 'Lo que se desvaloriza',
      valor: e.price - valorAlFinal,
      detalle: `En ${n} años pasaría de $${fmt(e.price)} a unos $${fmt(valorAlFinal)}${conf !== null && ajuste !== 1 ? (ajuste < 1 ? '; la marca aguanta bien el precio de reventa' : '; la marca se desvaloriza más rápido') : ''}.`,
      estimado: true,
    },
    {
      clave: 'energia',
      nombre: electrico ? 'Electricidad' : diesel ? 'ACPM' : 'Gasolina',
      valor: energia,
      detalle: electrico
        ? `${fmt(kmTotal)} km cargando en casa: ${kwh!.toFixed(1).replace('.', ',')} kWh cada 100 km a $${fmt(p['crt.kwh'])} el kWh.`
        : `${fmt(kmTotal)} km rindiendo ${fmt(kmGal!)} km por galón, a $${fmt(diesel ? p['crt.galonAcpm'] : p['crt.galonGasolina'])} el galón.`,
      estimado: false,
    },
    {
      clave: 'seguro',
      nombre: 'Seguro todo riesgo',
      valor: seguro,
      detalle: `Entre ${p['crt.seguroTasaMas120M']} % y ${p['crt.seguroTasaHasta120M']} % del valor del carro cada año; tu edad, tu barrio y tu historial lo mueven.`,
      estimado: true,
    },
    {
      clave: 'impuesto',
      nombre: 'Impuesto vehicular',
      valor: impuesto,
      detalle: electrico
        ? `Por ser eléctrico paga máximo ${p['crt.impuestoTarifaElectrico']} % del avalúo (Ley 1964).`
        : `Tarifa de Antioquia según el avalúo de cada año (${p['crt.impuestoTarifa1']} %, ${p['crt.impuestoTarifa2']} % o ${p['crt.impuestoTarifa3']} %).`,
      estimado: false,
    },
    {
      clave: 'mantenimiento',
      nombre: 'Mantenimientos',
      valor: servicios * porServicio,
      detalle: `${servicios} servicios, uno cada ${fmt(intervalo)} km${publicado3 !== null ? ', con el costo que publica la marca' : `, de unos $${fmt(porServicio)} cada uno`}.`,
      estimado: publicado3 === null,
    },
    {
      clave: 'soat',
      nombre: 'SOAT',
      valor: soatAnio * n,
      detalle: electrico ? `$${fmt(soatAnio)} al año, con el descuento de ley para eléctricos.` : `$${fmt(soatAnio)} al año por su cilindraje.`,
      estimado: false,
    },
  ].map(c => ({ ...c, valor: redondear(c.valor, 1000) })) as ComponenteCRT[];

  const total = componentes.reduce((t, c) => t + c.valor, 0);
  return { disponible: true, anios: n, total, porMes: redondear(total / (n * 12), 1000), componentes, valorAlFinal: redondear(valorAlFinal, 1000) };
}

// ---------------------------------------------------------------------------

export interface IndicesVehiculo {
  altura: ResultadoAltura | NoDisponible;
  palmas: ResultadoPalmas | NoDisponible;
  hueco: ResultadoHueco | NoDisponible;
  resalto: ResultadoResalto | NoDisponible;
  picoYPlaca: ResultadoPicoYPlaca | NoDisponible;
  crt: ResultadoCRT | NoDisponible;
}

export function calcularIndices(e: EntradaIndices, p: Valores): IndicesVehiculo {
  return {
    altura: indiceAltura(e, p),
    palmas: indicePalmas(e, p),
    hueco: indiceHueco(e, p),
    resalto: indiceResalto(e, p),
    picoYPlaca: picoYPlaca(e, e.hoy),
    crt: costoRealTenencia(e, p),
  };
}
