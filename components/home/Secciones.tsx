'use client';

// ============================================================================
// Secciones de la home (después del hero).
// ============================================================================

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Sparkles } from 'lucide-react';
import { CarRender } from '@/components/car/CarRender';
import { TarjetaCarro, type VehiculoTarjeta } from '@/components/car/TarjetaCarro';
import { Reveal } from '@/components/ui/Reveal';
import { useEnVista } from '@/components/ui/useEnVista';
import { datosClave, millones } from '@/lib/vehiculo-datos';

// ── Cómo funciona ───────────────────────────────────────────────────────────
// Tres pasos que se pueden tocar (y avanzan solos). A la izquierda, una
// demostración de cada paso que no depende de que haya carros en la base.
const PASOS = [
  {
    titulo: 'Escribes lo que necesitas',
    texto: 'Como se lo dirías a un amigo: para qué lo vas a usar, quién va contigo, cuánto quieres gastar.',
  },
  {
    titulo: 'Lo medimos contra Colombia',
    texto: 'Cada carro se compara con los de su tipo y precio que se venden aquí, no contra un Ferrari.',
  },
  {
    titulo: 'Te explicamos por qué',
    texto: 'Recibes los carros que mejor encajan, con las razones en palabras sencillas y de dónde sale cada dato.',
  },
];

const FRASE = 'Una SUV para la familia que no gaste mucho';
const DETECTA = ['Familia', 'SUV', 'Que gaste poco'];
const AUTO = 6000;

