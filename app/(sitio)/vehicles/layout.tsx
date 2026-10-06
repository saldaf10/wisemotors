import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Catálogo de Vehículos',
  description: 'Explora nuestra amplia selección de vehículos. Filtra por marca, precio, combustible y más para encontrar tu opción ideal.',
}

export default function VehiclesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
