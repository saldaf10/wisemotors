import type { Metadata } from 'next';
import { Logo, LogoMarca } from '@/components/brand/Logo';
import { FormularioEspera } from '@/components/espera/FormularioEspera';
import { CIUDADES } from '@/lib/lista-espera';

// Página "Muy pronto" de la campaña de expectativa. Mientras el sitio esté
// cerrado (lib/acceso.ts), cualquier URL de wisemotors.co muestra esta página.
// Regla de la campaña: ni una sola función del producto antes del lanzamiento.

const PROMESA = 'Muy pronto, dudar al comprar carro será cosa del pasado.';

export const metadata: Metadata = {
  title: { absolute: 'WiseMotors · Muy pronto' },
  description: `${PROMESA} Inscríbete y entérate primero.`,
  openGraph: {
    title: 'WiseMotors · Muy pronto',
    description: PROMESA,
    url: 'https://wisemotors.co',
    siteName: 'WiseMotors',
    locale: 'es_CO',
    type: 'website',
  },
};

export default function EsperaPage() {
  return (
    <div className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-showroom text-white">
      {/* La W gigante, casi invisible, como luz de fondo. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-[18vw] top-1/2 w-[95vw] max-w-[1100px] -translate-y-1/2 opacity-[0.07] md:-right-[8vw] md:w-[70vw]">
          <LogoMarca className="h-auto w-full" tono="blanco" />
        </div>
        <div className="absolute left-1/2 top-[38%] h-[60vh] w-[80vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(136,28,183,0.38),transparent)] blur-2xl" />
      </div>

      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 pt-6 md:px-8 md:pt-8">
        <Logo oscuro />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">Muy pronto</span>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-12 px-4 py-14 md:grid-cols-12 md:px-8 md:py-20">
        <div className="md:col-span-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-wise-lila">Para el que no sabe de carros</p>
          <h1 className="t-titulo mt-5 text-[44px] sm:text-[60px] md:text-[76px]">
            Muy pronto, dudar al comprar carro será <span className="text-wise-lila">cosa del pasado.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-white/65">
            Todos tenemos a alguien que «sabe de carros» y al que llamamos antes de comprar. Algo viene. Inscríbete y entérate
            antes que nadie.
          </p>
        </div>

        <div className="md:col-span-5">
          <FormularioEspera ciudades={[...CIUDADES]} />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] px-4 pb-6 font-mono text-[11px] text-white/35 md:px-8">
        © {new Date().getFullYear()} WiseMotors · Medellín, Colombia
      </footer>
    </div>
  );
}
