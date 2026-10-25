// Subida sin IA (lib/subida): plantilla por carro y lectura del texto.
// Uso: npx tsx scripts/verify-subida.ts  (sin BD ni API)

import { FORMATO, aplica, generarPlantilla } from '../lib/subida/formato';
import { campoDeLinea, leerGuia, leerNumero, leerSiNo, separarEstimado, separarOrigen } from '../lib/subida/leer';
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
check('todo campo fijo existe en el registro', FORMATO.every(c => c.identidad || c.porTren || (c.keys ? Object.values(c.keys).every(k => keys.has(k!)) : keys.has(c.key!))));

// --- Plantilla personalizada ---
const gasSedan = generarPlantilla({ tren: 'Gasolina', carroceria: 'Sedán' });
const ev = generarPlantilla({ tren: 'Eléctrico', carroceria: 'SUV' });
const pickup = generarPlantilla({ tren: 'Diesel', carroceria: 'Pickup' });
const van = generarPlantilla({ tren: 'Diesel', carroceria: 'Van' });
check('gasolina: pide cilindraje y consumo, no batería', gasSedan.includes('Cilindraje (cc):') && gasSedan.includes('Consumo mixto (km/gal):') && !gasSedan.includes('Capacidad de batería'));
check('eléctrico: pide batería y autonomía, no cilindraje ni tanque', ev.includes('Capacidad de batería (kWh):') && ev.includes('Autonomía oficial (km):') && !ev.includes('Cilindraje') && !ev.includes('Tanque'));
check('sedán: sin todoterreno ni carga útil', !gasSedan.includes('Ángulo de ataque') && !gasSedan.includes('Capacidad de carga'));
check('pickup: con carga útil, PBV y todoterreno, sin baúl', pickup.includes('Capacidad de carga (kg):') && pickup.includes('Peso bruto vehicular PBV (kg):') && pickup.includes('Ángulo de ataque (°):') && !pickup.includes('Baúl (L):'));
check('van: sin 0–100, prueba de choque ni ISOFIX', !van.includes('0–100') && !van.includes('prueba de choque') && !van.includes('ISOFIX'));
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

// --- Datos estimados ("E" al final) ---
const sep = (x: string) => JSON.stringify(separarEstimado(x));
check('"153 E", "153e", "153 (E)" → 153 estimado', [ '153 E', '153e', '153 (E)', '153 [e]' ].every(x => sep(x) === JSON.stringify({ texto: '153', estimado: true })));
check('"Sí E" y "Automática (CVT) E" → estimado', separarEstimado('Sí E').texto === 'Sí' && separarEstimado('Automática (CVT) E').texto === 'Automática (CVT)');
check('sin E no cambia: "153", "Euro 6", "Cuero", "E"', ['153', 'Euro 6', 'Cuero', 'E'].every(x => !separarEstimado(x).estimado));
const conE = leerGuia(`Marca: Mercedes-Benz
Modelo: Clase E
Año: 2026
Tren motriz: Gasolina
Carrocería: Sedán
Precio de lista (COP): 320000000 E
Potencia máxima (hp): 255
0–100 km/h (s): 6,4 E
Peso en vacío (kg): 1.680e
Cámaras 360°: Sí E
Tracción: Trasera E
Despeje al piso (mm): E`);
const dE = (k: string) => conE.datos.find(d => d.key === k);
check('la marca y el modelo no se tocan ("Clase E" sigue igual)', conE.identidad.modelo === 'Clase E');
check('precio con E → precio estimado', conE.identidad.precio === 320000000 && conE.identidad.precioEstimado === true);
check('datos con E: valor bien leído y marcado estimado', dE('performance.acceleration0to100')?.valor === 6.4 && dE('performance.acceleration0to100')?.estimado === true && dE('dimensions.curbWeight')?.valor === 1680 && dE('dimensions.curbWeight')?.estimado === true && dE('assistance.cameras360')?.valor === true && dE('assistance.cameras360')?.estimado === true && dE('drivetrain.traction')?.valor === 'Trasera' && dE('drivetrain.traction')?.estimado === true);
check('dato sin E → oficial', dE('combustion.maxPower')?.estimado === false);
check('una E sola no es un dato: error, no se guarda', !dE('chassis.groundClearance') && conE.avisos.some(a => a.campo === 'Despeje al piso (mm)' && a.tipo === 'error'));

