'use client';

// ============================================================================
// Comparador en una sola página, de lo general a lo particular:
//
//   1. Escenario: los carros frente a frente, cada uno con su color.
//   2. Veredicto de la IA (Claude): titular, para quién es cada uno, qué
//      tener en cuenta y cuál conviene según el uso.
//   3. Radiografía: seis dimensiones en un radar + un bloque por dimensión.
//      El puntaje es la posición frente al catálogo (lo que se vende aquí).
//   4. Pregunta por pregunta: las rondas del frente a frente.
//   5. La tabla completa, plegada.
//
// Cada carro conserva su color en TODAS las gráficas para seguirlo de un
// vistazo. Lo que no se sabe se dice; nunca un cero.
// ============================================================================

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Check,
  Fuel,
  Gauge,
  KeyRound,
  Luggage,
  RotateCcw,
  Route,
  Shield,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { CarRender } from '@/components/car/CarRender';
import { Fila } from '@/components/compare/FrenteAFrente';
import { CompareMatrix } from '@/components/compare/CompareMatrix';
import { PruebaDeRuta } from '@/components/compare/PruebaDeRuta';
import { useEnVista } from '@/components/ui/useEnVista';
import { CalificarIA } from '@/components/ui/CalificarIA';
import { adminFetch } from '@/lib/admin-fetch';
import { runDuel } from '@/lib/comparison/duel';
import { serie } from '@/lib/palette';
import { leer, millones, rendimiento, specsDe } from '@/lib/vehiculo-datos';
import type { Veredicto } from '@/lib/ai/comparar';

type Vehiculo = {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  fuelType: string;
  type?: string;
  images?: any[];
  imageUrl?: string | null;
  specifications?: unknown;
};

const fmt = (n: number, dec = 0) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: dec }).format(n);

// ── Dimensiones ────────────────────────────────────────────────────────────
const AYUDAS = [
  'safety.autonomousEmergencyBraking',
  'safety.forwardCollisionWarning',
  'safety.laneAssist',
  'safety.blindSpotDetection',
  'safety.crossTrafficAlert',
  'safety.adaptiveCruiseControl',
  'safety.fatigueMonitor',
  'safety.stabilityControl',
  'safety.tractionControl',
  'assistance.hillStartAssist',
];
const EQUIPO = [
  'technology.smartphoneIntegration',
  'technology.touchscreen',
  'technology.bluetooth',
  'technology.navigation',
  'technology.wirelessCharger',
  'assistance.reverseCamera',
  'assistance.cameras360',
  'assistance.parkingSensors',
  'comfort.airConditioning',
  'comfort.automaticClimateControl',
  'comfort.heatedSeats',
  'comfort.ventilatedSeats',
  'comfort.automaticHighBeam',
];
const cuenta = (s: Record<string, any>, keys: string[]) =>
  keys.filter(k => {
    let cur: any = s;
    for (const p of k.split('.')) cur = cur?.[p];
    return cur === true || (typeof cur === 'string' && cur.trim() !== '');
  }).length;

interface Metrica {
  leer: (s: Record<string, any>, v: any) => number | null;
  menorEsMejor?: boolean;
  /** Solo compara contra carros del mismo "grupo" (km/gal no se mezcla con autonomía). */
  grupo?: (v: any) => string;
}

interface Dimension {
  id: string;
  nombre: string;
  icono: LucideIcon;
  que: string;
  metricas: Metrica[];
}

const esEV = (v: any) => (v.fuelType === 'Eléctrico' ? 'ev' : 'combustion');

