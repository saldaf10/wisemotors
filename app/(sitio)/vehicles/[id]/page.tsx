import { Metadata, ResolvingMetadata } from 'next'
import { FichaVehiculo } from '@/components/vehicles/FichaVehiculo'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { getVehicle } from '@/lib/data/vehicles'
import { indicesDeVehiculo } from '@/lib/indices/servidor'

interface Props {
  params: { id: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const vehicle = await getVehicle(params.id);

  if (!vehicle) {
    return {
      title: 'Vehículo no encontrado',
    }
  }

  const title = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const description = `Conoce todo sobre el ${vehicle.brand} ${vehicle.model} ${vehicle.year}. Precio: $${vehicle.price.toLocaleString()}. Especificaciones, rendimiento y más en WiseMotors.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | WiseMotors`,
      description,
      images: vehicle.imageUrl ? [vehicle.imageUrl] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | WiseMotors`,
      description,
      images: vehicle.imageUrl ? [vehicle.imageUrl] : [],
    },
  }
}

export default async function VehicleDetailPage({ params }: Props) {
  const vehicle = await getVehicle(params.id);

  if (!vehicle) {
    notFound();
  }

  // Índices WiseMotors (Altura, Palmas, Hueco, Costo Real de Tenencia).
  // Si algo falla, la ficha sale igual, sin la sección.
  const indices = await indicesDeVehiculo(vehicle).catch(() => null);

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
    description: vehicle.slogan,
    brand: {
      '@type': 'Brand',
      name: vehicle.brand,
    },
    model: vehicle.model,
    modelDate: vehicle.year,
    vehicleEngine: {
      '@type': 'EngineSpecification',
      engineDisplacement: vehicle.engine ? `${vehicle.engine} cc` : undefined,
      enginePower: vehicle.power ? `${vehicle.power} HP` : undefined,
    },
    fuelType: vehicle.fuelType,
    offers: {
      '@type': 'Offer',
      price: vehicle.price,
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
    },
    image: vehicle.imageUrl,
  };

  return (
    <div className="min-h-screen">
      <Script
        id="vehicle-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FichaVehiculo vehicle={vehicle} indices={indices} />
    </div>
  );
}
