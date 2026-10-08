// ============================================================================
// Verificación de los campos clave (lib/attributes/clave.ts). Sin BD.
//   npx tsx scripts/verify-clave.ts
// ============================================================================

import { camposClave, clavesFaltantes, keyDeEntrada, valoresDeSpecs } from '../lib/attributes/clave';

let fallas = 0;
function check(nombre: string, ok: boolean, detalle = '') {
  if (ok) console.log(`  ✓ ${nombre}`);
  else {
    fallas++;
    console.error(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

const ids = (fuel: string) => camposClave(fuel).map(c => c.id);
check('un eléctrico no pide cilindraje, tanque ni caja', !ids('Eléctrico').some(i => ['cilindraje', 'tanque', 'caja', 'consumo', 'induccion'].includes(i)));
check('un eléctrico pide autonomía, batería y carga', ['autonomia', 'bateria', 'cargaRapida', 'cargaCasa'].every(i => ids('Eléctrico').includes(i)));
check('un gasolina no pide batería', !ids('Gasolina').includes('bateria'));
check('un híbrido pide rendimiento y tanque', ids('Híbrido').includes('consumo') && ids('Híbrido').includes('tanque'));

const f = (v: Record<string, unknown>, fuel = 'Gasolina', sin: string[] = []) => clavesFaltantes(fuel, v, sin).map(c => c.id);
check('rendimiento se cumple con solo ciudad', !f({ 'combustion.cityConsumption': 40 }).includes('consumo'));
check('"No lo tiene" (false) cuenta como dato', !f({ 'safety.isofix': false }).includes('isofix'));
check('vacío no cuenta', f({ 'wheels.tireSize': '' }).includes('llanta'));
check('"no existe" deja de pedirse', !f({}, 'Gasolina', ['ncap']).includes('ncap'));
check('inducción «Turbo» cumple "turbo o atmosférico"', !f({ 'combustion.inductionType': 'Turbo' }).includes('induccion'));
check('la potencia de un híbrido se escribe en hybrid.maxPower', keyDeEntrada(camposClave('Híbrido').find(c => c.id === 'potencia')!, 'Híbrido')?.key === 'hybrid.maxPower');
check('valoresDeSpecs aplana', valoresDeSpecs({ safety: { airbags: 6 }, meta: { sinDato: [] } })['safety.airbags'] === 6);

console.log(fallas ? `\n${fallas} fallas` : '\nTodo verificado ✓');
process.exit(fallas ? 1 : 0);
