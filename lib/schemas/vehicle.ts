import { z } from 'zod';

// Esquemas para especificaciones específicas
const performanceSchema = z.object({
  acceleration0to100: z.number().min(0).optional(),
  acceleration0to200: z.number().min(0).optional(),
  quarterMile: z.number().min(0).optional(),
  overtaking80to120: z.number().min(0).optional(),
  maxSpeed: z.number().min(0).optional(),
  powerToWeight: z.number().min(0).optional(),
  launchControl: z.boolean().optional(),
});

const chassisSchema = z.object({
  groundClearance: z.number().min(0).optional(),
  brakingDistance100to0: z.number().min(0).optional(),
  maxLateralAcceleration: z.number().optional(),
  maxLongitudinalAcceleration: z.number().optional(),
  suspensionSetup: z.string().optional(),
});

const offRoadSchema = z.object({
  approachAngle: z.number().min(0).optional(),
  departureAngle: z.number().min(0).optional(),
  breakoverAngle: z.number().min(0).optional(),
  wadingDepth: z.number().min(0).optional(),
  wadingHeight: z.number().min(0).optional(),
});

const weightSchema = z.object({
  grossCombinedWeight: z.number().min(0).optional(),
  payload: z.number().min(0).optional(),
  towingCapacity: z.number().min(0).optional(),
  cargoBoxVolume: z.number().min(0).optional(),
});

const dimensionsSchema = z.object({
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  wheelbase: z.number().min(0).optional(),
  curbWeight: z.number().min(0).optional(),
  cargoCapacity: z.number().min(0).optional(),
});

const interiorSchema = z.object({
  trunkCapacitySeatsDown: z.number().min(0).optional(),
  seatRows: z.number().min(1).optional(),
  interiorCargoCapacity: z.number().min(0).optional(),
  passengerCapacity: z.number().min(1).optional(),
});

const safetySchema = z.object({
  airbags: z.number().min(0).optional(),
  ncapRating: z.number().min(0).max(5).optional(),
  adultSafetyScore: z.number().min(0).max(100).optional(),
  childSafetyScore: z.number().min(0).max(100).optional(),
  assistanceScore: z.number().min(0).max(100).optional(),
  brakingSystem: z.array(z.enum(['ABS', 'EBD', 'BA'])).optional(),
  stabilityControl: z.boolean().optional(),
  tractionControl: z.boolean().optional(),
  autonomousEmergencyBraking: z.boolean().optional(),
  forwardCollisionWarning: z.boolean().optional(),
  laneAssist: z.boolean().optional(),
  adaptiveCruiseControl: z.boolean().optional(),
  blindSpotDetection: z.boolean().optional(),
  crossTrafficAlert: z.boolean().optional(),
  fatigueMonitor: z.boolean().optional(),
  tirePressureMonitoring: z.boolean().optional(),
});

const lightingSchema = z.object({
  headlightType: z.enum(['Halógeno', 'Xenón', 'LED', 'Laser', 'Matrix LED']).optional(),
});

const assistanceSchema = z.object({
  brakeAssist: z.boolean().optional(),
  hillStartAssist: z.boolean().optional(),
  reverseCamera: z.boolean().optional(),
  parkingSensors: z.boolean().optional(),
  cameras360: z.boolean().optional(),
});

const comfortSchema = z.object({
  airConditioning: z.boolean().optional(),
  automaticClimateControl: z.boolean().optional(),
  heatedSeats: z.boolean().optional(),
  ventilatedSeats: z.boolean().optional(),
  massageSeats: z.boolean().optional(),
  automaticHighBeam: z.boolean().optional(),
});

const technologySchema = z.object({
  bluetooth: z.boolean().optional(),
  touchscreen: z.boolean().optional(),
  navigation: z.boolean().optional(),
  smartphoneIntegration: z.array(z.enum(['CarPlay', 'Android Auto'])).optional(),
  wirelessCharger: z.boolean().optional(),
  startStop: z.boolean().optional(),
});

