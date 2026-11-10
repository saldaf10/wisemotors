'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Car, Check, Sparkles } from 'lucide-react';
import { formatPrice, getFuelLabel } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

// ============================================================================
// PODIO DE RESULTADOS
//
// El problema del podio anterior: tres tarjetas idénticas con una medalla
// encima. Si las tres se ven igual, el ranking no significa nada — el ojo no
// lee una etiqueta de color como jerarquía.
//
// Aquí la jerarquía es física: el #1 ocupa el ancho completo, tiene su propia
// fuente de luz (aura), su sombra lo despega del fondo y muestra datos que
// los otros dos no muestran. El #2 y el #3 quedan apoyados un escalón abajo.
// ============================================================================

interface VehiculoPodio {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  fuelType?: string;
  fuel?: string;
  type?: string;
  imageUrl?: string | null;
  matchPercentage?: number;
  reasons?: string[];
  features?: Record<string, number>;
}

interface Props {
  vehicles: VehiculoPodio[];
  titulo?: string;
  subtitulo?: string;
}

/** Revela cuando entra en pantalla, una sola vez. */
function useEnPantalla<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entradas => {
        if (entradas[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

// ---------------------------------------------------------------------------
// Anillo de afinidad. Un número dentro de un arco se lee de un vistazo;
// un "87% match" en una píldora es ruido más.
// ---------------------------------------------------------------------------
function AnilloAfinidad({ valor, tamano = 92 }: { valor: number; tamano?: number }) {
  const { ref, visible } = useEnPantalla<SVGSVGElement>();
  const radio = tamano / 2 - 6;
  const circunferencia = 2 * Math.PI * radio;
  const resto = circunferencia * (1 - Math.max(0, Math.min(100, valor)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg
        ref={ref}
        className="podio-anillo"
        width={tamano}
        height={tamano}
        data-shown={visible}
        style={
          {
            '--circunferencia': `${circunferencia}`,
            '--resto': `${resto}`,
          } as React.CSSProperties
        }
      >
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={radio}
          fill="none"
          stroke="rgba(var(--wise-glow), 0.14)"
          strokeWidth={5}
        />
        <circle
          className="valor"
          cx={tamano / 2}
          cy={tamano / 2}
          r={radio}
          fill="none"
          stroke="rgb(var(--wise-glow))"
          strokeWidth={5}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[22px] font-bold leading-none tabular-nums text-foreground">
          {Math.round(valor)}
        </span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          afinidad
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras de aptitud. Se sacan de las features ya calculadas (0-1); si una no
// existe, la barra NO se dibuja: nunca un cero que parezca un dato.
// ---------------------------------------------------------------------------
const APTITUDES: { clave: string; etiqueta: string }[] = [
  { clave: 'usage_urban', etiqueta: 'Ciudad' },
  { clave: 'highway_score', etiqueta: 'Carretera' },
  { clave: 'safety_score', etiqueta: 'Seguridad' },
  { clave: 'efficiency_score', etiqueta: 'Ahorro' },
  { clave: 'comfort_score', etiqueta: 'Confort' },
];

function BarrasAptitud({ features }: { features?: Record<string, number> }) {
  const { ref, visible } = useEnPantalla<HTMLDListElement>();

  const filas = useMemo(() => {
    if (!features) return [];
    return APTITUDES.map(a => ({ ...a, valor: features[a.clave] }))
      .filter(f => Number.isFinite(f.valor) && f.valor > 0)
      .slice(0, 4);
  }, [features]);

  if (filas.length === 0) return null;

  return (
    <dl ref={ref} className="grid grid-cols-2 gap-x-6 gap-y-3">
      {filas.map((f, i) => (
        <div key={f.clave}>
          <div className="flex items-baseline justify-between">
            <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
              {f.etiqueta}
            </dt>
            <dd className="font-mono text-[12px] font-semibold tabular-nums text-foreground/70">
              {Math.round(f.valor * 100)}
            </dd>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
            <div
              className="metric-bar h-full rounded-full bg-wise"
              data-shown={visible}
              style={{
                width: `${Math.round(Math.min(1, f.valor) * 100)}%`,
                transitionDelay: `${i * 90}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}

// Muchos vehículos recién ingestados aún no tienen foto y la ruta de imagen
// devuelve 404: un <img> roto se ve peor que no tener foto. Cuando falla se
// cae a un marcador con la marca, que al menos identifica el carro.
function Foto({
  src,
  marca,
  modelo,
  className = '',
}: {
  src?: string | null;
  marca: string;
  modelo: string;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);

  if (!src || fallo) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 ${className}`}
        style={{
          background:
            'linear-gradient(135deg, rgba(var(--wise-glow),0.10), rgba(var(--wise-glow),0.02) 60%)',
        }}
      >
        <Car className="h-8 w-8 text-wise/35" strokeWidth={1.25} />
        <span className="px-3 text-center text-[12px] font-medium uppercase tracking-[0.1em] text-wise/50">
          {marca} {modelo}
        </span>
        <span className="text-[11px] text-muted-foreground">Foto pendiente</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${marca} ${modelo}`}
      onError={() => setFallo(true)}
      className={`podio-foto object-cover ${className}`}
      loading="lazy"
    />
  );
}

// ---------------------------------------------------------------------------
// Podio
// ---------------------------------------------------------------------------
export function PodiumResults({
  vehicles,
  titulo = 'Tu mejor opción',
  subtitulo,
}: Props) {
  const router = useRouter();
  const { ref: auraRef, visible: auraVisible } = useEnPantalla<HTMLDivElement>();

  if (!vehicles || vehicles.length === 0) return null;

  const [primero, ...escoltas] = vehicles.slice(0, 3);
  const combustible = (v: VehiculoPodio) => getFuelLabel(v.fuel || v.fuelType || '');
  const ir = (id: string) => router.push(`/vehicles/${id}`);

  return (
    <section className="w-full">
      {/* Encabezado */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-wise">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
            Resultado del análisis
          </p>
          <h2 className="mt-2 text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground md:text-[38px]">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {subtitulo}
            </p>
          )}
        </div>
      </div>

      {/* ── #1: ancho completo, con su propia luz ── */}
      <div ref={auraRef} className="relative">
        <div className="podio-aura" data-shown={auraVisible} aria-hidden="true" />

        <article
          onClick={() => ir(primero.id)}
          className="podio-primero glass group cursor-pointer overflow-hidden rounded-[28px]"
        >
          <div className="grid gap-0 md:grid-cols-[1.08fr_1fr]">
            {/* Imagen */}
            <div className="relative aspect-[16/10] overflow-hidden md:aspect-auto md:min-h-[380px]">
              <Foto
                src={primero.imageUrl}
                marca={primero.brand}
                modelo={primero.model}
                className="absolute inset-0 h-full w-full"
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(105deg, rgba(12,10,20,0.38) 0%, rgba(12,10,20,0.06) 42%, transparent 70%)',
                }}
              />
              <span className="absolute left-5 top-5 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-wise shadow-sm backdrop-blur-md">
                La mejor opción para ti
              </span>
            </div>

            {/* Contenido */}
            <div className="relative flex flex-col justify-between p-6 md:p-9">
              <div className="relative">
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <h3 className="text-[27px] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground md:text-[34px]">
                      {primero.brand}{' '}
                      <span className="text-foreground/70">{primero.model}</span>
                    </h3>
                    <p className="mt-1.5 text-[14px] text-muted-foreground">
                      {primero.year} · {combustible(primero)}
                      {primero.type ? ` · ${primero.type}` : ''}
                    </p>
                  </div>
                  {primero.matchPercentage !== undefined && (
                    <AnilloAfinidad valor={primero.matchPercentage} />
                  )}
                </div>

                <p className="mt-5 font-mono text-[32px] font-bold leading-none tabular-nums tracking-[-0.02em] text-foreground md:text-[40px]">
                  <AnimatedNumber value={primero.price} format={formatPrice} durationMs={700} />
                </p>

                {primero.reasons && primero.reasons.length > 0 && (
                  <ul className="mt-6 space-y-2.5">
                    {primero.reasons.slice(0, 3).map((razon, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-wise/12">
                          <Check className="h-2.5 w-2.5 text-wise" strokeWidth={3} />
                        </span>
                        <span className="text-[14px] leading-relaxed text-foreground/80">
                          {razon}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="relative mt-7 border-t border-foreground/[0.07] pt-6">
                <BarrasAptitud features={primero.features} />
                <button
                  onClick={e => {
                    e.stopPropagation();
                    ir(primero.id);
                  }}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-wise px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-wise-dark"
                >
                  Ir al panel dinámico
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* ── #2 y #3: un escalón abajo ── */}
      {escoltas.length > 0 && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {escoltas.map((v, i) => (
            <article
              key={v.id}
              onClick={() => ir(v.id)}
              className="podio-escolta glass card-glow card-enter group cursor-pointer overflow-hidden rounded-3xl"
              style={{ '--enter-delay': `${(i + 1) * 90}ms` } as React.CSSProperties}
            >
              <div className="grid grid-cols-[38%_1fr] items-stretch">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Foto
                    src={v.imageUrl}
                    marca={v.brand}
                    modelo={v.model}
                    className="absolute inset-0 h-full w-full"
                  />
                </div>

                <div className="relative min-w-0 p-5">
                  <span
                    aria-hidden="true"
                    className="podio-cifra pointer-events-none absolute right-3 top-0 text-[64px] font-bold"
                  >
                    {i + 2}
                  </span>

                  <div className="relative">
                    <h3 className="truncate pr-10 text-[17px] font-semibold leading-tight tracking-[-0.015em] text-foreground">
                      {v.brand} <span className="text-foreground/65">{v.model}</span>
                    </h3>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {v.year} · {combustible(v)}
                    </p>
                    <p className="mt-3 font-mono text-[19px] font-bold tabular-nums text-foreground">
                      {formatPrice(v.price)}
                    </p>

                    {v.matchPercentage !== undefined && (
                      <div className="mt-3 flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                          <div
                            className="h-full rounded-full bg-wise/70"
                            style={{ width: `${Math.min(100, v.matchPercentage)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[12px] font-semibold tabular-nums text-muted-foreground">
                          {Math.round(v.matchPercentage)}%
                        </span>
                      </div>
                    )}

                    {v.reasons && v.reasons.length > 0 && (
                      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-foreground/70">
                        {v.reasons[0]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