function DemoEscribe({ activo }: { activo: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!activo) return;
    setN(0);
    let k = 0;
    const t = setInterval(() => {
      k++;
      setN(k);
      if (k >= FRASE.length) clearInterval(t);
    }, 45);
    return () => clearInterval(t);
  }, [activo]);
  const listo = n >= FRASE.length;
  return (
    <div className="flex h-full flex-col justify-center gap-6 p-6 md:p-10">
      <div className="flex h-[58px] items-center gap-3 rounded-full bg-blanco pl-5 pr-2 shadow-[0_24px_50px_-28px_rgba(14,12,17,0.5)] ring-1 ring-black/5">
        <Sparkles className="h-5 w-5 shrink-0 text-wise" />
        <p className="min-w-0 flex-1 truncate text-[15px] md:text-[17px]">
          {FRASE.slice(0, n)}
          <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-wise align-middle" />
        </p>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wise text-white">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
      <div>
        <p className="text-[13px] text-tinta-2">Lo que entendemos:</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DETECTA.map((d, i) => (
            <span
              key={d}
              className="rounded-full bg-tinta px-4 py-2 text-[14px] text-white"
              style={{
                opacity: listo ? 1 : 0,
                transform: listo ? 'none' : 'translateY(8px)',
                transition: `opacity 400ms ease ${i * 140}ms, transform 500ms cubic-bezier(0.34,1.56,0.64,1) ${i * 140}ms`,
              }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const FILAS_DEMO = [
  { etiqueta: 'Consumo', puntos: [18, 30, 41, 47, 55, 63, 70, 84], propio: 78 },
  { etiqueta: 'Espacio', puntos: [12, 25, 33, 48, 58, 66, 80, 90], propio: 71 },
  { etiqueta: 'Seguridad', puntos: [20, 28, 44, 52, 61, 74, 81, 92], propio: 86 },
];

function DemoMide({ activo }: { activo: boolean }) {
  return (
    <div className="flex h-full flex-col justify-center gap-7 p-6 md:p-10">
      <p className="text-[14px] text-tinta-2">
        Tu opción frente a las SUV de su precio que se venden en Colombia <span className="text-tinta-2/60">(ejemplo)</span>
      </p>
      {FILAS_DEMO.map((f, fi) => (
        <div key={f.etiqueta}>
          <p className="text-[14px] font-semibold">{f.etiqueta}</p>
          <div className="relative mt-3 h-6">
            <div className="absolute inset-x-0 top-1/2 h-px bg-linea" />
            {f.puntos.map((x, i) => (
              <span
                key={i}
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-papel bg-tinta/25"
                style={{ left: `${x}%`, opacity: activo ? 1 : 0, transition: `opacity 300ms ease ${fi * 120 + i * 40}ms` }}
              />
            ))}
            <span
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-wise shadow-[0_4px_12px_rgba(136,28,183,0.5)]"
              style={{ left: activo ? `${f.propio}%` : '0%', transition: `left 1200ms cubic-bezier(0.16,1,0.3,1) ${300 + fi * 150}ms` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-tinta-2">
            <span>menos</span>
            <span>más</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const RAZONES_DEMO = ['Rinde más por galón que la mayoría de su tipo', 'Baúl para unas 12 maletas de cabina', '5 estrellas en pruebas de choque'];

function DemoExplica({ activo }: { activo: boolean }) {
  return (
    <div className="flex h-full flex-col justify-center p-6 md:p-10">
      <div className="overflow-hidden rounded-[26px] bg-blanco shadow-[0_30px_60px_-40px_rgba(14,12,17,0.55)]">
        <div className="estudio flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="t-meta text-tinta-2">Tu mejor opción · ejemplo</p>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">SUV familiar híbrida</p>
          </div>
          <p className="t-ligero text-[34px] leading-none">
            92<span className="text-[16px] text-tinta-2">%</span>
          </p>
        </div>
        <ul className="space-y-3 px-5 py-5">
          {RAZONES_DEMO.map((r, i) => (
            <li
              key={r}
              className="flex items-start gap-3 text-[15px]"
              style={{
                opacity: activo ? 1 : 0,
                transform: activo ? 'none' : 'translateX(-10px)',
                transition: `opacity 400ms ease ${200 + i * 180}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${200 + i * 180}ms`,
              }}
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-wise" strokeWidth={2.5} />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ComoFunciona() {
  const [paso, setPaso] = useState(0);
  const [tocado, setTocado] = useState(false);
  const [ref, visto] = useEnVista<HTMLDivElement>(0.3);

  // Avanza solo mientras la persona no haya elegido un paso.
  useEffect(() => {
    if (!visto || tocado) return;
    const t = setTimeout(() => setPaso(p => (p + 1) % PASOS.length), AUTO);
    return () => clearTimeout(t);
  }, [paso, visto, tocado]);

  const elegir = (i: number) => {
    setTocado(true);
    setPaso(i);
  };

  return (
    <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-8 md:py-32">
      <Reveal>
        <h2 className="t-titulo max-w-[20ch] text-[44px] md:text-[84px]">
          <span className="text-tinta-2/50">Escríbelo como se lo dirías a un amigo.</span> La parte técnica corre por nuestra cuenta.
        </h2>
      </Reveal>

      <div ref={ref} className="mt-14 grid gap-8 md:grid-cols-12">
        <div className="estudio relative min-h-[360px] overflow-hidden rounded-[32px] md:col-span-7 md:min-h-[440px]">
          <div key={paso} className="sube absolute inset-0">
            {paso === 0 && <DemoEscribe activo={visto} />}
            {paso === 1 && <DemoMide activo={visto} />}
            {paso === 2 && <DemoExplica activo={visto} />}
          </div>
        </div>

        <div className="flex flex-col md:col-span-5" role="tablist" aria-label="Cómo funciona">
          {PASOS.map((p, i) => {
            const on = i === paso;
            return (
              <button
                key={p.titulo}
                role="tab"
                aria-selected={on}
                onClick={() => elegir(i)}
                className={`group relative border-t border-linea py-7 text-left transition-colors ${on ? '' : 'hover:bg-blanco/50'}`}
              >
                {/* Barra de progreso del paso activo */}
                <span className="absolute inset-x-0 -top-px h-[2px] overflow-hidden">
                  {on && (
                    <span
                      key={`${paso}-${tocado}`}
                      className="progreso-hero absolute inset-0 origin-left bg-wise"
                      style={{ animationDuration: `${AUTO}ms`, animationPlayState: tocado || !visto ? 'paused' : 'running', transform: tocado ? 'scaleX(1)' : undefined }}
                    />
                  )}
                </span>
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                      on ? 'bg-wise text-white' : 'bg-tarjeta text-tinta-2'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className={`text-[26px] font-semibold tracking-[-0.035em] transition-colors md:text-[30px] ${on ? 'text-tinta' : 'text-tinta/45'}`}>
                      {p.titulo}
                    </h3>
                    <p
                      className="max-w-[42ch] overflow-hidden text-[15px] leading-relaxed text-tinta-2 transition-all duration-500"
                      style={{ maxHeight: on ? 120 : 0, opacity: on ? 1 : 0, marginTop: on ? 8 : 0 }}
                    >
                      {p.texto}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
          <Link href="/vehicles" className="pastilla pastilla--tinta mt-6 h-12 self-start px-6">
            Explorar el catálogo <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Destacados (Carzone) ────────────────────────────────────────────────────
const FILTROS = [
  { texto: 'Todos', f: () => true },
  { texto: 'SUV', f: (v: VehiculoTarjeta) => v.type === 'SUV' },
  { texto: 'Hatchback', f: (v: VehiculoTarjeta) => v.type === 'Hatchback' },
  { texto: 'Sedán', f: (v: VehiculoTarjeta) => v.type === 'Sedán' },
  { texto: 'Eléctricos', f: (v: VehiculoTarjeta) => v.fuelType === 'Eléctrico' },
];

export function Destacados({ vehiculos, total }: { vehiculos: VehiculoTarjeta[]; total: number }) {
  const [filtro, setFiltro] = useState(0);
  const lista = vehiculos.filter(FILTROS[filtro].f).slice(0, 6);

  return (
    <section className="mx-auto max-w-[1440px] px-5 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="t-titulo text-[44px] md:text-[64px]">
          En el catálogo <span className="t-ligero text-tinta-2/50">({total})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f, i) => (
            <button key={f.texto} onClick={() => setFiltro(i)} className="pastilla h-10 px-4" data-activa={filtro === i}>
              {f.texto}
            </button>
          ))}
          <Link href="/vehicles" className="pastilla pastilla--wise h-10 px-4">
            Ver todo <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div key={filtro} className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((v, i) => (
          <TarjetaCarro key={v.id} vehiculo={v} indice={i} />
        ))}
        {lista.length === 0 && (
          <p className="col-span-full rounded-[28px] bg-tarjeta p-10 text-center text-tinta-2">
            Todavía no hay carros de este tipo en el catálogo.
          </p>
        )}
      </div>
    </section>
  );
}

// ── Franja del comparador (showroom con muesca) ─────────────────────────────
export function BandaComparar({ vehiculos }: { vehiculos: VehiculoTarjeta[] }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.3);

  // Dos del mismo tipo para que la comparación tenga sentido.
  const par = useMemo(() => {
    const porTipo = new Map<string, VehiculoTarjeta[]>();
    vehiculos.forEach(v => porTipo.set(v.type, [...(porTipo.get(v.type) ?? []), v]));
    const grupo = Array.from(porTipo.values()).sort((a, b) => b.length - a.length)[0] ?? [];
    return grupo.slice(0, 2);
  }, [vehiculos]);

  if (par.length < 2) return null;
  const [a, b] = par;
  const da = datosClave(a);
  const db = datosClave(b);
  const filas = [
    { etiqueta: 'Precio', va: a.price, vb: b.price, ta: millones(a.price), tb: millones(b.price), menor: true },
    ...['potencia', 'baul', 'consumo', 'autonomia', 'aceleracion']
      .map(k => ({ x: da.find(d => d.clave === k), y: db.find(d => d.clave === k) }))
      .filter(p => p.x && p.y)
      .slice(0, 3)
      .map(({ x, y }) => ({
        etiqueta: x!.etiqueta,
        va: x!.numero,
        vb: y!.numero,
        ta: `${x!.valor} ${x!.unidad}`,
        tb: `${y!.valor} ${y!.unidad}`,
        menor: x!.clave === 'aceleracion',
      })),
  ];

  return (
    <section className="banda-muesca relative mt-28 bg-showroom text-white md:mt-36">
      <div ref={ref} data-visto={visto} className="mx-auto max-w-[1440px] px-5 pb-24 pt-28 md:px-8 md:pt-32">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="t-titulo text-[44px] md:text-[64px]">
              Ponlos frente a frente. <span className="text-white/40">Sin letra menuda.</span>
            </h2>
            <p className="mt-6 max-w-[40ch] text-[15px] leading-relaxed text-white/60">
              Guarda los que te gusten y compáralos dato por dato. Cuando un dato no aplica o nos falta, te lo decimos.
            </p>
            <Link href="/compare" className="cta-corte mt-10">
              Comparar ahora <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="lg:col-span-8">
            <div className="relative grid grid-cols-2 items-end gap-4">
              <div>
                <CarRender car={a} className="aspect-[480/180] w-full" />
                <p className="mt-4 text-[17px] font-semibold tracking-[-0.03em] md:text-[20px]">{a.brand} {a.model}</p>
              </div>
              <div className="text-right">
                <CarRender car={b} className="aspect-[480/180] w-full -scale-x-100" />
                <p className="mt-4 text-[17px] font-semibold tracking-[-0.03em] md:text-[20px]">{b.brand} {b.model}</p>
              </div>
              <span className="cifra absolute left-1/2 top-[34%] flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-showroom text-[13px] text-white/70">
                vs
              </span>
            </div>

            <div className="mt-10 space-y-5">
              {filas.map((f, i) => {
                const max = Math.max(f.va, f.vb);
                const gana = f.menor ? (f.va <= f.vb ? 'a' : 'b') : f.va >= f.vb ? 'a' : 'b';
                return (
                  <div key={f.etiqueta} className="grid grid-cols-[1fr_64px_1fr] items-center gap-2 md:grid-cols-[1fr_120px_1fr] md:gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`cifra w-20 shrink-0 text-[14px] md:w-24 md:text-[15px] ${gana === 'a' ? 'text-white' : 'text-[#a39fab]'}`}>{f.ta}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="barra-izq h-full w-full rounded-full"
                          style={{
                            '--v': f.va / max,
                            background: gana === 'a' ? '#a855f7' : 'rgba(255,255,255,0.4)',
                            transitionDelay: `${i * 120}ms`,
                          } as React.CSSProperties}
                        />
                      </div>
                    </div>
                    <span className="text-center text-[13px] text-white/55">{f.etiqueta}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="barra-der h-full w-full rounded-full"
                          style={{
                            '--v': f.vb / max,
                            background: gana === 'b' ? '#a855f7' : 'rgba(255,255,255,0.4)',
                            transitionDelay: `${i * 120}ms`,
                          } as React.CSSProperties}
                        />
                      </div>
                      <span className={`cifra w-20 shrink-0 text-right text-[14px] md:w-24 md:text-[15px] ${gana === 'b' ? 'text-white' : 'text-[#a39fab]'}`}>{f.tb}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

