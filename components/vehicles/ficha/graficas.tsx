'use client';

// ============================================================================
// Gráficas de la ficha. Cada una responde una pregunta de comprador con un
// dibujo distinto (velocímetro, carrera, ruta, maletas, estrellas...) en vez
// de repetir "número grande + etiqueta". Todas arrancan al entrar en pantalla
// y respetan prefers-reduced-motion (globals.css apaga las transiciones).
// Nada se inventa: si falta el dato, la gráfica no se dibuja.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { Luggage, RotateCcw, Star, User } from 'lucide-react';
import { useEnVista } from '@/components/ui/useEnVista';

const fmt = (n: number, dec = 0) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: dec }).format(n);

// ── Velocímetro ────────────────────────────────────────────────────────────
/** Arco de 240° con aguja; el rango es el del catálogo, no el del mundo. */
export function Velocimetro({
  valor,
  min,
  max,
  unidad,
  minTexto,
  maxTexto,
}: {
  valor: number;
  min: number;
  max: number;
  unidad: string;
  minTexto?: string;
  maxTexto?: string;
}) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  const t = max > min ? Math.min(1, Math.max(0, (valor - min) / (max - min))) : 0.5;
  const R = 110;
  const C = { x: 140, y: 140 };
  const inicio = -210;
  const barrido = 240;
  const punto = (ang: number, r = R) => ({
    x: C.x + r * Math.cos((ang * Math.PI) / 180),
    y: C.y + r * Math.sin((ang * Math.PI) / 180),
  });
  const a = punto(inicio);
  const b = punto(inicio + barrido);
  const arco = `M ${a.x} ${a.y} A ${R} ${R} 0 1 1 ${b.x} ${b.y}`;
  const largo = (Math.PI * 2 * R * barrido) / 360;
  const angulo = inicio + barrido * (visto ? t : 0);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[250px] md:max-w-[380px]">
      <svg viewBox="0 0 280 250" className="w-full overflow-visible">
        <defs>
          <linearGradient id="vel-grad" x1="0" x2="1">
            <stop offset="0" stopColor="#d8b4fe" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <path d={arco} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" strokeLinecap="round" />
        <path
          d={arco}
          fill="none"
          stroke="url(#vel-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={visto ? largo * (1 - t) : largo}
          style={{ transition: 'stroke-dashoffset 1600ms cubic-bezier(0.16,1,0.3,1)', filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.55))' }}
        />
        {Array.from({ length: 25 }).map((_, i) => {
          const ang = inicio + (barrido * i) / 24;
          const largoTick = i % 4 === 0 ? 12 : 6;
          const p1 = punto(ang, R - 16);
          const p2 = punto(ang, R - 16 - largoTick);
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={i % 4 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'} strokeWidth={i % 4 === 0 ? 2 : 1} />
          );
        })}
        <g style={{ transform: `rotate(${angulo + 90}deg)`, transformOrigin: `${C.x}px ${C.y}px`, transition: 'transform 1600ms cubic-bezier(0.34,1.3,0.5,1)' }}>
          <path d={`M ${C.x - 3.5} ${C.y} L ${C.x} ${C.y - R + 34} L ${C.x + 3.5} ${C.y} Z`} fill="#fff" />
        </g>
        <circle cx={C.x} cy={C.y} r="8" fill="#0e0c11" stroke="#fff" strokeWidth="2.5" />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-[74%] text-center">
        <p className="text-[38px] font-light leading-none tracking-[-0.05em] text-white md:text-[48px]">
          {fmt(valor)}
          <span className="ml-1 text-[18px] text-white/55">{unidad}</span>
        </p>
      </div>
      {(minTexto || maxTexto) && (
        <div className="mt-2 flex justify-between gap-2 text-[10px] leading-tight text-white/45 md:text-[11px]">
          <span>{minTexto}</span>
          <span className="text-right">{maxTexto}</span>
        </div>
      )}
    </div>
  );
}

