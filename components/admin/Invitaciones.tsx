'use client';

// ============================================================================
// Códigos de invitación (nov-2026): cuáles quedan, a quién se le entregó cada
// uno y quién lo usó. Cada código se puede mandar como enlace
// (wisemotors.co/?codigo=…): la bienvenida llega con el código ya escrito.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2, Plus } from 'lucide-react';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';

interface Codigo {
  codigo: string;
  numero: number;
  nota: string | null;
  enlace: string;
  usadoEn: string | null;
  nombre: string | null;
  email: string | null;
}

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
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
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-tinta-2 hover:bg-tinta/5 hover:text-tinta"
    >
      {hecho ? <Check className="h-3.5 w-3.5 text-wise" /> : <Copy className="h-3.5 w-3.5" />} {etiqueta}
    </button>
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
  const [datos, setDatos] = useState<{ total: number; usados: number; lista: Codigo[] } | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'libres' | 'usados'>('todos');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const r = await adminFetch('/api/admin/invitaciones');
    const d = await r.json().catch(() => null);
    if (!r.ok) setError(mensajeDeErrorDeAuth(r) ?? d?.error ?? 'No se pudieron cargar');
    else setDatos(d);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function descargar() {
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

  async function generar() {
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

  const lista = datos.lista.filter(c => (filtro === 'libres' ? !c.usadoEn : filtro === 'usados' ? !!c.usadoEn : true));

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.03em]">Invitaciones</h2>
          <p className="text-[13px] text-tinta-2">
            {datos.usados} de {datos.total} usadas · {datos.total - datos.usados} libres. Cada código sirve una vez; el enlace llega con el código escrito.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={generar} disabled={ocupado} className="pastilla h-11 px-4 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Más códigos
          </button>
          <button type="button" onClick={descargar} disabled={ocupado} className="pastilla h-11 px-4 disabled:opacity-50">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      <div className="mt-5 flex gap-1.5">
        {(['todos', 'libres', 'usados'] as const).map(f => (
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
                <td className="px-4 py-2 font-mono font-medium tracking-[0.06em]">{c.codigo}</td>
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
                  ) : (
                    <span className="rounded-full bg-tinta/5 px-2 py-0.5 text-[12px] text-tinta-2">Libre</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {!c.usadoEn && (
                    <>
                      <Copiar texto={c.codigo} etiqueta="Código" />
                      <Copiar texto={c.enlace} etiqueta="Enlace" />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
