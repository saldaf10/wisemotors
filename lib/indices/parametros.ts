// ============================================================================
// Parámetros de los Índices WiseMotors, con vigencia (tabla parametros_indices).
//
// Esta lista ES la tabla curada: en cada deploy de producción, sembrarParametros
// compara cada valor con la fila vigente; si cambió, cierra la vigente (validTo)
// y crea la nueva. Así queda la historia y nunca se edita en caliente.
// Para recalibrar (cada año el SOAT y el impuesto, cada mes el galón): se cambia
// aquí el valor, la fuente y la fecha, y se despliega.
//
// Los que dicen "estimación de mercado" no son normativa: son el criterio de la
// casa con una referencia, y la interfaz los muestra como estimados.
// ============================================================================

import type { PrismaClient } from '@prisma/client';

export interface Parametro {
  clave: string;
  valor: number;
  unidad: string;
  descripcionEs: string;
  fuente: string;
}

export const PARAMETROS: Parametro[] = [
  // ── Altura ────────────────────────────────────────────────────────────────
  {
    clave: 'altura.perdidaAtmosfericoPor100m',
    valor: 1,
    unidad: '% por 100 m',
    descripcionEs: 'Potencia que pierde un motor atmosférico por cada 100 m sobre el nivel del mar (menos oxígeno por bocanada).',
    fuente: 'Regla de ingeniería SAE J1349 / plan WiseMotors §4.1 (Bogotá 2.640 m ≈ −26 %)',
  },
  {
    clave: 'altura.perdidaTurboPor100m',
    valor: 0.25,
    unidad: '% por 100 m',
    descripcionEs: 'Lo que pierde un motor turbo: el turbo compensa casi todo soplando más fuerte.',
    fuente: 'Estimación de ingeniería (turbo compensa la densidad del aire hasta su límite)',
  },
  {
    clave: 'palmas.altitud',
    valor: 2450,
    unidad: 'm',
    descripcionEs: 'Altura del Alto de Las Palmas, la referencia de subida exigente de Medellín.',
    fuente: 'Vía Las Palmas, Alto de Las Palmas (Antioquia)',
  },
  {
    clave: 'palmas.sufreHasta',
    valor: 55,
    unidad: 'hp por tonelada',
    descripcionEs: 'Por debajo de esto, cargado y a esa altura, sube con esfuerzo.',
    fuente: 'Criterio WiseMotors (calibrado con el mercado CO: un Picanto ~40, un CX-30 2.0 ~67, una RAV4 híbrida ~83)',
  },
  {
    clave: 'palmas.sobradoDesde',
    valor: 110,
    unidad: 'hp por tonelada',
    descripcionEs: 'Desde aquí sube sobrado, aun con la familia y el baúl lleno.',
    fuente: 'Criterio WiseMotors',
  },
  {
    clave: 'palmas.cargaKg',
    valor: 300,
    unidad: 'kg',
    descripcionEs: 'Carga que se le suma al peso del carro: cuatro personas y maletas.',
    fuente: 'Criterio WiseMotors',
  },

  // ── Hueco ─────────────────────────────────────────────────────────────────
  {
    clave: 'hueco.despejeMin',
    valor: 130,
    unidad: 'mm',
    descripcionEs: 'Despeje con el que un carro raspa en casi cualquier resalto (puntaje 0 en esa parte).',
    fuente: 'Criterio WiseMotors',
  },
  {
    clave: 'hueco.despejeMax',
    valor: 220,
    unidad: 'mm',
    descripcionEs: 'Despeje con el que ya no se sufre en vía colombiana (puntaje 100 en esa parte).',
    fuente: 'Criterio WiseMotors',
  },
  {
    clave: 'hueco.flancoMin',
    valor: 85,
    unidad: 'mm',
    descripcionEs: 'Alto de llanta (flanco) con el que un hueco dobla rines: perfil 40 en rin 18.',
    fuente: 'Criterio WiseMotors',
  },
  {
    clave: 'hueco.flancoMax',
    valor: 145,
    unidad: 'mm',
    descripcionEs: 'Flanco que absorbe el hueco sin drama: perfil 65 de camioneta.',
    fuente: 'Criterio WiseMotors',
  },

  // ── Policías acostados y rampas ───────────────────────────────────────────
  {
    clave: 'resalto.alturaMm',
    valor: 100,
    unidad: 'mm',
    descripcionEs: 'Alto de un policía acostado alto en una calle colombiana.',
    fuente: 'Criterio WiseMotors',
  },
  {
    clave: 'resalto.despejeMin',
    valor: 100,
    unidad: 'mm',
    descripcionEs: 'Altura al piso con la que un policía acostado alto casi toca la panza (puntaje 0 en esa parte).',
    fuente: 'Criterio WiseMotors',
  },
  {
    clave: 'resalto.despejeMax',
    valor: 200,
    unidad: 'mm',
    descripcionEs: 'Altura al piso con la que ningún policía acostado preocupa (puntaje 100 en esa parte).',
    fuente: 'Criterio WiseMotors',
  },
  {
    clave: 'resalto.rampaPct',
    valor: 18,
    unidad: '%',
    descripcionEs: 'Pendiente de una rampa de parqueadero empinada (edificios y centros comerciales).',
    fuente: 'Criterio WiseMotors',
  },

  // ── Costo Real de Tenencia (5 años, Medellín) ─────────────────────────────
  { clave: 'crt.anios', valor: 5, unidad: 'años', descripcionEs: 'Horizonte del cálculo.', fuente: 'Plan WiseMotors §4.4' },
  {
    clave: 'crt.kmAnio',
    valor: 12000,
    unidad: 'km/año',
    descripcionEs: 'Kilómetros que recorre un carro particular al año.',
    fuente: 'Estimación de mercado (uso particular urbano en Colombia)',
  },
  {
    clave: 'crt.galonGasolina',
    valor: 16251,
    unidad: 'COP/galón',
    descripcionEs: 'Gasolina corriente en Medellín, septiembre de 2026.',
    fuente: 'MinMinas/CREG, reportado por Infobae 30-ago-2026 (precios congelados en septiembre)',
  },
  {
    clave: 'crt.galonAcpm',
    valor: 11806,
    unidad: 'COP/galón',
    descripcionEs: 'ACPM (diésel) en Medellín, septiembre de 2026.',
    fuente: 'MinMinas/CREG, reportado por Infobae 30-ago-2026',
  },
  {
    clave: 'crt.kwh',
    valor: 864.06,
    unidad: 'COP/kWh',
    descripcionEs: 'Energía residencial EPM estrato 4 (sin subsidio ni contribución), cargando en casa.',
    fuente: 'EPM, Tarifas mercado regulado Antioquia, abril de 2026',
  },
  {
    clave: 'crt.soatMenos1500',
    valor: 447300,
    unidad: 'COP/año',
    descripcionEs: 'SOAT auto familiar de menos de 1.500 cc, menos de 10 años.',
    fuente: 'Fasecolda, tarifas máximas SOAT 2026',
  },
  {
    clave: 'crt.soat1500a2500',
    valor: 544700,
    unidad: 'COP/año',
    descripcionEs: 'SOAT auto familiar de 1.500 a 2.500 cc, menos de 10 años.',
    fuente: 'Fasecolda, tarifas máximas SOAT 2026',
  },
  {
    clave: 'crt.soatMas2500',
    valor: 636000,
    unidad: 'COP/año',
    descripcionEs: 'SOAT auto familiar de más de 2.500 cc, menos de 10 años.',
    fuente: 'Fasecolda, tarifas máximas SOAT 2026',
  },
  {
    clave: 'crt.soatDescuentoElectrico',
    valor: 10,
    unidad: '%',
    descripcionEs: 'Descuento en el SOAT para eléctricos (se toma la categoría de menos de 1.500 cc).',
    fuente: 'Ley 1964 de 2019',
  },
  {
    clave: 'crt.impuestoTope1',
    valor: 57_349_000,
    unidad: 'COP',
    descripcionEs: 'Avalúo hasta el que se paga la tarifa más baja del impuesto vehicular en Antioquia.',
    fuente: 'Gobernación de Antioquia, impuesto vehicular 2026',
  },
  {
    clave: 'crt.impuestoTope2',
    valor: 129_032_000,
    unidad: 'COP',
    descripcionEs: 'Avalúo hasta el que se paga la tarifa media; por encima, la alta.',
    fuente: 'Gobernación de Antioquia, impuesto vehicular 2026',
  },
  { clave: 'crt.impuestoTarifa1', valor: 1.5, unidad: '%', descripcionEs: 'Tarifa del impuesto vehicular, avalúo bajo.', fuente: 'Gobernación de Antioquia 2026' },
  { clave: 'crt.impuestoTarifa2', valor: 2.5, unidad: '%', descripcionEs: 'Tarifa del impuesto vehicular, avalúo medio.', fuente: 'Gobernación de Antioquia 2026' },
  { clave: 'crt.impuestoTarifa3', valor: 3.5, unidad: '%', descripcionEs: 'Tarifa del impuesto vehicular, avalúo alto.', fuente: 'Gobernación de Antioquia 2026' },
  {
    clave: 'crt.impuestoTarifaElectrico',
    valor: 1,
    unidad: '%',
    descripcionEs: 'Tope del impuesto vehicular para eléctricos.',
    fuente: 'Ley 1964 de 2019; Antioquia 2026 aplica 1 %',
  },
  {
    clave: 'crt.seguroTasaHasta120M',
    valor: 4,
    unidad: '% del valor/año',
    descripcionEs: 'Seguro todo riesgo, carros de hasta $120 M (las aseguradoras cobran entre 3 % y 6 %).',
    fuente: 'Estimación de mercado: Seguros Bolívar, La República y Comparabien 2026',
  },
  {
    clave: 'crt.seguroTasaMas120M',
    valor: 2.5,
    unidad: '% del valor/año',
    descripcionEs: 'Seguro todo riesgo, carros de más de $120 M (tasas preferenciales).',
    fuente: 'Estimación de mercado: La República 2026 (alta gama por debajo de 2 %–3 %)',
  },
  {
    clave: 'crt.depreciacionAnio1',
    valor: 18,
    unidad: '%',
    descripcionEs: 'Lo que pierde un carro nuevo el primer año (15 %–25 % según el mercado).',
    fuente: 'Estimación de mercado: El Espectador, guías Fasecolda',
  },
  {
    clave: 'crt.depreciacionAnual',
    valor: 11,
    unidad: '% por año',
    descripcionEs: 'Lo que pierde cada año siguiente (10 %–15 %).',
    fuente: 'Estimación de mercado: El Espectador, guías Fasecolda',
  },
  {
    clave: 'crt.servicioGasolina',
    valor: 650_000,
    unidad: 'COP por servicio',
    descripcionEs: 'Mantenimiento programado típico en concesionario, carro a gasolina.',
    fuente: 'Estimación de mercado (tarifas de concesionario Medellín 2026)',
  },
  { clave: 'crt.servicioDiesel', valor: 850_000, unidad: 'COP por servicio', descripcionEs: 'Mantenimiento programado típico, diésel.', fuente: 'Estimación de mercado' },
  { clave: 'crt.servicioHibrido', valor: 600_000, unidad: 'COP por servicio', descripcionEs: 'Mantenimiento programado típico, híbrido.', fuente: 'Estimación de mercado' },
  {
    clave: 'crt.servicioElectrico',
    valor: 350_000,
    unidad: 'COP por servicio',
    descripcionEs: 'Mantenimiento programado típico, eléctrico (sin aceite, filtros ni correas).',
    fuente: 'Estimación de mercado',
  },
  {
    clave: 'crt.intervaloServicioKm',
    valor: 10_000,
    unidad: 'km',
    descripcionEs: 'Cada cuánto se hace un mantenimiento si la marca no lo publica.',
    fuente: 'Estimación de mercado',
  },
];

export type Valores = Record<string, number>;

export const VALORES_POR_DEFECTO: Valores = Object.fromEntries(PARAMETROS.map(p => [p.clave, p.valor]));

/** Cierra la fila vigente si el valor cambió y crea la nueva. Idempotente. */
export async function sembrarParametros(prisma: PrismaClient) {
  const ahora = new Date();
  let cambios = 0;
  for (const p of PARAMETROS) {
    const vigente = await prisma.parametroIndice.findFirst({ where: { clave: p.clave, validTo: null } });
    if (vigente && vigente.valor === p.valor) continue;
    if (vigente) await prisma.parametroIndice.update({ where: { id: vigente.id }, data: { validTo: ahora } });
    await prisma.parametroIndice.create({
      data: { clave: p.clave, valor: p.valor, unidad: p.unidad, descripcionEs: p.descripcionEs, fuente: p.fuente, validFrom: ahora },
    });
    cambios++;
  }
  return cambios;
}
