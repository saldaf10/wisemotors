'use client';

// ============================================================================
// Resultados de la búsqueda con IA, en el sistema "Estudio".
//
// El #1 no es una tarjeta más: va en grande sobre el estudio, con su afinidad
// y las razones en palabras de persona. El #2 y #3 en compacto; el resto en
// tarjetas del catálogo. Los resultados de la IA no traen fotos ni ficha, así
// que se cruzan por id con el catálogo que ya cargó la home.
// ============================================================================

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { Afinador, aplicar, type Carro, type Respuestas } from '@/components/home/Afinador';
import { CarRender } from '@/components/car/CarRender';
import { TarjetaCarro, type VehiculoTarjeta } from '@/components/car/TarjetaCarro';
import { BuscadorIA } from '@/components/home/BuscadorIA';
import { CalificarIA } from '@/components/ui/CalificarIA';
import { datosClave, millones, palabraGigante, tresDatos } from '@/lib/vehiculo-datos';
import { AvisoIA } from '@/components/ui/AvisoIA';

/** Razones comparativas, calculadas con datos reales, frente a los otros del podio. */
function razonesRelativas(v: any, podio: any[]): string[] {
  if (podio.length < 2) return [];
  const out: string[] = [];
  const dato = (x: any, k: string) => datosClave(x).find(d => d.clave === k)?.numero ?? null;
  // Superlativo solo si es ESTRICTAMENTE mejor que todos los demás; en empate
  // se dice que empata (dos carros "el que más rinde" con la misma cifra se contradicen).
  const otros = podio.filter(x => x.id !== v.id);
  const mejor = (k: string, menor = false) => {
    const mio = dato(v, k);
    const vals = otros.map(x => dato(x, k)).filter((n): n is number => n !== null);
    if (mio === null || vals.length === 0) return false;
    return menor ? vals.every(n => mio < n) : vals.every(n => mio > n);
  };
  const empata = (k: string) => {
    const mio = dato(v, k);
    if (mio === null) return null;
    const todos = podio.map(x => dato(x, k)).filter((n): n is number => n !== null);
    const tope = Math.max(...todos);
    const igual = otros.find(x => dato(x, k) === mio);
    return mio === tope && igual ? igual : null;
  };
  const cifra = (k: string) => datosClave(v).find(d => d.clave === k);
  if (otros.every(x => v.price < x.price)) out.push(`El de menor precio de tus ${podio.length} mejores opciones`);
  if (mejor('consumo')) out.push(`El que más rinde por galón de los tres: ${cifra('consumo')!.valor} km`);
  if (mejor('autonomia')) out.push(`El que más lejos llega con una carga: ${cifra('autonomia')!.valor} km`);
  if (mejor('baul')) out.push(`El baúl más grande de los tres: ${cifra('baul')!.valor} L`);
  if (mejor('potencia')) out.push(`El de más fuerza de los tres: ${cifra('potencia')!.valor} hp`);
  if (mejor('aceleracion', true)) out.push(`El que arranca más rápido de los tres`);
  const empateConsumo = empata('consumo');
  if (empateConsumo) out.push(`Empata con el ${empateConsumo.model} en consumo: ${cifra('consumo')!.valor} km/gal`);
  return out;
}

interface Resultado {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  fuelType: string;
  type: string;
  matchPercentage?: number;
  reasons?: string[];
}

