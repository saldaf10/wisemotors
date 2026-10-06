// ============================================================================
// CAMPOS CLAVE — los datos sin los cuales la ficha queda coja.
//
// Son los que alimentan los bloques de la ficha (Desempeño, Consumo/Batería,
// Espacio, Seguridad, Tecnología), las tarjetas del catálogo, el comparador y
// los Índices WiseMotors. Si falta uno, un bloque desaparece sin que nadie lo
// note: por eso la ingesta los busca a propósito, la revisión los señala antes
// de publicar y el panel avisa de los carros publicados que siguen incompletos.
//
// Un campo se cumple con CUALQUIERA de sus keys (el consumo puede venir mixto
// o solo ciudad) y solo aplica si alguna de sus keys aplica al tren motriz (un
// eléctrico no tiene cilindraje). Un "no lo tiene" confirmado por una persona
// (false, "No") cuenta como dato. Si el dato de verdad no existe (un carro sin
// prueba de choque), el revisor lo marca como "no existe" y deja de pedirse.
// ============================================================================

import { ATTRIBUTE_REGISTRY, attributeAppliesTo, type AttributeDef, type ClaseVehiculo } from './registry';

export type SeccionClave = 'Desempeño' | 'Consumo' | 'Batería' | 'Espacio' | 'Carga' | 'Seguridad' | 'Tecnología' | 'Garantía';

export interface CampoClave {
  id: string;
  etiqueta: string;
  seccion: SeccionClave;
  /** Cualquiera de estas keys cumple el campo. La primera que aplique es donde se escribe a mano. */
  keys: string[];
  /** Para qué se usa, en una frase (se muestra al revisor). */
  porque: string;
  /** Solo se pide a estas clases (sin esto: a todas). */
  soloClases?: ClaseVehiculo[];
  /** No se pide a estas clases (a un camión no se le pide el 0 a 100). */
  noAplicaA?: ClaseVehiculo[];
}

/** Lo que casi nunca se publica de una van o un camión de trabajo. */
const NO_COMERCIAL: ClaseVehiculo[] = ['comercial'];

const TRENES = (campo: string) => [`combustion.${campo}`, `hybrid.${campo}`, `phev.${campo}`];

