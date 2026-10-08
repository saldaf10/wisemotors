// Subida sin IA (lib/subida): plantilla por carro y lectura del texto.
// Uso: npx tsx scripts/verify-subida.ts  (sin BD ni API)

import { FORMATO, aplica, generarPlantilla } from '../lib/subida/formato';
import { campoDeLinea, leerGuia, leerNumero, leerSiNo } from '../lib/subida/leer';
import { opcionMasCercana } from '../lib/subida/opciones';
import { plano } from '../lib/subida/texto';
import { ATTRIBUTE_REGISTRY } from '../lib/attributes/registry';

let fallas = 0;
function check(nombre: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${nombre}`);
  if (!ok) fallas++;
}

// --- El formato ---
const planos = FORMATO.map(c => plano(c.nombre));
check('ningún nombre de campo se repite (sin tildes ni mayúsculas)', new Set(planos).size === planos.length);
const keys = new Set(ATTRIBUTE_REGISTRY.map(d => d.key));
check('todo campo fijo existe en el registro', FORMATO.every(c => c.identidad || c.porTren || keys.has(c.key!)));

// --- Plantilla personalizada ---
const gasSedan = generarPlantilla({ tren: 'Gasolina', carroceria: 'Sedán' });
const ev = generarPlantilla({ tren: 'Eléctrico', carroceria: 'SUV' });
const pickup = generarPlantilla({ tren: 'Diesel', carroceria: 'Pickup' });
const van = generarPlantilla({ tren: 'Diesel', carroceria: 'Van' });
check('gasolina: pide cilindraje y consumo, no batería', gasSedan.includes('Cilindraje (cc):') && gasSedan.includes('Consumo mixto (km/gal):') && !gasSedan.includes('Capacidad de batería'));
check('eléctrico: pide batería y autonomía, no cilindraje ni tanque', ev.includes('Capacidad de batería (kWh):') && ev.includes('Autonomía oficial (km):') && !ev.includes('Cilindraje') && !ev.includes('Tanque'));
check('sedán: sin todoterreno ni carga útil', !gasSedan.includes('Ángulo de ataque') && !gasSedan.includes('Capacidad de carga'));
check('pickup: con carga útil, PBV y todoterreno, sin baúl', pickup.includes('Capacidad de carga (kg):') && pickup.includes('Peso bruto vehicular PBV (kg):') && pickup.includes('Ángulo de ataque (°):') && !pickup.includes('Baúl (L):'));
check('van: sin 0–100, NCAP ni ISOFIX', !van.includes('0–100') && !van.includes('NCAP') && !van.includes('ISOFIX'));
check('las opciones salen como pista', gasSedan.includes('Tracción (Delantera / Trasera / Integral (AWD) / 4x4):'));
check('el tren motriz y la carrocería vienen ya puestos', gasSedan.includes('Tren motriz: Gasolina') && gasSedan.includes('Carrocería: Sedán'));
const nCampos = (p: string) => p.split('\n').filter(l => l.includes(':')).length;
console.log(`  (campos: sedán gasolina ${nCampos(gasSedan)}, SUV eléctrica ${nCampos(ev)}, pickup diésel ${nCampos(pickup)}, van diésel ${nCampos(van)})`);

// --- Nombres de campo escritos de cualquier forma ---
check('sin tildes ni mayúsculas', campoDeLinea('TRACCION')?.nombre === 'Tracción');
check('con la pista de opciones detrás', campoDeLinea('Tracción (Delantera / Trasera / Integral (AWD) / 4x4)')?.nombre === 'Tracción');
check('con un error de tipeo', campoDeLinea('Potensia maxima (hp)')?.nombre === 'Potencia máxima (hp)');
check('garantía en años y en km no se confunden', campoDeLinea('garantia (años)')?.nombre === 'Garantía (años)' && campoDeLinea('Garantia (km)')?.nombre === 'Garantía (km)');
check('un nombre inventado no se adivina', campoDeLinea('Color favorito del vendedor') === null);

// --- Valores ---
check('números: "4.270" → 4270, "10,9" → 10.9, "1.5" → 1.5', leerNumero('4.270') === 4270 && leerNumero('10,9') === 10.9 && leerNumero('1.5') === 1.5);
check('números: "113.000.000" y "4270 mm"', leerNumero('113.000.000') === 113000000 && leerNumero('4270 mm') === 4270);
check('Sí/No: "si", "SÍ", "no", "sii"', leerSiNo('si') === true && leerSiNo('SÍ') === true && leerSiNo('no') === false && leerSiNo('sii') === true);
check('opción exacta sin tildes: "sedan" → Sedán', opcionMasCercana('sedan', ['Sedán', 'SUV']) === 'Sedán');
check('opción con tipeo: "Tambro" → Tambor', opcionMasCercana('Tambro', ['Disco', 'Tambor']) === 'Tambor');
check('sinónimo: "4WD" → 4x4, "AWD" → Integral', opcionMasCercana('4WD', ['Delantera', 'Trasera', 'Integral (AWD)', '4x4']) === '4x4' && opcionMasCercana('awd', ['Delantera', 'Trasera', 'Integral (AWD)', '4x4']) === 'Integral (AWD)');
check('sinónimo: "1.0 TSI" → Turbo', opcionMasCercana('1.0 TSI', ['Atmosférico', 'Turbo', 'Supercargado', 'Turbo y supercargado'], 'combustion.inductionType') === 'Turbo');
check('contenida: "Frenos de disco ventilado" → Disco', opcionMasCercana('Frenos de disco ventilado', ['Disco', 'Tambor']) === 'Disco');
check('lo que no se parece a nada → null', opcionMasCercana('cohete', ['Disco', 'Tambor']) === null);

// --- Lectura completa ---
const guia = `
# Identidad
marca: Chevrolet
MODELO: Tracker RS
año: 2026
Tren motriz: gasolina
Carroceria: suv
Categoria: automovil
Precio de lista (COP): 113.000.000

Potencia maxima (hp): 153
Torque máximo (Nm):
Cilindraje (cc): 1.199
Tipo de induccion (Atmosférico / Turbo / Supercargado / Turbo y supercargado): turbo
Traccion: delantera
Largo (mm): 4.270
Baúl (L):
Airbags: 6
Camara de reversa: si
Cámaras 360°: no
Capacidad de batería (kWh): 50
Frenos traseros: tambro
Despeje al piso (mm): 9000
Color favorito: rojo
`;
const r = leerGuia(guia);
const v = (k: string) => r.datos.find(d => d.key === k)?.valor;
check('identidad leída sin importar mayúsculas ni tildes', r.identidad.tren === 'Gasolina' && r.identidad.carroceria === 'SUV' && r.identidad.categoria === 'Automóvil' && r.identidad.precio === 113000000 && r.identidad.anio === 2026);
check('cada dato a su campo', v('combustion.maxPower') === 153 && v('combustion.displacement') === 1199 && v('combustion.inductionType') === 'Turbo' && v('drivetrain.traction') === 'Delantera' && v('dimensions.length') === 4270);
check('un campo vacío queda vacío (no toma el dato de la línea siguiente)', v('combustion.maxTorque') === undefined && v('dimensions.cargoCapacity') === undefined && r.vacios.includes('Torque máximo (Nm)'));
check('Sí/No por campo', v('assistance.reverseCamera') === true && v('assistance.cameras360') === false);
check('typo en la opción se corrige', v('chassis.rearBrakes') === 'Tambor');
check('batería en un carro a gasolina: se ignora con aviso', v('electric.batteryCapacity') === undefined && v('hybrid.batteryCapacity') === undefined && r.avisos.some(a => a.campo === 'Capacidad de batería (kWh)'));
check('fuera de rango: no se guarda y se avisa', v('chassis.groundClearance') === undefined && r.avisos.some(a => a.campo === 'Despeje al piso (mm)' && a.tipo === 'error'));
check('campo desconocido: error, no se asigna a otro', r.avisos.some(a => a.tipo === 'error' && /Color favorito/.test(a.texto)));
const soloAplicables = r.datos.every(d => aplica(FORMATO.find(c => c.nombre === d.campo)!, 'Gasolina', 'SUV'));
check('solo se guardan campos que van para este carro', soloAplicables);

const hibrido = leerGuia('Marca: Toyota\nModelo: RAV4\nAño: 2026\nTren motriz: hibrido\nCarrocería: SUV\nPrecio de lista (COP): 180000000\nPotencia máxima (hp): 222\nCapacidad de batería (kWh): 1,6');
check('híbrido: la potencia va a hybrid.maxPower y la batería a hybrid.batteryCapacity', hibrido.datos.some(d => d.key === 'hybrid.maxPower' && d.valor === 222) && hibrido.datos.some(d => d.key === 'hybrid.batteryCapacity' && d.valor === 1.6));

const sinIdentidad = leerGuia('Potencia máxima (hp): 150');
check('sin tren motriz ni carrocería no se guarda nada y se avisa', sinIdentidad.datos.length === 0 && sinIdentidad.avisos.some(a => a.texto === 'Falta Tren motriz.'));

console.log(fallas ? `\n${fallas} fallas` : '\nTodo verificado ✓');
process.exit(fallas ? 1 : 0);