export function ResultadosIA({
  resultados,
  consulta,
  catalogo,
}: {
  resultados: any;
  consulta: string;
  catalogo: VehiculoTarjeta[];
  onRefinar?: (q: string) => void;
}) {
  const completar = (r: Resultado) => ({ ...catalogo.find(v => v.id === r.id), ...r }) as Carro;
  const todos: Carro[] = [...(resultados.top_recommendations?.vehicles ?? []), ...(resultados.all_matches?.vehicles ?? [])]
    .map(completar)
    .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
  // Objetiva ("con turbo"): no hay opinión, se muestran todos. Subjetiva: podio de la IA.
  const conPodio = resultados.query_type !== 'OBJECTIVE_FEATURE' && (resultados.top_recommendations?.vehicles?.length ?? 0) > 0;

  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const visibles = aplicar(todos, respuestas);
  const podio = conPodio ? visibles.slice(0, 3) : [];
  const resto = conPodio ? visibles.slice(3) : visibles;
  const [primero, ...escoltas] = podio;

  return (
    <div className="space-y-14">
      <div className="max-w-[640px]">
        <BuscadorIA inicial={consulta} />
        <AvisoIA className="mt-3" />
      </div>
      {resultados.aviso && <p className="rounded-[20px] bg-[#efe4f7] px-5 py-4 text-[15px]">{resultados.aviso}</p>}
      <Afinador
        todos={todos}
        visibles={visibles}
        orden={resultados.preguntas ?? []}
        respuestas={respuestas}
        onCambio={setRespuestas}
      />
      {visibles.length === 0 && (
        <p className="rounded-[20px] bg-tarjeta px-5 py-4 text-[15px]">Con esas respuestas no queda ninguno. Quita una de arriba.</p>
      )}
      {primero && (
        <div className="grid overflow-hidden rounded-[36px] bg-blanco lg:grid-cols-[1.25fr_1fr]">
          <div className="estudio relative flex min-h-[320px] items-center justify-center overflow-hidden p-8">
            <p
              aria-hidden
              className="t-display pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[clamp(110px,14vw,220px)] leading-none"
              style={{ color: 'transparent', WebkitTextStroke: '1.5px color-mix(in srgb, #881cb7 30%, #d9d7de)' }}
            >
              {palabraGigante(primero.model, primero.brand)}
            </p>
            <span className="t-meta absolute left-6 top-6 rounded-full bg-tinta px-3 py-1.5 text-white">Tu mejor opción</span>
            <CarRender car={primero} prioridad className="carro-entra relative aspect-[480/190] w-full max-w-[620px]" />
          </div>
          <div className="flex flex-col p-8 md:p-10">
            <p className="text-[14px] text-tinta-2">{primero.brand}</p>
            <h3 className="t-titulo text-[40px] md:text-[52px]">{primero.model}</h3>
            <p className="mt-1 text-[14px] text-tinta-2">
              {primero.year} · {primero.fuelType} · {primero.type}
            </p>

            <div className="mt-8 flex items-end gap-8">
              <div>
                <p className="t-ligero text-[44px] leading-none md:text-[52px]">
                  1.º <span className="text-[22px] text-tinta-2">de {visibles.length}</span>
                </p>
                <p className="mt-1 text-[13px] text-tinta-2">
                  la mejor opción para lo que pediste
                  {primero.matchPercentage != null && ` · ${primero.matchPercentage}% de coincidencia`}
                </p>
              </div>
              <div>
                <p className="cifra text-[26px] font-semibold">{millones(primero.price)}</p>
                <p className="mt-1 text-[13px] text-tinta-2">precio de lista</p>
              </div>
            </div>

            {tresDatos(primero).length > 0 && (
              <div className="fila-datos mt-8 border-y border-linea py-4">
                {tresDatos(primero).map(d => (
                  <div key={d.clave} className="px-3 text-center first:pl-0 last:pr-0">
                    <p className="cifra text-[17px] font-semibold">
                      {d.valor}
                      {d.unidad && <span className="ml-0.5 text-[12px] font-normal text-tinta-2">{d.unidad}</span>}
                    </p>
                    <p className="mt-0.5 text-[12px] text-tinta-2">{d.etiqueta}</p>
                  </div>
                ))}
              </div>
            )}

            {[...razonesRelativas(primero, podio), ...(primero.reasons ?? [])].length ? (
              <ul className="mt-6 space-y-2.5">
                {Array.from(new Set([...razonesRelativas(primero, podio), ...(primero.reasons ?? [])])).slice(0, 4).map(r => (
                  <li key={r} className="flex items-start gap-3 text-[15px]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-wise" strokeWidth={2.5} />
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}

            <Link href={`/vehicles/${primero.id}`} className="pastilla pastilla--wise mt-auto h-12 self-start px-6 max-lg:mt-8">
              Ver ficha completa <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {escoltas.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {escoltas.slice(0, 2).map((v, i) => (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className="group grid grid-cols-[1fr_1.1fr] items-center gap-4 overflow-hidden rounded-[28px] bg-blanco p-5 transition-shadow duration-500 hover:shadow-[0_30px_60px_-36px_rgba(14,12,17,0.5)]"
            >
              <div className="estudio flex aspect-[4/3] items-center justify-center rounded-[20px] p-3">
                <CarRender car={v} className="aspect-[480/180] w-full transition-transform duration-700 group-hover:translate-x-1 group-hover:scale-105" />
              </div>
              <div className="min-w-0">
                <p className="cifra text-[12px] text-tinta-2">#{i + 2}</p>
                <p className="truncate text-[22px] font-semibold tracking-[-0.03em]">
                  {v.brand} {v.model}
                </p>
                <p className="cifra mt-1 text-[16px]">{millones(v.price)}</p>
                {v.matchPercentage != null && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-tarjeta">
                      <div className="h-full rounded-full bg-wise" style={{ width: `${v.matchPercentage}%` }} />
                    </div>
                    <p className="mt-1 text-[12px] text-tinta-2">{v.matchPercentage}% de afinidad</p>
                  </div>
                )}
                {(() => {
                  // Una razón propia y comparativa; si no hay, la diferencia de precio con el #1.
                  const propia = razonesRelativas(v, podio)[0];
                  const diff = Math.round((v.price - primero.price) / 1e6);
                  const texto =
                    propia ??
                    (diff > 0
                      ? `$${diff} M más que el ${primero.model}`
                      : diff < 0
                        ? `$${-diff} M menos que el ${primero.model}`
                        : v.reasons?.[0]);
                  return texto ? <p className="mt-3 text-[13px] leading-snug text-tinta-2">{texto}</p> : null;
                })()}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ¿Sirvió? Lo lee el equipo en el panel para mejorar la búsqueda. */}
      {todos.length > 0 && (
        <CalificarIA
          tipo="busqueda"
          clave={consulta}
          pregunta={podio.length ? '¿Te sirvieron estas recomendaciones?' : '¿Encontraste lo que buscabas?'}
          detalle={{
            tipoConsulta: resultados.query_type,
            total: todos.length,
            mostrados: (podio.length ? podio : resto).slice(0, 5).map(c => `${c.brand} ${c.model}`),
          }}
        />
      )}

      {resto.length > 0 && (
        <div>
          <h3 className="t-titulo text-[32px] md:text-[44px]">
            {podio.length ? 'Otras opciones' : 'Los que cumplen'} <span className="t-ligero text-tinta-2/50">({resto.length})</span>
          </h3>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {resto.map((v, i) => (
              <TarjetaCarro key={v.id} vehiculo={v} indice={i} />
            ))}
          </div>
        </div>
      )}

      <p className="cifra text-[12px] text-tinta-2">
        {resultados.total_matches ?? todos.length} carros analizados · {resultados.processing_time_ms ?? '—'} ms
      </p>
    </div>
  );
}
