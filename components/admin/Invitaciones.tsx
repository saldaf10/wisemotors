'use client';

// ============================================================================
// Invitaciones (nov-2026). "Generar invitación": se escribe el nombre de la
// persona, se le aparta el primer código libre y sale la invitación como imagen
// (PNG de 1080×1350, lib/invitacion-imagen.ts) para mandarla por WhatsApp.
// Debajo, todos los códigos: libres, entregados (con nombre) y usados.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Image as Imagen, Loader2, Plus, Share2, Ticket, X } from 'lucide-react';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';
import { formatearCodigo } from '@/lib/invitaciones-formato';
import { dibujarInvitacion, pngDeCanvas, type DatosInvitacion } from '@/lib/invitacion-imagen';

interface Codigo {
  codigo: string;
  numero: number;
  nota: string | null;
  enlace: string;
  usadoEn: string | null;
  nombre: string | null;
  email: string | null;
}

const enlaceDe = (codigo: string) => `https://wisemotors.co/?codigo=${codigo}`;
const archivoDe = (d: DatosInvitacion) =>
  `invitacion-wisemotors-${String(d.numero).padStart(3, '0')}-${d.nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;

function Copiar({ texto, etiqueta, grande = false }: { texto: string; etiqueta: string; grande?: boolean }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setHecho(true);
          setTimeout(() => setHecho(false), 1500);
        } catch {}
      }}
      className={
        grande
          ? 'pastilla h-11 px-4 text-[14px]'
          : 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-tinta-2 hover:bg-tinta/5 hover:text-tinta'
      }
    >
      {hecho ? <Check className="h-3.5 w-3.5 text-wise" /> : <Copy className="h-3.5 w-3.5" />} {hecho ? 'Copiado' : etiqueta}
    </button>
  );
}

/** Ventana para generar (o volver a sacar) la invitación de una persona. */
function GenerarInvitacion({ inicial, onCerrar, onCambio }: { inicial: DatosInvitacion | null; onCerrar: () => void; onCambio: () => void }) {
  const [nombre, setNombre] = useState('');
  const [datos, setDatos] = useState<DatosInvitacion | null>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [png, setPng] = useState<Blob | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!datos || !canvas.current) return;
    let vivo = true;
    setPng(null);
    dibujarInvitacion(canvas.current, datos)
      .then(() => pngDeCanvas(canvas.current!))
      .then(b => vivo && setPng(b))
      .catch(() => vivo && setError('No se pudo dibujar la imagen.'));
    return () => {
      vivo = false;
    };
  }, [datos]);

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOcupado(true);
    try {
      const r = await adminFetch('/api/admin/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(mensajeDeErrorDeAuth(r) ?? d?.error ?? 'No se pudo generar.');
      setDatos({ nombre: d.nombre, codigo: d.codigo, numero: d.numero, total: d.total });
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar.');
    } finally {
      setOcupado(false);
    }
  }

  const descargar = () => {
    if (!png || !datos) return;
    const url = URL.createObjectURL(png);
    const a = document.createElement('a');
    a.href = url;
    a.download = archivoDe(datos);
    a.click();
    URL.revokeObjectURL(url);
  };

  // En el celular: compartir directo a WhatsApp con la imagen y el enlace.
  const archivo = png && datos ? new File([png], archivoDe(datos), { type: 'image/png' }) : null;
  const puedeCompartir = !!archivo && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [archivo] });
  const compartir = async () => {
    if (!archivo || !datos) return;
    try {
      await navigator.share({
        files: [archivo],
        text: `${datos.nombre}, te invito a WiseMotors. Tu código: ${formatearCodigo(datos.codigo)} · ${enlaceDe(datos.codigo)}`,
      });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-tinta/40 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Generar invitación"
        onClick={e => e.stopPropagation()}
        className="sube flex max-h-[94dvh] w-full max-w-[880px] flex-col overflow-y-auto rounded-t-[28px] bg-blanco p-5 shadow-2xl sm:rounded-[28px] md:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="t-meta text-wise">Invitación</p>
            <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">
              {datos ? `Invitación de ${datos.nombre}` : 'Generar invitación'}
            </h3>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="-m-1 rounded-full p-1 text-tinta-2 hover:text-tinta">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!datos ? (
          <form onSubmit={generar} className="mt-5">
            <label className="block text-[14px] font-medium">
              Nombre de la persona
              <input
                autoFocus
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                maxLength={40}
                placeholder="Ej.: Laura"
                className="mt-2 h-12 w-full rounded-[14px] border border-linea px-4 text-[16px] outline-none focus:border-wise"
              />
            </label>
            <p className="mt-2 text-[13px] text-tinta-2">Sale en grande en la invitación. Se le aparta el siguiente código libre.</p>
            {error && <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-[13px] text-red-700">{error}</p>}
            <button type="submit" disabled={ocupado || nombre.trim().length < 2} className="pastilla pastilla--wise mt-5 h-11 px-6 text-[14px] disabled:opacity-40">
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Ticket className="h-4 w-4" /> Generar invitación</>}
            </button>
          </form>
        ) : (
          <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,360px)_1fr]">
            <div className="overflow-hidden rounded-[18px] bg-showroom ring-1 ring-linea">
              <canvas ref={canvas} className="block h-auto w-full" aria-label={`Invitación de ${datos.nombre}`} />
            </div>
            <div>
              <dl className="space-y-3 text-[14px]">
                <div>
                  <dt className="text-tinta-2">Código</dt>
                  <dd className="font-mono text-[28px] font-medium tracking-[0.12em]">{formatearCodigo(datos.codigo)}</dd>
                </div>
                <div>
                  <dt className="text-tinta-2">Invitación</dt>
                  <dd className="font-semibold">
                    #{String(datos.numero).padStart(3, '0')} de {datos.total}
                  </dd>
                </div>
                <div>
                  <dt className="text-tinta-2">Enlace (llega con el código escrito)</dt>
                  <dd className="break-all text-[13px]">{enlaceDe(datos.codigo)}</dd>
                </div>
              </dl>
              {error && <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-[13px] text-red-700">{error}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={descargar} disabled={!png} className="pastilla pastilla--wise h-11 px-5 text-[14px] disabled:opacity-40">
                  {png ? <Download className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />} Descargar imagen
                </button>
                {puedeCompartir && (
                  <button onClick={compartir} className="pastilla h-11 px-4 text-[14px]">
                    <Share2 className="h-4 w-4" /> Compartir
                  </button>
                )}
                <Copiar texto={enlaceDe(datos.codigo)} etiqueta="Copiar enlace" grande />
              </div>
              <button
                onClick={() => {
                  setDatos(null);
                  setNombre('');
                  setError('');
                }}
                className="mt-5 text-[13px] font-medium text-wise hover:underline"
              >
                + Otra invitación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Nota({ c, onGuardada }: { c: Codigo; onGuardada: () => void }) {
  const [valor, setValor] = useState(c.nota ?? '');
  useEffect(() => setValor(c.nota ?? ''), [c.nota]);
  const guardar = async () => {
    if ((c.nota ?? '') === valor.trim()) return;
    await adminFetch('/api/admin/invitaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: c.codigo, nota: valor }),
    });
    onGuardada();
  };
  return (
    <input
      value={valor}
      onChange={e => setValor(e.target.value)}
      onBlur={guardar}
      onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder="¿A quién se lo diste?"
      className="h-8 w-full min-w-[140px] rounded-lg border border-transparent bg-transparent px-2 text-[13px] outline-none hover:border-linea focus:border-wise"
    />
  );
}

export function Invitaciones() {
  const [datos, setDatos] = useState<{ total: number; usados: number; entregados: number; lista: Codigo[] } | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'libres' | 'entregados' | 'usados'>('todos');
  const [ocupado, setOcupado] = useState(false);
  // null = cerrada; 'nueva' = pedir nombre; datos = volver a sacar la de alguien.
  const [ventana, setVentana] = useState<'nueva' | DatosInvitacion | null>(null);

  const cargar = useCallback(async () => {
    const r = await adminFetch('/api/admin/invitaciones');
    const d = await r.json().catch(() => null);
    if (!r.ok) setError(mensajeDeErrorDeAuth(r) ?? d?.error ?? 'No se pudieron cargar');
    else setDatos(d);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function descargarCsv() {
    setOcupado(true);
    try {
      const r = await adminFetch('/api/admin/invitaciones?formato=csv');
      if (!r.ok) throw new Error(mensajeDeErrorDeAuth(r) ?? 'No se pudo descargar.');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `invitaciones-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo descargar.');
    } finally {
      setOcupado(false);
    }
  }

  async function masCodigos() {
    const n = Number(prompt('¿Cuántos códigos nuevos?', '10'));
    if (!(n >= 1 && n <= 500)) return;
    setOcupado(true);
    try {
      await adminFetch('/api/admin/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad: Math.floor(n) }),
      });
      await cargar();
    } finally {
      setOcupado(false);
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

  const libres = datos.total - datos.usados - datos.entregados;
  const lista = datos.lista.filter(c =>
    filtro === 'libres' ? !c.usadoEn && !c.nota : filtro === 'entregados' ? !c.usadoEn && !!c.nota : filtro === 'usados' ? !!c.usadoEn : true
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.03em]">Invitaciones</h2>
          <p className="text-[13px] text-tinta-2">
            {datos.usados} usadas · {datos.entregados} entregadas sin usar · {libres} libres, de {datos.total}. Cada código sirve una vez.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setVentana('nueva')} className="pastilla pastilla--wise h-11 px-5">
            <Ticket className="h-4 w-4" /> Generar invitación
          </button>
          <button type="button" onClick={masCodigos} disabled={ocupado} className="pastilla h-11 px-4 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Más códigos
          </button>
          <button type="button" onClick={descargarCsv} disabled={ocupado} className="pastilla h-11 px-4 disabled:opacity-50">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {(['todos', 'libres', 'entregados', 'usados'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] capitalize ${filtro === f ? 'bg-tinta text-white' : 'bg-tinta/5 text-tinta-2 hover:bg-tinta/10'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-[20px] bg-blanco ring-1 ring-linea">
        <table className="w-full text-left text-[13.5px]">
          <thead className="border-b border-linea text-[12px] text-tinta-2">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Entregado a</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {lista.map(c => (
              <tr key={c.codigo}>
                <td className="cifra px-4 py-2 text-tinta-2">{String(c.numero).padStart(3, '0')}</td>
                <td className="whitespace-nowrap px-4 py-2 font-mono font-medium tracking-[0.08em]">{formatearCodigo(c.codigo)}</td>
                <td className="px-2 py-1">
                  <Nota c={c} onGuardada={cargar} />
                </td>
                <td className="px-4 py-2">
                  {c.usadoEn ? (
                    <span>
                      <span className="rounded-full bg-wise/10 px-2 py-0.5 text-[12px] font-medium text-wise">Usado</span>{' '}
                      <span className="text-tinta-2">
                        {c.nombre} · {c.email} · {new Date(c.usadoEn).toLocaleDateString('es-CO')}
                      </span>
                    </span>
                  ) : c.nota ? (
                    <span className="rounded-full bg-version/25 px-2 py-0.5 text-[12px] font-medium text-version-oscuro">Entregado</span>
                  ) : (
                    <span className="rounded-full bg-tinta/5 px-2 py-0.5 text-[12px] text-tinta-2">Libre</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {!c.usadoEn && c.nota && (
                    <button
                      type="button"
                      onClick={() => setVentana({ nombre: c.nota!, codigo: c.codigo, numero: c.numero, total: datos.total })}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-tinta-2 hover:bg-tinta/5 hover:text-tinta"
                    >
                      <Imagen className="h-3.5 w-3.5" /> Invitación
                    </button>
                  )}
                  {!c.usadoEn && <Copiar texto={c.enlace} etiqueta="Enlace" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ventana && (
        <GenerarInvitacion inicial={ventana === 'nueva' ? null : ventana} onCerrar={() => setVentana(null)} onCambio={cargar} />
      )}
    </div>
  );
}
