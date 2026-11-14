'use client';

// ============================================================================
// Encuesta al terminar el recorrido guiado (nov-2026).
//
// Sale cuando la persona toca "Terminar" en el último paso (Recorrido.tsx
// llama a pedirEncuesta). Cuatro pantallas cortas: búsqueda con IA, la
// información y su orden, comparar y los me gusta, y lo general. Las notas
// son obligatorias; los comentarios, opcionales (salvo el "¿por qué?" cuando
// los me gusta fueron difíciles). Se guarda en /api/encuesta, una por cuenta.
// "Ahora no" la cierra y no vuelve a salir sola.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

const CLAVE = 'wm_encuesta'; // 'pendiente' | 'hecha' | 'saltada'
const EVENTO = 'wm-encuesta';

/** Pide la encuesta (al terminar el recorrido). Si ya la respondió o la saltó, no hace nada. */
export function pedirEncuesta() {
  try {
    const estado = localStorage.getItem(CLAVE);
    if (estado === 'hecha' || estado === 'saltada') return;
    localStorage.setItem(CLAVE, 'pendiente');
    window.dispatchEvent(new Event(EVENTO));
  } catch {}
}

function marcar(estado: 'hecha' | 'saltada') {
  try {
    localStorage.setItem(CLAVE, estado);
  } catch {}
}

interface Respuestas {
  busquedaIA: number | null;
  busquedaComentario: string;
  informacion: number | null;
  organizacion: number | null;
  organizacionComentario: string;
  comparacion: number | null;
  likesFacilidad: number | null;
  likesPorQue: string;
  rendimiento: number | null;
  diseno: number | null;
  comentarios: string;
}

const VACIAS: Respuestas = {
  busquedaIA: null,
  busquedaComentario: '',
  informacion: null,
  organizacion: null,
  organizacionComentario: '',
  comparacion: null,
  likesFacilidad: null,
  likesPorQue: '',
  rendimiento: null,
  diseno: null,
  comentarios: '',
};

const CALIDAD = ['Muy mala', 'Mala', 'Normal', 'Buena', 'Excelente'];
const FACILIDAD = ['Muy difícil', 'Difícil', 'Normal', 'Fácil', 'Muy fácil'];

