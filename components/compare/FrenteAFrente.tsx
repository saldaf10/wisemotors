'use client';

// ============================================================================
// Comparador "frente a frente" (editorial, no juego).
//
// Los carros en el piso del estudio, mirándose. Debajo, una fila por pregunta
// de comprador (lib/comparison/duel.ts): con dos carros, barras que divergen
// desde el centro; con más, una barra por carro. El mejor valor se marca en
// morado. "No comparable" y "sin dato" se dicen con palabras; nunca un cero.
// ============================================================================

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CarRender } from '@/components/car/CarRender';
import { runDuel, type DuelVehicle } from '@/lib/comparison/duel';
import { useEnVista } from '@/components/ui/useEnVista';
import { millones } from '@/lib/vehiculo-datos';
import { serie } from '@/lib/palette';

type Vehiculo = DuelVehicle & { type?: string; images?: any[]; imageUrl?: string | null };

export function Fila({
  ronda,
  vehiculos,
  indice,
}: {
  ronda: ReturnType<typeof runDuel>['rounds'][number];
  vehiculos: Vehiculo[];
  indice: number;
}) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.4);
  const dos = vehiculos.length === 2;
  const retraso = { transitionDelay: `${100 + (indice % 3) * 60}ms` };

  return (
    <div ref={ref} data-visto={visto} className="grid gap-4 border-t border-linea py-7 md:grid-cols-12 md:gap-8">
      <div className="md:col-span-3">
        <p className="text-[19px] font-semibold tracking-[-0.03em]">{ronda.titulo}</p>
        <p className="mt-1 text-[14px] leading-snug text-tinta-2">{ronda.pregunta}</p>
        <p className="mt-2 text-[12px] leading-snug text-tinta-2/80">{ronda.porQue}</p>
      </div>

      <div className="md:col-span-9">
        {!ronda.comparable && (
          <p className="mb-3 inline-flex rounded-full bg-tarjeta px-3 py-1 text-[12px] text-tinta-2">
            No comparable · {ronda.motivoNoComparable}
          </p>
        )}

        {dos ? (
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            {ronda.entries.map((e, i) => {
              const izq = i === 0;
              return (
                <div key={e.vehicleId} className={`flex flex-col ${izq ? 'items-end text-right' : 'items-start'}`}>
                  <p className={`text-[15px] ${e.value === null ? 'italic text-tinta-2' : e.winner ? 'font-semibold text-tinta' : 'text-tinta/70'}`}>
                    {e.display ?? 'Sin dato todavía'}
                    {e.winner && ronda.comparable && (
                      <span className="ml-2 rounded-full bg-wise px-2 py-0.5 align-middle text-[11px] font-semibold text-white">mejor</span>
                    )}
                  </p>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-tarjeta">
                    {e.value !== null && (
                      <div
                        className={`${izq ? 'barra-izq ml-auto' : 'barra-der'} h-full w-full rounded-full`}
                        style={{ '--v': e.bar, background: serie(i), opacity: e.winner || !ronda.comparable ? 1 : 0.35, ...retraso } as React.CSSProperties}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {ronda.entries.map((e, i) => {
              const v = vehiculos.find(x => x.id === e.vehicleId)!;
              return (
                <div key={e.vehicleId} className="grid grid-cols-[140px_1fr_auto] items-center gap-3 md:grid-cols-[180px_1fr_200px]">
                  <span className="truncate text-[13px] text-tinta-2">
                    {v.brand} {v.model}
                  </span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-tarjeta">
                    {e.value !== null && (
                      <div
                        className="barra-der h-full w-full rounded-full"
                        style={{ '--v': e.bar, background: serie(i), opacity: e.winner || !ronda.comparable ? 1 : 0.35, ...retraso } as React.CSSProperties}
                      />
                    )}
                  </div>
                  <span className={`text-right text-[14px] ${e.value === null ? 'italic text-tinta-2' : e.winner ? 'font-semibold' : 'text-tinta/70'}`}>
                    {e.display ?? 'Sin dato todavía'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function FrenteAFrente({ vehiculos }: { vehiculos: Vehiculo[] }) {
  const { rounds, score } = useMemo(() => runDuel(vehiculos), [vehiculos]);
  const jugables = rounds.filter(r => r.comparable);
  const dos = vehiculos.length === 2;

  const resumen = vehiculos
    .map(v => ({
      v,
      gana: jugables.filter(r => r.entries.some(e => e.winner && e.vehicleId === v.id)).map(r => r.titulo.toLowerCase()),
    }))
    .sort((a, b) => score[b.v.id] - score[a.v.id]);

  return (
    <div>
      {/* Escenario */}
      <div className="estudio relative overflow-hidden rounded-[36px] px-6 pb-10 pt-8 md:px-10">
        <div className={`grid ${dos ? 'grid-cols-2 gap-16 md:gap-28' : 'grid-cols-2 gap-6 lg:grid-cols-3'}`}>
          {vehiculos.map((v, i) => (
            <div key={v.id} className={`sube ${dos && i === 1 ? 'text-right' : ''}`} style={{ '--d': `${i * 120}ms` } as React.CSSProperties}>
              {/* Misma caja para foto y render: ninguno domina por tamaño */}
              <div className="relative aspect-[480/180] md:aspect-auto md:h-[200px]">
                <div
                  aria-hidden
                  className="absolute inset-x-[10%] bottom-0 h-[12%] rounded-[50%]"
                  style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,0.35), transparent)' }}
                />
                <CarRender car={v} ajustado className={`relative h-full w-full ${dos && i === 1 ? '-scale-x-100' : ''}`} />
              </div>
              <p className="mt-8 text-[13px] text-tinta-2">{v.brand}</p>
              <p className="truncate text-[20px] font-semibold leading-tight tracking-[-0.03em] md:text-[30px]">{v.model}</p>
              <p className="cifra mt-1 text-[15px]">{millones(v.price)}</p>
            </div>
          ))}
        </div>
        {dos && (
          <span className="cifra absolute left-1/2 top-[22%] flex h-14 w-14 md:top-[26%] -translate-x-1/2 items-center justify-center rounded-full border border-linea bg-blanco text-[14px] text-tinta-2 shadow-sm">
            vs
          </span>
        )}
      </div>

      {/* Resumen en una frase por carro */}
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {resumen.map(({ v, gana }, i) => (
          <div key={v.id} className={`rounded-[28px] p-6 ${i === 0 && gana.length ? 'bg-tinta text-white' : 'bg-blanco'}`}>
            <p className={`text-[13px] ${i === 0 && gana.length ? 'text-white/50' : 'text-tinta-2'}`}>
              {gana.length} de {jugables.length} preguntas a su favor
            </p>
            <p className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em]">
              {v.brand} {v.model}
              {gana.length ? (
                <span className={i === 0 ? 'text-white/60' : 'text-tinta-2'}> gana en {gana.join(', ')}.</span>
              ) : (
                <span className="text-tinta-2"> no gana en ninguna, pero puede ser el que más te sirva.</span>
              )}
            </p>
            <Link href={`/vehicles/${v.id}`} className={`mt-5 inline-flex items-center gap-1.5 text-[14px] ${i === 0 && gana.length ? 'text-white' : 'text-tinta'} hover:underline`}>
              Ir al panel dinámico <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>

      {/* Dato por dato */}
      <div className="mt-16">
        <h3 className="t-titulo text-[32px] md:text-[44px]">
          Pregunta por pregunta. <span className="text-tinta-2/50">En palabras de persona.</span>
        </h3>
        <div className="mt-8">
          {rounds.map((r, i) => (
            <Fila key={r.id} ronda={r} vehiculos={vehiculos} indice={i} />
          ))}
        </div>
        <p className="mt-6 max-w-[70ch] text-[13px] text-tinta-2">
          Ganar más preguntas no lo hace el mejor para ti. Si lo tuyo es la plata, mira el precio; si viajas con familia,
          el baúl y la seguridad pesan más.
        </p>
      </div>
    </div>
  );
}