const wisemetricsSchema = z.object({
  drivingFun: z.number().min(0).max(100).optional(),
  technology: z.number().min(0).max(100).optional(),
  environmentalImpact: z.number().min(0).max(100).optional(),
  reliability: z.number().min(0).max(100).optional(),
  qualityPriceRatio: z.number().min(0).max(100).optional(),
  comfort: z.number().min(0).max(100).optional(),
  usability: z.number().min(0).max(100).optional(),
  efficiency: z.number().min(0).max(100).optional(),
  prestige: z.number().min(0).max(100).optional(),
  userRating: z.number().min(0).max(5).optional(),
  interiorQuality: z.number().min(0).max(100).optional(),
  easeOfUse: z.number().min(0).max(100).optional(),
  easeOfParking: z.number().min(0).max(100).optional(),
  practicality: z.number().min(0).max(100).optional(),
  serviceConvenience: z.number().min(0).max(100).optional(),
  experience: z.number().min(0).max(100).optional(),
  visibility: z.number().min(0).max(100).optional(),
  easeOfCleaning: z.number().min(0).max(100).optional(),
  petFriendly: z.number().min(0).max(100).optional(),
  familyFriendly: z.number().min(0).max(100).optional(),
});

// Esquemas específicos por tipo de vehículo
const combustionEngineSchema = z.object({
  displacement: z.number().min(0).optional(),
  turbo: z.boolean().optional(),
  supercharger: z.boolean().optional(),
  engineConfiguration: z.enum(['En línea', 'V', 'Boxer', 'W']).optional(),
  inductionType: z.enum(['Natural', 'Turbo', 'Supercargado', 'Biturbo', 'Electric turbo']).optional(),
  compressionRatio: z.number().min(0).optional(),
  octanajeRecomendado: z.string().optional(),
  maxPower: z.number().min(0).optional(),
  maxTorque: z.number().min(0).optional(),
  rpmLimit: z.number().min(0).optional(),
  transmissionType: z.enum(['Manual', 'Automática', 'CVT', 'DCT', 'AMT']).optional(),
  gears: z.number().min(1).optional(),
  fuelTankCapacity: z.number().min(0).optional(),
  powerAtRpm: z.number().min(0).optional(),
  cityConsumption: z.number().min(0).optional(),
  highwayConsumption: z.number().min(0).optional(),
  combinedConsumption: z.number().min(0).optional(),
  emissionStandard: z.string().optional(),
  startStop: z.boolean().optional(),
  ecoMode: z.boolean().optional(),
  ahorro5Anos: z.string().optional(),
});

const electricVehicleSchema = z.object({
  cityElectricConsumption: z.number().min(0).optional(),
  highwayElectricConsumption: z.number().min(0).optional(),
  electricRange: z.number().min(0).optional(),
  theoreticalRangeHighway: z.number().min(0).optional(),
  theoreticalRangeCity: z.number().min(0).optional(),
  theoreticalRangeMixed: z.number().min(0).optional(),
  realRangeHighway: z.number().min(0).optional(),
  realRangeCity: z.number().min(0).optional(),
  realRangeMixed: z.number().min(0).optional(),
  acChargingTime: z.number().min(0).optional(),
  dcChargingTime: z.number().min(0).optional(),
  chargingTime1080: z.number().min(0).optional(),
  regenerativeBraking: z.boolean().optional(),
  batteryCapacity: z.number().min(0).optional(),
  batteryPrice: z.number().min(0).optional(),
  homeChargerCost: z.number().min(0).optional(),
  chargingConvenienceIndex: z.number().min(0).max(100).optional(),
});

const hybridVehicleSchema = z.object({
  displacement: z.number().min(0).optional(),
  engineConfiguration: z.enum(['En línea', 'V', 'Boxer', 'W']).optional(),
  maxPower: z.number().min(0).optional(),
  maxTorque: z.number().min(0).optional(),
  transmissionType: z.enum(['Manual', 'Automática', 'CVT', 'DCT', 'AMT']).optional(),
  gears: z.number().min(1).optional(),
  fuelTankCapacity: z.number().min(0).optional(),
  cityConsumption: z.number().min(0).optional(),
  highwayConsumption: z.number().min(0).optional(),
  batteryCapacity: z.number().min(0).optional(),
  regenerativeBraking: z.boolean().optional(),
  startStop: z.boolean().optional(),
  ecoMode: z.boolean().optional(),
});