function Nota10({ valor, onCambio, etiqueta }: { valor: number | null; onCambio: (n: number) => void; etiqueta: string }) {
  return (
    <div>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label={etiqueta}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            onClick={() => onCambio(n)}
            className={`cifra h-10 rounded-[10px] text-[14px] font-semibold transition-colors md:h-11 ${
              valor === n ? 'bg-wise text-white' : valor !== null && n < valor ? 'bg-wise/15 text-wise' : 'bg-tinta/[0.05] text-tinta hover:bg-tinta/10'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-tinta-2">
        <span>Muy mal</span>
        <span>Excelente</span>
      </div>
    </div>
  );
}

function Escala5({ valor, onCambio, opciones, etiqueta }: { valor: number | null; onCambio: (n: number) => void; opciones: string[]; etiqueta: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o, i) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === i + 1}
          onClick={() => onCambio(i + 1)}
          className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
            valor === i + 1 ? 'bg-wise text-white' : 'bg-tinta/[0.05] text-tinta hover:bg-tinta/10'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Pregunta({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{titulo}</p>
      {ayuda && <p className="mt-0.5 text-[13px] text-tinta-2">{ayuda}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Comentario({ valor, onCambio, placeholder, obligatorio = false }: { valor: string; onCambio: (t: string) => void; placeholder: string; obligatorio?: boolean }) {
  return (
    <textarea
      value={valor}
      onChange={e => onCambio(e.target.value)}
      placeholder={placeholder}
      maxLength={2000}
      rows={3}
      required={obligatorio}
      className="w-full resize-none rounded-[14px] border border-linea bg-blanco px-3.5 py-2.5 text-[14px] leading-relaxed outline-none transition-colors placeholder:text-tinta-2/70 focus:border-wise"
    />
  );
}

export function Encuesta() {
  const [abierta, setAbierta] = useState(false);
  const [paso, setPaso] = useState(0);
  const [r, setR] = useState<Respuestas>(VACIAS);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [gracias, setGracias] = useState(false);

  const revisar = useCallback(() => {
    try {
      if (localStorage.getItem(CLAVE) === 'pendiente') setAbierta(true);
    } catch {}
  }, []);

  useEffect(() => {
    revisar();
    window.addEventListener(EVENTO, revisar);
    return () => window.removeEventListener(EVENTO, revisar);
  }, [revisar]);

  if (!abierta) return null;

  const poner = <K extends keyof Respuestas>(k: K, v: Respuestas[K]) => setR(x => ({ ...x, [k]: v }));
  const likesDificil = r.likesFacilidad !== null && r.likesFacilidad <= 2;

  const pasos = [
    {
      titulo: 'La búsqueda con IA',
      listo: r.busquedaIA !== null,
      contenido: (
        <>
          <Pregunta titulo="¿Cuánto le das a la búsqueda con IA?" ayuda="De 1 a 10.">
            <Nota10 valor={r.busquedaIA} onCambio={n => poner('busquedaIA', n)} etiqueta="Nota de la búsqueda con IA" />
          </Pregunta>
          <Pregunta titulo="¿Algo que quieras contarnos de la búsqueda?" ayuda="Opcional.">
            <Comentario valor={r.busquedaComentario} onCambio={t => poner('busquedaComentario', t)} placeholder="Qué te gustó, qué no te encontró…" />
          </Pregunta>
        </>
      ),
    },
    {
      titulo: 'La información',
      listo: r.informacion !== null && r.organizacion !== null,
      contenido: (
        <>
          <Pregunta titulo="¿Cómo te pareció la información de los carros?">
            <Escala5 valor={r.informacion} onCambio={n => poner('informacion', n)} opciones={CALIDAD} etiqueta="Información" />
          </Pregunta>
          <Pregunta titulo="¿Cómo te pareció la organización?" ayuda="El orden en que está todo y cómo se ve.">
            <Escala5 valor={r.organizacion} onCambio={n => poner('organizacion', n)} opciones={CALIDAD} etiqueta="Organización" />
          </Pregunta>
          <Pregunta titulo="¿Algún comentario sobre la información o el orden?" ayuda="Opcional.">
            <Comentario valor={r.organizacionComentario} onCambio={t => poner('organizacionComentario', t)} placeholder="Algo que no encontraste, algo que sobra…" />
          </Pregunta>
        </>
      ),
    },
    {
      titulo: 'Comparar y los me gusta',
      listo: r.comparacion !== null && r.likesFacilidad !== null && (!likesDificil || r.likesPorQue.trim().length > 0),
      contenido: (
        <>
          <Pregunta titulo="¿Cómo te pareció la comparación entre carros?">
            <Escala5 valor={r.comparacion} onCambio={n => poner('comparacion', n)} opciones={CALIDAD} etiqueta="Comparación" />
          </Pregunta>
          <Pregunta titulo="¿Qué tan fácil fue entender los me gusta?">
            <Escala5 valor={r.likesFacilidad} onCambio={n => poner('likesFacilidad', n)} opciones={FACILIDAD} etiqueta="Facilidad de los me gusta" />
          </Pregunta>
          {likesDificil && (
            <Pregunta titulo="¿Por qué fue difícil?">
              <Comentario valor={r.likesPorQue} onCambio={t => poner('likesPorQue', t)} placeholder="Cuéntanos qué te confundió" obligatorio />
            </Pregunta>
          )}
        </>
      ),
    },
    {
      titulo: 'En general',
      listo: r.rendimiento !== null && r.diseno !== null,
      contenido: (
        <>
          <Pregunta titulo="¿Cuánto le das a la página en rendimiento general?" ayuda="Qué tan rápida y estable se sintió, de 1 a 10.">
            <Nota10 valor={r.rendimiento} onCambio={n => poner('rendimiento', n)} etiqueta="Nota de rendimiento" />
          </Pregunta>
          <Pregunta titulo="¿Cuánto le das al diseño y al funcionamiento?" ayuda="De 1 a 10.">
            <Nota10 valor={r.diseno} onCambio={n => poner('diseno', n)} etiqueta="Nota de diseño y funcionamiento" />
          </Pregunta>
          <Pregunta titulo="Comentarios generales" ayuda="Opcional.">
            <Comentario valor={r.comentarios} onCambio={t => poner('comentarios', t)} placeholder="Lo que quieras decirnos" />
          </Pregunta>
        </>
      ),
    },
  ];
  const actual = pasos[paso];
  const ultimo = paso === pasos.length - 1;

  const cerrar = () => {
    if (!gracias) marcar('saltada');
    setAbierta(false);
  };

  async function enviar() {
    setEnviando(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/encuesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(r),
      });
      const d = await res.json().catch(() => null);
      if (res.status === 401) throw new Error('Inicia sesión para enviar la encuesta.');
      if (!res.ok) throw new Error(d?.error ?? 'No se pudo enviar. Intenta otra vez.');
      marcar('hecha');
      setGracias(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar. Intenta otra vez.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-tinta/40 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={cerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Encuesta"
        onClick={e => e.stopPropagation()}
        className="sube flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-t-[28px] bg-blanco shadow-[0_24px_60px_-20px_rgba(14,12,17,0.55)] sm:rounded-[28px]"
      >
        {gracias ? (
          <div className="p-6 text-center md:p-8">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wise text-white">
              <Check className="h-6 w-6" />
            </span>
            <p className="mt-4 text-[22px] font-semibold tracking-[-0.03em]">¡Gracias!</p>
            <p className="mx-auto mt-2 max-w-[36ch] text-[14.5px] leading-relaxed text-tinta-2">
              Tus respuestas nos ayudan a mejorar WiseMotors antes de abrirlo a todo el mundo.
            </p>
            <button onClick={() => setAbierta(false)} className="pastilla pastilla--wise mt-6 h-11 px-6 text-[14px]">
              Seguir explorando
            </button>
          </div>
        ) : (
          <>
            <div className="shrink-0 px-5 pt-5 md:px-7 md:pt-7">
              <div className="flex items-start justify-between gap-3">
                <p className="t-meta text-wise">
                  Encuesta · {paso + 1} de {pasos.length}
                </p>
                <button onClick={cerrar} aria-label="Cerrar la encuesta" className="-m-1 rounded-full p-1 text-tinta-2 hover:text-tinta">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {paso === 0 && <p className="mt-2 text-[14px] text-tinta-2">Terminaste el recorrido. Cuéntanos qué te pareció: son 2 minutos.</p>}
              <p className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em]">{actual.titulo}</p>
              <div className="mt-3 flex gap-1" aria-hidden>
                {pasos.map((_, i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= paso ? 'bg-wise' : 'bg-tinta/10'}`} />
                ))}
              </div>
            </div>
            <div key={paso} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
              {actual.contenido}
            </div>
            <div className="shrink-0 border-t border-linea px-5 py-4 md:px-7">
              {error && <p className="mb-3 rounded-xl bg-red-50 p-2.5 text-[13px] text-red-700">{error}</p>}
              <div className="flex items-center justify-between gap-3">
                {paso === 0 ? (
                  <button onClick={cerrar} className="text-[13px] text-tinta-2 hover:text-tinta">
                    Ahora no
                  </button>
                ) : (
                  <button onClick={() => setPaso(p => p - 1)} className="text-[13px] text-tinta-2 hover:text-tinta">
                    Atrás
                  </button>
                )}
                <button
                  onClick={ultimo ? enviar : () => setPaso(p => p + 1)}
                  disabled={!actual.listo || enviando}
                  className="pastilla pastilla--wise h-11 px-6 text-[14px] disabled:opacity-40"
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : ultimo ? 'Enviar' : 'Siguiente'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
