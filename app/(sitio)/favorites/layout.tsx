import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mis Favoritos',
  description: 'Consulta y gestiona tus vehículos favoritos. Guarda las opciones que más te gustan para revisarlas más tarde.',
}

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
