// ============================================================================
// FORMATO DE SUBIDA (sin IA). Reemplaza la subida con IA (oct-2026).
//
// El orden de esta lista ES el orden de la plantilla y nunca cambia: un campo
// nuevo se agrega en su sección, no se reordena lo que ya existe.
// Cada campo dice a qué key del registro va. Los que existen por tren motriz
// (potencia, cilindraje, consumo, batería…) son UN solo campo en la plantilla y
// se guardan en combustion.* / hybrid.* / phev.* / electric.* según el carro.
// docs/formato-subida.md explica las reglas para quien llena la guía.
// ============================================================================

import { ATTRIBUTE_REGISTRY, attributeAppliesTo, type AttributeDef, type ClaseVehiculo } from '@/lib/attributes/registry';
import { CATEGORIAS, claseDeTipo, TIPOS_CARROCERIA } from '@/lib/attributes/clase';

export const TRENES = ['Gasolina', 'Diesel', 'Eléctrico', 'Híbrido', 'Híbrido Enchufable'] as const;
export type Tren = (typeof TRENES)[number];

/** Prefijo del registro de cada tren motriz para los campos "por motor". */
const PREFIJO: Record<Tren, string> = {
  Gasolina: 'combustion',
  Diesel: 'combustion',
  Híbrido: 'hybrid',
  'Híbrido Enchufable': 'phev',
  Eléctrico: 'electric',
};

export type CampoIdentidad = 'marca' | 'modelo' | 'anio' | 'tren' | 'carroceria' | 'categoria' | 'precio';

export interface CampoFormato {
  seccion: string;
  /** Nombre tal como sale en la plantilla, con la unidad: "Largo (mm)". */
  nombre: string;
  /** Campo de identidad del carro (no es un dato del registro). */
  identidad?: CampoIdentidad;
  /** Key del registro, o el sufijo por tren motriz ("maxPower" → combustion.maxPower…). */
  key?: string;
  porTren?: string;
  /** Solo para estas clases (carro, pickup, van/camión). */
  clases?: ClaseVehiculo[];
  /** Solo para estas carrocerías (además de la clase). */
  carrocerias?: string[];
}

const DEF = new Map(ATTRIBUTE_REGISTRY.map(d => [d.key, d]));
const TRABAJO: ClaseVehiculo[] = ['pickup', 'comercial'];
const NO_COMERCIAL: ClaseVehiculo[] = ['auto', 'pickup'];

// Atajos para escribir la lista: k = key fija, t = por tren motriz.
const k = (seccion: string, nombre: string, key: string, extra: Partial<CampoFormato> = {}): CampoFormato => ({ seccion, nombre, key, ...extra });
const t = (seccion: string, nombre: string, porTren: string, extra: Partial<CampoFormato> = {}): CampoFormato => ({ seccion, nombre, porTren, ...extra });

const ID = 'Identidad', MOTOR = 'Motor', CONSUMO = 'Consumo y autonomía', BAT = 'Batería y carga', DES = 'Desempeño', TRAC = 'Tracción';
const DIM = 'Dimensiones y peso', ESP = 'Espacio', CARGA = 'Carga y trabajo', LLANT = 'Llantas', CHAS = 'Chasis y frenos', TT = 'Todoterreno';
const SEG = 'Seguridad', ASIS = 'Asistencias de manejo', LUZ = 'Luces', CONF = 'Confort', TEC = 'Tecnología', GAR = 'Garantía y mantenimiento';

