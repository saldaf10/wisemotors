// ============================================================================
// Índices de un vehículo, del lado del servidor: parámetros vigentes de la
// tabla parametros_indices (con los de código como respaldo) + la percepción
// de marca. La ficha los recibe ya calculados.
// ============================================================================

import { prisma } from '@/lib/prisma';
import { VALORES_POR_DEFECTO, type Valores } from './parametros';
import { calcularIndices, type IndicesVehiculo } from './calculo';

let cache: { valores: Valores; hasta: number } | null = null;

/** Parámetros vigentes; cacheados 10 minutos (cambian por deploy, no por visita). */
export async function parametrosVigentes(): Promise<Valores> {
  if (cache && cache.hasta > Date.now()) return cache.valores;
  let valores: Valores = { ...VALORES_POR_DEFECTO };
  try {
    const filas = await prisma.parametroIndice.findMany({ where: { validTo: null } });
    for (const f of filas) valores[f.clave] = f.valor;
  } catch {
    // Base sin la tabla todavía: los de código son la misma tabla curada.
    valores = { ...VALORES_POR_DEFECTO };
  }
  cache = { valores, hasta: Date.now() + 10 * 60 * 1000 };
  return valores;
}

export async function indicesDeVehiculo(v: {
  brand: string;
  type?: string | null;
  vehicleType?: string | null;
  fuelType: string;
  price: number;
  specifications: unknown;
}): Promise<IndicesVehiculo> {
  const [p, marca] = await Promise.all([
    parametrosVigentes(),
    prisma.brandPerception.findFirst({ where: { brand: { equals: v.brand, mode: 'insensitive' } } }).catch(() => null),
  ]);
  return calcularIndices(
    {
      fuelType: v.fuelType,
      price: v.price,
      specifications: v.specifications,
      confiabilidadMarca: marca?.reliability ?? null,
      type: v.type,
      vehicleType: v.vehicleType,
    },
    p
  );
}
