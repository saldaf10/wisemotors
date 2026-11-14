import type { Metadata } from 'next';
import { Bienvenida } from '@/components/bienvenida/Bienvenida';

// Bienvenida por invitación (nov-2026). Mientras el sitio esté cerrado
// (lib/acceso.ts), cualquier URL de wisemotors.co sin acceso muestra esta página.
// Reemplazó la de lista de espera: ahora se entra con un código de invitación.

const PROMESA = 'Escoge carro sin saber de carros. Acceso anticipado solo con invitación.';

export const metadata: Metadata = {
  title: { absolute: 'WiseMotors · Acceso por invitación' },
  description: PROMESA,
  openGraph: {
    title: 'WiseMotors · Te guardamos un puesto',
    description: PROMESA,
    url: 'https://wisemotors.co',
    siteName: 'WiseMotors',
    locale: 'es_CO',
    type: 'website',
  },
};

export default function BienvenidaPage() {
  return <Bienvenida />;
}
