import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConcesionario } from '@/lib/data/concesionarios';
import { PerfilConcesionario } from '@/components/concesionarios/PerfilConcesionario';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getConcesionario(params.id);
  if (!c) return { title: 'Concesionario no encontrado' };
  return {
    title: `${c.name} · ${c.location}`,
    description: `${c.name} en ${c.location}: dirección, horario, cómo llegar y los ${c.carros.length} carros que vende en WiseMotors.`,
  };
}

export default async function ConcesionarioPage({ params }: Props) {
  const c = await getConcesionario(params.id);
  if (!c) notFound();
  const { carros, ...perfil } = c;
  // Datos estructurados: Google entiende que es un concesionario con dirección y ubicación
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: perfil.name,
    address: { '@type': 'PostalAddress', streetAddress: perfil.address, addressLocality: perfil.location, addressCountry: 'CO' },
    ...(perfil.lat !== null && perfil.lng !== null ? { geo: { '@type': 'GeoCoordinates', latitude: perfil.lat, longitude: perfil.lng } } : {}),
    ...(perfil.phone ? { telephone: perfil.phone } : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PerfilConcesionario c={perfil} carros={carros} />
    </>
  );
}