const DIMENSIONES: Dimension[] = [
  {
    id: 'desempeno',
    nombre: 'Desempeño',
    icono: Gauge,
    que: 'Fuerza, torque y qué tan rápido acelera',
    metricas: [
      { leer: s => leer(s, 'combustion.maxPower', 'hybrid.maxPower', 'phev.maxPower', 'electric.maxPower') },
      { leer: s => leer(s, 'performance.acceleration0to100'), menorEsMejor: true },
      { leer: s => leer(s, 'combustion.maxTorque', 'hybrid.maxTorque', 'phev.maxTorque', 'electric.maxTorque') },
    ],
  },
  {
    id: 'rinde',
    nombre: 'Rinde',
    icono: Fuel,
    que: 'Km por galón, o por carga si es eléctrico',
    metricas: [
      {
        leer: (s, v) => (esEV(v) === 'ev' ? leer(s, 'electric.realRangeMixed', 'electric.electricRange') : rendimiento(s)),
        grupo: esEV,
      },
    ],
  },
  {
    id: 'espacio',
    nombre: 'Espacio',
    icono: Luggage,
    que: 'Baúl, pasajeros y altura al piso',
    metricas: [
      { leer: s => leer(s, 'dimensions.cargoCapacity') },
      { leer: s => leer(s, 'interior.passengerCapacity') },
      { leer: s => leer(s, 'chassis.groundClearance') },
    ],
  },
  {
    id: 'seguridad',
    nombre: 'Seguridad',
    icono: Shield,
    que: 'Estrellas en choques, airbags y ayudas',
    metricas: [
      { leer: s => leer(s, 'safety.ncapRating') },
      { leer: s => leer(s, 'safety.airbags') },
      { leer: s => cuenta(s, AYUDAS) || null },
    ],
  },
  {
    id: 'equipo',
    nombre: 'Equipamiento',
    icono: Sparkles,
    que: 'Pantalla, cámaras, clima, celular…',
    metricas: [{ leer: s => cuenta(s, EQUIPO) || null }],
  },
  {
    id: 'precio',
    nombre: 'Precio',
    icono: Tag,
    que: 'Lo que cuesta sacarlo del concesionario',
    metricas: [{ leer: (_s, v) => (v.price > 0 ? v.price : null), menorEsMejor: true }],
  },
];

/** Percentil (0–1) de un valor dentro del catálogo; empates cuentan la mitad. */
function percentil(valor: number, universo: number[], menorEsMejor = false) {
  if (universo.length < 3) return null;
  let debajo = 0;
  for (const u of universo) {
    if (menorEsMejor ? u > valor : u < valor) debajo += 1;
    else if (u === valor) debajo += 0.5;
  }
  return debajo / universo.length;
}

function puntajes(vehiculos: Vehiculo[], catalogo: any[]) {
  const universo = catalogo.length >= 3 ? catalogo : vehiculos.map(v => ({ ...v, s: specsDe(v.specifications) }));
  return DIMENSIONES.map(d => {
    const porCarro = vehiculos.map(v => {
      const s = specsDe(v.specifications);
      const ps = d.metricas
        .map(m => {
          const mio = m.leer(s, v);
          if (mio === null) return null;
          const pool = universo
            .filter(u => (m.grupo ? m.grupo(u) === m.grupo(v) : true))
            .map(u => m.leer(u.s, u))
            .filter((n): n is number => n !== null);
          return percentil(mio, pool, m.menorEsMejor);
        })
        .filter((p): p is number => p !== null);
      return ps.length ? (ps.reduce((a, b) => a + b, 0) / ps.length) * 10 : null;
    });
    return { ...d, porCarro };
  });
}

