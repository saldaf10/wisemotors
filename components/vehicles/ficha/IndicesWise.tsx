'use client';

// ============================================================================
// Índices WiseMotors en la ficha (plan §4): lo que solo importa en Colombia.
//
// Altura (con selector de ciudad), Palmas, Hueco y Costo Real de Tenencia.
// Llegan ya calculados del servidor (lib/indices). Un índice sin los datos que
// lo sostienen no aparece (qué falta se ve en la cola de auditoría del panel,
// no se le cuenta al comprador).
// ============================================================================

import { useState } from 'react';
import { Coins, Mountain, MountainSnow, Waves } from 'lucide-react';
import type { IndicesVehiculo, ResultadoAltura, ResultadoCRT, ResultadoHueco, ResultadoPalmas } from '@/lib/indices/calculo';
import { Bloque, Cabecera, Titulito } from './SeccionesFicha';

const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(Math.round(n));
const mill = (n: number) => `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(n / 1_000_000)} M`;

export function hayIndices(i: IndicesVehiculo | null | undefined) {
  return !!i && (i.altura.disponible || i.palmas.disponible || i.hueco.disponible || i.crt.disponible);
}

function Medidor({ puntaje, claro = false }: { puntaje: number; claro?: boolean }) {
  return (
    <div className={`relative mt-5 h-2.5 rounded-full ${claro ? 'bg-white/15' : 'bg-tinta/10'}`} role="img" aria-label={`${puntaje} de 100`}>
      <div className="absolute inset-y-0 left-0 rounded-full bg-wise transition-[width] duration-700" style={{ width: `${puntaje}%` }} />
    </div>
  );
}