export const FORMATO: CampoFormato[] = [
  { seccion: ID, nombre: 'Marca', identidad: 'marca' },
  { seccion: ID, nombre: 'Modelo', identidad: 'modelo' },
  { seccion: ID, nombre: 'Año', identidad: 'anio' },
  { seccion: ID, nombre: 'Tren motriz', identidad: 'tren' },
  { seccion: ID, nombre: 'Carrocería', identidad: 'carroceria' },
  { seccion: ID, nombre: 'Categoría', identidad: 'categoria' },
  { seccion: ID, nombre: 'Precio de lista (COP)', identidad: 'precio' },

  t(MOTOR, 'Potencia máxima (hp)', 'maxPower'),
  t(MOTOR, 'Torque máximo (Nm)', 'maxTorque'),
  t(MOTOR, 'Cilindraje (cc)', 'displacement'),
  k(MOTOR, 'Número de cilindros', 'combustion.cylinders'),
  t(MOTOR, 'Configuración del motor', 'engineConfiguration'),
  t(MOTOR, 'Tipo de inducción', 'inductionType'),
  k(MOTOR, 'Ciclo del motor', 'combustion.workCycle'),
  t(MOTOR, 'Potencia del motor a gasolina (hp)', 'enginePower'),
  t(MOTOR, 'Potencia del motor eléctrico (hp)', 'electricMotorPower'),
  k(MOTOR, 'Motores eléctricos', 'electric.motors'),
  k(MOTOR, 'Potencia a qué rpm (rpm)', 'combustion.powerAtRpm'),
  k(MOTOR, 'Corte de rpm (rpm)', 'combustion.rpmLimit'),
  k(MOTOR, 'Relación de compresión', 'combustion.compressionRatio'),
  k(MOTOR, 'Octanaje recomendado', 'combustion.octanajeRecomendado'),
  k(MOTOR, 'Norma de emisiones', 'combustion.emissionStandard'),
  t(MOTOR, 'Transmisión', 'transmissionType'),
  t(MOTOR, 'Marchas', 'gears'),

  t(CONSUMO, 'Consumo ciudad (km/gal)', 'cityConsumption'),
  t(CONSUMO, 'Consumo carretera (km/gal)', 'highwayConsumption'),
  t(CONSUMO, 'Consumo mixto (km/gal)', 'combinedConsumption'),
  t(CONSUMO, 'Tanque de combustible (gal)', 'fuelTankCapacity'),
  k(CONSUMO, 'Consumo eléctrico ciudad (kWh/100 km)', 'electric.cityElectricConsumption'),
  k(CONSUMO, 'Consumo eléctrico carretera (kWh/100 km)', 'electric.highwayElectricConsumption'),
  t(CONSUMO, 'Autonomía oficial (km)', 'electricRange'),

  t(BAT, 'Capacidad de batería (kWh)', 'batteryCapacity'),
  k(BAT, 'Peso de la batería (kg)', 'phev.batteryWeight'),
  t(BAT, 'Tiempo de carga en casa AC (h)', 'acChargingTime'),
  k(BAT, 'Potencia de carga en casa AC (kW)', 'electric.onboardChargerKw'),
  t(BAT, 'Carga rápida DC 10–80 % (min)', 'dcChargingTime'),
  k(BAT, 'Potencia máxima de carga rápida DC (kW)', 'electric.dcMaxPowerKw'),
  k(BAT, 'Conector de carga', 'electric.chargePort'),
  t(BAT, 'Frenado regenerativo', 'regenerativeBraking'),
  k(BAT, 'Niveles de regeneración', 'electric.regenLevels'),
  k(BAT, 'Manejo con un solo pedal', 'electric.onePedal'),
  k(BAT, 'Garantía de la batería (años)', 'commercial.batteryWarrantyYears'),
  k(BAT, 'Garantía de la batería (km)', 'commercial.batteryWarrantyKm'),

  k(DES, '0–100 km/h (s)', 'performance.acceleration0to100', { clases: NO_COMERCIAL }),
  k(DES, 'Velocidad máxima (km/h)', 'performance.maxSpeed'),
  k(DES, 'Recuperación 50–80 km/h (s)', 'performance.acceleration50to80', { clases: NO_COMERCIAL }),
  k(DES, 'Adelantamiento 80–120 km/h (s)', 'performance.overtaking80to120', { clases: NO_COMERCIAL }),
  k(DES, '0–200 km/h (s)', 'performance.acceleration0to200', { clases: ['auto'] }),
  k(DES, 'Cuarto de milla (s)', 'performance.quarterMile', { clases: ['auto'] }),
  k(DES, 'Launch control', 'performance.launchControl', { clases: ['auto'] }),

  k(TRAC, 'Tracción', 'drivetrain.traction'),
  k(TRAC, 'Tracción integral que se activa sola', 'drivetrain.onDemandAwd'),
  k(TRAC, 'Caja reductora 4L', 'drivetrain.lowRange', { clases: NO_COMERCIAL }),
  k(TRAC, 'Reparto de torque entre ruedas', 'drivetrain.torqueVectoring', { clases: NO_COMERCIAL }),
  k(TRAC, 'Modos de manejo', 'drivetrain.driveModes'),
  k(TRAC, 'Modo remolque', 'drivetrain.towMode'),
  k(TRAC, 'Levas de cambio en el volante', 'drivetrain.paddleShifters', { clases: NO_COMERCIAL }),

  k(DIM, 'Largo (mm)', 'dimensions.length'),
  k(DIM, 'Ancho (mm)', 'dimensions.width'),
  k(DIM, 'Alto (mm)', 'dimensions.height'),
  k(DIM, 'Distancia entre ejes (mm)', 'dimensions.wheelbase'),
  k(DIM, 'Despeje al piso (mm)', 'chassis.groundClearance'),
  k(DIM, 'Radio de giro (m)', 'dimensions.turningRadius'),
  k(DIM, 'Peso en vacío (kg)', 'dimensions.curbWeight'),
  k(DIM, 'Carga en el techo (kg)', 'dimensions.roofLoad'),

  k(ESP, 'Pasajeros', 'interior.passengerCapacity'),
  k(ESP, 'Filas de asientos', 'interior.seatRows'),
  k(ESP, 'Puertas', 'interior.doors'),
  k(ESP, 'Baúl (L)', 'dimensions.cargoCapacity', { clases: ['auto'] }),
  k(ESP, 'Baúl con sillas abatidas (L)', 'interior.trunkCapacitySeatsDown', { clases: ['auto'] }),

  k(CARGA, 'Capacidad de carga (kg)', 'weight.payload', { clases: TRABAJO }),
  k(CARGA, 'Capacidad de remolque (kg)', 'weight.towingCapacity'),
  k(CARGA, 'Peso bruto vehicular PBV (kg)', 'weight.grossVehicleWeight', { clases: TRABAJO }),
  k(CARGA, 'Peso bruto combinado (kg)', 'weight.grossCombinedWeight', { clases: TRABAJO }),
  k(CARGA, 'Volumen de carga del platón o furgón (L)', 'weight.cargoBoxVolume', { clases: TRABAJO }),
  k(CARGA, 'Largo de la zona de carga (mm)', 'cargoArea.length', { clases: TRABAJO }),
  k(CARGA, 'Ancho de la zona de carga (mm)', 'cargoArea.width', { clases: TRABAJO }),
  k(CARGA, 'Alto de la zona de carga (mm)', 'cargoArea.height', { clases: TRABAJO }),

  k(LLANT, 'Medida de llanta', 'wheels.tireSize'),
  k(LLANT, 'Rin (pulgadas)', 'wheels.rimSize'),
  k(LLANT, 'Llanta de repuesto', 'wheels.spareTire'),

  k(CHAS, 'Suspensión delantera', 'chassis.frontSuspension'),
  k(CHAS, 'Suspensión trasera', 'chassis.rearSuspension'),
  k(CHAS, 'Amortiguación adaptativa', 'chassis.adaptiveDampers', { clases: NO_COMERCIAL }),
  k(CHAS, 'Frenos delanteros', 'chassis.frontBrakes'),
  k(CHAS, 'Frenos traseros', 'chassis.rearBrakes'),
  k(CHAS, 'Material de los discos', 'chassis.brakeDiscMaterial', { clases: ['auto'] }),
  k(CHAS, 'Pinzas de freno', 'chassis.brakeCalipers', { clases: ['auto'] }),
  k(CHAS, 'Frenado 100–0 km/h (m)', 'chassis.brakingDistance100to0'),
  k(CHAS, 'Aceleración lateral máxima (g)', 'chassis.maxLateralAcceleration', { clases: ['auto'] }),
  k(CHAS, 'Aceleración longitudinal máxima (g)', 'chassis.maxLongitudinalAcceleration', { clases: ['auto'] }),

  // Todoterreno: solo camionetas (SUV) y pickups.
  k(TT, 'Ángulo de ataque (°)', 'offRoad.approachAngle', { carrocerias: ['SUV', 'Pickup'] }),
  k(TT, 'Ángulo de salida (°)', 'offRoad.departureAngle', { carrocerias: ['SUV', 'Pickup'] }),
  k(TT, 'Ángulo ventral (°)', 'offRoad.breakoverAngle', { carrocerias: ['SUV', 'Pickup'] }),
  k(TT, 'Vadeo (mm)', 'offRoad.wadingDepth', { carrocerias: ['SUV', 'Pickup'] }),
  k(TT, 'Pendiente máxima (%)', 'offRoad.maxGradient', { carrocerias: ['SUV', 'Pickup'] }),
  k(TT, 'Control de descenso', 'offRoad.hillDescentControl', { carrocerias: ['SUV', 'Pickup'] }),
  k(TT, 'Control de tracción para trocha', 'offRoad.offRoadTractionControl', { carrocerias: ['SUV', 'Pickup'] }),
  k(TT, 'Modos de terreno', 'offRoad.terrainModes', { carrocerias: ['SUV', 'Pickup'] }),

  k(SEG, 'Airbags', 'safety.airbags'),
  k(SEG, 'Anclajes ISOFIX', 'safety.isofix', { clases: NO_COMERCIAL }),
  k(SEG, 'Control de estabilidad', 'safety.stabilityControl'),
  k(SEG, 'Control de tracción', 'safety.tractionControl'),
  k(SEG, 'Monitoreo de presión de llantas', 'safety.tirePressureMonitoring'),
  k(SEG, 'Calificación NCAP (estrellas)', 'safety.ncapRating', { clases: NO_COMERCIAL }),
  k(SEG, 'Quién hizo la prueba de choque', 'safety.ncapAgency', { clases: NO_COMERCIAL }),
  k(SEG, 'Año de la prueba de choque', 'safety.ncapYear', { clases: NO_COMERCIAL }),
  k(SEG, 'Asistencias NCAP (%)', 'safety.assistanceScore', { clases: NO_COMERCIAL }),

  k(ASIS, 'Frenado autónomo de emergencia', 'safety.autonomousEmergencyBraking'),
  k(ASIS, 'Alerta de colisión frontal', 'safety.forwardCollisionWarning'),
  k(ASIS, 'Asistente de carril', 'safety.laneAssist'),
  k(ASIS, 'Punto ciego', 'safety.blindSpotDetection'),
  k(ASIS, 'Crucero adaptativo', 'safety.adaptiveCruiseControl'),
  k(ASIS, 'Monitor de fatiga', 'safety.fatigueMonitor'),
  k(ASIS, 'Asistente de frenado', 'assistance.brakeAssist'),
  k(ASIS, 'Asistente de arranque en pendiente', 'assistance.hillStartAssist'),
  k(ASIS, 'Cámara de reversa', 'assistance.reverseCamera'),
  k(ASIS, 'Cámaras 360°', 'assistance.cameras360'),
  k(ASIS, 'Sensores de parqueo traseros', 'assistance.parkingSensors'),
  k(ASIS, 'Sensores de parqueo delanteros', 'assistance.frontParkingSensors'),
  k(ASIS, 'Se parquea solo', 'assistance.parkAssist', { clases: ['auto'] }),

  k(LUZ, 'Tipo de faros', 'lighting.headlightType'),
  k(LUZ, 'Luces altas automáticas', 'comfort.automaticHighBeam'),
  k(LUZ, 'Exploradoras delanteras', 'lighting.frontFogLights'),
  k(LUZ, 'Direccionales secuenciales', 'lighting.dynamicIndicators'),
  k(LUZ, 'Lavafaros', 'lighting.headlightWashers'),
  k(LUZ, 'Sensor de lluvia', 'lighting.rainSensor'),

  k(CONF, 'Aire acondicionado', 'comfort.airConditioning'),
  k(CONF, 'Climatizador automático', 'comfort.automaticClimateControl'),
  k(CONF, 'Zonas de climatizador', 'comfort.climateZones'),
  k(CONF, 'Salidas de aire para atrás', 'comfort.rearAcVents'),
  k(CONF, 'Encendido sin llave', 'comfort.keyless'),
  k(CONF, 'Techo', 'comfort.sunroof', { clases: NO_COMERCIAL }),
  k(CONF, 'Vidrios eléctricos', 'comfort.powerWindows'),
  k(CONF, 'Material de las sillas', 'comfort.seatMaterial'),
  k(CONF, 'Silla del conductor eléctrica', 'comfort.powerDriverSeat'),
  k(CONF, 'Silla del copiloto eléctrica', 'comfort.powerPassengerSeat', { clases: NO_COMERCIAL }),
  k(CONF, 'Memoria de posición', 'comfort.seatMemory', { clases: NO_COMERCIAL }),
  k(CONF, 'Asientos calefaccionados', 'comfort.heatedSeats'),
  k(CONF, 'Asientos ventilados', 'comfort.ventilatedSeats', { clases: NO_COMERCIAL }),
  k(CONF, 'Asientos con masaje', 'comfort.massageSeats', { clases: ['auto'] }),
  k(CONF, 'Segunda fila corrediza', 'comfort.slidingSecondRow', { clases: NO_COMERCIAL }),
  k(CONF, 'Volante', 'comfort.steeringWheel'),
  k(CONF, 'Volante con calefacción', 'comfort.heatedSteeringWheel', { clases: NO_COMERCIAL }),
  k(CONF, 'Retrovisor que se oscurece solo', 'comfort.autoDimmingMirror'),
  k(CONF, 'Luz ambiental', 'comfort.ambientLighting', { clases: NO_COMERCIAL }),
  k(CONF, 'Vidrios acústicos', 'comfort.acousticGlass', { clases: NO_COMERCIAL }),

  k(TEC, 'Pantalla central (pulgadas)', 'technology.centralScreenIn'),
  k(TEC, 'Pantalla táctil', 'technology.touchscreen'),
  k(TEC, 'Tablero digital (pulgadas)', 'technology.clusterScreenIn'),
  k(TEC, 'CarPlay / Android Auto', 'technology.smartphoneIntegration'),
  k(TEC, 'CarPlay / Android Auto sin cable', 'technology.wirelessSmartphone'),
  k(TEC, 'Bluetooth', 'technology.bluetooth'),
  k(TEC, 'Cargador inalámbrico', 'technology.wirelessCharger'),
  k(TEC, 'Puertos USB-A', 'technology.usbA'),
  k(TEC, 'Puertos USB-C', 'technology.usbC'),
  k(TEC, 'Marca del sonido', 'technology.audioBrand'),
  k(TEC, 'Parlantes', 'technology.speakers'),
  k(TEC, 'Start-Stop', 'technology.startStop'),

  k(GAR, 'Garantía (años)', 'commercial.warrantyYears'),
  k(GAR, 'Garantía (km)', 'commercial.warrantyKm'),
  k(GAR, 'Asistencia en carretera (años)', 'commercial.roadsideAssistanceYears'),
  k(GAR, 'Mantenimiento cada (km)', 'commercial.serviceIntervalKm'),
  k(GAR, 'Mantenimiento cada (meses)', 'commercial.serviceIntervalMonths'),
  k(GAR, 'Costo de los 3 primeros mantenimientos (COP)', 'commercial.maintenanceCost3'),
  k(GAR, 'País donde se fabrica', 'commercial.origin'),
];

