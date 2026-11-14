// ============================================================================
// Verificación de los Índices WiseMotors (lib/indices/calculo.ts).
// Funciones puras, sin base de datos ni API keys.
//
//   npx tsx scripts/verify-indices.ts
//
// Sale con código 1 si algo falla. Al final imprime los índices de los 10
// carros DEMO para mirarlos con criterio (no son asserts).
// ============================================================================

import { readFileSync } from 'node:fs';
import { VALORES_POR_DEFECTO as P } from '../lib/indices/parametros';
import { calcularIndices, costoRealTenencia, indiceAltura, indiceHueco, indicePalmas, indiceResalto, leerLlanta } from '../lib/indices/calculo';
import { picoYPlaca } from '../lib/indices/pico-y-placa';
import { opcionMasCercana } from '../lib/subida/opciones';

let fallas = 0;
function check(nombre: string, ok: boolean, detalle = '') {
  if (ok) console.log(`  ✓ ${nombre}`);
  else {
    fallas++;
    console.error(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

const corolla = {
  fuelType: 'Gasolina',
  price: 110_000_000,
  specifications: {
    combustion: { maxPower: 170, inductionType: 'Atmosférico', displacement: 2000, combinedConsumption: 45 },
    dimensions: { curbWeight: 1300 },
    chassis: { groundClearance: 160 },
    wheels: { tireSize: '215/55 R17' },
  },
};
const electrico = {
  fuelType: 'Eléctrico',
  price: 140_000_000,
  specifications: {
    electric: { maxPower: 170, batteryCapacity: 60, electricRange: 400 },
    dimensions: { curbWeight: 1700 },
  },
};
const turbo = { ...corolla, specifications: { ...corolla.specifications, combustion: { ...corolla.specifications.combustion, inductionType: 'Turbo' } } };
const sinInduccion = { ...corolla, specifications: { ...corolla.specifications, combustion: { maxPower: 170 } } };

console.log('\nÍndice Altura');
const a = indiceAltura(corolla, P);
check('Corolla atmosférico de 170 hp → ~126 hp en Bogotá (plan §4.1)', a.disponible && a.ciudades.find(c => c.nombre === 'Bogotá')!.potencia === 125,
  JSON.stringify(a.disponible && a.ciudades.find(c => c.nombre === 'Bogotá')));
const e = indiceAltura(electrico, P);
check('eléctrico no pierde nada en Bogotá', e.disponible && e.ciudades.every(c => c.perdidaPct === 0));
const t = indiceAltura(turbo, P);
check('turbo pierde mucho menos que atmosférico', t.disponible && a.disponible && t.ciudades[8].perdidaPct < a.ciudades[8].perdidaPct / 3);
const x = indiceAltura(sinInduccion, P);
check('sin saber si es turbo NO se calcula (no se asume)', !x.disponible && x.faltan.includes('si el motor es turbo o atmosférico'));
const h = indiceAltura({ fuelType: 'Híbrido', price: 1, specifications: { hybrid: { maxPower: 200, enginePower: 150 } } }, P);
check('híbrido: solo pierde el motor a gasolina', h.disponible && h.ciudades[8].potencia === Math.round(200 - 150 * 0.264), JSON.stringify(h.disponible && h.ciudades[8]));

console.log('\nÍndice Palmas');
const pa = indicePalmas(corolla, P);
const pe = indicePalmas(electrico, P);
check('calcula hp por tonelada con carga', pa.disponible && pa.hpPorTonelada > 60 && pa.hpPorTonelada < 110, JSON.stringify(pa));
check('sin peso, dice qué falta', (() => { const r = indicePalmas({ ...electrico, specifications: { electric: { maxPower: 170 } } }, P); return !r.disponible && r.faltan.includes('el peso'); })());
check('eléctrico menciona el empuje desde cero', pe.disponible && /desde cero/.test(pe.explicacion));
check('puntaje entre 0 y 100', pa.disponible && pa.puntaje >= 0 && pa.puntaje <= 100);

console.log('\nÍndice Hueco');
check('lee "215/55 R17"', JSON.stringify(leerLlanta('215/55 R17')) === JSON.stringify({ ancho: 215, perfil: 55, rin: 17 }));
check('lee "225/40ZR18"', leerLlanta('225/40ZR18')?.perfil === 40);
check('rechaza basura', leerLlanta('R17') === null && leerLlanta(17) === null);
const hu = indiceHueco(corolla, P);
const bajo = indiceHueco({ ...corolla, specifications: { chassis: { groundClearance: 130 }, wheels: { tireSize: '225/40 R18' } } }, P);
const trocha = indiceHueco({ ...corolla, specifications: { chassis: { groundClearance: 230 }, wheels: { tireSize: '265/65 R17' } } }, P);
check('sedán normal queda en el medio', hu.disponible && hu.puntaje > 20 && hu.puntaje < 70, JSON.stringify(hu));
check('perfil 40 y bajito: sufre', bajo.disponible && bajo.veredicto === 'Sufre en huecos');
check('camioneta de trocha: arriba', trocha.disponible && trocha.puntaje >= 85);

console.log('\nCosto Real de Tenencia');
const c = costoRealTenencia(corolla, P);
check('calcula con los 6 componentes', c.disponible && c.componentes.length === 6);
check('total = suma de componentes', c.disponible && c.total === c.componentes.reduce((s, x) => s + x.valor, 0));
const galones = (12000 * 5) / 45;
check('gasolina = km ÷ rendimiento × galón', c.disponible && Math.abs(c.componentes.find(x => x.clave === 'energia')!.valor - galones * P['crt.galonGasolina']) < 1000);
const ce = costoRealTenencia(electrico, P);
check('eléctrico: energía derivada de batería ÷ autonomía', ce.disponible && ce.componentes.find(x => x.clave === 'energia')!.valor > 0);
check('eléctrico paga menos energía que el de gasolina', ce.disponible && c.disponible && ce.componentes.find(x => x.clave === 'energia')!.valor < c.componentes.find(x => x.clave === 'energia')!.valor);
check('eléctrico: impuesto al 1 %', ce.disponible && ce.componentes.find(x => x.clave === 'impuesto')!.detalle.includes('1 %'));
check('sin consumo, no se calcula', !costoRealTenencia({ ...corolla, specifications: { combustion: { displacement: 1600 } } }, P).disponible);
check('PHEV explica por qué no', (() => { const r = costoRealTenencia({ fuelType: 'Híbrido Enchufable', price: 1, specifications: {} }, P); return !r.disponible && !!r.nota; })());
const toyota = costoRealTenencia({ ...corolla, confiabilidadMarca: 98 }, P);
const otra = costoRealTenencia({ ...corolla, confiabilidadMarca: 50 }, P);
check('marca confiable se desvaloriza menos', toyota.disponible && otra.disponible && toyota.valorAlFinal > otra.valorAlFinal);

console.log('\nNormalización de la tracción y la inducción');
// ── Policías acostados ──
const res = (h: number, l: number, extra: Record<string, number> = {}) =>
  indiceResalto({ fuelType: 'Gasolina', price: 1, specifications: { chassis: { groundClearance: h }, dimensions: { wheelbase: l }, offRoad: extra } }, P);
const rBajo = res(120, 2700);
const rSuv = res(160, 2570, { approachAngle: 17, breakoverAngle: 14.2 });
const rPick = res(274, 3745, { approachAngle: 30, breakoverAngle: 23 });
check('resalto: hatch de 120 mm raspa', rBajo.disponible && rBajo.veredicto === 'Raspa si no vas con cuidado');
check('resalto: ventral calculado ≈ publicado (Tracker 14,2°)', (() => { const r = res(160, 2570); return r.disponible && r.ventralCalculado && Math.abs(r.ventral - 14.2) < 0.2; })());
check('resalto: SUV de 160 mm pasa tranquilo', rSuv.disponible && rSuv.veredicto === 'Pasa tranquilo');
check('resalto: pickup alta ni los siente', rPick.disponible && rPick.puntaje === 100);
check('resalto: sin altura al piso no se muestra', !indiceResalto({ fuelType: 'Gasolina', price: 1, specifications: { dimensions: { wheelbase: 2600 } } }, P).disponible);

// ── Pico y placa ──
const hoy = new Date('2026-11-14');
const tiene = (fuelType: string, ciudad: string, d = hoy) => {
  const r = picoYPlaca({ fuelType }, d);
  return r.disponible ? r.ciudades.find(c => c.nombre === ciudad)?.tiene : undefined;
};
check('pyp: gasolina en Bogotá sí', tiene('Gasolina', 'Bogotá') === true);
check('pyp: eléctrico en Bogotá no', tiene('Eléctrico', 'Bogotá') === false);
check('pyp: híbrido en Medellín no', tiene('Híbrido', 'Medellín') === false);
check('pyp: enchufable cuenta como híbrido', tiene('Híbrido Enchufable', 'Cali') === false);
check('pyp: Barranquilla no tiene para particulares', tiene('Gasolina', 'Barranquilla') === false);
check('pyp: híbrido en Manizales sí (nov-2026)', tiene('Híbrido', 'Manizales') === true);
check('pyp: Manizales desaparece al vencer la medida', tiene('Híbrido', 'Manizales', new Date('2026-12-01')) === undefined);
check('pyp: Pereira no se muestra (fuentes contradictorias)', tiene('Gasolina', 'Pereira') === undefined);
check('pyp: vans de carga no se muestran', !picoYPlaca({ fuelType: 'Diesel', type: 'Van', vehicleType: 'Comercial' }, hoy).disponible);

for (const [entra, sale] of [
  ['4WD', '4x4'], ['Tracción total', 'Integral (AWD)'], ['AWD', 'Integral (AWD)'], ['4x2', 'Delantera'],
  ['Tracción delantera', 'Delantera'], ['RWD', 'Trasera'], ['xDrive', 'Integral (AWD)'], ['E-Four', 'Integral (AWD)'],
] as const) {
  check(`"${entra}" → ${sale}`, opcionMasCercana(entra, ['Delantera', 'Trasera', 'Integral (AWD)', '4x4']) === sale);
}
const IND = ['Atmosférico', 'Turbo', 'Supercargado', 'Turbo y supercargado'];
check('"1.0 TSI" → Turbo', opcionMasCercana('1.0 TSI', IND, 'combustion.inductionType') === 'Turbo');
check('"aspiración natural" → Atmosférico', opcionMasCercana('aspiración natural', IND, 'combustion.inductionType') === 'Atmosférico');
check('"Frenos de tambor" → Tambor', opcionMasCercana('Frenos de tambor', ['Disco', 'Tambor']) === 'Tambor');

console.log('\nLos 10 DEMO (para mirar con criterio):');
const demo = JSON.parse(readFileSync('data/semillas/vehiculos-demo.json', 'utf8'));
for (const v of demo) {
  const specs: Record<string, any> = {};
  for (const f of v.facts) {
    const partes = f.key.split('.');
    let n = specs;
    for (const k of partes.slice(0, -1)) n = n[k] = n[k] ?? {};
    n[partes[partes.length - 1]] = f.value;
  }
  const r = calcularIndices({ fuelType: v.fuelType, price: v.price, specifications: specs }, P);
  const txt = (x: any, f: (x: any) => string) => (x.disponible ? f(x) : `falta ${x.faltan.join(', ') || x.nota}`);
  console.log(`  ${v.brand} ${v.model}`);
  console.log(`     Altura: ${txt(r.altura, x => `Bogotá ${x.ciudades[8].potencia}/${x.potenciaNominal} hp (−${x.ciudades[8].perdidaPct} %)`)}`);
  console.log(`     Palmas: ${txt(r.palmas, x => `${x.hpPorTonelada} hp/t · ${x.veredicto} (${x.puntaje})`)}`);
  console.log(`     Hueco:  ${txt(r.hueco, x => `${x.veredicto} (${x.puntaje})`)}`);
  console.log(`     Resalto: ${txt(r.resalto, x => `${x.veredicto} (${x.puntaje})`)}`);
  console.log(`     CRT:    ${txt(r.crt, x => `$${Math.round(x.total / 1e6)} M en 5 años ($${(x.porMes / 1e6).toFixed(1)} M/mes)`)}`);
}

console.log(fallas ? `\n${fallas} fallas` : '\nTodo verificado ✓');
process.exit(fallas ? 1 : 0);
