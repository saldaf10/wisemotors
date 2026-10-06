// Clases de vehículo (carro / pickup / van-camión): rangos y datos clave.
// Uso: npx tsx scripts/verify-clase.ts  (sin BD ni API)

import { ATTRIBUTE_REGISTRY, fueraDeRango, rangoDe, RANGOS_HUERFANOS } from '../lib/attributes/registry';
import { camposClave, clavesFaltantes } from '../lib/attributes/clave';
import { CATEGORIAS, claseDeTipo, TIPOS_CARROCERIA, tiposDeClase } from '../lib/attributes/clase';

let fallas = 0;
function check(nombre: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${nombre}`);
  if (!ok) fallas++;
}
const def = (k: string) => ATTRIBUTE_REGISTRY.find(d => d.key === k)!;
const ids = (fuel: string, clase: 'auto' | 'pickup' | 'comercial') => camposClave(fuel, clase).map(c => c.id);

check('todas las keys de RANGOS_POR_CLASE existen en el registro', RANGOS_HUERFANOS.length === 0);
check('los campos nuevos de carga existen', ['weight.grossVehicleWeight', 'cargoArea.length', 'cargoArea.width', 'cargoArea.height'].every(k => !!def(k)));

check('Pickup → pickup', claseDeTipo('Pickup') === 'pickup');
check('Van y Camión → comercial', claseDeTipo('Van') === 'comercial' && claseDeTipo('Camión') === 'comercial');
check('SUV, Sedán y vacío → auto', claseDeTipo('SUV') === 'auto' && claseDeTipo('Sedán') === 'auto' && claseDeTipo(undefined) === 'auto');
check('las carrocerías incluyen Van y Camión', TIPOS_CARROCERIA.includes('Van') && TIPOS_CARROCERIA.includes('Camión'));
check('la clase comercial solo admite Van y Camión', tiposDeClase('comercial').join() === 'Van,Camión');
check('hay categoría Comercial', CATEGORIAS.includes('Comercial'));

// El caso que reportó el equipo: el "baúl" de una van no cabía.
check('un furgón de 15.000 L está fuera de rango para un carro', fueraDeRango(def('dimensions.cargoCapacity'), 15_000, 'auto'));
check('…y dentro de rango para una van o camión', !fueraDeRango(def('dimensions.cargoCapacity'), 15_000, 'comercial'));
check('un camión de 7 t de carga útil cabe como comercial', !fueraDeRango(def('weight.payload'), 7000, 'comercial'));
check('…pero no como pickup', fueraDeRango(def('weight.payload'), 7000, 'pickup'));
check('un camión de 8,5 m de largo cabe como comercial', !fueraDeRango(def('dimensions.length'), 8500, 'comercial'));
check('un camión con 14 km/gal cabe como comercial', !fueraDeRango(def('combustion.combinedConsumption'), 14, 'comercial'));
check('lo que no se sobrescribe vale igual que en un carro', JSON.stringify(rangoDe(def('safety.airbags'), 'comercial')) === JSON.stringify(rangoDe(def('safety.airbags'), 'auto')));
check('un override parcial conserva el otro extremo', rangoDe(def('chassis.groundClearance'), 'pickup').min === def('chassis.groundClearance').expectedMin);

// Datos clave por clase
const auto = ids('Gasolina', 'auto');
const pickup = ids('Diesel', 'pickup');
const comercial = ids('Diesel', 'comercial');
check('a un carro no se le pide carga útil ni remolque', !auto.includes('cargaUtil') && !auto.includes('remolque'));
check('a un carro sí se le pide el baúl y el 0 a 100', auto.includes('baul') && auto.includes('aceleracion'));
check('a una pickup se le pide carga útil, remolque, PBV y platón', ['cargaUtil', 'remolque', 'pbv', 'zonaCarga'].every(i => pickup.includes(i)));
check('a una pickup no se le pide baúl', !pickup.includes('baul'));
check('a una van o camión se le pide volumen de carga', comercial.includes('volumenCarga') && comercial.includes('cargaUtil') && comercial.includes('pbv'));
check('a una van o camión no se le pide 0 a 100, prueba de choque ni cargador inalámbrico', !['aceleracion', 'ncap', 'cargadorInalambrico', 'baul'].some(i => comercial.includes(i)));
check(
  'el volumen de carga se cumple con la capacidad interior',
  !clavesFaltantes('Diesel', { 'interior.interiorCargoCapacity': 12_000 }, [], 'comercial').some(c => c.id === 'volumenCarga')
);
check('sin clase, todo sigue como un carro', camposClave('Gasolina').map(c => c.id).join() === auto.join());

console.log(fallas ? `\n${fallas} fallas` : '\nTodo verificado ✓');
process.exit(fallas ? 1 : 0);
