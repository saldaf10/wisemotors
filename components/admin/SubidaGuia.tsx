'use client';

// ============================================================================
// Subida de vehículos SIN IA (oct-2026): reemplaza IngestStudio.
//   1. Se elige tren motriz y carrocería → plantilla personalizada para copiar
//      (lib/subida/formato.ts: solo los campos que van para ese carro).
//   2. Se pega la guía llena → se lee en el navegador (lib/subida/leer.ts):
//      cada valor a su campo, opciones con tipeo corregidas, vacíos se saltan.
//   3. Fotos por vista y concesionario → publicar (mismo camino de siempre:
//      /api/admin/ingest/publish).
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';
import { CLASES, claseDeTipo } from '@/lib/attributes/clase';
import { TRENES, generarPlantilla, type Tren } from '@/lib/subida/formato';
import { ORIGENES, leerGuia, type Origen } from '@/lib/subida/leer';
import { MarcaE } from '@/components/ui/Estimado';
import { RevisionFotos, fotosIniciales, type FotoRevision } from '@/components/admin/RevisionFotos';

const GUARDADO = 'wm_subida_guia';
const fmt = (v: number | string | boolean) => (typeof v === 'boolean' ? (v ? 'Sí' : 'No') : typeof v === 'number' ? v.toLocaleString('es-CO') : v);

// Trazabilidad: cada letra con su color. E usa el amarillo de los estimados de la ficha.
const COLOR_ORIGEN: Record<Origen, string> = {
  O: 'bg-emerald-100 text-emerald-800',
  C: 'bg-sky-100 text-sky-800',
  X: 'bg-violet-100 text-violet-800',
  E: 'bg-[#dbec43]/60 text-[#3d4200]',
};

