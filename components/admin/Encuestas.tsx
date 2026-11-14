'use client';

// ============================================================================
// Encuesta del recorrido guiado (nov-2026): promedios de cada pregunta, cómo se
// reparten las respuestas y lo que escribió cada persona. CSV con todo.
// ============================================================================

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';

interface Pregunta {
  promedio: number | null;
  reparto: number[];
}
interface Fila {
  id: string;
  updatedAt: string;
  nombre: string | null;
  email: string | null;
  busquedaIA: number;
  busquedaComentario: string | null;
  informacion: number;
  organizacion: number;
  organizacionComentario: string | null;
  comparacion: number;
  likesFacilidad: number;
  likesPorQue: string | null;
  rendimiento: number;
  diseno: number;
  comentarios: string | null;
}
interface Datos {
  total: number;
  resumen: Record<string, Pregunta>;
  lista: Fila[];
}

const CALIDAD = ['Muy mala', 'Mala', 'Normal', 'Buena', 'Excelente'];
const FACILIDAD = ['Muy difícil', 'Difícil', 'Normal', 'Fácil', 'Muy fácil'];

const PREGUNTAS: { clave: string; texto: string; max: 5 | 10; etiquetas?: string[] }[] = [
  { clave: 'busquedaIA', texto: 'Búsqueda con IA', max: 10 },
  { clave: 'informacion', texto: 'Información de los carros', max: 5, etiquetas: CALIDAD },
  { clave: 'organizacion', texto: 'Organización (orden y cómo se ve)', max: 5, etiquetas: CALIDAD },
  { clave: 'comparacion', texto: 'Comparación entre carros', max: 5, etiquetas: CALIDAD },
  { clave: 'likesFacilidad', texto: 'Qué tan fácil fueron los me gusta', max: 5, etiquetas: FACILIDAD },
  { clave: 'rendimiento', texto: 'Rendimiento general', max: 10 },
  { clave: 'diseno', texto: 'Diseño y funcionamiento', max: 10 },
];

function Resumen({ p, max, etiquetas, texto }: { p: Pregunta; max: number; etiquetas?: string[]; texto: string }) {
  const tope = Math.max(1, ...p.reparto);
  return (
    <div className="rounded-[20px] bg-blanco p-5 ring-1 ring-linea">
      <p className="text-[13px] text-tinta-2">{texto}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="cifra text-[32px] font-semibold leading-none tracking-[-0.04em]">
          {p.promedio === null ? '—' : new Intl.NumberFormat('es-CO').format(p.promedio)}
        </span>
        <span className="text-[13px] text-tinta-2">de {max}</span>
      </p>
      <div className="mt-4 flex h-16 items-end gap-1" aria-hidden>
        {p.reparto.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-t-[4px] bg-wise/80" style={{ height: `${(n / tope) * 48}px`, minHeight: n ? 3 : 0 }} />
            <span className="text-[10px] text-tinta-2">{etiquetas ? etiquetas[i].split(' ').map(w => w[0]).join('') : i + 1}</span>
          </div>
        ))}
      </div>
      {etiquetas && <p className="mt-2 text-[10.5px] leading-snug text-tinta-2/80">{etiquetas.join(' · ')}</p>}
    </div>
  );
}

export function Encuestas() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    adminFetch('/api/admin/encuestas')
      .then(async r => {
        const d = await r.json().catch(() => null);
        if (!r.ok) setError(mensajeDeErrorDeAuth(r) ?? d?.error ?? 'No se pudieron cargar');
        else setDatos(d);
      })
      .catch(() => setError('No se pudieron cargar'));
  }, []);

  async function descargar() {
    setBajando(true);
    try {
      const r = await adminFetch('/api/admin/encuestas?formato=csv');
      if (!r.ok) throw new Error(mensajeDeErrorDeAuth(r) ?? 'No se pudo descargar.');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `encuesta-recorrido-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo descargar.');
    } finally {
      setBajando(false);
    }
  }

  if (error) return <p className="m-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!datos) {
    return (
      <div className="flex items-center gap-2 p-8 text-tinta-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const comentarios = (f: Fila) =>
    [
      ['Búsqueda', f.busquedaComentario],
      ['Información y orden', f.organizacionComentario],
      ['Por qué los me gusta fueron difíciles', f.likesPorQue],
      ['General', f.comentarios],
    ].filter((x): x is [string, string] => !!x[1]);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.03em]">Encuesta del recorrido</h2>
          <p className="text-[13px] text-tinta-2">
            {datos.total === 1 ? '1 respuesta' : `${datos.total} respuestas`}. Sale al terminar el recorrido guiado; una por cuenta.
          </p>
        </div>
        <button type="button" onClick={descargar} disabled={bajando || !datos.total} className="pastilla h-11 px-5 disabled:opacity-50">
          <Download className="h-4 w-4" /> {bajando ? 'Descargando…' : 'Descargar CSV'}
        </button>
      </div>

      {datos.total === 0 ? (
        <p className="mt-8 text-[14px] text-tinta-2">Todavía nadie la ha respondido.</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PREGUNTAS.map(q => (
              <Resumen key={q.clave} p={datos.resumen[q.clave]} max={q.max} etiquetas={q.etiquetas} texto={q.texto} />
            ))}
          </div>

          <h3 className="mt-8 text-[15px] font-semibold">Respuestas</h3>
          <ul className="mt-3 space-y-3">
            {datos.lista.map(f => (
              <li key={f.id} className="rounded-[20px] bg-blanco p-5 ring-1 ring-linea">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold">
                    {f.nombre ?? 'Sin nombre'} <span className="font-normal text-tinta-2">{f.email}</span>
                  </p>
                  <p className="text-[12px] text-tinta-2">{new Date(f.updatedAt).toLocaleDateString('es-CO')}</p>
                </div>
                <p className="mt-2 text-[13px] text-tinta-2">
                  IA <b className="text-tinta">{f.busquedaIA}/10</b> · Info <b className="text-tinta">{CALIDAD[f.informacion - 1]}</b> · Orden{' '}
                  <b className="text-tinta">{CALIDAD[f.organizacion - 1]}</b> · Comparar <b className="text-tinta">{CALIDAD[f.comparacion - 1]}</b> · Me gusta{' '}
                  <b className="text-tinta">{FACILIDAD[f.likesFacilidad - 1]}</b> · Rendimiento <b className="text-tinta">{f.rendimiento}/10</b> · Diseño{' '}
                  <b className="text-tinta">{f.diseno}/10</b>
                </p>
                {comentarios(f).length > 0 && (
                  <dl className="mt-3 space-y-2 border-t border-linea pt-3">
                    {comentarios(f).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[12px] text-tinta-2">{k}</dt>
                        <dd className="whitespace-pre-line text-[14px] leading-relaxed">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