const phevVehicleSchema = z.object({
  displacement: z.number().min(0).optional(),
  engineConfiguration: z.enum(['En línea', 'V', 'Boxer', 'W']).optional(),
  maxPower: z.number().min(0).optional(),
  maxTorque: z.number().min(0).optional(),
  transmissionType: z.enum(['Manual', 'Automática', 'CVT', 'DCT', 'AMT']).optional(),
  gears: z.number().min(1).optional(),
  fuelTankCapacity: z.number().min(0).optional(),
  cityConsumption: z.number().min(0).optional(),
  highwayConsumption: z.number().min(0).optional(),
  batteryCapacity: z.number().min(0).optional(),
  electricRange: z.number().min(0).optional(),
  acChargingTime: z.number().min(0).optional(),
  dcChargingTime: z.number().min(0).optional(),
  regenerativeBraking: z.boolean().optional(),
  batteryWeight: z.number().min(0).optional(),
  homeChargerCost: z.number().min(0).optional(),
  chargingConvenienceIndex: z.number().min(0).max(100).optional(),
});

// Esquema principal de especificaciones
const specificationsSchema = z.object({
  performance: performanceSchema.optional(),
  chassis: chassisSchema.optional(),
  offRoad: offRoadSchema.optional(),
  weight: weightSchema.optional(),
  dimensions: dimensionsSchema.optional(),
  interior: interiorSchema.optional(),
  safety: safetySchema.optional(),
  lighting: lightingSchema.optional(),
  assistance: assistanceSchema.optional(),
  comfort: comfortSchema.optional(),
  technology: technologySchema.optional(),
  wisemetrics: wisemetricsSchema.optional(),
  combustion: combustionEngineSchema.optional(),
  electric: electricVehicleSchema.optional(),
  hybrid: hybridVehicleSchema.optional(),
  phev: phevVehicleSchema.optional(),
  // Campos adicionales del formulario de AddVehicleForm
  identification: z.any().optional(),
  powertrain: z.any().optional(),
  transmission: z.any().optional(),
  efficiency: z.any().optional(),
  battery: z.any().optional(),
  adas: z.any().optional(),
  infotainment: z.any().optional(),
  commercial: z.any().optional(),
  metadata: z.any().optional(),
}).passthrough(); // Permitir campos adicionales

// Esquema principal del vehículo
export const vehicleSchema = z.object({
  brand: z.string().min(1, 'La marca es requerida'),
  model: z.string().min(1, 'El modelo es requerido'),
  year: z.number().min(1900).max(2030),
  price: z.number().min(0, 'El precio debe ser mayor a 0'),
  type: z.enum(['Sedán', 'SUV', 'Pickup', 'Deportivo', 'Wagon', 'Hatchback', 'Convertible', 'Van', 'Camión']),
  vehicleType: z.enum(['Automóvil', 'Deportivo', 'Todoterreno', 'Lujo', 'Económico', 'Comercial']),
  fuelType: z.enum(['Gasolina', 'Diesel', 'Eléctrico', 'Híbrido', 'Híbrido Enchufable']),
  history: z.string().optional(),
  wiseCategories: z.string().optional(),
  specifications: specificationsSchema,
  dealerIds: z.array(z.string()).min(1, 'Debe seleccionar al menos un concesionario'),
  coverImage: z.string().optional(),
  galleryImages: z.array(z.string()).optional(),
  thumbnailIndex: z.number().min(0).optional(),
  reviewVideoUrl: z.string().url('Debe ser una URL válida').optional().or(z.literal('')),
});

// Esquema para actualizaciones parciales - más permisivo
export const vehicleUpdateSchema = z.object({
  brand: z.string().min(1, 'La marca es requerida').optional(),
  model: z.string().min(1, 'El modelo es requerido').optional(),
  year: z.number().min(1900).max(2030).optional(),
  price: z.number().min(0, 'El precio debe ser mayor a 0').optional(),
  type: z.enum(['Sedán', 'SUV', 'Pickup', 'Deportivo', 'Wagon', 'Hatchback', 'Convertible', 'Van', 'Camión']).optional(),
  vehicleType: z.enum(['Automóvil', 'Deportivo', 'Todoterreno', 'Lujo', 'Económico', 'Comercial']).optional(),
  fuelType: z.enum(['Gasolina', 'Diesel', 'Eléctrico', 'Híbrido', 'Híbrido Enchufable']).optional(),
  history: z.string().optional(),
  wiseCategories: z.string().optional(),
  specifications: z.any().optional(), // Permitir cualquier estructura para actualizaciones
  dealerIds: z.array(z.string()).min(1, 'Debe seleccionar al menos un concesionario').optional(),
  coverImage: z.string().optional(),
  galleryImages: z.array(z.string()).optional(),
  thumbnailIndex: z.number().min(0).optional(),
  reviewVideoUrl: z.string().optional(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;
export type VehicleSpecifications = z.infer<typeof specificationsSchema>;
