import { getVehicles } from '@/lib/data/vehicles';
import { Catalogo } from '@/components/vehicles/Catalogo';
import type { VehiculoTarjeta } from '@/components/car/TarjetaCarro';

// Se arma en cada visita, no en el build: así el build no necesita la base de
// datos (en Vercel, las variables de entorno pueden no estar en el build).
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Catálogo',
  description: 'Carros nuevos en Colombia, medidos contra el mercado colombiano y explicados en palabras de persona.',
};

// El catálogo completo (hasta 200) se filtra en el cliente: ver components/vehicles/Catalogo.tsx.
export default async function VehiclesPage() {
  const { vehicles } = await getVehicles({ limit: 200, sortBy: 'createdAt' });
  return <Catalogo vehiculos={vehicles as unknown as VehiculoTarjeta[]} />;
}
