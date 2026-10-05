'use client';

// ============================================================================
// Hero: showroom partido (referencia LaFerrari).
//
// Panel morado profundo a la izquierda, negro a la derecha. WISE gigante en
// Anton, en dos tonos según el fondo que pisa, siempre (es la marca), y los
// carros de exhibición dibujados rotando encima como en una tornamesa: el carro
// sale, el nuevo entra desenfocado y se posa.
//
// Solo imágenes, sin cifras: el protagonista es el buscador. Las fotos de los
// carros publicados se ven pixeladas a este tamaño, así que aquí van los
// renders hasta tener fotografía de estudio de verdad.
// ============================================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CarRender } from '@/components/car/CarRender';
import { BuscadorIA } from '@/components/home/BuscadorIA';

const INTERVALO = 7000;

// Carros de exhibición dibujados, uno por carrocería, sin datos.
const VITRINA: { id: string; tipo: string; car: any }[] = [
  { id: 'vitrina-suv', tipo: 'SUV', car: { id: 'vitrina-suv', brand: 'Exhibicion', model: 'suv familiar', type: 'SUV', fuelType: 'Híbrido' } },
  { id: 'vitrina-sedan', tipo: 'Sedán', car: { id: 'vitrina-sedan', brand: 'Exhibicion', model: 'sedan ejecutivo', type: 'Sedán', fuelType: 'Gasolina' } },
  { id: 'vitrina-hatch', tipo: 'Hatchback', car: { id: 'vitrina-hatch', brand: 'Exhibicion', model: 'hatch urbano', type: 'Hatchback', fuelType: 'Eléctrico' } },
  { id: 'vitrina-pickup', tipo: 'Pickup', car: { id: 'vitrina-pickup', brand: 'Exhibicion', model: 'pickup finca', type: 'Pickup', fuelType: 'Diesel' } },
  { id: 'vitrina-coupe', tipo: 'SUV coupé', car: { id: 'vitrina-coupe', brand: 'Exhibicion', model: 'model coupe', type: 'SUV', fuelType: 'Eléctrico', specifications: { dimensions: { height: 1560 } } } },
];

function Palabra({ texto, color }: { texto: string; color: string }) {
  return (
    <p className="t-display whitespace-nowrap text-[34vw] lg:text-[clamp(120px,23vw,420px)]" style={{ color }}>
      {Array.from(texto).map((l, i) => (
        <span key={i} className="letra-sube">
          <span style={{ '--i': i } as React.CSSProperties}>{l === ' ' ? ' ' : l}</span>
        </span>
      ))}
    </p>
  );
}

export function HeroShowroom({ consulta }: { consulta: string }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const total = VITRINA.length;

  useEffect(() => {
    if (pausa) return;
    const t = setTimeout(() => setI(x => (x + 1) % total), INTERVALO);
    return () => clearTimeout(t);
  }, [i, pausa, total]);

  const exhibicion = VITRINA[i % total];
  // La palabra es siempre la marca: los carros cambian, WISE se queda.
  const palabra = 'WISE';

  return (
    <section
      className="hero-showroom relative isolate overflow-hidden bg-showroom text-white"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
    >
      {/* Panel morado */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 hidden w-[36vw] lg:block"
        style={{
          background: 'linear-gradient(170deg, #521672 0%, #3b0d55 55%, #2a0a3d 100%)',
        }}
      />
      {/* Luz de estudio sobre el negro */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(50% 45% at 68% 62%, rgba(136,28,183,0.22), transparent 70%), radial-gradient(30% 20% at 66% 86%, rgba(255,255,255,0.06), transparent 70%)',
        }}
      />

      {/* Palabra gigante en dos tonos (escritorio): negra sobre el morado, morada sobre el negro */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[16%] hidden lg:block" key={palabra}>
        <div className="palabra-capa palabra-capa--panel absolute inset-x-0 top-0 pl-[4vw]">
          <Palabra texto={palabra} color="#0c0a0f" />
        </div>
        <div className="palabra-capa palabra-capa--negro absolute inset-x-0 top-0 pl-[4vw]">
          <Palabra texto={palabra} color="#5b1a82" />
        </div>
      </div>

      {/* Móvil: titular → buscador → carro → datos. Escritorio: carro arriba, titular y datos abajo. */}
      <div className="relative flex flex-col px-5 pt-[88px] md:px-8 lg:grid lg:h-[100svh] lg:max-h-[1000px] lg:min-h-[780px] lg:grid-cols-[calc(36vw-64px)_1fr] lg:grid-rows-[1fr_auto] lg:gap-x-16 lg:pt-[96px]">
        <div className="-mx-5 bg-[linear-gradient(170deg,#521672,#2a0a3d)] px-5 pb-10 pt-8 md:-mx-8 md:px-8 lg:col-start-1 lg:row-start-2 lg:m-0 lg:self-end lg:bg-none lg:p-0 lg:pb-12">
          <h1 className="t-titulo text-[40px] md:text-[56px]">
            <span className="block">Cuéntanos cómo vives.</span>
            <span className="block text-white/45">Te decimos qué carro.</span>
          </h1>
          <div className="mt-7">
            <BuscadorIA inicial={consulta} oscuro />
          </div>
        </div>

        {/* Escenario del carro */}
        <div className="relative h-[74vw] max-h-[520px] lg:col-span-2 lg:row-start-1 lg:h-auto lg:max-h-none">
          {/* Piso del showroom: el vacío bajo el carro se vuelve escenario */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-2 right-[-32px] hidden h-[34%] lg:left-[calc(36vw-32px)] lg:block"
            style={{
              background:
                'linear-gradient(180deg, transparent, rgba(26,19,32,0.9)), radial-gradient(60% 100% at 60% 100%, rgba(136,28,183,0.18), transparent 70%)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          />
          <div aria-hidden className="pointer-events-none absolute left-0 top-[6%] lg:hidden" key={`m-${palabra}`}>
            <Palabra texto={palabra} color="#5b1a82" />
          </div>
          <div
            key={exhibicion.id}
            className="carro-entra absolute bottom-0 right-0 h-[62%] w-full lg:bottom-[-13%] lg:right-[2vw] lg:h-[84%] lg:w-[62vw] lg:max-w-[940px]"
          >
            {/* Halo morado y sombra de piso: el carro se posa, no flota */}
            <div
              aria-hidden
              className="absolute inset-x-[4%] bottom-[-6%] h-[40%] rounded-[50%]"
              style={{
                background: 'radial-gradient(closest-side, rgba(136,28,183,0.28), transparent)',
                filter: 'blur(18px)',
              }}
            />
            <div
              aria-hidden
              className="absolute inset-x-[15%] bottom-[4%] h-[12%] rounded-[50%]"
              style={{
                background: 'radial-gradient(closest-side, rgba(0,0,0,0.7), transparent)',
                filter: 'blur(10px)',
              }}
            />
            <CarRender car={exhibicion.car} prioridad abajo className="relative h-full w-full" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pb-10 pt-6 lg:col-start-2 lg:row-start-2 lg:self-end lg:pb-12">
          <div className="flex items-center gap-3">
            {VITRINA.map((it, k) => (
              <button
                key={it.id}
                onClick={() => setI(k)}
                aria-label={`Ver ${it.tipo}`}
                aria-pressed={k === i % total}
                className={`h-2 rounded-full transition-all duration-500 ${k === i % total ? 'w-8 bg-wise-lila' : 'w-2 bg-white/25 hover:bg-white/50'}`}
              />
            ))}
          </div>
          <Link href="/vehicles" className="cta-corte">
            Explorar catálogo <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
