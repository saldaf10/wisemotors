// ============================================================================
// Features de cada carro para el orden base del buscador.
//
// Regla: cada feature sale de un DATO REAL de la ficha, en sus unidades reales
// (km/gal, mm, hp, s…), orientado para que "más alto = mejor". No se normaliza
// aquí: el scoring (deterministic.ts) usa percentiles dentro de los candidatos,
// así que solo importa el orden.
//
// Si el dato no existe, la feature es NaN ("no sabemos"): el scoring la trata
// como la mediana — ni premia ni castiga. Antes se rellenaban valores inventados
// (150 hp, 8 L/100 km) y el consumo se leía como L/100 km cuando la ficha está
// en km/gal: un carro de 45 km/gal salía "gastón" y uno sin datos "económico".
// ============================================================================

import { prisma } from '@/lib/prisma';
import { leer, rendimiento, specsDe, tanque } from '@/lib/vehiculo-datos';

export interface VehicleFeatures {
  // Desempeño
  power_to_weight_norm: number; // hp por tonelada
  acceleration_norm: number; // −segundos de 0 a 100
  braking_norm: number; // −metros de 100 a 0
  max_speed_norm: number; // km/h

  // Capacidades
  ground_clearance_norm: number; // mm
  efficiency_norm: number; // −pesos por km recorrido
  comfort_norm: number; // equipamiento de confort presente
  safety_norm: number; // estrellas NCAP + airbags + asistencias
  tech_norm: number; // equipamiento de tecnología presente
  reliability_norm: number; // confiabilidad percibida de la marca en CO (0-100)
  space_norm: number; // baúl + pasajeros

  // Usos
  urban_score: number; // −largo (más corto = más fácil de parquear)
  highway_score: number; // km que recorre con un tanque o una carga
  offroad_score: number; // altura + ángulos + tipo
  hill_climb_score: number; // torque (o potencia) por tonelada
  potholes_score: number; // altura al piso

  // Valor
  quality_price_ratio_norm: number; // −precio
  prestige_norm: number; // prestigio de la marca en CO (0-100)

  // Compatibilidad con la UI vieja del podio
  performance_score: number;
  efficiency_score: number;
  safety_score: number;
  comfort_score: number;
  tech_score: number;
  value_score: number;
  usage_urban: number;
  consumption_score: number;
  electric_range: number;
}

export interface VehicleCandidate {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  fuelType: string;
  vehicleType: string;
  type: string;
  imageUrl: string | null;
  features: VehicleFeatures;
  tags: string[];
  /** Ficha cruda: la IA recibe de aquí los datos reales para explicar. */
  specifications?: unknown;
  /** Versiones del mismo carro (lib/versiones): misma marca y familia. */
  familia?: string | null;
}

/** Contexto del mercado colombiano que no está en la ficha del carro. */
export interface ContextoMercado {
  marcas: Map<string, { prestige: number; reliability: number }>;
}

// Precios de referencia para comparar gasolina contra electricidad por km.
// Solo ordenan (el eléctrico siempre sale mucho más barato por km); no se
// muestran como cifra al usuario.
const PESOS_GALON = 16_000;
const PESOS_KWH = 950;

const PESO_TIPICO: Record<string, number> = { SUV: 1450, Sedán: 1300, Hatchback: 1150, Pickup: 2000 };

const NO_SE = Number.NaN;
const cuenta = (...xs: unknown[]) => xs.filter(x => x === true || x === 'true' || x === 'Sí').length;

