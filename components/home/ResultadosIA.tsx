'use client';

// ============================================================================
// Resultados de la búsqueda con IA, en el sistema "Estudio".
//
// El #1 no es una tarjeta más: va en grande sobre el estudio, con su afinidad
// y las razones en palabras de persona. El #2 y #3 en compacto; el resto en
// tarjetas del catálogo. Los resultados de la IA no traen fotos ni ficha, así
// que se cruzan por id con el catálogo que ya cargó la home.
//
// Versiones del mismo carro (lib/versiones): la búsqueda ordena cada versión
// por separado; aquí, DESPUÉS de las preguntas para afinar, se agrupan y cada
// carro sale una vez con la versión que mejor encaja. Las otras se ofrecen en
// amarillo, con un botón para compararlas.
// ============================================================================

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, Layers } from 'lucide-react';
import { Afinador, aplicar, type Carro, type Respuestas } from '@/components/home/Afinador';
import { CarRender } from '@/components/car/CarRender';
import { TarjetaCarro, type VehiculoTarjeta } from '@/components/car/TarjetaCarro';
import { BuscadorIA } from '@/components/home/BuscadorIA';
import { CalificarIA } from '@/components/ui/CalificarIA';
import { datosClave, millones, palabraGigante, tresDatos } from '@/lib/vehiculo-datos';
import { AvisoIA } from '@/components/ui/AvisoIA';
import { BotonFavorito } from '@/components/car/BotonFavorito';
import { agruparVersiones, claveFamilia, etiquetaVersion } from '@/lib/versiones';

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

/** "Te recomendamos la versión GL · también viene en GS ($93 M)" + comparar las versiones. */
function OtrasVersiones({ v, otras, compacto = false }: { v: Carro; otras: VehiculoTarjeta[]; compacto?: boolean }) {
  const router = useRouter();
  if (!otras.length) return null;
  const url = `/compare?ids=${[v.id, ...otras.map(o => o.id)].join(',')}`;
  const nombres = otras.map(o => `${etiquetaVersion(o)} (${millones(o.price)})`);
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0];
  return (
    <div className={`rounded-[18px] border border-version/40 bg-version/10 ${compacto ? 'mt-3 px-3 py-2.5' : 'mt-5 px-4 py-3'}`}>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-version-oscuro">
        <Layers className="h-4 w-4 shrink-0" /> Te recomendamos la versión {etiquetaVersion(v)}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-tinta-2">También viene en {lista}.</p>
      {/* Puede ir dentro de un enlace (#2 y #3): navega sin abrir la ficha. */}
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          router.push(url);
        }}
        className="pastilla mt-2 h-9 !border-version !bg-version px-3.5 text-[13px] font-semibold !text-tinta hover:!bg-version/80"
      >
        Comparar las {otras.length + 1} versiones
      </button>
    </div>
  );
}