// ── Carrera de 0 a 100 ─────────────────────────────────────────────────────
/**
 * Los carriles corren en TIEMPO REAL: 8,1 s duran 8,1 s. Es la forma más
 * honesta de sentir la diferencia entre 8 y 12 segundos.
 */
export function Carrera({ carriles }: { carriles: { nombre: string; segundos: number; propio?: boolean }[] }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.5);
  const [vuelta, setVuelta] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [reloj, setReloj] = useState(0);
  const inicio = useRef(0);
  const maximo = Math.max(...carriles.map(c => c.segundos));

  useEffect(() => {
    if (!visto) return;
    setCorriendo(false);
    setReloj(0);
    const arranque = setTimeout(() => {
      setCorriendo(true);
      inicio.current = performance.now();
    }, 250);
    let raf = 0;
    const tic = () => {
      if (inicio.current) {
        const t = (performance.now() - inicio.current) / 1000;
        setReloj(Math.min(t, maximo));
        if (t >= maximo) return;
      }
      raf = requestAnimationFrame(tic);
    };
    raf = requestAnimationFrame(tic);
    return () => {
      clearTimeout(arranque);
      cancelAnimationFrame(raf);
      inicio.current = 0;
    };
  }, [visto, vuelta, maximo]);

  return (
    <div ref={ref}>
      <div className="flex items-end justify-between">
        <p className="cifra text-[34px] font-light leading-none tracking-[-0.04em] md:text-[44px]">
          {fmt(reloj, 1)}
          <span className="ml-1 text-[16px] text-tinta-2">s</span>
        </p>
        <button onClick={() => setVuelta(v => v + 1)} className="pastilla h-9 px-3.5 text-[13px]">
          <RotateCcw className="h-3.5 w-3.5" /> Otra vez
        </button>
      </div>
      <div className="mt-3 space-y-2 md:mt-5 md:space-y-3">
        {carriles.map(c => {
          const llego = reloj >= c.segundos;
          return (
            <div key={c.nombre}>
              <div className="flex justify-between text-[12px]">
                <span className={c.propio ? 'font-semibold text-tinta' : 'text-tinta-2'}>{c.nombre}</span>
                <span className={`cifra ${llego ? (c.propio ? 'text-wise' : 'text-tinta') : 'text-tinta-2/50'}`}>{fmt(c.segundos, 1)} s</span>
              </div>
              {/* Carril: la estela crece y el carrito va en la punta. El carro
                  avanza dentro de un riel que le deja su propio ancho al final. */}
              <div className="relative mt-1 h-7">
                <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-tarjeta [background-image:repeating-linear-gradient(90deg,transparent_0_18px,rgba(14,12,17,0.06)_18px_20px)]" />
                <div key={vuelta} className="absolute inset-y-0 left-0 right-9">
                  <div
                    className={`absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full ${c.propio ? 'bg-wise shadow-[0_0_14px_rgba(136,28,183,0.55)]' : 'bg-tinta/25'}`}
                    style={{
                      width: corriendo ? 'calc(100% + 18px)' : '18px',
                      // Aceleración casi constante: la posición crece como t², de ahí el ease-in.
                      transition: corriendo ? `width ${c.segundos}s cubic-bezier(0.45, 0, 0.85, 0.55)` : 'none',
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{
                      left: corriendo ? '100%' : '0%',
                      transition: corriendo ? `left ${c.segundos}s cubic-bezier(0.45, 0, 0.85, 0.55)` : 'none',
                    }}
                  >
                    <Carrito className={`h-[23px] w-9 ${c.propio ? 'text-wise' : 'text-tinta/55'}`} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Carrito de perfil mirando a la derecha (el sentido de la carrera). */
function Carrito({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 18" className={className} aria-hidden>
      <path
        d="M2 12.5V10c0-.9.6-1.6 1.5-1.8l4-.9 3.6-3.4c.6-.5 1.3-.8 2.1-.8h5.2c.8 0 1.6.3 2.1.9l3 3.2 2.4.5c1 .2 1.6 1 1.6 2v2.8c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1z"
        fill="currentColor"
      />
      <path d="M12.3 5.4c.3-.3.7-.4 1.1-.4h2.6v3h-5.6zM17 5h1.5c.4 0 .8.2 1.1.5L22 8h-5z" fill="#fff" opacity=".85" />
      <circle cx="7.5" cy="14" r="2.6" fill="#0e0c11" />
      <circle cx="7.5" cy="14" r="1" fill="#fff" />
      <circle cx="21" cy="14" r="2.6" fill="#0e0c11" />
      <circle cx="21" cy="14" r="1" fill="#fff" />
    </svg>
  );
}

// ── Parqueadero ────────────────────────────────────────────────────────────
// Cupo de referencia: 2,40 × 4,80 m, lo típico en edificios y centros
// comerciales de Colombia (cada POT fija su mínimo; muchos van de 2,30 × 4,50
// a 2,50 × 5,00). Vista desde arriba, en milímetros reales: el carro se
// dibuja a escala dentro de su cupo, con un vecino a cada lado.
const CUPO = { ancho: 2400, largo: 4800 };

export function Parqueadero({ largo, ancho, nombre }: { largo: number; ancho: number; nombre: string }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.35);
  const linea = 70;
  const pasillo = 1500;
  const W = CUPO.ancho * 3 + linea;
  const H = CUPO.largo + pasillo;
  const sobraLargo = CUPO.largo - largo; // mm, adelante + atrás
  const porLado = (CUPO.ancho - ancho) / 2; // mm a cada lado para abrir puertas
  const cm = (mm: number) => fmt(Math.abs(mm) / 10);
  // Carro centrado en el cupo del medio, con la nariz hacia la pared.
  const x = CUPO.ancho + linea / 2 + (CUPO.ancho - ancho) / 2;
  const y = Math.max(120, sobraLargo / 2);
  const r = Math.min(ancho * 0.16, 380);

  const veredicto =
    sobraLargo < 0
      ? { t: `Se sale ${cm(sobraLargo)} cm del cupo`, d: 'Necesita un parqueadero más largo que el promedio.' }
      : porLado < 300
        ? { t: 'Entra, pero justo de lado', d: `Quedan ${cm(porLado)} cm a cada lado: abrir las puertas pide cuidado.` }
        : sobraLargo < 400
          ? { t: 'Entra, sin mucho espacio de sobra', d: `Le sobran ${cm(sobraLargo)} cm de largo y ${cm(porLado)} cm a cada lado.` }
          : { t: 'Entra holgado', d: `Le sobran ${cm(sobraLargo)} cm de largo y ${cm(porLado)} cm a cada lado para abrir las puertas.` };

  return (
    <div ref={ref} className="grid items-center gap-4 md:grid-cols-[1fr_1.3fr] md:gap-6">
      <div>
        <p className="text-[20px] font-medium leading-tight tracking-[-0.03em] md:text-[28px]">{veredicto.t}</p>
        <p className="mt-2 text-[13px] leading-snug text-tinta-2 md:text-[15px]">{veredicto.d}</p>
        <div className="mt-3 flex md:mt-5 flex-wrap gap-2 text-[12px]">
          <span className="rounded-full bg-blanco px-3 py-1.5">
            {nombre}: <span className="cifra font-semibold">{fmt(largo / 1000, 2)} × {fmt(ancho / 1000, 2)} m</span>
          </span>
          <span className="rounded-full bg-blanco px-3 py-1.5">
            Cupo: <span className="cifra font-semibold">4,80 × 2,40 m</span>
          </span>
        </div>
        <p className="mt-4 text-[11px] text-tinta-2">Cupo típico de edificios y centros comerciales. Varía según el edificio. Ancho sin espejos.</p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto max-h-[220px] w-full overflow-hidden rounded-[18px] md:max-h-[380px]" role="img" aria-label={`${nombre} dentro de un cupo de parqueadero promedio`}>
        <rect width={W} height={H} fill="#3a3740" />
        {/* pared y topellantas */}
        <rect width={W} height={90} fill="#2a2830" />
        {[0, 1, 2].map(i => (
          <rect key={i} x={i * CUPO.ancho + linea + CUPO.ancho * 0.3} y={260} width={CUPO.ancho * 0.4 - linea} height={110} rx={50} fill="#c9c5cf" opacity={0.35} />
        ))}
        {/* líneas del cupo */}
        {[0, 1, 2, 3].map(i => (
          <rect key={i} x={i * CUPO.ancho} y={0} width={linea} height={CUPO.largo} fill="#f4f1f7" opacity={i === 1 || i === 2 ? 0.95 : 0.5} />
        ))}
        {/* vecinos: un carro mediano (4,30 × 1,80 m) a cada lado */}
        {[0, 2].map(i => (
          <rect key={i} x={i * CUPO.ancho + linea / 2 + (CUPO.ancho - 1800) / 2} y={(CUPO.largo - 4300) / 2} width={1800} height={4300} rx={300} fill="#f4f1f7" opacity={0.13} />
        ))}
        {/* cupo propio resaltado */}
        <rect x={CUPO.ancho + linea} y={0} width={CUPO.ancho - linea} height={CUPO.largo} fill="#881cb7" opacity={0.12} />
        {/* pasillo */}
        <path d={`M ${W / 2 - 900} ${CUPO.largo + pasillo / 2} h 1500 m -380 -260 l 380 260 l -380 260`} fill="none" stroke="#f4f1f7" strokeOpacity={0.35} strokeWidth={70} strokeLinecap="round" strokeLinejoin="round" />

        {/* el carro, entrando desde el pasillo */}
        <g
          style={{
            transform: visto ? 'translateY(0)' : `translateY(${H}px)`,
            transition: 'transform 1600ms cubic-bezier(0.16,1,0.3,1) 200ms',
          }}
        >
          <rect x={x} y={y} width={ancho} height={largo} rx={r} fill="#881cb7" stroke={sobraLargo < 0 ? '#fca5a5' : 'none'} strokeWidth={60} />
          {/* parabrisas, techo y vidrio trasero */}
          <path
            d={`M ${x + ancho * 0.12} ${y + largo * 0.36} Q ${x + ancho / 2} ${y + largo * 0.27} ${x + ancho * 0.88} ${y + largo * 0.36} L ${x + ancho * 0.82} ${y + largo * 0.44} L ${x + ancho * 0.18} ${y + largo * 0.44} Z`}
            fill="#e9d5ff"
            opacity={0.9}
          />
          <rect x={x + ancho * 0.18} y={y + largo * 0.45} width={ancho * 0.64} height={largo * 0.3} rx={ancho * 0.08} fill="#6b1590" />
          <path
            d={`M ${x + ancho * 0.2} ${y + largo * 0.77} L ${x + ancho * 0.8} ${y + largo * 0.77} L ${x + ancho * 0.86} ${y + largo * 0.85} Q ${x + ancho / 2} ${y + largo * 0.89} ${x + ancho * 0.14} ${y + largo * 0.85} Z`}
            fill="#e9d5ff"
            opacity={0.75}
          />
          {/* espejos */}
          <rect x={x - 110} y={y + largo * 0.37} width={130} height={200} rx={50} fill="#881cb7" />
          <rect x={x + ancho - 20} y={y + largo * 0.37} width={130} height={200} rx={50} fill="#881cb7" />
          {/* farolas */}
          <rect x={x + ancho * 0.1} y={y + 40} width={ancho * 0.22} height={90} rx={40} fill="#fff" opacity={0.9} />
          <rect x={x + ancho * 0.68} y={y + 40} width={ancho * 0.22} height={90} rx={40} fill="#fff" opacity={0.9} />
        </g>
      </svg>
    </div>
  );
}

// ── Ruta desde Medellín ────────────────────────────────────────────────────
// Distancias aproximadas por carretera. Referencia de escala, no navegación.
const DESTINOS = [
  { nombre: 'Guatapé', km: 80 },
  { nombre: 'Manizales', km: 195 },
  { nombre: 'Bogotá', km: 415 },
  { nombre: 'Cartagena', km: 640 },
];

export function Ruta({ km, electrico }: { km: number; electrico: boolean }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  const escala = Math.max(km, DESTINOS[DESTINOS.length - 1].km) * 1.08;
  const pos = (k: number) => `${(k / escala) * 100}%`;
  const alcanza = DESTINOS.filter(d => d.km <= km);
  const ultimo = alcanza[alcanza.length - 1];

  return (
    <div ref={ref}>
      <p className="text-[15px] leading-snug text-white/70">
        {ultimo ? (
          <>
            Saliendo de Medellín {electrico ? 'con la batería llena' : 'con el tanque lleno'} llegas hasta{' '}
            <span className="font-semibold text-white">{ultimo.nombre}</span>
            {alcanza.length < DESTINOS.length && <> sin {electrico ? 'recargar' : 'tanquear'}</>}.
          </>
        ) : (
          <>Rinde para la ciudad y los alrededores de Medellín.</>
        )}
      </p>
      <div className="relative mt-14 h-16">
        {/* carretera */}
        <div className="absolute inset-x-0 top-6 h-[3px] rounded-full bg-white/10" />
        <div
          className="absolute left-0 top-6 h-[3px] rounded-full bg-gradient-to-r from-wise-lila to-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.7)]"
          style={{ width: visto ? pos(km) : '0%', transition: 'width 2200ms cubic-bezier(0.16,1,0.3,1)' }}
        />
        {/* salida */}
        <div className="absolute left-0 top-6 -translate-y-1/2">
          <span className="block h-3 w-3 rounded-full bg-white" />
          <span className="absolute left-0 top-5 whitespace-nowrap text-[12px] text-white/60">Medellín</span>
        </div>
        {DESTINOS.map((d, i) => {
          const si = d.km <= km;
          return (
            // En celular, Guatapé queda encima de Medellín: se omite.
            <div key={d.nombre} className={`absolute top-6 -translate-x-1/2 -translate-y-1/2 ${i === 0 ? 'max-sm:hidden' : ''}`} style={{ left: pos(d.km) }}>
              <span
                className={`block h-3 w-3 rounded-full border-2 transition-all duration-500 ${si && visto ? 'border-wise-lila bg-wise-lila shadow-[0_0_10px_#d8b4fe]' : 'border-white/30 bg-showroom'}`}
                style={{ transitionDelay: `${400 + i * 350}ms` }}
              />
              <span className={`absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-center text-[12px] ${si ? 'text-white' : 'text-white/35'}`}>
                {d.nombre}
                <span className="block text-[10px] text-white/40">{d.km} km</span>
              </span>
            </div>
          );
        })}
        {/* el carro */}
        <div
          className="absolute -top-7 -translate-x-1/2"
          style={{ left: visto ? pos(km) : '0%', transition: 'left 2200ms cubic-bezier(0.16,1,0.3,1)' }}
        >
          <span className="cifra whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-tinta">≈ {fmt(Math.round(km / 10) * 10)} km</span>
        </div>
      </div>
      <p className="mt-6 text-[11px] text-white/35">Distancias aproximadas por carretera. En trancón y lomas rinde menos.</p>
    </div>
  );
}

// ── Nivel (tanque o batería) ───────────────────────────────────────────────
export function Nivel({ etiqueta, valor, unidad, electrico }: { etiqueta: string; valor: string; unidad: string; electrico: boolean }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className="flex flex-col items-start gap-3 md:flex-row md:items-end md:gap-5">
      <div className="relative h-[76px] w-[40px] md:h-[132px] md:w-[62px] overflow-hidden rounded-[18px] border-2 border-tinta/15 bg-tarjeta">
        {electrico && <span className="absolute -top-0 left-1/2 h-2 w-6 -translate-x-1/2 rounded-b bg-tinta/15" />}
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-wise to-[#b45af0]"
          style={{ height: visto ? '100%' : '0%', transition: 'height 1800ms cubic-bezier(0.16,1,0.3,1)' }}
        >
          {electrico ? (
            <div className="grid h-full grid-rows-5 gap-[3px] p-[5px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="rounded-[5px] bg-white/20" />
              ))}
            </div>
          ) : (
            <span className="ola absolute -top-2 left-0 h-4 w-[200%] bg-[radial-gradient(circle_at_10px_-4px,transparent_10px,#b45af0_11px)] [background-size:20px_16px]" />
          )}
        </div>
      </div>
      <div>
        <p className="text-[12px] text-tinta-2 md:text-[13px]">{etiqueta}</p>
        <p className="text-[30px] font-light leading-none tracking-[-0.05em] md:text-[40px]">
          {valor}
          <span className="ml-1 text-[13px] text-tinta-2 md:text-[15px]">{unidad}</span>
        </p>
      </div>
    </div>
  );
}

// ── Barras comparadas simples ──────────────────────────────────────────────
export function BarrasPar({ filas, max }: { filas: { etiqueta: string; valor: number; texto: string }[]; max: number }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className="space-y-3 md:space-y-4">
      {filas.map((f, i) => (
        <div key={f.etiqueta}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-[12px] text-tinta-2 md:text-[13px]">{f.etiqueta}</span>
            <span className="cifra text-[13px] font-semibold md:text-[15px]">{f.texto}</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-tarjeta">
            <div
              className={`h-full rounded-full ${i === 0 ? 'bg-wise' : 'bg-wise-lila'}`}
              style={{ width: visto ? `${(f.valor / max) * 100}%` : '0%', transition: `width 1200ms cubic-bezier(0.16,1,0.3,1) ${i * 150}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Maletas ────────────────────────────────────────────────────────────────
export function Maletas({ litros }: { litros: number }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  const n = Math.max(1, Math.min(24, Math.round(litros / 40)));
  return (
    <div ref={ref}>
      <div className="flex flex-wrap gap-1 md:gap-1.5">
        {Array.from({ length: n }).map((_, i) => (
          <span
            key={i}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-wise/10 text-wise md:h-9 md:w-9 md:rounded-xl"
            style={{
              opacity: visto ? 1 : 0,
              transform: visto ? 'none' : 'translateY(10px) scale(0.6)',
              transition: `opacity 300ms ease ${i * 45}ms, transform 500ms cubic-bezier(0.34,1.56,0.64,1) ${i * 45}ms`,
            }}
          >
            <Luggage className="h-4 w-4" />
          </span>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-tinta-2 md:mt-4 md:text-[14px]">
        ≈ {n} {n === 1 ? 'maleta' : 'maletas'} de cabina ({fmt(litros)} L)
      </p>
    </div>
  );
}

// ── Personas ───────────────────────────────────────────────────────────────
export function Personas({ n }: { n: number }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className="flex flex-wrap gap-1">
      {Array.from({ length: Math.min(9, n) }).map((_, i) => (
        <span
          key={i}
          className="flex h-8 w-6 items-end justify-center rounded-t-full bg-white/15 md:h-11 md:w-9"
          style={{ opacity: visto ? 1 : 0, transition: `opacity 400ms ease ${i * 90}ms` }}
        >
          <User className="mb-1 h-4 w-4 text-white md:mb-1.5 md:h-5 md:w-5" />
        </span>
      ))}
    </div>
  );
}

// ── Estrellas de choque ────────────────────────────────────────────────────
export function Estrellas({ n }: { n: number }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className="flex gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const llena = i < Math.round(n);
        return (
          <Star
            key={i}
            className={`h-7 w-7 md:h-10 md:w-10 ${llena ? 'text-wise-lila' : 'text-white/15'}`}
            fill="currentColor"
            strokeWidth={0}
            style={{
              opacity: visto ? 1 : 0,
              transform: visto ? 'none' : 'scale(0.3) rotate(-40deg)',
              transition: `opacity 300ms ease ${i * 120}ms, transform 700ms cubic-bezier(0.34,1.56,0.64,1) ${i * 120}ms`,
              filter: llena ? 'drop-shadow(0 0 10px rgba(216,180,254,0.6))' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Anillo de porcentaje ───────────────────────────────────────────────────
export function Anillo({ pct, etiqueta }: { pct: number; etiqueta: string }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  const R = 34;
  const L = 2 * Math.PI * R;
  return (
    <div ref={ref} className="flex items-center gap-2 md:gap-3">
      <svg viewBox="0 0 80 80" className="h-[48px] w-[48px] shrink-0 -rotate-90 md:h-[72px] md:w-[72px]">
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(136,28,183,0.12)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="#881cb7"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={L}
          strokeDashoffset={visto ? L * (1 - pct / 100) : L}
          style={{ transition: 'stroke-dashoffset 1400ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div>
        <p className="cifra text-[18px] font-semibold leading-none md:text-[22px]">{fmt(pct)}%</p>
        <p className="mt-1 text-[12px] text-tinta-2">{etiqueta}</p>
      </div>
    </div>
  );
}

// ── Posición en la categoría (tira de puntos) ──────────────────────────────
export interface Tira {
  etiqueta: string;
  unidad: string;
  menorEsMejor?: boolean;
  propio: number;
  otros: { nombre: string; valor: number }[];
  formato?: (n: number) => string;
}

export function TiraCategoria({ tira, indice }: { tira: Tira; indice: number }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  const f = tira.formato ?? ((n: number) => fmt(n));
  const todos = [tira.propio, ...tira.otros.map(o => o.valor)];
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const x = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 50);
  const mejores = tira.otros.filter(o => (tira.menorEsMejor ? tira.propio < o.valor : tira.propio > o.valor)).length;

  return (
    <div ref={ref} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t border-linea py-3 md:grid-cols-[180px_1fr_220px] md:gap-8 md:py-5">
      <p className="text-[14px] font-semibold leading-tight tracking-[-0.02em] md:text-[15px]">{tira.etiqueta}</p>
      <div className="relative order-last col-span-2 mb-3 h-8 md:order-none md:col-span-1 md:mb-0 md:h-10">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-linea" />
        <span className="cifra absolute left-0 top-full text-[10px] text-tinta-2">{f(min)}</span>
        <span className="cifra absolute right-0 top-full text-[10px] text-tinta-2">{f(max)}</span>
        {tira.otros.map((o, i) => (
          <span
            key={o.nombre}
            title={`${o.nombre}: ${f(o.valor)} ${tira.unidad}`}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-papel bg-tinta/25"
            style={{
              left: `${x(o.valor)}%`,
              opacity: visto ? 1 : 0,
              transition: `opacity 400ms ease ${indice * 80 + i * 60}ms`,
            }}
          />
        ))}
        <span
          className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: visto ? `${x(tira.propio)}%` : '0%', transition: `left 1200ms cubic-bezier(0.16,1,0.3,1) ${indice * 80}ms` }}
        >
          <span className="absolute h-7 w-7 animate-ping rounded-full bg-wise/25 [animation-duration:2.4s]" />
          <span className="relative h-5 w-5 rounded-full border-[3px] border-white bg-wise shadow-[0_4px_12px_rgba(136,28,183,0.5)]" />
        </span>
      </div>
      <p className="text-right text-[12px] leading-snug text-tinta-2 md:text-[14px]">
        <span className="cifra font-semibold text-tinta">
          {f(tira.propio)} {tira.unidad}
        </span>
        <br />
        {tira.otros.length > 0 &&
          (mejores === tira.otros.length
            ? 'El mejor del grupo'
            : mejores === 0
              ? 'El que menos tiene del grupo'
              : `Mejor que ${mejores} de ${tira.otros.length}`)}
      </p>
    </div>
  );
}
