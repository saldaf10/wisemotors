'use client';

// Datos ESTIMADOS: la marca no los publica, así que salen de pruebas en video,
// revistas especializadas o un cálculo de WiseMotors. Se guardan en
// specifications.meta.estimados (lib/vehiculo-datos: estimadosDe) y se pintan
// con un subrayado amarillo y una "E". La ficha avisa una vez qué significa.

import { createContext, useCallback, useContext, useMemo } from 'react';
import { estimadosDe, specsDe } from '@/lib/vehiculo-datos';

/**
 * Decisión del equipo (18-oct-2026): por ahora los estimados NO se muestran en la página
 * pública (ni amarillo, ni "E", ni aviso). Se siguen guardando. Para volver a mostrarlos,
 * poner true: ficha y comparador ya están marcados.
 */
export const MOSTRAR_ESTIMADOS = false;

const Contexto = createContext<Set<string>>(new Set());

export function EstimadosProvider({ specs, children }: { specs: unknown; children: React.ReactNode }) {
  const set = useMemo(() => new Set(MOSTRAR_ESTIMADOS ? estimadosDe(specsDe(specs)) : []), [specs]);
  return <Contexto.Provider value={set}>{children}</Contexto.Provider>;
}

/** (...keys) → true si alguna de esas keys es un dato estimado de este carro. */
export function useEstimado() {
  const set = useContext(Contexto);
  return useCallback((...keys: string[]) => keys.some(k => set.has(k)), [set]);
}

export function useHayEstimados() {
  return useContext(Contexto).size > 0;
}

export const TEXTO_ESTIMADO = 'Dato estimado: la marca no lo publica';

/** La "E" sola, para poner junto a un valor. */
export function MarcaE({ className = '' }: { className?: string }) {
  return (
    <abbr className={`marca-e no-underline ${className}`} title={TEXTO_ESTIMADO} aria-label="estimado">
      E
    </abbr>
  );
}

/** Envuelve un valor: si es estimado lo subraya en amarillo y le pone la "E". */
export function Estimado({ k, activo, children }: { k?: string | string[]; activo?: boolean; children: React.ReactNode }) {
  const es = useEstimado();
  const si = activo ?? (k ? es(...(Array.isArray(k) ? k : [k])) : false);
  if (!si) return <>{children}</>;
  return (
    <>
      <span className="estimado">{children}</span>
      <MarcaE />
    </>
  );
}

/** Solo la "E" si alguna de las keys es estimada (para títulos de bloques con gráficas). */
export function SiEstimado({ k }: { k: string | string[] }) {
  const es = useEstimado();
  return es(...(Array.isArray(k) ? k : [k])) ? <MarcaE /> : null;
}

/** El aviso de la ficha: solo sale si el carro tiene algún dato estimado. */
export function AvisoEstimados({ className = '' }: { className?: string }) {
  if (!useHayEstimados()) return null;
  return (
    <p className={`flex items-start gap-3 rounded-[20px] border border-[#dbec43]/70 bg-[#dbec43]/15 px-4 py-3 text-[13.5px] leading-relaxed text-tinta-2 ${className}`}>
      <MarcaE className="!ml-0 mt-0.5 !align-middle !text-[12px]" />
      <span>
        <span className="font-semibold text-tinta">Datos estimados.</span> La marca no publica estos datos, así que no salen de una fuente
        oficial: los tomamos de pruebas en video, revistas especializadas o los calculamos nosotros. Úsalos como referencia.
      </span>
    </p>
  );
}
