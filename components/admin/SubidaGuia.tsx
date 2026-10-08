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

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';
import { CLASES, claseDeTipo } from '@/lib/attributes/clase';
import { TRENES, generarPlantilla, type Tren } from '@/lib/subida/formato';
import { leerGuia } from '@/lib/subida/leer';
import { RevisionFotos, fotosIniciales, type FotoRevision } from '@/components/admin/RevisionFotos';

const GUARDADO = 'wm_subida_guia';
const fmt = (v: number | string | boolean) => (typeof v === 'boolean' ? (v ? 'Sí' : 'No') : typeof v === 'number' ? v.toLocaleString('es-CO') : v);

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
          priceEstimated: false,
          priceReasoningEs: 'Precio de la guía de subida.',
          priceConfidence: 1,
          // Lo escribió una persona del equipo con la ficha en la mano: confianza plena.
          facts: lectura.datos.map(d => ({ key: d.key, value: d.valor, confidence: 1, sourceTier: 1 })),
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
        <textarea
          id="guia"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={'Marca: Chevrolet\nModelo: Tracker RS\n…'}
          className="mt-3 h-72 w-full rounded-2xl border border-linea bg-papel p-4 font-mono text-[12.5px] text-tinta focus:border-wise focus:outline-none"
        />
      </section>

      {lectura && (
        <section className="rounded-[28px] border border-linea bg-blanco p-6">
          <h2 className="text-lg font-bold text-tinta">
            {id?.marca ?? '¿Marca?'} {id?.modelo ?? '¿Modelo?'} {id?.anio ?? ''}
          </h2>
          <p className="mt-1 text-sm text-tinta-2">
            {[id?.tren, id?.carroceria, id?.categoria, id?.precio ? `$${id.precio.toLocaleString('es-CO')}` : null].filter(Boolean).join(' · ') || 'Faltan los datos de identidad'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
            <span className="rounded-full bg-wise/10 px-3 py-1 text-wise">{lectura.datos.length} datos leídos</span>
            <span className="rounded-full bg-tarjeta px-3 py-1 text-tinta-2">{lectura.vacios.length} vacíos</span>
            {errores.length > 0 && <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">{errores.length} por corregir</span>}
          </div>

          {errores.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {errores.map((a, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] text-rose-700">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {a.linea ? <span className="font-mono text-rose-500">línea {a.linea} · </span> : null}
                    {a.texto}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {avisos.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {avisos.map((a, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {a.linea ? <span className="font-mono">línea {a.linea} · </span> : null}
                    {a.texto}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {lectura.datos.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wider text-tinta-2">
                    <th className="py-2 pr-3 font-medium">Campo</th>
                    <th className="py-2 pr-3 font-medium">Escribiste</th>
                    <th className="py-2 font-medium">Se guarda</th>
                  </tr>
                </thead>
                <tbody>
                  {lectura.datos.map(d => (
                    <tr key={d.key} className="border-b border-linea/60">
                      <td className="py-1.5 pr-3 text-tinta-2">{d.campo}</td>
                      <td className="py-1.5 pr-3 font-mono text-[12.5px] text-tinta-2">{d.escrito}</td>
                      <td className={`py-1.5 font-medium ${String(fmt(d.valor)) !== d.escrito ? 'text-wise' : 'text-tinta'}`}>{fmt(d.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lectura.vacios.length > 0 && (
            <details className="mt-4 text-[13px] text-tinta-2">
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
