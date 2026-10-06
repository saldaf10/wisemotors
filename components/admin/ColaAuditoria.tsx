'use client';

// ============================================================================
// Cola de auditoría: lo publicado que necesita una segunda mirada humana
// (sin revisor, confianza baja, fuente de comunidad) y los precios estimados.
// Un carro por tarjeta, plegada; dentro, cada dato con su motivo y fuente, y
// tres salidas: confirmar, corregir o quitar. Lo que se resuelve sale de la cola.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';
import type { HechoPendiente, VehiculoPendiente } from '@/lib/auditoria';
import { DatosClave } from '@/components/admin/DatosClave';
import { claseDeTipo } from '@/lib/attributes/clase';

const host = (u: string | null) => {
  if (!u) return '';
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u.startsWith('/') ? 'archivo local' : u;
  }
};

const mostrar = (h: HechoPendiente) =>
  h.valor === true ? 'Sí' : h.valor === false ? 'No' : typeof h.valor === 'number' ? new Intl.NumberFormat('es-CO').format(h.valor) : String(h.valor ?? '—');

export function ColaAuditoria({ onCambio }: { onCambio?: (pendientes: number) => void }) {
  const [datos, setDatos] = useState<{ vehiculos: VehiculoPendiente[]; totalHechos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    const r = await adminFetch('/api/admin/auditoria');
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      setError(mensajeDeErrorDeAuth(r) ?? d?.error ?? 'No se pudo cargar la cola');
      return;
    }
    setDatos(d);
    onCambio?.(d.totalHechos + d.vehiculos.filter((v: VehiculoPendiente) => v.precioEstimado).length);
  }, [onCambio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function accion(clave: string, cuerpo: Record<string, unknown>) {
    setOcupado(clave);
    setError(null);
    try {
      const r = await adminFetch('/api/admin/auditoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(mensajeDeErrorDeAuth(r) ?? d?.error ?? 'No se pudo guardar');
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setOcupado(null);
    }
  }

  if (!datos && !error) {
    return (
      <div className="flex items-center gap-2 p-8 text-tinta-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando la cola…
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5 max-w-2xl">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-tinta">Por revisar</h2>
        <p className="mt-1 text-[14px] leading-snug text-tinta-2">
          Carros con datos clave sin completar (sus bloques no salen en la ficha) y datos publicados que merecen una
          segunda mirada: nadie los revisó, la confianza es baja o vienen de una fuente de comunidad. Si no se sostienen,
          quítalos: un dato faltante es mejor que uno falso.
        </p>
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {datos && datos.vehiculos.length === 0 && (
        <p className="rounded-2xl bg-papel p-6 text-tinta-2">Nada pendiente. Todo lo publicado tiene revisión.</p>
      )}

      <div className="space-y-3">
        {datos?.vehiculos.map(v => {
          const esteAbierto = abierto === v.id;
          return (
            <div key={v.id} className="rounded-[22px] border border-linea">
              <button
                type="button"
                onClick={() => setAbierto(esteAbierto ? null : v.id)}
                aria-expanded={esteAbierto}
                className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left"
              >
                <span className="font-semibold text-tinta">{v.nombre}</span>
                {v.demo && <span className="rounded-full bg-papel px-2 py-0.5 text-[11px] font-semibold text-tinta-2">DEMO</span>}
                {v.precioEstimado && <span className="rounded-full bg-[#efe4f7] px-2 py-0.5 text-[11px] font-semibold text-wise">precio estimado</span>}
                {v.faltanClave > 0 && (
                  <span className="rounded-full bg-wise px-2 py-0.5 text-[11px] font-semibold text-white">faltan {v.faltanClave} datos clave</span>
                )}
                {v.hechos.length > 0 && <span className="text-[13px] text-tinta-2">{v.hechos.length} datos por revisar</span>}
                <ChevronDown className={`ml-auto h-4 w-4 text-tinta-2 transition-transform ${esteAbierto ? 'rotate-180' : ''}`} />
              </button>

              {esteAbierto && (
                <div className="border-t border-linea px-5 pb-5">
                  <p className="mt-4 text-[13px] text-tinta-2">
                    ¿Mucho por llenar?{' '}
                    <a href={`/admin/vehicles/${v.id}`} className="text-wise hover:underline">
                      Complementar con IA pegando una investigación ↗
                    </a>
                  </p>
                  {v.faltanClave > 0 && (
                    <div className="mt-4">
                      <DatosClave
                        fuelType={v.fuelType}
                        clase={claseDeTipo(v.tipo)}
                        valores={v.valores}
                        sinDato={v.sinDato}
                        onValor={(key, valor) => accion(`add-${key}`, { accion: 'agregar', vehicleId: v.id, key, valor })}
                        onSinDato={(id, marcar) => accion(`sd-${id}`, { accion: 'sinDato', vehicleId: v.id, id, marcar })}
                      />
                    </div>
                  )}
                  {v.precioEstimado && (
                    <PrecioEstimado
                      v={v}
                      ocupado={ocupado === `precio-${v.id}`}
                      onConfirmar={precio => accion(`precio-${v.id}`, { accion: 'precio', vehicleId: v.id, precio })}
                    />
                  )}

                  {v.hechos.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[13px] text-tinta-2">
                        {v.demo
                          ? 'Carro DEMO: son datos aproximados. Confirma solo lo que verifiques con una fuente.'
                          : 'Revisa contra la fuente de cada dato.'}
                      </p>
                      {!v.demo && (
                        <button
                          type="button"
                          className="pastilla h-9 px-4 text-[13px]"
                          disabled={ocupado !== null}
                          onClick={() => {
                            if (confirm(`¿Confirmar los ${v.hechos.length} datos de ${v.nombre} tal como están?`)) {
                              accion(`todo-${v.id}`, { accion: 'confirmarVehiculo', vehicleId: v.id });
                            }
                          }}
                        >
                          <Check className="h-4 w-4" /> Confirmar todos
                        </button>
                      )}
                    </div>
                  )}

                  <ul className="mt-3 divide-y divide-linea">
                    {v.hechos.map(h => (
                      <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-[220px] flex-1">
                          <p className="text-[14px] font-medium text-tinta">{h.etiqueta}</p>
                          <p className="text-[12px] text-tinta-2">
                            {h.motivos.join(' · ')}
                            {h.fuente && (
                              <>
                                {' · '}
                                {h.fuente.startsWith('http') ? (
                                  <a href={h.fuente} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-wise hover:underline">
                                    {host(h.fuente)} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  host(h.fuente)
                                )}
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {h.tipo === 'boolean' ? (
                            <span className="w-40 text-right text-[14px] font-semibold">{mostrar(h)}</span>
                          ) : h.opciones ? (
                            <select
                              value={edicion[h.id] ?? String(h.valor ?? '')}
                              onChange={e => setEdicion({ ...edicion, [h.id]: e.target.value })}
                              className="w-40 rounded-lg border border-linea px-2 py-1 text-[14px] font-semibold"
                            >
                              {h.opciones.map(o => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={edicion[h.id] ?? mostrar(h)}
                              onChange={e => setEdicion({ ...edicion, [h.id]: e.target.value })}
                              className="w-40 rounded-lg border border-linea px-2 py-1 text-right text-[14px] font-semibold"
                              aria-label={`Valor de ${h.etiqueta}`}
                            />
                          )}
                          {h.unidad && <span className="w-14 text-[12px] text-tinta-2">{h.unidad}</span>}
                        </div>

                        <div className="flex gap-1.5">
                          {edicion[h.id] !== undefined && edicion[h.id] !== mostrar(h) ? (
                            <button
                              type="button"
                              className="pastilla pastilla--wise h-9 px-3 text-[13px]"
                              disabled={ocupado !== null}
                              onClick={() => accion(h.id, { accion: 'corregir', id: h.id, valor: edicion[h.id] })}
                            >
                              {ocupado === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar corrección'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="pastilla h-9 px-3 text-[13px]"
                              disabled={ocupado !== null}
                              onClick={() => accion(h.id, { accion: 'confirmar', id: h.id })}
                              title="El dato es correcto"
                            >
                              {ocupado === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Correcto</>}
                            </button>
                          )}
                          <button
                            type="button"
                            className="pastilla h-9 px-3 text-[13px]"
                            disabled={ocupado !== null}
                            onClick={() => accion(`q-${h.id}`, { accion: 'quitar', id: h.id })}
                            title="El dato no se sostiene: quitarlo de la ficha"
                            aria-label={`Quitar ${h.etiqueta}`}
                          >
                            {ocupado === `q-${h.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrecioEstimado({ v, ocupado, onConfirmar }: { v: VehiculoPendiente; ocupado: boolean; onConfirmar: (precio: number) => void }) {
  const [precio, setPrecio] = useState(String(Math.round(v.precio)));
  const n = Number(precio);
  return (
    <div className="mt-4 rounded-2xl bg-[#efe4f7] p-4">
      <p className="text-[14px] font-semibold text-tinta">Precio estimado — confírmalo con el concesionario</p>
      {v.razonPrecio && <p className="mt-1 text-[13px] leading-snug text-tinta-2">{v.razonPrecio}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={precio}
          onChange={e => setPrecio(e.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          className="w-48 rounded-lg border border-linea bg-blanco px-3 py-2 text-[15px] font-semibold"
          aria-label="Precio confirmado en pesos"
        />
        {n > 0 && <span className="text-[13px] text-tinta-2">= ${Math.round(n / 1_000_000)} millones</span>}
        <button type="button" className="pastilla pastilla--wise h-10 px-4 text-[13px]" disabled={ocupado || !(n > 0)} onClick={() => onConfirmar(n)}>
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Es el precio real'}
        </button>
      </div>
    </div>
  );
}
