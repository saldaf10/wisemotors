// Partir "Suspensión" en delantera y trasera (lib/attributes/suspension.ts).
// Uso: npx tsx scripts/verify-suspension.ts  (sin BD ni API)

import { partirSuspension } from '../lib/attributes/suspension';

let fallas = 0;
function check(texto: string, delantera?: string, trasera?: string, porOrden = false) {
  const r = partirSuspension(texto);
  const ok = r.delantera === delantera && r.trasera === trasera && !!r.porOrden === porOrden;
  console.log(`${ok ? '✓' : '✗'} «${texto}» → ${r.delantera ?? '—'} | ${r.trasera ?? '—'}${r.porOrden ? ' (por orden)' : ''}`);
  if (!ok) fallas++;
}

check('Independiente McPherson adelante / eje torsional atrás', 'Independiente McPherson', 'Eje torsional');
check('Delantera: McPherson, Trasera: barra de torsión', 'McPherson', 'Barra de torsión');
check('McPherson delantera y multibrazo trasera', 'McPherson', 'Multibrazo');
check('Suspensión delantera independiente tipo McPherson; trasera de eje rígido con ballestas', 'Independiente tipo McPherson', 'Eje rígido con ballestas');
check('Independiente: McPherson adelante / multibrazo atrás', 'Independiente McPherson', 'Multibrazo');
check('Independiente en las cuatro ruedas', 'Independiente', 'Independiente');
check('Multibrazo en ambos ejes', 'Multibrazo', 'Multibrazo');
check('McPherson / Multilink', 'McPherson', 'Multilink', true);
check('Independiente');
check('');

console.log(fallas ? `\n${fallas} fallas` : '\nTodo verificado ✓');
process.exit(fallas ? 1 : 0);