export const CAMPOS_CLAVE: CampoClave[] = [
  // Desempeño
  { id: 'potencia', etiqueta: 'Potencia', seccion: 'Desempeño', keys: [...TRENES('maxPower'), 'electric.maxPower'], porque: 'Tarjeta, ficha, Índice Altura y Palmas' },
  { id: 'torque', etiqueta: 'Torque', seccion: 'Desempeño', keys: [...TRENES('maxTorque'), 'electric.maxTorque'], porque: 'Bloque de desempeño y búsqueda "para subir"' },
  { id: 'aceleracion', etiqueta: '0 a 100 km/h', seccion: 'Desempeño', keys: ['performance.acceleration0to100'], porque: 'Tarjeta del catálogo y carrera en la ficha', noAplicaA: NO_COMERCIAL },
  { id: 'velocidad', etiqueta: 'Velocidad máxima', seccion: 'Desempeño', keys: ['performance.maxSpeed'], porque: 'Velocímetro de la ficha' },
  { id: 'caja', etiqueta: 'Transmisión', seccion: 'Desempeño', keys: TRENES('transmissionType'), porque: 'Filtro automática/manual del buscador' },
  { id: 'traccion', etiqueta: 'Tracción', seccion: 'Desempeño', keys: ['drivetrain.traction'], porque: 'Filtro 4x4 y búsqueda "para finca"' },
  { id: 'cilindraje', etiqueta: 'Cilindraje', seccion: 'Desempeño', keys: TRENES('displacement'), porque: 'Ficha y SOAT del Costo Real de Tenencia' },
  { id: 'induccion', etiqueta: 'Turbo o atmosférico', seccion: 'Desempeño', keys: ['combustion.inductionType', 'combustion.turbo'], porque: 'Índice Altura (cuánto pierde en Bogotá)' },
  { id: 'peso', etiqueta: 'Peso', seccion: 'Desempeño', keys: ['dimensions.curbWeight'], porque: 'Índice Palmas' },

  // Consumo / batería
  {
    id: 'consumo',
    etiqueta: 'Rendimiento (km por galón)',
    seccion: 'Consumo',
    keys: [...TRENES('combinedConsumption'), ...TRENES('cityConsumption')],
    porque: 'Tarjeta, ficha, búsqueda "que gaste poco" y Costo Real de Tenencia',
  },
  { id: 'tanque', etiqueta: 'Tanque', seccion: 'Consumo', keys: TRENES('fuelTankCapacity'), porque: 'Kilómetros con el tanque lleno' },
  { id: 'autonomia', etiqueta: 'Autonomía eléctrica', seccion: 'Batería', keys: ['electric.electricRange', 'electric.realRangeMixed', 'phev.electricRange'], porque: 'Tarjeta, ficha y ruta desde Medellín' },
  { id: 'bateria', etiqueta: 'Batería', seccion: 'Batería', keys: ['electric.batteryCapacity', 'phev.batteryCapacity'], porque: 'Ficha y costo de energía' },
  { id: 'cargaRapida', etiqueta: 'Carga rápida', seccion: 'Batería', keys: ['electric.chargingTime1080', 'electric.dcChargingTime', 'phev.dcChargingTime'], porque: 'Bloque de batería' },
  { id: 'cargaCasa', etiqueta: 'Carga en casa', seccion: 'Batería', keys: ['electric.acChargingTime', 'phev.acChargingTime'], porque: 'Bloque de batería' },

  // Espacio
  { id: 'pasajeros', etiqueta: 'Pasajeros', seccion: 'Espacio', keys: ['interior.passengerCapacity'], porque: 'Filtro "7 puestos" y bloque de espacio' },
  { id: 'baul', etiqueta: 'Baúl', seccion: 'Espacio', keys: ['dimensions.cargoCapacity'], porque: 'Maletas en la ficha, búsqueda "para la familia"', soloClases: ['auto'] },
  { id: 'largo', etiqueta: 'Largo', seccion: 'Espacio', keys: ['dimensions.length'], porque: 'Medidas y "¿cabe en mi parqueadero?"' },
  { id: 'ancho', etiqueta: 'Ancho', seccion: 'Espacio', keys: ['dimensions.width'], porque: 'Medidas de la ficha' },
  { id: 'alto', etiqueta: 'Alto', seccion: 'Espacio', keys: ['dimensions.height'], porque: 'Medidas y silueta del carro' },
  { id: 'entreEjes', etiqueta: 'Distancia entre ejes', seccion: 'Espacio', keys: ['dimensions.wheelbase'], porque: 'Espacio para las piernas atrás' },
  { id: 'despeje', etiqueta: 'Altura al piso', seccion: 'Espacio', keys: ['chassis.groundClearance'], porque: 'Índice Hueco y búsqueda "para trocha"' },
  { id: 'llanta', etiqueta: 'Medida de llanta', seccion: 'Espacio', keys: ['wheels.tireSize'], porque: 'Índice Hueco' },

  // Carga (pickups, vans y camiones: lo primero que pregunta quien compra para trabajar)
  { id: 'cargaUtil', etiqueta: 'Capacidad de carga (payload)', seccion: 'Carga', keys: ['weight.payload'], porque: 'Cuánto peso lleva: lo primero que se compara en un vehículo de trabajo', soloClases: ['pickup', 'comercial'] },
  { id: 'remolque', etiqueta: 'Capacidad de remolque', seccion: 'Carga', keys: ['weight.towingCapacity'], porque: 'Tráiler, lancha, remolque de carga', soloClases: ['pickup', 'comercial'] },
  { id: 'pbv', etiqueta: 'Peso bruto vehicular (PBV)', seccion: 'Carga', keys: ['weight.grossVehicleWeight'], porque: 'Peso máximo cargado: define licencia y por dónde puede circular', soloClases: ['pickup', 'comercial'] },
  { id: 'zonaCarga', etiqueta: 'Largo del platón o del furgón', seccion: 'Carga', keys: ['cargoArea.length'], porque: 'Qué cabe atrás (estibas, motos, material)', soloClases: ['pickup', 'comercial'] },
  { id: 'volumenCarga', etiqueta: 'Volumen de carga', seccion: 'Carga', keys: ['dimensions.cargoCapacity', 'interior.interiorCargoCapacity', 'weight.cargoBoxVolume'], porque: 'Cuánto cabe en el furgón o la caja', soloClases: ['comercial'] },

  // Seguridad
  { id: 'airbags', etiqueta: 'Airbags', seccion: 'Seguridad', keys: ['safety.airbags'], porque: 'Tarjeta y bloque de seguridad' },
  { id: 'ncap', etiqueta: 'Estrellas en prueba de choque', seccion: 'Seguridad', keys: ['safety.ncapRating'], porque: 'Bloque de seguridad (si no tiene prueba, márcalo "no existe")', noAplicaA: NO_COMERCIAL },
  { id: 'estabilidad', etiqueta: 'Control de estabilidad', seccion: 'Seguridad', keys: ['safety.stabilityControl'], porque: 'Ayudas de seguridad' },
  { id: 'aeb', etiqueta: 'Frenado autónomo de emergencia', seccion: 'Seguridad', keys: ['safety.autonomousEmergencyBraking'], porque: 'Ayudas de seguridad y búsqueda' },
  { id: 'camara', etiqueta: 'Cámara de reversa', seccion: 'Seguridad', keys: ['assistance.reverseCamera', 'assistance.cameras360'], porque: 'Ayudas de seguridad y búsqueda' },
  { id: 'sensores', etiqueta: 'Sensores de parqueo', seccion: 'Seguridad', keys: ['assistance.parkingSensors'], porque: 'Ayudas de seguridad y búsqueda' },
  { id: 'isofix', etiqueta: 'ISOFIX', seccion: 'Seguridad', keys: ['safety.isofix'], porque: 'Búsqueda "silla del bebé"', noAplicaA: NO_COMERCIAL },
  { id: 'carril', etiqueta: 'Asistente de carril', seccion: 'Seguridad', keys: ['safety.laneAssist'], porque: 'Ayudas de seguridad', noAplicaA: NO_COMERCIAL },
  { id: 'puntoCiego', etiqueta: 'Alerta de punto ciego', seccion: 'Seguridad', keys: ['safety.blindSpotDetection'], porque: 'Ayudas de seguridad', noAplicaA: NO_COMERCIAL },
  { id: 'crucero', etiqueta: 'Crucero adaptativo', seccion: 'Seguridad', keys: ['safety.adaptiveCruiseControl'], porque: 'Ayudas de seguridad', noAplicaA: NO_COMERCIAL },

  // Tecnología
  { id: 'pantalla', etiqueta: 'Pantalla central (pulgadas)', seccion: 'Tecnología', keys: ['technology.centralScreenIn'], porque: 'Bloque de tecnología' },
  { id: 'celular', etiqueta: 'CarPlay / Android Auto', seccion: 'Tecnología', keys: ['technology.smartphoneIntegration'], porque: 'Tarjeta, tecnología y búsqueda' },
  { id: 'clima', etiqueta: 'Aire acondicionado automático', seccion: 'Tecnología', keys: ['comfort.automaticClimateControl'], porque: 'Confort y búsqueda' },
  { id: 'faros', etiqueta: 'Tipo de faros', seccion: 'Tecnología', keys: ['lighting.headlightType'], porque: 'Tecnología y búsqueda "luces LED"' },
  { id: 'cargadorInalambrico', etiqueta: 'Cargador inalámbrico', seccion: 'Tecnología', keys: ['technology.wirelessCharger'], porque: 'Tecnología y búsqueda', noAplicaA: NO_COMERCIAL },
  { id: 'sinLlave', etiqueta: 'Encendido sin llave', seccion: 'Tecnología', keys: ['comfort.keyless'], porque: 'Confort', noAplicaA: NO_COMERCIAL },

  // Garantía
  { id: 'garantia', etiqueta: 'Garantía (años)', seccion: 'Garantía', keys: ['commercial.warrantyYears'], porque: 'Ficha y comparador' },
  { id: 'garantiaKm', etiqueta: 'Garantía (km)', seccion: 'Garantía', keys: ['commercial.warrantyKm'], porque: 'Ficha y comparador' },
];