// ── Componente principal ───────────────────────────────────────────────────
export function Comparador({ vehiculos }: { vehiculos: Vehiculo[] }) {
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [tabla, setTabla] = useState(false);

  useEffect(() => {
    fetch('/api/vehicles?limit=200')
      .then(r => r.json())
      .then(j => setCatalogo((j.vehicles ?? []).map((v: any) => ({ ...v, s: specsDe(v.specifications) }))))
      .catch(() => setCatalogo([]));
  }, []);

  const dims = useMemo(() => puntajes(vehiculos, catalogo), [vehiculos, catalogo]);
  const { rounds } = useMemo(() => runDuel(vehiculos as any), [vehiculos]);
  const nombre = (id: string) => {
    const v = vehiculos.find(x => x.id === id);
    return v ? v.model : '';
  };
  const color = (id: string) => serie(vehiculos.findIndex(x => x.id === id));

  return (
    <div className="space-y-4 md:space-y-6">
      <Escenario vehiculos={vehiculos} />

      <Titular
        titulo="Lo que dice la IA"
        bajada="Claude leyó todos los datos que tenemos de cada carro y te lo explica sin tecnicismos. No inventa: si un dato falta, no lo usa."
      />
      <VeredictoIA vehiculos={vehiculos} nombre={nombre} color={color} />

      <Titular
        titulo="Radiografía"
        bajada="Seis cosas que importan al comprar. El puntaje de 0 a 10 dice dónde queda cada carro frente a todo lo que tenemos en el catálogo."
      />
      <Radiografia vehiculos={vehiculos} dims={dims} />

      <Titular
        titulo="Pregunta por pregunta"
        bajada="Cada fila es una pregunta que te harías antes de comprar. La barra más larga y marcada es la mejor respuesta."
      />
      <div className="rounded-[24px] bg-blanco px-4 py-1 md:rounded-[30px] md:px-8 md:py-2">
        {vehiculos.length === 2 && (
          <div className="sticky top-[84px] z-10 -mx-4 grid grid-cols-12 bg-blanco/90 px-4 pb-3 pt-5 backdrop-blur md:top-[92px] md:-mx-8 md:px-8">
            <div className="hidden md:col-span-3 md:block" />
            <div className="col-span-12 grid grid-cols-2 gap-3 md:col-span-9">
              {vehiculos.map((v, i) => (
                <p key={v.id} className={`flex items-center gap-2 text-[13px] font-semibold md:text-[14px] ${i === 0 ? 'justify-end' : ''}`}>
                  {i === 1 && <span className="h-2.5 w-2.5 rounded-full" style={{ background: serie(i) }} />}
                  {v.brand} {v.model}
                  {i === 0 && <span className="h-2.5 w-2.5 rounded-full" style={{ background: serie(i) }} />}
                </p>
              ))}
            </div>
          </div>
        )}
        {rounds.map((r, i) => (
          <Fila key={r.id} ronda={r} vehiculos={vehiculos as any} indice={i} />
        ))}
      </div>

      <div className="pt-4 md:pt-10">
        <button onClick={() => setTabla(t => !t)} className="pastilla h-12 px-6" aria-expanded={tabla}>
          {tabla ? 'Ocultar la tabla completa' : 'Ver todos los datos, uno por uno'}
          <ArrowUpRight className={`h-4 w-4 transition-transform duration-500 ${tabla ? 'rotate-[135deg]' : ''}`} />
        </button>
        {tabla && (
          <div className="sube mt-6">
            <CompareMatrix vehicles={vehiculos as any} />
          </div>
        )}
      </div>

      {/* Lo último: pasar de comparar a probarlo. */}
      <PruebaDeRuta vehiculos={vehiculos} />
    </div>
  );
}

function Titular({ titulo, bajada }: { titulo: string; bajada: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 pt-8 md:gap-4 md:pb-2 md:pt-16">
      <h2 className="t-titulo text-[30px] md:text-[64px]">{titulo}</h2>
      <p className="max-w-[48ch] text-[13px] leading-snug text-tinta-2 md:text-[15px] md:leading-relaxed">{bajada}</p>
    </div>
  );
}

