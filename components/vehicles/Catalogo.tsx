'use client';

// ============================================================================
// Catálogo (referencia Carzone).
//
// Filtros a la izquierda: búsqueda, pastillas de combustible y carrocería,
// histograma de precios con rango doble, marcas con conteo. A la derecha,
// tarjetas grandes. Se filtra en el cliente sobre el catálogo completo (hasta
// 200 vehículos, ver app/vehicles/page.tsx): instantáneo y permite el
// histograma. Si el catálogo crece más, estos filtros pasan a la API.
// ============================================================================

import { useMemo, useState } from 'react';
import { ArrowDownUp, Search, SlidersHorizontal, X } from 'lucide-react';
import { TarjetaCarro, type VehiculoTarjeta } from '@/components/car/TarjetaCarro';
import { millones } from '@/lib/vehiculo-datos';

const ORDENES = [
  { v: 'recientes', t: 'Recientes' },
  { v: 'precio-asc', t: 'Menor precio' },
  { v: 'precio-desc', t: 'Mayor precio' },
  { v: 'marca', t: 'Marca A–Z' },
];

const BARRAS = 26;

function contar<T>(xs: T[], k: (x: T) => string) {
  const m = new Map<string, number>();
  xs.forEach(x => m.set(k(x), (m.get(k(x)) ?? 0) + 1));
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

export function Catalogo({ vehiculos }: { vehiculos: VehiculoTarjeta[] }) {
  const precios = vehiculos.map(v => v.price);
  const pMin = precios.length ? Math.floor(Math.min(...precios) / 1e6) * 1e6 : 0;
  const pMax = precios.length ? Math.ceil(Math.max(...precios) / 1e6) * 1e6 : 1;

  const [texto, setTexto] = useState('');
  const [combustibles, setCombustibles] = useState<string[]>([]);
  const [carrocerias, setCarrocerias] = useState<string[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [rango, setRango] = useState<[number, number]>([pMin, pMax]);
  const [orden, setOrden] = useState('recientes');
  const [panel, setPanel] = useState(false);

  const alternar = (lista: string[], set: (x: string[]) => void, v: string) =>
    set(lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const out = vehiculos.filter(
      v =>
        (!q || `${v.brand} ${v.model}`.toLowerCase().includes(q)) &&
        (!combustibles.length || combustibles.includes(v.fuelType)) &&
        (!carrocerias.length || carrocerias.includes(v.type)) &&
        (!marcas.length || marcas.includes(v.brand)) &&
        v.price >= rango[0] &&
        v.price <= rango[1]
    );
    if (orden === 'precio-asc') out.sort((a, b) => a.price - b.price);
    if (orden === 'precio-desc') out.sort((a, b) => b.price - a.price);
    if (orden === 'marca') out.sort((a, b) => `${a.brand}${a.model}`.localeCompare(`${b.brand}${b.model}`, 'es'));
    return out;
  }, [vehiculos, texto, combustibles, carrocerias, marcas, rango, orden]);

  // Histograma de precios del catálogo completo
  const barras = useMemo(() => {
    const paso = (pMax - pMin) / BARRAS || 1;
    const b = Array.from({ length: BARRAS }, (_, i) => ({ desde: pMin + i * paso, n: 0 }));
    precios.forEach(p => {
      const i = Math.min(BARRAS - 1, Math.floor((p - pMin) / paso));
      b[i].n++;
    });
    return { b, paso, max: Math.max(1, ...b.map(x => x.n)) };
  }, [precios, pMin, pMax]);

  const activos = combustibles.length + carrocerias.length + marcas.length + (rango[0] > pMin || rango[1] < pMax ? 1 : 0);
  const limpiar = () => {
    setTexto('');
    setCombustibles([]);
    setCarrocerias([]);
    setMarcas([]);
    setRango([pMin, pMax]);
  };

  const filtros = (
    <div className="space-y-9">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-3 text-[20px] font-medium tracking-[-0.02em]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-linea bg-blanco">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          Filtros
        </p>
        {activos > 0 && (
          <button onClick={limpiar} className="text-[13px] text-tinta-2 underline-offset-4 hover:text-tinta hover:underline">
            Limpiar ({activos})
          </button>
        )}
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-2" />
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Marca o modelo"
          className="h-12 w-full rounded-2xl border border-linea bg-blanco pl-11 pr-4 text-[15px] outline-none transition-colors focus:border-tinta"
        />
      </label>

      <fieldset>
        <legend className="t-meta mb-4 text-tinta-2">Combustible</legend>
        <div className="flex flex-wrap gap-2">
          {contar(vehiculos, v => v.fuelType).map(([f, n]) => (
            <button key={f} onClick={() => alternar(combustibles, setCombustibles, f)} className="pastilla h-10 px-4" data-activa={combustibles.includes(f)}>
              {f} <span className="text-[12px] opacity-50">{n}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="t-meta mb-4 text-tinta-2">Carrocería</legend>
        <div className="flex flex-wrap gap-2">
          {contar(vehiculos, v => v.type).map(([t, n]) => (
            <button key={t} onClick={() => alternar(carrocerias, setCarrocerias, t)} className="pastilla h-10 px-4" data-activa={carrocerias.includes(t)}>
              {t} <span className="text-[12px] opacity-50">{n}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="t-meta mb-4 text-tinta-2">Precio</legend>
        <div className="flex h-12 items-end gap-[4px]" aria-hidden>
          {barras.b.map((b, i) => {
            const dentro = b.desde + barras.paso >= rango[0] && b.desde <= rango[1];
            return (
              <span
                key={i}
                className="histo-barra flex-1 rounded-t-[2px]"
                style={{
                  height: `${b.n ? 18 + (b.n / barras.max) * 82 : 6}%`,
                  background: dentro ? '#6f6b77' : '#dcdae0',
                  transitionDelay: `${i * 12}ms`,
                }}
              />
            );
          })}
        </div>
        <div className="rango-doble relative h-6">
          <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-linea" />
          <div
            className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-tinta"
            style={{
              left: `${((rango[0] - pMin) / (pMax - pMin || 1)) * 100}%`,
              right: `${100 - ((rango[1] - pMin) / (pMax - pMin || 1)) * 100}%`,
            }}
          />
          <input
            type="range"
            min={pMin}
            max={pMax}
            step={1e6}
            value={rango[0]}
            onChange={e => setRango([Math.min(+e.target.value, rango[1] - 1e6), rango[1]])}
            aria-label="Precio mínimo"
          />
          <input
            type="range"
            min={pMin}
            max={pMax}
            step={1e6}
            value={rango[1]}
            onChange={e => setRango([rango[0], Math.max(+e.target.value, rango[0] + 1e6)])}
            aria-label="Precio máximo"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="cifra flex-1 rounded-xl border border-linea bg-blanco px-3 py-2.5 text-[14px]">{millones(rango[0])}</span>
          <span className="text-tinta-2">–</span>
          <span className="cifra flex-1 rounded-xl border border-linea bg-blanco px-3 py-2.5 text-[14px]">{millones(rango[1])}</span>
        </div>
      </fieldset>

      <fieldset>
        <legend className="t-meta mb-4 text-tinta-2">Marcas</legend>
        <ul className="space-y-1">
          {contar(vehiculos, v => v.brand).map(([m, n]) => {
            const on = marcas.includes(m);
            return (
              <li key={m}>
                <button onClick={() => alternar(marcas, setMarcas, m)} className="group flex w-full items-center gap-3 py-1.5 text-left" aria-pressed={on}>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                      on ? 'border-tinta bg-tinta text-white' : 'border-linea bg-blanco group-hover:border-tinta'
                    }`}
                  >
                    {on && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                        <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <span className={`flex-1 text-[16px] ${on ? 'text-tinta' : 'text-tinta/80'}`}>{m}</span>
                  <span className="cifra text-[12px] text-tinta-2">{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-6 md:px-8 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linea pb-5 md:gap-5 md:pb-8">
        <h1 className="t-titulo text-[38px] md:text-[80px]">
          Catálogo <span className="t-ligero text-tinta-2/50">({filtrados.length})</span>
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setPanel(true)} className="pastilla h-11 px-4 lg:hidden">
            <SlidersHorizontal className="h-4 w-4" /> Filtros{activos ? ` (${activos})` : ''}
          </button>
          <label className="pastilla relative h-11 cursor-pointer pl-4 pr-10">
            <ArrowDownUp className="h-4 w-4" />
            <span className="sr-only">Ordenar por</span>
            <select
              value={orden}
              onChange={e => setOrden(e.target.value)}
              className="absolute inset-0 cursor-pointer appearance-none bg-transparent pl-10 pr-4 text-[14px] font-medium outline-none"
            >
              {ORDENES.map(o => (
                <option key={o.v} value={o.v}>
                  {o.t}
                </option>
              ))}
            </select>
            <span className="invisible">{ORDENES.find(o => o.v === orden)?.t}</span>
          </label>
        </div>
      </div>

      <div className="mt-5 grid gap-10 md:mt-10 lg:grid-cols-[290px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-[108px]">{filtros}</div>
        </aside>

        <div>
          {filtrados.length > 0 ? (
            // De a dos también en celular: tarjeta compacta (en pantallas anchas es la completa).
            <div className="grid grid-cols-2 gap-2 md:gap-5 2xl:grid-cols-3">
              {filtrados.map((v, i) => (
                <TarjetaCarro key={v.id} vehiculo={v} indice={i} destacada={i === 0} compacta detallada />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] bg-tarjeta px-8 py-16 text-center">
              <p className="text-[26px] font-semibold tracking-[-0.03em]">Ningún carro cumple todo eso.</p>
              <p className="mt-2 text-tinta-2">Quita algún filtro o amplía el rango de precio.</p>
              <button onClick={limpiar} className="pastilla pastilla--tinta mt-6">
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtros en móvil: hoja lateral */}
      {panel && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Cerrar filtros" onClick={() => setPanel(false)} />
          <div className="hoja-filtros absolute inset-y-0 right-0 w-[min(420px,92vw)] overflow-y-auto bg-papel p-6">
            <div className="mb-6 flex justify-end">
              <button onClick={() => setPanel(false)} className="flecha" aria-label="Cerrar filtros">
                <X className="h-4 w-4" />
              </button>
            </div>
            {filtros}
            <button onClick={() => setPanel(false)} className="pastilla pastilla--tinta mt-10 w-full justify-center">
              Ver {filtrados.length} carros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