/** Opciones válidas de los campos de identidad. */
export const OPCIONES_IDENTIDAD: Partial<Record<CampoIdentidad, readonly string[]>> = {
  tren: TRENES,
  carroceria: TIPOS_CARROCERIA,
  categoria: CATEGORIAS,
};

/** La key del registro de un campo para este tren motriz (null = no existe para él). */
export function keyDe(campo: CampoFormato, tren: Tren): string | null {
  if (campo.identidad) return null;
  const key = campo.porTren ? `${PREFIJO[tren]}.${campo.porTren}` : campo.key!;
  const d = DEF.get(key);
  return d && attributeAppliesTo(d, tren) ? key : null;
}

export function defDe(campo: CampoFormato, tren: Tren): AttributeDef | null {
  const key = keyDe(campo, tren);
  return key ? DEF.get(key) ?? null : null;
}

/** ¿El campo va en la plantilla de este carro? */
export function aplica(campo: CampoFormato, tren: Tren, carroceria: string): boolean {
  if (campo.identidad) return true;
  if (!keyDe(campo, tren)) return false;
  if (campo.clases && !campo.clases.includes(claseDeTipo(carroceria))) return false;
  if (campo.carrocerias && !campo.carrocerias.includes(carroceria)) return false;
  return true;
}

/** Lo que se le muestra a quien llena: opciones, Sí/No o nada (la unidad ya va en el nombre). */
export function pista(campo: CampoFormato, tren: Tren): string {
  if (campo.identidad) {
    const op = OPCIONES_IDENTIDAD[campo.identidad];
    return op ? op.join(' / ') : '';
  }
  const d = defDe(campo, tren);
  if (!d) return '';
  if (d.dataType === 'boolean') return 'Sí / No';
  if (d.opciones?.length) return d.opciones.join(' / ');
  return '';
}

/** La plantilla personalizada para este carro, lista para llenar. */
export function generarPlantilla(id: { tren: Tren; carroceria: string; marca?: string; modelo?: string; anio?: number | string; categoria?: string }): string {
  const lineas: string[] = [];
  let seccion = '';
  const pre: Partial<Record<CampoIdentidad, string>> = {
    marca: id.marca ?? '',
    modelo: id.modelo ?? '',
    anio: id.anio ? String(id.anio) : '',
    tren: id.tren,
    carroceria: id.carroceria,
    categoria: id.categoria ?? '',
  };
  for (const c of FORMATO) {
    if (!aplica(c, id.tren, id.carroceria)) continue;
    if (c.seccion !== seccion) {
      if (lineas.length) lineas.push('');
      lineas.push(`# ${c.seccion}`);
      seccion = c.seccion;
    }
    const p = pista(c, id.tren);
    const valor = c.identidad ? pre[c.identidad] ?? '' : '';
    lineas.push(`${c.nombre}${p && !valor ? ` (${p})` : ''}: ${valor}`.trimEnd());
  }
  return lineas.join('\n') + '\n';
}
