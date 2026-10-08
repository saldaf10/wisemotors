'use client';

// ============================================================================
// Revisión de fotos en la ingesta: SEIS vistas fijas (lateral, frontal,
// trasera, 3/4 delantera, 3/4 trasera, interior). Cada vista muestra la foto
// elegida —la que subió el equipo, ya procesada: sin fondo,
// recortada— o queda vacía para subirla. Debajo, las demás candidatas: se
// pueden usar para cualquier vista.
// La lateral es la portada por defecto.
// ============================================================================

import { useState } from 'react';
import { AlertTriangle, ExternalLink, FlipHorizontal2, ImagePlus, Loader2, Star, X } from 'lucide-react';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';

export interface FotoRevision {
  original: string;
  pagina: string;
  oficial: boolean;
  angulo: string;
  miraA: string;
  estudio: boolean;
  calidad: number;
  recomendada: boolean;
  procesada?: string;
  publicId?: string;
  recortada?: boolean;
  volteada?: boolean;
  error?: string;
  // Estado de la revisión
  /** publicIds de versiones anteriores (antes de voltear): se borran al publicar. */
  anteriores?: string[];
  usar: boolean;
  portada: boolean;
  procesando?: boolean;
}

export const VISTAS: { angulo: string; etiqueta: string }[] = [
  { angulo: 'lado', etiqueta: 'Lateral' },
  { angulo: 'frente', etiqueta: 'Frontal' },
  { angulo: 'atras', etiqueta: 'Trasera' },
  { angulo: 'tres_cuartos_frente', etiqueta: '3/4 delantera' },
  { angulo: 'tres_cuartos_atras', etiqueta: '3/4 trasera' },
  { angulo: 'interior', etiqueta: 'Interior' },
];
const ETIQUETA: Record<string, string> = { ...Object.fromEntries(VISTAS.map(v => [v.angulo, v.etiqueta])), detalle: 'Detalle' };

/** Estado inicial: una foto por vista (la recomendada); portada = la lateral o la primera. */
export function fotosIniciales(fotos: Omit<FotoRevision, 'usar' | 'portada'>[] | undefined): FotoRevision[] {
  const ocupadas = new Set<string>();
  const lista = (fotos ?? []).map(f => {
    const usar = f.recomendada && !f.error && !ocupadas.has(f.angulo);
    if (usar) ocupadas.add(f.angulo);
    return { ...f, usar, portada: false };
  });
  const portada = lista.find(f => f.usar && f.angulo === 'lado') ?? lista.find(f => f.usar);
  if (portada) portada.portada = true;
  return lista;
}

/** Reduce la foto a 2400 px en JPEG antes de subirla (el límite de Vercel es ~4,5 MB). */
async function reducir(f: File): Promise<File> {
  const bitmap = await createImageBitmap(f).catch(() => null);
  if (!bitmap) return f;
  const escala = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  if (escala === 1 && f.size < 3.5 * 1024 * 1024) return f;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
  return blob ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
}

/** Sube una foto del concesionario para una vista; vuelve procesada y lista para usar. */
export async function subirFotoVista(archivo: File, angulo: string): Promise<FotoRevision> {
  const form = new FormData();
  form.set('archivo', await reducir(archivo));
  form.set('angulo', angulo);
  const res = await adminFetch('/api/admin/ingest/foto', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(mensajeDeErrorDeAuth(res) ?? data.error ?? 'No se pudo subir la foto');
  return { ...data, usar: true, portada: false };
}

function ElegirArchivo({ onArchivo, children, className }: { onArchivo: (f: File) => void; children: React.ReactNode; className: string }) {
  return (
    <label className={`cursor-pointer ${className}`}>
      {children}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onArchivo(f);
        }}
      />
    </label>
  );
}

