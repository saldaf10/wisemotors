'use client';

// ============================================================================
// Contactar al concesionario sin salir de WiseMotors.
//
// - Un solo concesionario (o ninguno): el nombre y directo a WhatsApp.
// - Varios: una lista ordenada por distancia a la persona, con un botón verde
//   por concesionario. Puede escribirle a uno o a varios (cada uno es su propio
//   toque: los navegadores bloquean abrir varios WhatsApp de una vez).
//
// Cada contacto queda como lead (WhatsAppLead) con su concesionario ANTES de
// abrir WhatsApp: ese es el registro que se le cobra al concesionario.
// No hay links que saquen a la persona a otra página: el único "salir" es el
// WhatsApp, que es el lead.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { Check, Clock, MapPin, MessageCircle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWhatsAppLeads } from '@/hooks/useWhatsAppLeads';
import { porCercania, type Coordenadas } from '@/lib/distancia';
import { BotonCercania, Distancia, kmA, type Concesionario } from './piezas';

/** WhatsApp de WiseMotors: recibe lo que no tiene celular del concesionario y lo reenvía. */
export const WHATSAPP_WISE = '573103818615';

export type Motivo = 'prueba' | 'info';

export interface CarroDelLead {
  id: string;
  brand: string;
  model: string;
  year: number;
}

export function mensajeDeContacto(motivo: Motivo, quien: string, carro: CarroDelLead | null, c: Concesionario | null) {
  const donde = c ? ` en ${c.name}${c.location ? ` (${c.location})` : ''}` : '';
  if (!carro) return `Hola${c ? ` ${c.name}` : ''}, los encontré en WiseMotors. Mi nombre es ${quien} y quiero información sobre sus carros.`;
  const etiqueta = `${carro.brand} ${carro.model} ${carro.year}`;
  return motivo === 'prueba'
    ? `Hola, me interesa el ${etiqueta}. Mi nombre es ${quien} y quiero agendar una prueba de manejo${donde}.`
    : `Hola, me interesa el ${etiqueta}${donde}. Mi nombre es ${quien} y quiero más información: precio, disponibilidad y financiación.`;
}

/** Registra el lead y abre WhatsApp (directo al concesionario si tiene celular). */
export function useContactar(fuente: string) {
  const { user } = useAuth();
  const { createLead } = useWhatsAppLeads();
  return async (motivo: Motivo, nombre: string, carro: CarroDelLead | null, c: Concesionario | null) => {
    const quien = nombre.trim() || 'Cliente';
    const mensaje = mensajeDeContacto(motivo, quien, carro, c);
    // La ventana se abre YA (dentro del toque) para que el navegador no la bloquee; el lead se guarda en paralelo.
    window.open(`https://wa.me/${c?.whatsapp ?? WHATSAPP_WISE}?text=${encodeURIComponent(mensaje)}`, '_blank');
    try {
      await createLead({
        name: quien,
        username: user?.username || undefined,
        email: user?.email || undefined,
        vehicleId: carro?.id,
        vehicleBrand: carro?.brand,
        vehicleModel: carro?.model,
        dealershipId: c?.id,
        dealershipName: c?.name,
        message: mensaje,
        source: `${fuente}_${motivo === 'prueba' ? 'prueba' : 'concesionario'}`,
      });
    } catch {
      // Si el registro falla, igual la persona ya está en WhatsApp.
    }
  };
}

/** Lista para elegir a qué concesionarios escribirles (cuando lo vende más de uno). */
export function ListaContacto({
  abierta,
  motivo,
  carro,
  concesionarios,
  nombre,
  setNombre,
  onCerrar,
  ubicacion,
  fuente = 'ficha',
}: {
  abierta: boolean;
  motivo: Motivo;
  carro: CarroDelLead | null;
  concesionarios: Concesionario[];
  nombre: string;
  setNombre: (v: string) => void;
  onCerrar: () => void;
  /** La misma ubicación de la ficha: si la pide aquí, la ficha también la ve. */
  ubicacion: { yo: Coordenadas | null; estado: string; pedir: () => void };
  /** De dónde sale el lead (para los informes): ficha, comparador… */
  fuente?: string;
}) {
  const { yo, estado, pedir } = ubicacion;
  const contactar = useContactar(fuente);
  const [escritos, setEscritos] = useState<Set<string>>(new Set());
  const nombreRef = useRef<HTMLInputElement>(null);
  const lista = porCercania(concesionarios, yo);

  // Esc cierra, el fondo no se desplaza y el foco va al nombre.
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => nombreRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-tinta/40 backdrop-blur-[2px] md:items-center" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-contacto"
        className="sube flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[32px] bg-papel shadow-[0_40px_80px_-20px_rgba(14,12,17,0.5)] md:rounded-[32px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div>
            <h2 id="titulo-contacto" className="text-[24px] font-semibold leading-tight tracking-[-0.03em]">
              {motivo === 'prueba' ? '¿Dónde quieres probarlo?' : '¿A quién le escribes?'}
            </h2>
            <p className="mt-1 text-[14px] text-tinta-2">
              {carro ? `El ${carro.brand} ${carro.model} lo venden ${concesionarios.length} concesionarios.` : ''} Puedes escribirle a uno o a varios.
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="pastilla h-10 w-10 shrink-0 justify-center !px-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-6">
          <label htmlFor="nombre-lista" className="sr-only">
            Tu nombre
          </label>
          <input
            id="nombre-lista"
            ref={nombreRef}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="¿Cómo te llamas?"
            className="h-12 w-full rounded-full border border-linea bg-blanco px-5 text-[15px] outline-none focus:border-tinta"
          />
          {lista.some(c => typeof c.lat === 'number') && (
            <div className="flex flex-wrap items-center gap-2">
              <BotonCercania estado={estado} pedir={pedir} />
              {estado === 'lista' && <span className="text-[13px] text-tinta-2">Del más cercano al más lejano</span>}
            </div>
          )}
        </div>

        <ul className="mt-4 flex-1 space-y-2 overflow-y-auto px-6 pb-6">
          {lista.map((c, i) => {
            const listo = escritos.has(c.id);
            return (
              <li key={c.id} className={`rounded-[22px] border bg-blanco p-4 ${listo ? 'border-[#15803d]/40' : 'border-linea'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold tracking-[-0.02em]">
                      {c.name}
                      {i === 0 && estado === 'lista' && kmA(c, yo) !== null && <span className="rounded-full bg-[#15803d]/10 px-2 py-0.5 text-[11px] font-semibold text-[#15803d]">El más cercano</span>}
                    </p>
                    <div className="mt-1.5 space-y-1 text-[13px] text-tinta-2">
                      <Distancia km={kmA(c, yo)} />
                      {(c.address || c.location) && (
                        <p className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {[c.address, c.location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {c.horario && (
                        <p className="flex items-start gap-1.5">
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c.horario}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      contactar(motivo, nombre, carro, c);
                      setEscritos(s => new Set(s).add(c.id));
                    }}
                    className={`pastilla h-12 w-full justify-center px-5 text-[15px] font-semibold sm:w-auto ${listo ? '' : 'pastilla--verde'}`}
                  >
                    {listo ? (
                      <>
                        <Check className="h-4 w-4 text-[#15803d]" /> Le escribiste · otra vez
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-4 w-4" /> Escribirle
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