// --- Prueba de choque: solo estrellas ---
const choque = leerGuia(`Marca: Hyundai
Modelo: Kona
Año: 2026
Tren motriz: Híbrido
Carrocería: SUV
Precio de lista (COP): 123990000
Calificación NCAP (estrellas): 5
Quién hizo la prueba de choque: Euro NCAP
Año de la prueba de choque: 2023
Asistencias NCAP (%): 83`);
check('nombre viejo "Calificación NCAP (estrellas)" → estrellas', choque.datos.some(d => d.key === 'safety.ncapRating' && d.valor === 5));
check('campos retirados de NCAP: aviso, no error', !choque.avisos.some(a => a.tipo === 'error') && choque.avisos.filter(a => /ya no se usa/.test(a.texto)).length === 3);
check('nombre nuevo "Estrellas en prueba de choque"', campoDeLinea('Estrellas en prueba de choque')?.key === 'safety.ncapRating');

// --- Autonomía: eléctrico vs. híbrido enchufable ---
const phev = leerGuia('Marca: BYD\nModelo: Song Plus DM-i\nAño: 2026\nTren motriz: Híbrido Enchufable\nCarrocería: SUV\nPrecio de lista (COP): 180000000\nAutonomía oficial (km): 1100\nAutonomía solo eléctrica (km): 110');
check('PHEV: autonomía oficial = total, y la solo eléctrica aparte', phev.datos.some(d => d.key === 'phev.totalRange' && d.valor === 1100) && phev.datos.some(d => d.key === 'phev.electricRange' && d.valor === 110));
const evR = leerGuia('Marca: BYD\nModelo: Dolphin\nAño: 2026\nTren motriz: Eléctrico\nCarrocería: Hatchback\nPrecio de lista (COP): 120000000\nAutonomía oficial (km): 410\nAutonomía solo eléctrica (km): 410');
check('eléctrico: autonomía oficial a electric.electricRange; "solo eléctrica" no aplica', evR.datos.some(d => d.key === 'electric.electricRange' && d.valor === 410) && !evR.datos.some(d => d.key === 'phev.electricRange'));
check('plantilla PHEV trae las dos autonomías; la de gasolina ninguna', generarPlantilla({ tren: 'Híbrido Enchufable', carroceria: 'SUV' }).includes('Autonomía solo eléctrica (km):') && !gasSedan.includes('Autonomía'));

// --- Trazabilidad O / C / X / E y notas al pie ---
check('letras: "232 O", "320 C", "38.5 X", "3.8e", "Sí (E)"', separarOrigen('232 O').origen === 'O' && separarOrigen('320 C').origen === 'C' && separarOrigen('38.5 X').texto === '38.5' && separarOrigen('3.8e').origen === 'E' && separarOrigen('Sí (E)').origen === 'E');
check('una "o" minúscula no es letra ("Cuero o tela")', separarOrigen('Cuero o tela').origen === null);
const traz = leerGuia(`Marca: Mercedes-Benz
Modelo: Clase C
Año: 2026 O
Tren motriz: Gasolina O
Carrocería: Sedán O
Precio de lista (COP): 250000000 C
Potencia máxima (hp): 255 O
Consumo mixto (km/gal): 45.2 X
0–100 km/h (s): 6.2 E
Peso en vacío (kg): 1650 E
Cámaras 360°: Sí O

# Notas
- **Consumo mixto (km/gal) (X):** 11.9 km/l WLTP de Alemania × 3.8
0–100 km/h (s): prueba de Car and Driver https://www.caranddriver.com/x
Precio de lista (COP): concesionario oficial, octubre 2026
Ficha oficial Mercedes-Benz Colombia: https://www.mercedes-benz.com.co/x`);
const dT = (k: string) => traz.datos.find(d => d.key === k);
check('modelo "Clase C" no pierde la C; año y tren con letra se leen', traz.identidad.modelo === 'Clase C' && traz.identidad.anio === 2026 && traz.identidad.tren === 'Gasolina');
check('cada dato con su letra', dT('combustion.maxPower')?.origen === 'O' && dT('combustion.combinedConsumption')?.origen === 'X' && dT('performance.acceleration0to100')?.estimado === true && dT('assistance.cameras360')?.valor === true);
check('las notas se pegan a su dato', /11\.9 km\/l/.test(dT('combustion.combinedConsumption')?.nota ?? '') && /caranddriver/.test(dT('performance.acceleration0to100')?.nota ?? ''));
check('precio con letra y nota', traz.identidad.precioOrigen === 'C' && /concesionario/.test(traz.identidad.precioNota ?? '') && !traz.identidad.precioEstimado);
check('nota sin campo → nota general', traz.notasGenerales.some(n => /mercedes-benz\.com\.co/.test(n)));
check('E sin nota → aviso; las notas no se leen como datos', traz.avisos.some(a => a.campo === 'Peso en vacío (kg)' && /nota/.test(a.texto)) && !traz.avisos.some(a => a.tipo === 'error'));

