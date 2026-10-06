// ============================================================================
// Clase de vehículo: carro, pickup o van/camión.
//
// No es un campo aparte en la base: sale de la carrocería (`Vehicle.type`).
// Cambia dos cosas:
//   - los rangos físicos válidos (registry.ts → RANGOS_POR_CLASE): una van de
//     carga tiene 15.000 L "de baúl" y un camión pesa 7 t;
//   - los datos clave (clave.ts): a una pickup o un camión se le pide carga
//     útil, remolque y peso bruto; a un camión no se le pide el 0 a 100.
// ============================================================================

import type { ClaseVehiculo } from './registry';

export type { ClaseVehiculo };

export const CLASES: { id: ClaseVehiculo; etiqueta: string; ayuda: string; tipos: string[] }[] = [
  { id: 'auto', etiqueta: 'Carro', ayuda: 'Sedán, hatchback, SUV, deportivo…', tipos: ['Sedán', 'Hatchback', 'SUV', 'Wagon', 'Deportivo', 'Convertible'] },
  { id: 'pickup', etiqueta: 'Pickup', ayuda: 'Camioneta con platón', tipos: ['Pickup'] },
  { id: 'comercial', etiqueta: 'Van o camión', ayuda: 'Vans de carga o pasajeros, furgones, camiones', tipos: ['Van', 'Camión'] },
];

/** Todas las carrocerías válidas, en orden para los selectores. */
export const TIPOS_CARROCERIA = CLASES.flatMap(c => c.tipos);

/** Categorías (Vehicle.vehicleType). "Comercial" es la de vans y camiones de trabajo. */
export const CATEGORIAS = ['Automóvil', 'Deportivo', 'Todoterreno', 'Lujo', 'Económico', 'Comercial'];

export function esClase(x: unknown): x is ClaseVehiculo {
  return x === 'auto' || x === 'pickup' || x === 'comercial';
}

/** Clase de un vehículo según su carrocería. */
export function claseDeTipo(type: string | null | undefined): ClaseVehiculo {
  if (type === 'Pickup') return 'pickup';
  if (type === 'Van' || type === 'Camión') return 'comercial';
  return 'auto';
}

/** Carrocerías posibles de una clase. */
export function tiposDeClase(clase: ClaseVehiculo): string[] {
  return CLASES.find(c => c.id === clase)!.tipos;
}

/** Cómo se nombra la clase en los prompts de la IA ("camión", "pickup"…). */
export function claseEnPalabras(clase: ClaseVehiculo): string {
  return clase === 'pickup' ? 'pickup (camioneta con platón)' : clase === 'comercial' ? 'van o camión de trabajo' : 'carro de pasajeros';
}
