import type { Metadata } from 'next'
import '@fontsource-variable/inter-tight'
import '@fontsource/anton'
import '@fontsource-variable/jetbrains-mono'
import './globals.css'
import './legacy.css'
import { FavoritesProvider } from '@/contexts/FavoritesContext'
import { AuthProvider } from '@/contexts/AuthContext'

// Fuentes self-hosted (fontsource): Inter Tight para todo, Anton solo para la
// palabra gigante detrás de un carro, JetBrains Mono para cifras y rótulos.
// Las familias se declaran en globals.css (--font-sans/display/mono).

export const metadata: Metadata = {
  title: {
    default: 'WiseMotors - Encuentra tu vehículo ideal con IA',
    template: '%s | WiseMotors'
  },
  description: 'Usa nuestra inteligencia artificial para encontrar el carro o moto perfecto. Describe lo que buscas y WiseMotors lo encuentra por ti en segundos.',
  keywords: ['compra de vehículos', 'carros usados', 'motos', 'búsqueda con IA', 'WiseMotors', 'automóviles Colombia', 'concesionario digital'],
  authors: [{ name: 'WiseMotors' }],
  creator: 'WiseMotors',
  publisher: 'WiseMotors',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://wisemotors.co'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'WiseMotors - Encuentra tu vehículo ideal con IA',
    description: 'Búsqueda inteligente de vehículos impulsada por IA. Encuentra lo que realmente necesitas.',
    url: 'https://wisemotors.co',
    siteName: 'WiseMotors',
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WiseMotors - Búsqueda de Vehículos con IA',
    description: 'Encuentra tu próximo vehículo describiendo lo que quieres. IA al servicio de tu movilidad.',
  },
  icons: {
    icon: [
      { url: '/favicon.png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: [
      { url: '/favicon.png' },
      { url: '/favicon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  verification: {
    google: 'sbnaPtb58P-S65ESDPs8gbDU37O2nCKIy28NIXIKuLk',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="font-sans">
        <AuthProvider>
          <FavoritesProvider>
            {children}
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