interface Resultado {
  id: string;
  brand: string;
  model: string;
  familia?: string | null;
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
  // Un carro por familia, con la versión mejor ubicada (la que más encaja) al frente.
  const grupos = agruparVersiones(visibles);
  const lideres = grupos.map(g => g[0]);
  const podio = conPodio ? lideres.slice(0, 3) : [];
  const gruposResto = conPodio ? grupos.slice(3) : grupos;
  const resto = gruposResto.map(g => g[0]);
  const [primero, ...escoltas] = podio;
  /** Las otras versiones del carro en el catálogo (también las que quedaron fuera de la búsqueda). */
  const otrasVersiones = (v: Carro) =>
    catalogo.filter(c => c.id !== v.id && claveFamilia(c) === claveFamilia(v)).sort((a, b) => a.price - b.price);

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
        <p className="rounded-[20px] bg-tarjeta px-5 py-4 text-[15px]" data-recorrido="sin-coincidencias">
          Con esas respuestas no queda ninguno. Quita una de arriba.
        </p>
      )}
      {primero && (
        <div className="grid overflow-hidden rounded-[36px] bg-blanco lg:grid-cols-[1.25fr_1fr]" data-recorrido="resultados">
          <div className="estudio relative flex min-h-[210px] items-center justify-center overflow-hidden p-5 md:min-h-[320px] md:p-8">
            <p
              aria-hidden
              className="t-display pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[clamp(110px,14vw,220px)] leading-none"
              style={{ color: 'transparent', WebkitTextStroke: '1.5px color-mix(in srgb, #881cb7 30%, #d9d7de)' }}
            >
              {palabraGigante(primero.model, primero.brand)}
            </p>
            <span className="t-meta absolute left-4 top-4 rounded-full bg-tinta px-3 py-1.5 text-white md:left-6 md:top-6">Tu mejor opción</span>
            <BotonFavorito id={primero.id} className="absolute right-4 top-4 z-10 md:right-6 md:top-6" />
            <CarRender car={primero} prioridad className="carro-entra relative aspect-[480/190] w-full max-w-[620px]" />
          </div>
          <div className="flex flex-col p-5 md:p-10">
            <p className="text-[14px] text-tinta-2">{primero.brand}</p>
            <h3 className="t-titulo text-[34px] md:text-[52px]">{primero.model}</h3>
            <p className="mt-1 text-[14px] text-tinta-2">
              {primero.year} · {primero.fuelType} · {primero.type}
            </p>

            <div className="mt-5 flex items-end justify-between gap-6 md:mt-8 md:justify-start md:gap-8">
              <div>
                <p className="t-ligero text-[36px] leading-none md:text-[52px]">
                  1.º <span className="text-[22px] text-tinta-2">de {lideres.length}</span>
                </p>
                <p className="mt-1 text-[13px] text-tinta-2">
                  la mejor opción para lo que pediste
                  {primero.matchPercentage != null && ` · ${primero.matchPercentage}% de coincidencia`}
                </p>
              </div>
              <div className="text-right md:text-left">
                <p className="cifra whitespace-nowrap text-[22px] font-semibold md:text-[26px]">{millones(primero.price)}</p>
                <p className="mt-1 text-[13px] text-tinta-2">precio de lista</p>
              </div>
            </div>

            {tresDatos(primero).length > 0 && (
              <div className="fila-datos mt-5 border-y border-linea py-4 md:mt-8">
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
              <ul className="mt-5 space-y-2.5 md:mt-6">
                {/* En celular, las 2 razones principales; en pantalla grande, hasta 4. */}
                {Array.from(new Set([...razonesRelativas(primero, podio), ...(primero.reasons ?? [])])).slice(0, 4).map((r, i) => (
                  <li key={r} className={`flex items-start gap-3 text-[15px] ${i >= 2 ? 'max-md:hidden' : ''}`}>
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-wise" strokeWidth={2.5} />
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}

            <OtrasVersiones v={primero} otras={otrasVersiones(primero)} />

            {/* La acción del podio: separada de las razones, a todo el ancho y con lo que hay adentro. */}
            <div className="mt-6 border-t border-linea pt-5 md:mt-8 md:pt-6 lg:mt-auto">
              <Link
                href={`/vehicles/${primero.id}`}
                data-recorrido="panel-dinamico"
                className="pastilla pastilla--wise !h-14 !w-full !justify-between !px-6 !text-[16px] !font-semibold"
              >
                Ir al panel dinámico del {primero.model}
                <ArrowUpRight className="h-5 w-5 shrink-0" />
              </Link>
              <p className="mt-2 text-center text-[13px] text-tinta-2">Fotos, desempeño, consumo, espacio y con quién hablar.</p>
            </div>
          </div>
        </div>
      )}

      {escoltas.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {escoltas.slice(0, 2).map((v, i) => (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className="group relative grid items-center gap-4 overflow-hidden rounded-[28px] bg-blanco p-5 transition-shadow duration-500 hover:shadow-[0_30px_60px_-36px_rgba(14,12,17,0.5)] sm:grid-cols-[1fr_1.1fr]"
            >
              <BotonFavorito id={v.id} className="absolute right-4 top-4 z-10 !h-12 !w-12" />
              <div className="estudio flex aspect-[16/9] items-center justify-center rounded-[20px] p-3 sm:aspect-[4/3]">
                <CarRender car={v} className="aspect-[480/180] w-full transition-transform duration-700 group-hover:translate-x-1 group-hover:scale-105" />
              </div>
              <div className="flex h-full min-w-0 flex-col">
                <p className="cifra text-[12px] text-tinta-2">#{i + 2}</p>
                <p className="truncate pr-12 text-[22px] font-semibold tracking-[-0.03em]">
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
                {/* Los mismos tres datos de la principal: para comparar de un vistazo. */}
                {tresDatos(v).length > 0 && (
                  <div className="fila-datos mt-4 border-t border-linea pt-3">
                    {tresDatos(v).map(d => (
                      <div key={d.clave} className="px-2 text-center first:pl-0 last:pr-0">
                        <p className="cifra text-[15px] font-semibold">
                          {d.valor}
                          {d.unidad && <span className="ml-0.5 text-[11px] font-normal text-tinta-2">{d.unidad}</span>}
                        </p>
                        <p className="mt-0.5 text-[11px] text-tinta-2">{d.etiqueta}</p>
                      </div>
                    ))}
                  </div>
                )}
                <OtrasVersiones v={v} otras={otrasVersiones(v)} compacto />
                {/* Un botón de verdad, abajo y a todo el ancho: alineado en las dos tarjetas. */}
                <span className="pastilla mt-4 !w-full !justify-center !border-wise/30 !text-wise transition-colors group-hover:!border-wise group-hover:!bg-wise group-hover:!text-white sm:mt-auto">
                  Ir al panel dinámico <ArrowUpRight className="h-4 w-4" />
                </span>
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
          <h3 className="t-titulo text-[32px] md:text-[44px]" data-recorrido={podio.length ? undefined : 'resultados'}>
            {podio.length ? 'Otras opciones' : 'Los que cumplen'} <span className="t-ligero text-tinta-2/50">({resto.length})</span>
          </h3>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {gruposResto.map((g, i) => (
              <TarjetaCarro
                key={claveFamilia(g[0])}
                vehiculo={g[0]}
                versiones={g.length > 1 ? [...g].sort((a, b) => a.price - b.price) : undefined}
                indice={i}
              />
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