export function computeVehicleFeatures(vehicle: any, contexto: ContextoMercado): VehicleFeatures {
  const s = specsDe(vehicle.specifications);
  const electrico = vehicle.fuelType === 'Eléctrico';

  const hp = leer(s, 'combustion.maxPower', 'hybrid.maxPower', 'phev.maxPower', 'electric.maxPower');
  const torque = leer(s, 'combustion.maxTorque', 'hybrid.maxTorque', 'phev.maxTorque', 'electric.maxTorque');
  const peso = leer(s, 'dimensions.curbWeight', 'dimensions.weight');
  const acel = leer(s, 'performance.acceleration0to100');
  const frenado = leer(s, 'chassis.brakingDistance100to0');
  const vmax = leer(s, 'performance.maxSpeed');
  let altura = leer(s, 'chassis.groundClearance');
  if (altura !== null && altura < 1) altura *= 1000; // venía en metros
  const largo = leer(s, 'dimensions.length');
  const baul = leer(s, 'dimensions.cargoCapacity');
  const pasajeros = leer(s, 'interior.passengerCapacity');

  // Pesos por km: lo que de verdad le importa a "que no gaste mucho".
  const kmGal = rendimiento(s);
  const kwh100 = (() => {
    const c = leer(s, 'electric.cityElectricConsumption');
    const h = leer(s, 'electric.highwayElectricConsumption');
    return c !== null && h !== null ? (c + h) / 2 : (c ?? h);
  })();
  const pesosKm = electrico
    ? kwh100 !== null
      ? (kwh100 * PESOS_KWH) / 100
      : (16 * PESOS_KWH) / 100 // consumo típico de un eléctrico: solo para ordenar
    : kmGal !== null
      ? PESOS_GALON / kmGal
      : null;

  const autonomia = electrico
    ? leer(s, 'electric.realRangeMixed', 'electric.electricRange', 'electric.theoreticalRangeMixed')
    : kmGal !== null && tanque(s) !== null
      ? kmGal * tanque(s)!
      : null;

  const ncap = leer(s, 'safety.ncapRating');
  const airbags = leer(s, 'safety.airbags');
  const asistencias = cuenta(
    s.safety?.autonomousEmergencyBraking,
    s.safety?.forwardCollisionWarning,
    s.safety?.laneAssist,
    s.safety?.adaptiveCruiseControl,
    s.safety?.blindSpotDetection,
    s.safety?.crossTrafficAlert,
    s.safety?.fatigueMonitor,
    s.safety?.stabilityControl
  );
  const hayDatosSeguridad = ncap !== null || airbags !== null || asistencias > 0;

  const confort = cuenta(
    s.comfort?.airConditioning,
    s.comfort?.automaticClimateControl,
    s.comfort?.heatedSeats,
    s.comfort?.ventilatedSeats,
    s.comfort?.massageSeats,
    s.comfort?.automaticHighBeam,
    s.comfort?.rearAcVents,
    s.comfort?.keyless,
    s.comfort?.sunroof ? true : undefined, // enum: "Corredizo", "Panorámico"…
    s.comfort?.powerDriverSeat
  );
  const tecnologia = cuenta(
    s.technology?.bluetooth,
    s.technology?.touchscreen,
    s.technology?.navigation,
    s.technology?.smartphoneIntegration,
    s.technology?.wirelessCharger,
    s.assistance?.reverseCamera,
    s.assistance?.parkingSensors,
    s.assistance?.cameras360,
    s.technology?.wirelessSmartphone,
    s.technology?.connectedApp,
    s.assistance?.frontParkingSensors
  );

  const marca = contexto.marcas.get((vehicle.brand ?? '').toLowerCase());
  // Sin peso publicado se usa el típico de su carrocería: la potencia sigue
  // ordenando, solo pierde el matiz del peso.
  const toneladas = (peso ?? PESO_TIPICO[vehicle.type] ?? 1400) / 1000;

  const potenciaPeso = hp !== null ? hp / toneladas : NO_SE;
  const fuerzaPeso = torque !== null ? torque / toneladas : NO_SE;
  const alto = altura ?? NO_SE;
  const pickupOTodoterreno = /pickup|todoterreno/i.test(`${vehicle.type} ${vehicle.vehicleType ?? ''}`);
  const angulos = (leer(s, 'offRoad.approachAngle') ?? 0) + (leer(s, 'offRoad.departureAngle') ?? 0);
  // Tracción: solo suma cuando se sabe (no saberla no castiga).
  const traccion = String(s.drivetrain?.traction ?? '');
  const bonoTraccion =
    (traccion === '4x4' ? 120 : traccion === 'Integral (AWD)' ? 60 : 0) + (s.drivetrain?.lowRange === true ? 40 : 0);

  const f = {
    power_to_weight_norm: potenciaPeso,
    acceleration_norm: acel !== null ? -acel : NO_SE,
    braking_norm: frenado !== null ? -frenado : NO_SE,
    max_speed_norm: vmax ?? NO_SE,
    ground_clearance_norm: alto,
    efficiency_norm: pesosKm !== null ? -pesosKm : NO_SE,
    comfort_norm: confort > 0 ? confort : NO_SE,
    safety_norm: hayDatosSeguridad ? (ncap ?? 0) * 4 + (airbags ?? 0) + asistencias * 1.5 : NO_SE,
    tech_norm: tecnologia > 0 ? tecnologia : NO_SE,
    reliability_norm: marca?.reliability ?? NO_SE,
    space_norm: baul !== null || pasajeros !== null ? (baul ?? 0) + (pasajeros ?? 0) * 60 : NO_SE,
    urban_score: largo !== null ? -largo : NO_SE,
    highway_score: autonomia ?? NO_SE,
    offroad_score: altura !== null ? altura + angulos + (pickupOTodoterreno ? 60 : 0) + bonoTraccion : NO_SE,
    hill_climb_score: fuerzaPeso,
    potholes_score: alto,
    quality_price_ratio_norm: vehicle.price > 0 ? -vehicle.price : NO_SE,
    prestige_norm: marca?.prestige ?? NO_SE,
  };

  return {
    ...f,
    performance_score: f.power_to_weight_norm,
    efficiency_score: f.efficiency_norm,
    safety_score: f.safety_norm,
    comfort_score: f.comfort_norm,
    tech_score: f.tech_norm,
    value_score: f.quality_price_ratio_norm,
    usage_urban: f.urban_score,
    consumption_score: pesosKm ?? NO_SE,
    electric_range: electrico ? (autonomia ?? NO_SE) : 0,
  };
}

/** Percepción de marcas en Colombia (tabla curada), para confiabilidad y prestigio. */
export async function getMarketStats(): Promise<ContextoMercado> {
  const filas = await prisma.brandPerception
    .findMany({ select: { brand: true, prestige: true, reliability: true } })
    .catch(() => []);
  return { marcas: new Map(filas.map(f => [f.brand.toLowerCase(), f])) };
}

/**
 * Etiquetas cortas y verificables para la IA: solo lo que es cierto por tipo,
 * combustible o categoría editorial de WiseMotors. Las cifras van aparte.
 */
export function generateVehicleTags(vehicle: any): string[] {
  const tags: string[] = [];
  if (vehicle.type === 'Pickup') tags.push('platón para carga');
  if (vehicle.fuelType === 'Eléctrico') tags.push('eléctrico: cero gasolina');
  if (vehicle.fuelType === 'Híbrido') tags.push('híbrido');
  if (vehicle.wiseCategories) {
    for (const c of String(vehicle.wiseCategories).split(',')) {
      const limpia = c.trim();
      if (limpia) tags.push(`WiseMotors: ${limpia}`);
    }
  }
  return Array.from(new Set(tags)).slice(0, 6);
}