function ChipOrigen({ origen }: { origen: Origen | null | undefined }) {
  if (!origen) return <span className="text-[12px] text-tinta-2/60">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${COLOR_ORIGEN[origen]}`} title={ORIGENES[origen]}>
      {origen} <span className="font-normal">{ORIGENES[origen]}</span>
    </span>
  );
}

/** Nota al pie con los enlaces clicables. */
function TextoNota({ texto }: { texto: string }) {
  const partes = texto.split(/(https?:\/\/[^\s)\]]+)/g);
  return (
    <>
      {partes.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-wise underline">
            {p.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/** Qué filas mostrar al tocar un contador. */
type Filtro = Origen | 'sin' | 'avisos' | 'errores' | 'vacios' | null;

const ALTO_LINEA = 20; // px: igual en la numeración y en el texto para que coincidan.

/** Caja para pegar la guía, con las filas numeradas a la izquierda. */
function GuiaNumerada({ texto, onCambio, areaRef }: { texto: string; onCambio: (t: string) => void; areaRef: React.RefObject<HTMLTextAreaElement> }) {
  const numerosRef = useRef<HTMLDivElement>(null);
  const filas = Math.max(1, texto.split('\n').length);
  return (
    <div className="relative mt-3 h-72 overflow-hidden rounded-2xl border border-linea bg-papel focus-within:border-wise">
      <div
        ref={numerosRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-12 select-none overflow-hidden border-r border-linea bg-tarjeta/60 py-4 pr-2 text-right font-mono text-[11.5px] text-tinta-2/70"
      >
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} style={{ height: ALTO_LINEA, lineHeight: `${ALTO_LINEA}px` }}>
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        id="guia"
        ref={areaRef}
        value={texto}
        wrap="off"
        spellCheck={false}
        onChange={e => onCambio(e.target.value)}
        onScroll={e => {
          if (numerosRef.current) numerosRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        placeholder={'Marca: Chevrolet\nModelo: Tracker RS\n…'}
        style={{ lineHeight: `${ALTO_LINEA}px` }}
        className="h-full w-full resize-none bg-transparent py-4 pl-[60px] pr-4 font-mono text-[12.5px] text-tinta focus:outline-none"
      />
    </div>
  );
}

export function SubidaGuia() {
  const [tren, setTren] = useState<Tren>('Gasolina');
  const [carroceria, setCarroceria] = useState('SUV');
  const [copiado, setCopiado] = useState(false);
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<FotoRevision[]>(() => fotosIniciales(undefined));
  const [concesionarios, setConcesionarios] = useState<{ id: string; name: string; location?: string }[]>([]);
  const [dealerIds, setDealerIds] = useState<string[]>([]);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicado, setPublicado] = useState<{ id: string; nombre: string } | null>(null);

  useEffect(() => {
    try {
      const g = localStorage.getItem(GUARDADO);
      if (g) setTexto(g);
    } catch {}
    fetch('/api/dealers')
      .then(r => (r.ok ? r.json() : []))
      .then((d: any) => setConcesionarios(Array.isArray(d) ? d : (d.dealers ?? [])))
      .catch(() => {});
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(GUARDADO, texto);
    } catch {}
  }, [texto]);

  const plantilla = useMemo(() => generarPlantilla({ tren, carroceria }), [tren, carroceria]);
  const lectura = useMemo(() => (texto.trim() ? leerGuia(texto) : null), [texto]);
  const [filtro, setFiltro] = useState<Filtro>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const tablaRef = useRef<HTMLDivElement>(null);
  const erroresRef = useRef<HTMLUListElement>(null);
  const avisosRef = useRef<HTMLUListElement>(null);
  const vaciosRef = useRef<HTMLDetailsElement>(null);

  /** Lleva a la fila N del texto pegado y la selecciona. */
  function irALinea(n: number) {
    const area = areaRef.current;
    if (!area || n < 1) return;
    const lineas = area.value.split('\n');
    const inicio = lineas.slice(0, n - 1).reduce((t, l) => t + l.length + 1, 0);
    area.focus();
    area.setSelectionRange(inicio, inicio + (lineas[n - 1]?.length ?? 0));
    area.scrollTop = Math.max(0, (n - 4) * ALTO_LINEA);
    area.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Tocar un contador: filtra la tabla (o abre la lista) y lleva hasta ahí. */
  function verFiltro(f: Filtro) {
    const nuevo = filtro === f ? null : f;
    setFiltro(nuevo);
    if (!nuevo) return;
    const destino = nuevo === 'errores' ? erroresRef.current : nuevo === 'avisos' ? avisosRef.current : nuevo === 'vacios' ? vaciosRef.current : tablaRef.current;
    if (nuevo === 'vacios' && vaciosRef.current) vaciosRef.current.open = true;
    requestAnimationFrame(() => destino?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  const errores = lectura?.avisos.filter(a => a.tipo === 'error') ?? [];
  const avisos = lectura?.avisos.filter(a => a.tipo === 'aviso') ?? [];
  const id = lectura?.identidad;
  const listo = !!lectura && errores.length === 0 && lectura.datos.length > 0;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(plantilla);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setError('No se pudo copiar: selecciona la plantilla y cópiala a mano.');
    }
  }

  async function publicar() {
    if (!lectura || !id) return;
    setError(null);
    setPublicando(true);
    try {
      const categoria = id.categoria ?? (claseDeTipo(id.carroceria) === 'comercial' ? 'Comercial' : 'Automóvil');
      const res = await adminFetch('/api/admin/ingest/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: id.marca,
          model: id.modelo,
          year: id.anio,
          type: id.carroceria,
          vehicleType: categoria,
          fuelType: id.tren,
          price: id.precio,
          priceEstimated: !!id.precioEstimado,
          priceReasoningEs: id.precioEstimado ? 'Precio estimado (marcado con E en la guía).' : 'Precio de la guía de subida.',
          priceConfidence: id.precioEstimado ? 0.6 : 1,
          // Lo escribió una persona del equipo con la ficha en la mano: confianza plena.
          // Los marcados con "E" son estimados: no salen de la marca (fuente secundaria).
          // Trazabilidad: O (o sin letra) = fuente oficial; C, X y E = fuente secundaria.
          facts: lectura.datos.map(d => ({
            key: d.key,
            value: d.valor,
            confidence: 1,
            sourceTier: d.origen && d.origen !== 'O' ? 2 : 1,
            estimado: d.estimado,
            origen: d.origen,
            nota: d.nota,
          })),
          notasGenerales: lectura.notasGenerales,
          priceOrigen: id.precioOrigen ?? null,
          priceNota: id.precioNota,
          dealerIds,
          fotos: [...fotos.filter(f => f.usar && f.portada), ...fotos.filter(f => f.usar && !f.portada)]
            .filter(f => f.procesada)
            .map(f => ({ url: f.procesada, angulo: f.angulo, portada: f.portada })),
          fotosDescartadas: [...fotos.filter(f => !f.usar && f.publicId).map(f => f.publicId), ...fotos.flatMap(f => f.anteriores ?? [])],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeDeErrorDeAuth(res) ?? data.error ?? 'No se pudo publicar');
      setPublicado({ id: data.vehicle.id, nombre: `${id.marca} ${id.modelo} ${id.anio}` });
      setTexto('');
      setFotos(fotosIniciales(undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar');
    } finally {
      setPublicando(false);
    }
  }

  if (publicado) {
    return (
      <div className="mx-auto max-w-xl rounded-[28px] border border-linea bg-blanco p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-wise" />
        <h2 className="mt-3 text-xl font-bold text-tinta">{publicado.nombre} publicado</h2>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="wise" onClick={() => window.open(`/vehicles/${publicado.id}`, '_blank', 'noopener')}>
            Ver ficha
          </Button>
          <Button variant="outline" onClick={() => setPublicado(null)}>
            Subir otro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Plantilla */}
      <section className="rounded-[28px] border border-linea bg-blanco p-6">
        <h2 className="text-lg font-bold text-tinta">1. Plantilla para este carro</h2>
        <p className="mt-1 text-sm text-tinta-2">Elige el tren motriz y la carrocería: la plantilla trae solo los campos que van para ese carro.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[13px] font-medium text-tinta-2">Tren motriz</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tren motriz">
              {TRENES.map(x => (
                <button key={x} type="button" role="radio" aria-checked={tren === x} data-activa={tren === x} className="pastilla h-10 px-4" onClick={() => setTren(x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-tinta-2">Carrocería</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Carrocería">
              {CLASES.flatMap(c => c.tipos).map(x => (
                <button key={x} type="button" role="radio" aria-checked={carroceria === x} data-activa={carroceria === x} className="pastilla h-10 px-4" onClick={() => setCarroceria(x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[13px] text-tinta-2">{plantilla.split('\n').filter(l => l.includes(':')).length} campos</p>
          <Button variant="wise" onClick={copiar}>
            <ClipboardCopy className="mr-2 h-4 w-4" /> {copiado ? 'Copiada' : 'Copiar plantilla'}
          </Button>
        </div>
        <textarea readOnly value={plantilla} aria-label="Plantilla" className="mt-3 h-56 w-full rounded-2xl border border-linea bg-papel p-4 font-mono text-[12.5px] text-tinta" />
      </section>

      {/* 2. Pegar la guía llena */}
      <section className="rounded-[28px] border border-linea bg-blanco p-6">
        <h2 className="text-lg font-bold text-tinta">2. Pega la guía llena</h2>
        <p className="mt-1 text-sm text-tinta-2">Se lee al instante, sin IA. Lo que no se entienda sale en rojo y no se guarda.</p>
        <GuiaNumerada texto={texto} onCambio={setTexto} areaRef={areaRef} />
      </section>

      {lectura && (
        <section className="rounded-[28px] border border-linea bg-blanco p-6">
          <h2 className="text-lg font-bold text-tinta">
            {id?.marca ?? '¿Marca?'} {id?.modelo ?? '¿Modelo?'} {id?.anio ?? ''}
          </h2>
          <p className="mt-1 text-sm text-tinta-2">
            {[id?.tren, id?.carroceria, id?.categoria, id?.precio ? `$${id.precio.toLocaleString('es-CO')}${id.precioEstimado ? ' (estimado)' : ''}` : null].filter(Boolean).join(' · ') || 'Faltan los datos de identidad'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
            <button type="button" onClick={() => setFiltro(null)} className={`rounded-full bg-wise/10 px-3 py-1 text-wise ${filtro === null ? 'ring-2 ring-wise/40' : ''}`}>
              {lectura.datos.length} datos leídos
            </button>
            {(Object.keys(ORIGENES) as Origen[]).map(o => {
              const n = lectura.datos.filter(d => d.origen === o).length;
              return n ? (
                <button key={o} type="button" onClick={() => verFiltro(o)} aria-pressed={filtro === o} className={`rounded-full px-3 py-1 transition hover:brightness-95 ${COLOR_ORIGEN[o]} ${filtro === o ? 'ring-2 ring-tinta/30' : ''}`}>
                  {n} {ORIGENES[o].toLowerCase()} ({o})
                </button>
              ) : null;
            })}
            {lectura.datos.some(d => !d.origen) && (
              <button type="button" onClick={() => verFiltro('sin')} aria-pressed={filtro === 'sin'} className={`rounded-full bg-tarjeta px-3 py-1 text-tinta-2 hover:brightness-95 ${filtro === 'sin' ? 'ring-2 ring-tinta/30' : ''}`}>
                {lectura.datos.filter(d => !d.origen).length} sin letra
              </button>
            )}
            {lectura.vacios.length > 0 && (
              <button type="button" onClick={() => verFiltro('vacios')} className="rounded-full bg-tarjeta px-3 py-1 text-tinta-2 hover:brightness-95">
                {lectura.vacios.length} vacíos
              </button>
            )}
            {avisos.length > 0 && (
              <button type="button" onClick={() => verFiltro('avisos')} className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 hover:brightness-95">
                {avisos.length} avisos
              </button>
            )}
            {errores.length > 0 && (
              <button type="button" onClick={() => verFiltro('errores')} className="rounded-full bg-rose-100 px-3 py-1 text-rose-700 hover:brightness-95">
                {errores.length} por corregir
              </button>
            )}
          </div>

          {errores.length > 0 && (
            <ul ref={erroresRef} className="mt-4 scroll-mt-28 space-y-1.5">
              {errores.map((a, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] text-rose-700">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {a.campo ? <span className="font-semibold">{a.campo}</span> : null}
                    {a.linea ? (
                      <>
                        {' '}
                        <button type="button" onClick={() => irALinea(a.linea)} className="text-rose-500/80 underline decoration-dotted hover:text-rose-700">
                          (fila {a.linea})
                        </button>
                      </>
                    ) : null}
                    {a.campo || a.linea ? <span className="text-rose-500/70"> · </span> : null}
                    {a.texto}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {avisos.length > 0 && (
            <ul ref={avisosRef} className="mt-3 scroll-mt-28 space-y-1.5">
              {avisos.map((a, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {a.campo ? <span className="font-semibold">{a.campo}</span> : null}
                    {a.linea ? (
                      <>
                        {' '}
                        <button type="button" onClick={() => irALinea(a.linea)} className="underline decoration-dotted opacity-80 hover:opacity-100">
                          (fila {a.linea})
                        </button>
                      </>
                    ) : null}
                    {a.campo || a.linea ? <span className="opacity-70"> · </span> : null}
                    {a.texto}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {lectura.datos.length > 0 && (
            <div ref={tablaRef} className="mt-5 scroll-mt-28 overflow-x-auto">
              {filtro && filtro !== 'errores' && filtro !== 'avisos' && filtro !== 'vacios' && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-papel px-4 py-2 text-[13px] text-tinta-2">
                  <span>
                    Mostrando solo los datos{' '}
                    <span className="font-semibold text-tinta">{filtro === 'sin' ? 'sin letra' : `${ORIGENES[filtro].toLowerCase()} (${filtro})`}</span>. Toca una fila
                    para ir a esa línea del texto.
                  </span>
                  <button type="button" onClick={() => setFiltro(null)} className="font-medium text-wise hover:underline">
                    Ver todos
                  </button>
                </div>
              )}
              <table className="w-full min-w-[860px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wider text-tinta-2">
                    <th className="py-2 pr-3 font-medium">Fila</th>
                    <th className="py-2 pr-3 font-medium">Campo</th>
                    <th className="py-2 pr-3 font-medium">Escribiste</th>
                    <th className="py-2 pr-3 font-medium">Se guarda</th>
                    <th className="py-2 pr-3 font-medium">Origen</th>
                    <th className="py-2 font-medium">Fuente, razón o cálculo</th>
                  </tr>
                </thead>
                <tbody>
                  {lectura.datos
                    .filter(d => !filtro || filtro === 'errores' || filtro === 'avisos' || filtro === 'vacios' || (filtro === 'sin' ? !d.origen : d.origen === filtro))
                    .map(d => (
                    <tr key={d.key} onClick={() => irALinea(d.linea)} title="Ir a esta línea del texto" className="cursor-pointer border-b border-linea/60 align-top hover:bg-papel">
                      <td className="py-1.5 pr-3 font-mono text-[12px] text-tinta-2/70">{d.linea}</td>
                      <td className="py-1.5 pr-3 text-tinta-2">{d.campo}</td>
                      <td className="py-1.5 pr-3 font-mono text-[12.5px] text-tinta-2">{d.escrito}</td>
                      <td className={`py-1.5 pr-3 font-medium ${String(fmt(d.valor)) !== d.escrito ? 'text-wise' : 'text-tinta'}`}>
                        {fmt(d.valor)}
                        {d.estimado && <MarcaE />}
                      </td>
                      <td className="py-1.5 pr-3">
                        <ChipOrigen origen={d.origen} />
                      </td>
                      <td className="max-w-[420px] py-1.5 text-[12.5px] leading-snug text-tinta-2">
                        {d.nota ? (
                          <TextoNota texto={d.nota} />
                        ) : d.origen === 'X' || d.origen === 'E' ? (
                          <span className="text-amber-700">Falta la nota al pie</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(lectura.notasGenerales.length > 0 || id?.precioNota) && (
            <div className="mt-5 rounded-2xl bg-papel p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-tinta-2">Notas y fuentes de la guía</p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-tinta-2">
                {id?.precioNota && (
                  <li>
                    <span className="font-semibold text-tinta">Precio{id.precioOrigen ? ` (${id.precioOrigen})` : ''}:</span> <TextoNota texto={id.precioNota} />
                  </li>
                )}
                {lectura.notasGenerales.map((n, i) => (
                  <li key={i}>
                    <TextoNota texto={n} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lectura.vacios.length > 0 && (
            <details ref={vaciosRef} className="mt-4 scroll-mt-28 text-[13px] text-tinta-2">
              <summary className="cursor-pointer select-none">Ver los {lectura.vacios.length} campos vacíos</summary>
              <p className="mt-2 leading-relaxed">{lectura.vacios.join(' · ')}</p>
            </details>
          )}
        </section>
      )}

      {/* 3. Fotos y concesionario */}
      {lectura && (
        <>
          <RevisionFotos fotos={fotos} onChange={setFotos} />
          <section className="rounded-[28px] border border-linea bg-blanco p-6">
            <h3 className="mb-1 font-bold text-tinta">¿Quién lo vende?</h3>
            <p className="mb-3 text-sm text-tinta-2">Los leads de WhatsApp de este carro llegan a los concesionarios que marques.</p>
            {concesionarios.length === 0 ? (
              <p className="text-sm text-tinta-2">
                Aún no hay concesionarios.{' '}
                <a href="/admin/dealerships/new" target="_blank" rel="noopener" className="text-wise hover:underline">
                  Crear uno ↗
                </a>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {concesionarios.map(c => {
                  const activo = dealerIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="pastilla h-10 px-4"
                      data-activa={activo}
                      aria-pressed={activo}
                      onClick={() => setDealerIds(activo ? dealerIds.filter(x => x !== c.id) : [...dealerIds, c.id])}
                    >
                      {c.name}
                      {c.location && <span className="text-xs text-tinta-2/70">· {c.location}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {error && <p className="text-sm text-rose-700">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {!listo && <p className="text-[13px] text-tinta-2">{errores.length ? 'Corrige lo que está en rojo para publicar.' : 'Pega una guía con datos para publicar.'}</p>}
            <Button variant="wise" onClick={publicar} disabled={!listo || publicando || fotos.some(f => f.procesando)}>
              {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publicar'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