// ── 1. Escenario ───────────────────────────────────────────────────────────
function Escenario({ vehiculos }: { vehiculos: Vehiculo[] }) {
  const dos = vehiculos.length === 2;
  return (
    <div className="estudio relative overflow-hidden rounded-[28px] px-4 pb-6 pt-6 md:rounded-[36px] md:px-10 md:pb-10 md:pt-10">
      <p aria-hidden className="t-display pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center text-[22vw] leading-none text-tinta/[0.035]">
        VS
      </p>
      <div className={`relative grid ${dos ? 'grid-cols-2 gap-10 md:gap-28' : vehiculos.length === 3 ? 'grid-cols-3 gap-3 md:gap-6' : 'grid-cols-2 gap-x-4 gap-y-5 md:gap-6 lg:grid-cols-4'}`}>
        {vehiculos.map((v, i) => (
          <div key={v.id} className={`sube ${dos && i === 1 ? 'text-right' : ''}`} style={{ '--d': `${i * 120}ms` } as React.CSSProperties}>
            <div className="relative aspect-[480/180] md:aspect-auto md:h-[190px]">
              <div aria-hidden className="absolute inset-x-[10%] bottom-0 h-[12%] rounded-[50%]" style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,0.35), transparent)' }} />
              <CarRender car={v} ajustado className={`relative h-full w-full ${dos && i === 1 ? '-scale-x-100' : ''}`} />
            </div>
            <div className={`mt-3 flex items-center gap-2 md:mt-6 ${dos && i === 1 ? 'justify-end' : ''}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: serie(i) }} />
              <p className="text-[13px] text-tinta-2">{v.brand}</p>
            </div>
            <p className="truncate text-[17px] font-semibold leading-tight tracking-[-0.03em] md:text-[30px]">{v.model}</p>
            <p className="cifra mt-0.5 text-[13px] md:mt-1 md:text-[15px]">{millones(v.price)}</p>
          </div>
        ))}
      </div>
      {dos && (
        <span className="cifra absolute left-1/2 top-[34%] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-tinta text-[14px] text-white shadow-[0_14px_30px_-12px_rgba(14,12,17,0.7)]">
          vs
        </span>
      )}
    </div>
  );
}

// ── 2. Veredicto de la IA ──────────────────────────────────────────────────
const PERFIL_INFO: Record<string, { texto: string; icono: LucideIcon }> = {
  familia: { texto: 'Para la familia', icono: Users },
  ciudad: { texto: 'Para la ciudad', icono: Building2 },
  carretera: { texto: 'Para carretera', icono: Route },
  bolsillo: { texto: 'Para el bolsillo', icono: Wallet },
  seguridad: { texto: 'El más seguro', icono: ShieldCheck },
  primer_carro: { texto: 'Primer carro', icono: KeyRound },
};

const PASOS = ['Leyendo la ficha de cada carro…', 'Comparando consumo, espacio y seguridad…', 'Pensando para quién es cada uno…', 'Escribiéndolo en palabras sencillas…'];

function VeredictoIA({ vehiculos, nombre, color }: { vehiculos: Vehiculo[]; nombre: (id: string) => string; color: (id: string) => string }) {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error' | 'sinSesion'>('cargando');
  const [v, setV] = useState<Veredicto | null>(null);
  const [error, setError] = useState('');
  const [paso, setPaso] = useState(0);
  const ids = vehiculos.map(x => x.id).join(',');

  const pedir = useCallback(async () => {
    setEstado('cargando');
    setPaso(0);
    try {
      const r = await adminFetch('/api/compare/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids.split(',') }),
      });
      // El veredicto gasta IA: es para quien tiene cuenta. Sin sesión se invita, no se muestra un error.
      if (r.status === 401) {
        setEstado('sinSesion');
        return;
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo comparar');
      setV(j.veredicto);
      setEstado('listo');
    } catch (e: any) {
      setError(e?.message || 'No se pudo comparar');
      setEstado('error');
    }
  }, [ids]);

  useEffect(() => {
    pedir();
  }, [pedir]);

  useEffect(() => {
    if (estado !== 'cargando') return;
    const t = setInterval(() => setPaso(p => (p + 1) % PASOS.length), 2600);
    return () => clearInterval(t);
  }, [estado]);

  if (estado === 'cargando') {
    return (
      <div className="grid gap-4 md:grid-cols-12">
        <div className="relative overflow-hidden rounded-[30px] bg-showroom p-8 text-white md:col-span-7 md:min-h-[320px]">
          <div className="ia-aurora" aria-hidden />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px]">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-wise-lila" /> Claude está comparando
            </span>
            <p key={paso} className="sube mt-8 text-[28px] font-medium leading-tight tracking-[-0.03em] md:text-[36px]">
              {PASOS[paso]}
            </p>
            <div className="mt-8 space-y-3">
              {[80, 64, 72].map((w, i) => (
                <div key={i} className="brillo h-3 rounded-full bg-white/10" style={{ width: `${w}%`, animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:col-span-5">
          {vehiculos.slice(0, 2).map(x => (
            <div key={x.id} className="brillo-claro rounded-[30px] bg-blanco p-6">
              <div className="h-4 w-1/3 rounded-full bg-tarjeta" />
              <div className="mt-4 h-3 w-5/6 rounded-full bg-tarjeta" />
              <div className="mt-2 h-3 w-2/3 rounded-full bg-tarjeta" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (estado === 'sinSesion') {
    const volver = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/compare';
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[30px] bg-blanco p-8">
        <p className="flex max-w-[52ch] items-center gap-3 text-[15px]">
          <Sparkles className="h-5 w-5 shrink-0 text-wise" /> Crea una cuenta gratis y la IA te dice, en palabras sencillas, para quién es cada uno.
        </p>
        <div className="flex gap-2">
          <Link href={`/register?next=${encodeURIComponent(volver)}`} className="pastilla pastilla--wise h-11 px-5">
            Crear cuenta
          </Link>
          <Link href={`/login?next=${encodeURIComponent(volver)}`} className="pastilla h-11 px-5">
            Ingresar
          </Link>
        </div>
      </div>
    );
  }

  if (estado === 'error' || !v) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[30px] bg-blanco p-8">
        <p className="flex items-center gap-3 text-[15px]">
          <AlertCircle className="h-5 w-5 text-wise" /> {error}
        </p>
        <button onClick={pedir} className="pastilla h-11 px-5">
          <RotateCcw className="h-4 w-4" /> Intentar de nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4">
      {/* Titular */}
      <div className="reveal relative col-span-2 overflow-hidden rounded-[24px] bg-showroom p-5 text-white md:col-span-7 md:rounded-[30px] md:p-10" data-shown="true">
        <div className="ia-aurora ia-aurora--quieta" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px]">
            <Sparkles className="h-3.5 w-3.5 text-wise-lila" /> Veredicto de la IA
          </span>
          <p className="mt-5 text-[24px] font-semibold leading-[1.05] tracking-[-0.04em] md:mt-8 md:text-[44px]">{v.titular}</p>
          <p className="mt-4 max-w-[62ch] text-[14px] leading-snug text-white/65 md:mt-6 md:text-[16px] md:leading-relaxed">{v.resumen}</p>
        </div>
      </div>

      {/* Para quién es cada uno */}
      <div className="col-span-2 grid gap-3 md:col-span-5 md:gap-4">
        {v.porCarro.map(p => (
          <div key={p.id} className="sube rounded-[24px] bg-blanco p-4 md:rounded-[30px] md:p-6">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color(p.id) }} />
              <p className="text-[16px] font-semibold tracking-[-0.03em] md:text-[18px]">{nombre(p.id)}</p>
            </div>
            <p className="mt-2 text-[13px] leading-snug md:mt-3 md:text-[15px]">
              <span className="text-tinta-2">Es para ti si </span>
              {p.esParaTiSi}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.fuertes.slice(0, 3).map(f => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-papel px-2.5 py-1 text-[12px]">
                  <Check className="h-3 w-3 text-wise" strokeWidth={3} /> {f}
                </span>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 border-t border-linea pt-3 text-[13px] leading-snug text-tinta-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Ojo con {p.ojoCon.replace(/^ojo con\s*/i, '')}
            </p>
          </div>
        ))}
      </div>

      {/* Cuál conviene según el uso: bloques de tamaños distintos */}
      {v.perfiles.map((p, i) => {
        const info = PERFIL_INFO[p.perfil] ?? { texto: p.perfil, icono: Sparkles };
        const spans = ['md:col-span-5', 'md:col-span-4', 'md:col-span-3', 'md:col-span-3', 'md:col-span-4', 'md:col-span-5'];
        const oscuro = i === 0;
        return (
          <div
            key={p.perfil}
            className={`sube relative overflow-hidden rounded-[24px] p-4 md:rounded-[30px] md:p-6 ${spans[i % spans.length]} ${oscuro ? 'bg-wise text-white' : 'bg-blanco'}`}
            style={{ '--d': `${i * 70}ms` } as React.CSSProperties}
          >
            <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full md:h-10 md:w-10 ${oscuro ? 'bg-white/15' : 'bg-wise/10 text-wise'}`}>
                <info.icono className="h-4 w-4" />
              </span>
              <span className={`text-[12px] leading-tight md:text-[13px] ${oscuro ? 'text-white/70' : 'text-tinta-2'}`}>{info.texto}</span>
            </div>
            <p className="mt-3 flex items-center gap-2 text-[18px] font-semibold leading-none tracking-[-0.04em] md:mt-6 md:text-[26px]">
              {!oscuro && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color(p.ganadorId) }} />}
              {nombre(p.ganadorId)}
            </p>
            <p className={`mt-2 text-[12px] leading-snug md:mt-3 md:text-[14px] ${oscuro ? 'text-white/75' : 'text-tinta-2'}`}>{p.razon}</p>
          </div>
        );
      })}

      {/* ¿Sirvió el veredicto? Lo lee el equipo en el panel para mejorarlo. */}
      <div className="col-span-2 md:col-span-12">
        <CalificarIA
          tipo="comparacion"
          clave={[...ids.split(',')].sort().join(',')}
          pregunta="¿Te sirvió este veredicto para decidir?"
          detalle={{ carros: vehiculos.map(x => `${x.brand} ${x.model}`), titular: v.titular }}
        />
      </div>
    </div>
  );
}