// --- Guías reales con notas desordenadas (Polo, 18-oct-2026) ---
const polo = leerGuia(`Marca: Volkswagen O
Modelo: Polo PA Track O
Año: 2026 O
Tren motriz: Gasolina O
Carrocería: Hatchback O
Precio de lista (COP): 65990000 O
Consumo ciudad (km/gal): 42.5 E
Consumo carretera (km/gal): 60.1 E
Tanque de combustible (gal): 13.74 X
Radio de giro (m): 10.6 C

---

Detalles de Cálculos (X)

* Tanque de combustible (gal): Calculado a partir de 52 Litros.

$$\\text{gal} = \\frac{52}{3.785} = 13.74$$

Notas sobre Estimaciones (E)

* Consumo ciudad (42.5 E) y carretera (60.1 E): pruebas reales.`);
const dP = (k: string) => polo.datos.find(d => d.key === k);
check('Polo: " O" final se quita del modelo', polo.identidad.modelo === 'Polo PA Track' && polo.identidad.marca === 'Volkswagen');
check('Polo: "Detalles de Cálculos (X)" abre las notas; la fórmula sigue la nota', /52 Litros/.test(dP('combustion.fuelTankCapacity')?.nota ?? '') && /13\.74/.test(dP('combustion.fuelTankCapacity')?.nota ?? '') && !/\$|\\\\/.test(dP('combustion.fuelTankCapacity')?.nota ?? ''));
check('Polo: "Consumo ciudad (…) y carretera (…)" va a los dos', /pruebas/.test(dP('combustion.cityConsumption')?.nota ?? '') && /pruebas/.test(dP('combustion.highwayConsumption')?.nota ?? ''));
check('Polo: diámetro de giro 10.6 → radio 5.3', dP('dimensions.turningRadius')?.valor === 5.3);
check('Polo: sin errores ni avisos de "---" o repetidos', !polo.avisos.some(a => a.tipo === 'error' || /repetido|no tiene/.test(a.texto)));

// --- "# Notes" en inglés y notas que repiten el nombre del campo (Kona, 25-oct-2026) ---
const kona = leerGuia(`Marca: Hyundai
Modelo: Kona Híbrida N Line
Año: 2026 O
Tren motriz: Híbrido
Carrocería: SUV
Precio de lista (COP): 148990000 O
Consumo ciudad (km/gal): 86.0 X
Tanque de combustible (gal): 10.0 X
Zonas de climatizador: Dual O

# Notes

Consumo ciudad (km/gal): 378.5 ÷ 4.4 l/100 km WLTP = 86.0
Tanque de combustible (gal): 38 L ÷ 3.785 = 10.0`);
const dK = (k: string) => kona.datos.find(d => d.key === k);
check('Kona: "# Notes" abre las notas y cada fórmula va a su dato', /4\.4/.test(dK('hybrid.cityConsumption')?.nota ?? '') && /38 L/.test(dK('hybrid.fuelTankCapacity')?.nota ?? ''));
check('Kona: sin avisos de repetido ni de "X sin nota"', !kona.avisos.some(a => /repetido|sin nota|no trae nota/.test(a.texto)));
check('Kona: "Dual" en zonas de clima = 2', dK('comfort.climateZones')?.valor === 2 || kona.datos.some(d => d.campo === 'Zonas de climatizador' && d.valor === 2));
const repetidoReal = leerGuia('Marca: X\nModelo: Y\nAño: 2026\nTren motriz: Gasolina\nCarrocería: Sedán\nPrecio de lista (COP): 90000000\nAirbags: 6 O\nAirbags: 8 O');
check('un dato repetido de verdad sigue avisando', repetidoReal.avisos.some(a => /repetido/.test(a.texto)));

console.log(fallas ? `\n${fallas} fallas` : '\nTodo verificado ✓');
process.exit(fallas ? 1 : 0);