const DEF = new Map(ATTRIBUTE_REGISTRY.map(d => [d.key, d]));

/** Keys del campo que aplican a este tren motriz (vacío = el campo no aplica). */
function keysQueAplican(c: CampoClave, fuelType: string) {
  return c.keys.filter(k => {
    const d = DEF.get(k);
    return d && attributeAppliesTo(d, fuelType);
  });
}

/** ¿El campo se le pide a esta clase de vehículo? */
const aplicaAClase = (c: CampoClave, clase: ClaseVehiculo) =>
  (!c.soloClases || c.soloClases.includes(clase)) && !(c.noAplicaA ?? []).includes(clase);

/** Campos clave que aplican a este tren motriz y esta clase (carro, pickup, van/camión). */
export function camposClave(fuelType: string, clase: ClaseVehiculo = 'auto'): CampoClave[] {
  return CAMPOS_CLAVE.filter(c => aplicaAClase(c, clase) && keysQueAplican(c, fuelType).length > 0);
}

/** Dónde se escribe el dato si se ingresa a mano (la primera key que aplica). */
export function keyDeEntrada(c: CampoClave, fuelType: string): AttributeDef | null {
  const k = keysQueAplican(c, fuelType)[0];
  return k ? DEF.get(k)! : null;
}

/** ¿Hay dato? false y "No" confirmados por una persona cuentan; vacío no. */
export const tieneValor = (v: unknown) => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && !Number.isFinite(v));

/**
 * Campos clave que faltan.
 * @param valores key → valor (lo que ya tiene el carro o el borrador)
 * @param sinDato ids que el revisor marcó como "el dato no existe"
 */
export function clavesFaltantes(
  fuelType: string,
  valores: Record<string, unknown>,
  sinDato: string[] = [],
  clase: ClaseVehiculo = 'auto'
): CampoClave[] {
  return camposClave(fuelType, clase).filter(c => !sinDato.includes(c.id) && !keysQueAplican(c, fuelType).some(k => tieneValor(valores[k])));
}

/** Aplana specifications ({a:{b:1}}) a { 'a.b': 1 } para preguntar por keys. */
export function valoresDeSpecs(specs: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [bloque, campos] of Object.entries(specs ?? {})) {
    if (campos && typeof campos === 'object' && !Array.isArray(campos)) {
      for (const [campo, v] of Object.entries(campos)) out[`${bloque}.${campo}`] = v;
    }
  }
  return out;
}

/** Ids marcados "el dato no existe", guardados en specifications.meta.sinDato. */
export function sinDatoDeSpecs(specs: Record<string, any>): string[] {
  const x = specs?.meta?.sinDato;
  return Array.isArray(x) ? x.filter((i: unknown) => typeof i === 'string') : [];
}