export function RevisionFotos({
  fotos,
  onChange,
}: {
  fotos: FotoRevision[];
  onChange: React.Dispatch<React.SetStateAction<FotoRevision[]>>;
}) {
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [errorVista, setErrorVista] = useState<Record<string, string>>({});
  const candidatas = fotos.filter(f => !f.usar);
  const llenas = VISTAS.filter(v => fotos.some(f => f.usar && f.angulo === v.angulo)).length;

  const cambiar = (original: string, cambio: Partial<FotoRevision>, base: FotoRevision[]) =>
    base.map(f => (f.original === original ? { ...f, ...cambio } : f));

  /** Siempre hay una portada entre las que se usan: la lateral o la primera. */
  const conPortada = (base: FotoRevision[]) => {
    if (base.some(f => f.portada && f.usar)) return base;
    const p = base.find(f => f.usar && f.angulo === 'lado') ?? base.find(f => f.usar);
    return p ? cambiar(p.original, { portada: true }, base) : base;
  };
  /** Deja `original` como la única foto usada de su vista. */
  const ocupar = (base: FotoRevision[], original: string, angulo: string) =>
    conPortada(base.map(f => (f.usar && f.angulo === angulo && f.original !== original ? { ...f, usar: false, portada: false } : f)));

  async function subir(angulo: string, archivo: File) {
    setSubiendo(angulo);
    setErrorVista(e => ({ ...e, [angulo]: '' }));
    try {
      const nueva = await subirFotoVista(archivo, angulo);
      onChange(prev => {
        // La lateral nueva pasa a ser la portada.
        const base = angulo === 'lado' ? [...prev, nueva].map(f => ({ ...f, portada: f.original === nueva.original })) : [...prev, nueva];
        return ocupar(base, nueva.original, angulo);
      });
    } catch (err) {
      setErrorVista(e => ({ ...e, [angulo]: err instanceof Error ? err.message : 'Error' }));
    } finally {
      setSubiendo(null);
    }
  }

  function quitar(f: FotoRevision) {
    onChange(prev => conPortada(cambiar(f.original, { usar: false, portada: false }, prev)));
  }

  /** Usa una candidata para una vista: si cambia el ángulo o no estaba procesada, se procesa. */
  async function usarComo(f: FotoRevision, angulo: string) {
    if (f.procesada && f.angulo === angulo) {
      onChange(prev => ocupar(cambiar(f.original, { usar: true }, prev), f.original, angulo));
      return;
    }
    onChange(prev => ocupar(cambiar(f.original, { usar: true, angulo, procesando: true, error: undefined }, prev), f.original, angulo));
    try {
      const res = await adminFetch('/api/admin/ingest/foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: f.original, angulo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo procesar');
      const anteriores = [...(f.anteriores ?? []), ...(f.publicId ? [f.publicId] : [])];
      onChange(prev => cambiar(f.original, { ...data, anteriores, procesando: false }, prev));
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error';
      onChange(prev => conPortada(cambiar(f.original, { usar: false, portada: false, procesando: false, error }, prev)));
    }
  }

  /** Vuelve a procesar la foto en espejo: las de lado deben mirar a la derecha. */
  async function voltear(f: FotoRevision) {
    onChange(prev => cambiar(f.original, { procesando: true, error: undefined }, prev));
    try {
      const res = await adminFetch('/api/admin/ingest/foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: f.original, angulo: f.angulo, voltear: !f.volteada }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo voltear');
      if (data.procesada === f.procesada) throw new Error('Voltear necesita Cloudinary configurado');
      const anteriores = [...(f.anteriores ?? []), ...(f.publicId ? [f.publicId] : [])];
      onChange(prev => cambiar(f.original, { ...data, anteriores, procesando: false }, prev));
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error';
      onChange(prev => cambiar(f.original, { procesando: false, error }, prev));
    }
  }

  function hacerPortada(f: FotoRevision) {
    onChange(prev => prev.map(x => ({ ...x, portada: x.original === f.original })));
  }

  return (
    <div className="bg-blanco rounded-[28px] border border-linea p-6">
      <h3 className="font-bold text-tinta">Fotos: {llenas} de 6 vistas</h3>
      <p className="mt-1 text-sm text-tinta-2">
        Sube una foto por vista o cámbiala. La marcada con ★ es la
        portada; las de lado deben mirar a la derecha (si no, voltéala).
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        {VISTAS.map(v => {
          const f = fotos.find(x => x.usar && x.angulo === v.angulo);
          const ocupado = subiendo === v.angulo || f?.procesando;
          return (
            <div key={v.angulo} className={`overflow-hidden rounded-[20px] border ${f ? 'border-wise' : 'border-dashed border-linea'}`}>
              <div className="relative flex aspect-[4/3] items-center justify-center bg-white p-2">
                {f ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.procesada ?? f.original} alt={v.etiqueta} className="max-h-full max-w-full object-contain" loading="lazy" />
                ) : (
                  <ElegirArchivo onArchivo={a => subir(v.angulo, a)} className="flex h-full w-full flex-col items-center justify-center gap-2 text-tinta-2 hover:text-wise">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[13px]">Subir foto</span>
                  </ElegirArchivo>
                )}
                {ocupado && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="h-5 w-5 animate-spin text-wise" />
                  </div>
                )}
                {f?.portada && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-wise px-2 py-0.5 text-[11px] font-medium text-white">
                    <Star className="h-3 w-3" /> Portada
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 p-3">
                <span className="mr-auto text-[13px] font-semibold">{v.etiqueta}</span>
                {f && f.pagina === 'concesionario' && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-800">Concesionario</span>}
                
                {f && !ocupado && (
                  <>
                    {f.angulo !== 'interior' && (
                      <button onClick={() => voltear(f)} className="h-8 rounded-full border border-linea px-2 hover:border-tinta" title="Voltear (el carro debe mirar a la derecha)">
                        <FlipHorizontal2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!f.portada && (
                      <button onClick={() => hacerPortada(f)} className="h-8 rounded-full border border-linea px-2 hover:border-tinta" title="Hacer portada">
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <ElegirArchivo onArchivo={a => subir(v.angulo, a)} className="flex h-8 items-center rounded-full border border-linea px-2 hover:border-tinta">
                      <ImagePlus className="h-3.5 w-3.5" aria-label="Reemplazar con otra foto" />
                    </ElegirArchivo>
                    <button onClick={() => quitar(f)} className="h-8 rounded-full border border-linea px-2 hover:border-tinta" title="Quitar">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {(errorVista[v.angulo] || f?.error) && (
                  <p className="flex w-full items-start gap-1 text-[12px] text-rose-700">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {errorVista[v.angulo] || f?.error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {candidatas.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-wise hover:underline">Otras {candidatas.length} fotos</summary>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {candidatas.map(f => (
              <div key={f.original} className="overflow-hidden rounded-[20px] border border-linea">
                <div className="relative flex aspect-[4/3] items-center justify-center bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.procesada ?? f.original} alt={ETIQUETA[f.angulo] ?? f.angulo} className="max-h-full max-w-full object-contain" loading="lazy" />
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-tarjeta px-2 py-0.5">{ETIQUETA[f.angulo] ?? f.angulo}</span>
                    <a href={f.pagina} target="_blank" rel="noopener noreferrer" className="ml-auto text-tinta-2 hover:text-tinta" title="Página de origen">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {f.error && <p className="text-[12px] text-rose-700">{f.error}</p>}
                  <select
                    value=""
                    onChange={e => e.target.value && usarComo(f, e.target.value)}
                    className="h-8 w-full rounded-full border border-linea bg-blanco px-3 text-[12px]"
                    aria-label="Usar esta foto como"
                  >
                    <option value="">Usar como…</option>
                    {VISTAS.map(v => (
                      <option key={v.angulo} value={v.angulo}>
                        {v.etiqueta}
                        {fotos.some(x => x.usar && x.angulo === v.angulo) ? ' (reemplaza)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