// ── 3. Radiografía ─────────────────────────────────────────────────────────
function Radiografia({ vehiculos, dims }: { vehiculos: Vehiculo[]; dims: ReturnType<typeof puntajes> }) {
  const spans = ['md:col-span-4', 'md:col-span-4', 'md:col-span-4', 'md:col-span-3', 'md:col-span-5', 'md:col-span-4'];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4">
      <div className="col-span-2 rounded-[24px] bg-showroom p-4 text-white md:col-span-12 md:rounded-[30px] md:p-10">
        <div className="grid items-center gap-4 md:gap-8 lg:grid-cols-[1.1fr_1fr]">
          <RadarDimensiones vehiculos={vehiculos} dims={dims} />
          <div>
            <p className="text-[13px] text-white/50">Cómo leerlo</p>
            <p className="mt-1 text-[17px] font-medium leading-snug tracking-[-0.03em] md:mt-2 md:text-[24px]">
              Entre más grande la figura, mejor en general.{' '}
              <span className="text-white/45">Pero fíjate en la forma: dice en qué es fuerte cada uno.</span>
            </p>
            <ul className="mt-4 space-y-2 md:mt-8 md:space-y-3">
              {vehiculos.map((v, i) => {
                const vals = dims.map(d => d.porCarro[i]).filter((n): n is number => n !== null);
                const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                const mejor = dims
                  .map(d => ({ d, n: d.porCarro[i] }))
                  .filter(x => x.n !== null)
                  .sort((a, b) => (b.n as number) - (a.n as number))[0];
                return (
                  <li key={v.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 md:gap-4 md:pb-3">
                    <span className="flex items-center gap-2 text-[13px] leading-tight md:gap-2.5 md:text-[15px]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full md:h-3 md:w-3" style={{ background: serie(i) }} />
                      {v.brand} {v.model}
                    </span>
                    <span className="text-right text-[11px] leading-snug text-white/55 md:text-[13px]">
                      {prom !== null && (
                        <>
                          Promedio <span className="cifra text-white">{fmt(prom, 1)}/10</span>
                        </>
                      )}
                      {mejor && <> · lo mejor: {mejor.d.nombre.toLowerCase()}</>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {dims.map((d, di) => {
        const conDato = d.porCarro.filter((n): n is number => n !== null);
        const tope = conDato.length ? Math.max(...conDato) : null;
        const ganador = tope !== null && conDato.filter(n => n === tope).length === 1 ? d.porCarro.indexOf(tope) : -1;
        return (
          <BloqueDimension key={d.id} className={spans[di % spans.length]} dimension={d} vehiculos={vehiculos} ganador={ganador} />
        );
      })}
    </div>
  );
}

function BloqueDimension({
  className,
  dimension: d,
  vehiculos,
  ganador,
}: {
  className: string;
  dimension: ReturnType<typeof puntajes>[number];
  vehiculos: Vehiculo[];
  ganador: number;
}) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={`rounded-[22px] bg-blanco p-3.5 md:rounded-[30px] md:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wise/10 text-wise md:h-9 md:w-9">
            <d.icono className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[14px] font-semibold leading-tight tracking-[-0.02em] md:text-[16px]">{d.nombre}</p>
            <p className="hidden text-[12px] text-tinta-2 md:block">{d.que}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2 md:mt-6 md:space-y-3">
        {vehiculos.map((v, i) => {
          const n = d.porCarro[i];
          return (
            <div key={v.id}>
              <div className="flex items-baseline justify-between gap-1 text-[11px] md:text-[12px]">
                <span className={`truncate ${i === ganador ? 'font-semibold' : 'text-tinta-2'}`}>{v.model}</span>
                <span className="cifra">{n === null ? 'sin dato' : `${fmt(n, 1)}`}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tarjeta md:h-2">
                {n !== null && (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: visto ? `${Math.max(4, n * 10)}%` : '0%',
                      background: serie(i),
                      opacity: ganador === -1 || i === ganador ? 1 : 0.45,
                      transition: `width 1100ms cubic-bezier(0.16,1,0.3,1) ${i * 120}ms`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] leading-tight text-tinta-2 md:mt-4 md:text-[13px]">
        {ganador >= 0 ? (
          <>
            Gana <span className="font-semibold text-tinta">{vehiculos[ganador].model}</span>
          </>
        ) : d.porCarro.every(n => n === null) ? (
          'Todavía no tenemos estos datos'
        ) : (
          'Empatados'
        )}
      </p>
    </div>
  );
}

function RadarDimensiones({ vehiculos, dims }: { vehiculos: Vehiculo[]; dims: ReturnType<typeof puntajes> }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.3);
  const N = dims.length;
  const C = 170;
  const R = 120;
  const punto = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  };
  return (
    <div ref={ref} className="mx-auto w-full max-w-[460px]">
      <svg viewBox="0 0 340 340" className="w-full overflow-visible">
        {[0.25, 0.5, 0.75, 1].map(k => (
          <polygon
            key={k}
            points={dims.map((_, i) => `${punto(i, R * k).x},${punto(i, R * k).y}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
          />
        ))}
        {dims.map((d, i) => {
          const p = punto(i, R);
          const l = punto(i, R + 26);
          return (
            <g key={d.id}>
              <line x1={C} y1={C} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.1)" />
              <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.7)" fontSize="12">
                {d.nombre}
              </text>
            </g>
          );
        })}
        {vehiculos.map((v, vi) => {
          const pts = dims.map((d, i) => punto(i, (R * (d.porCarro[vi] ?? 0)) / 10));
          return (
            <g
              key={v.id}
              style={{
                transformOrigin: `${C}px ${C}px`,
                transform: visto ? 'scale(1)' : 'scale(0)',
                transition: `transform 1300ms cubic-bezier(0.34,1.3,0.5,1) ${vi * 200}ms`,
              }}
            >
              <polygon
                points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                fill={serie(vi)}
                fillOpacity={0.18}
                stroke={serie(vi)}
                strokeWidth={2.5}
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 10px ${serie(vi)}88)` }}
              />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={serie(vi)} stroke="#0c0a0f" strokeWidth={1.5} />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
