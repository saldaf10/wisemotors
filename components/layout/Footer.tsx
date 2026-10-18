import Link from 'next/link';
import { ArrowUpRight, Instagram } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { AvisoIA } from '@/components/ui/AvisoIA';

// ============================================================================
// Cierre en showroom: titular en dos tonos, enlaces, líneas de ticks y la
// marca gigante recortada contra el borde (referencias LaFerrari / Nexwash).
// ============================================================================

const COLUMNAS = [
  {
    titulo: 'Explorar',
    enlaces: [
      { texto: 'Catálogo', href: '/vehicles' },
      { texto: 'Comparar', href: '/compare' },
      { texto: 'Favoritos', href: '/favorites' },
    ],
  },
  {
    titulo: 'Cuenta',
    enlaces: [
      { texto: 'Ingresar', href: '/login' },
      { texto: 'Crear cuenta', href: '/register' },
    ],
  },
  {
    titulo: 'Contacto',
    enlaces: [
      { texto: '@wisemotors.co', href: 'https://instagram.com/wisemotors.co' },
      { texto: '+57 310 381 8615', href: 'tel:+573103818615' },
      { texto: 'wisemotorsco@gmail.com', href: 'mailto:wisemotorsco@gmail.com' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-showroom text-white">
      <div className="mx-auto max-w-[1440px] px-5 pt-20 md:px-8 md:pt-28">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <h2 className="t-titulo text-[44px] md:text-[64px]">
              <span className="text-white/60">No tienes que saber de carros.</span>{' '}
              <span>Para eso estamos.</span>
            </h2>
            <Link href="/vehicles" className="cta-corte mt-10">
              Ver el catálogo <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-6 md:pt-3">
            {COLUMNAS.map(c => (
              <div key={c.titulo}>
                <p className="t-meta text-white/55">{c.titulo}</p>
                <ul className="mt-5 space-y-3">
                  {c.enlaces.map(e => (
                    <li key={e.href}>
                      <Link
                        href={e.href}
                        className="group inline-flex items-center gap-1.5 text-[15px] text-white/75 transition-colors hover:text-white"
                      >
                        {e.texto}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <AvisoIA claro className="mt-14 max-w-[640px]" />

        <div className="ticks mt-8 text-white" />

        <div className="flex flex-wrap items-center justify-between gap-4 py-6">
          <Logo oscuro />
          <p className="t-meta text-white/55">(Medellín · Colombia) · © {new Date().getFullYear()} WiseMotors</p>
          <a
            href="https://instagram.com/wisemotors.co"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de WiseMotors"
            className="flecha !border-white/15 !bg-white/5 !text-white"
          >
            <Instagram className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Marca gigante que se sale por abajo */}
      <p
        aria-hidden
        className="t-display pointer-events-none -mb-[0.2em] select-none whitespace-nowrap px-4 text-center text-[17vw] leading-[0.8] text-white/[0.06]"
      >
        WISEMOTORS
      </p>
    </footer>
  );
}