function Altura({ a }: { a: ResultadoAltura }) {
  const [ciudad, setCiudad] = useState('Bogotá');
  const c = a.ciudades.find(x => x.nombre === ciudad) ?? a.ciudades[0];
  return (
    <>
      <div className="mt-5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ciudad">
        {a.ciudades.map(x => (
          <button
            key={x.nombre}
            role="radio"
            aria-checked={x.nombre === ciudad}
            onClick={() => setCiudad(x.nombre)}
            className={`rounded-full px-2.5 py-1 text-[12px] transition-colors md:px-3 md:py-1.5 md:text-[13px] ${
              x.nombre === ciudad ? 'bg-white text-tinta' : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {x.nombre}
          </button>
        ))}
      </div>
      <p className="mt-5 text-[13px] text-white/55 md:mt-7">En {c.nombre}, a {fmt(c.altitud)} m, le quedan</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="cifra text-[56px] font-light leading-none tracking-[-0.05em] md:text-[96px]">{fmt(c.potencia)}</span>
        <span className="text-[18px] text-white/55">de {fmt(a.potenciaNominal)} hp</span>
      </p>
      <div className="mt-5 h-2.5 rounded-full bg-white/15" aria-hidden>
        <div className="h-full rounded-full bg-[#d8b4fe] transition-[width] duration-500" style={{ width: `${(c.potencia / a.potenciaNominal) * 100}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-white/55">
        {c.perdidaPct === 0 ? 'No pierde nada.' : `Pierde ${a.aproximado ? 'hasta ' : ''}${c.perdidaPct} % de su fuerza.`}
      </p>
      <p className="mt-4 max-w-[52ch] text-[13px] leading-snug text-white/80 md:mt-6 md:text-[15px] md:leading-relaxed">{a.explicacion}</p>
    </>
  );
}

function Palmas({ p }: { p: ResultadoPalmas }) {
  return (
    <>
      <p className="mt-4 text-[22px] font-semibold leading-none tracking-[-0.03em] md:mt-6 md:text-[32px]">{p.veredicto}</p>
      <p className="mt-2 cifra text-[12px] leading-snug text-tinta-2 md:text-[15px]">{p.hpPorTonelada} hp por tonelada, cargado y en la cima</p>
      <Medidor puntaje={p.puntaje} />
      <p className="mt-4 text-[12px] leading-snug text-tinta-2 md:mt-5 md:text-[14px] md:leading-relaxed">{p.explicacion}</p>
    </>
  );
}

function Hueco({ h }: { h: ResultadoHueco }) {
  return (
    <>
      <p className="mt-4 text-[22px] font-semibold leading-none tracking-[-0.03em] md:mt-6 md:text-[32px]">{h.veredicto}</p>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] md:mt-4 md:gap-8 md:text-[13px]">
        <div>
          <dt className="text-tinta-2">Altura al piso</dt>
          <dd className="cifra text-[15px] font-semibold md:text-[20px]">{h.despejeMm} mm</dd>
        </div>
        <div>
          <dt className="text-tinta-2">Llanta</dt>
          <dd className="cifra text-[15px] font-semibold md:text-[20px]">{h.llanta}</dd>
        </div>
      </dl>
      <Medidor puntaje={h.puntaje} />
      <p className="mt-4 text-[12px] leading-snug text-tinta-2 md:mt-5 md:text-[14px] md:leading-relaxed">{h.explicacion}</p>
    </>
  );
}

const COLORES: Record<string, string> = {
  depreciacion: '#3b0d55',
  energia: '#881cb7',
  seguro: '#b36ad6',
  impuesto: '#d8b4fe',
  mantenimiento: '#8b8594',
  soat: '#c9c5cf',
};

function CRT({ c }: { c: ResultadoCRT }) {
  const orden = [...c.componentes].sort((a, b) => b.valor - a.valor);
  return (
    <>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 md:mt-6 md:gap-y-2">
        <p className="cifra text-[40px] font-light leading-none tracking-[-0.05em] md:text-[72px]">{mill(c.total)}</p>
        <p className="text-[13px] text-tinta-2 md:text-[15px]">
          en {c.anios} años · unos <span className="cifra font-semibold text-tinta">{mill(c.porMes)}</span> al mes
        </p>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full md:mt-6 md:h-4" role="img" aria-label="Reparto del costo">
        {orden.map(x => (
          <div key={x.clave} style={{ width: `${(x.valor / c.total) * 100}%`, background: COLORES[x.clave] }} title={x.nombre} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 md:mt-6 md:gap-x-8 md:gap-y-4">
        {orden.map(x => (
          <li key={x.clave} className="flex gap-2 md:gap-3">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORES[x.clave] }} />
            <div>
              <p className="text-[12px] leading-snug md:text-[14px]">
                <span className="font-semibold">{x.nombre}</span> <span className="cifra">{mill(x.valor)}</span>
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-tinta-2 md:text-[13px]">{x.detalle}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-snug text-tinta-2/80 md:mt-6 md:text-[12px]">
        Medellín, 12.000 km al año. Galón, kWh, SOAT e impuesto con las tarifas vigentes de 2026; seguro, desvalorización y
        mantenimiento son estimaciones de mercado. No incluye financiación ni parqueadero.
      </p>
    </>
  );
}

export function SeccionIndices({ indices }: { indices: IndicesVehiculo }) {
  const { altura, palmas, hueco, crt } = indices;
  return (
    <section>
      <Cabecera
        id="colombia"
        icono={MountainSnow}
        titulo="Hecho para Colombia"
        bajada="Lo que ninguna ficha te dice: cuánta fuerza le queda en tu ciudad, si sube a Las Palmas, si aguanta un hueco y cuánto te cuesta de verdad."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4">
        {altura.disponible && (
          <Bloque tono="tinta" className={
              !palmas.disponible && !hueco.disponible ? 'md:col-span-12' : palmas.disponible && hueco.disponible ? 'md:col-span-7 md:row-span-2' : 'md:col-span-7'
            }>
            <Titulito icono={Mountain} claro>
              Índice Altura
            </Titulito>
            <Altura a={altura} />
          </Bloque>
        )}
        {palmas.disponible && (
          <Bloque tono="lila" mitad={hueco.disponible} className={altura.disponible ? 'md:col-span-5' : hueco.disponible ? 'md:col-span-6' : 'md:col-span-12'}>
            <Titulito icono={Mountain}>Índice Palmas</Titulito>
            <Palmas p={palmas} />
          </Bloque>
        )}
        {hueco.disponible && (
          <Bloque mitad={palmas.disponible} className={altura.disponible ? 'md:col-span-5' : palmas.disponible ? 'md:col-span-6' : 'md:col-span-12'}>
            <Titulito icono={Waves}>Índice Hueco</Titulito>
            <Hueco h={hueco} />
          </Bloque>
        )}
        {crt.disponible && (
          <Bloque className="md:col-span-12">
            <Titulito icono={Coins}>Costo Real de Tenencia</Titulito>
            <CRT c={crt} />
          </Bloque>
        )}
      </div>
    </section>
  );
}
