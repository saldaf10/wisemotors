import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Comparar Vehículos',
  description: 'Compara tus vehículos favoritos lado a lado. Analiza especificaciones, rendimiento y tecnología para tomar la mejor decisión.',
}

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
