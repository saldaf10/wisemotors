'use client';

// ============================================================================
// Afinar con preguntas: cuando la búsqueda deja muchas opciones buenas, se le
// pregunta al comprador una cosa a la vez (presupuesto, motor, tipo, caja, qué
// le importa más) hasta que queden 1, 2 o 3.
//
// El orden de las preguntas lo escoge la IA según la búsqueda; las respuestas
// filtran aquí mismo, sin volver a la IA (gratis e instantáneo). Solo se
// pregunta lo que de verdad divide la lista actual, y cada opción dice cuántos
// carros quedan.
// ============================================================================

import { X } from 'lucide-react';
import type { VehiculoTarjeta } from '@/components/car/TarjetaCarro';

type Prioridad = 'comodidad' | 'economia' | 'seguridad' | 'espacio' | 'desempeno';
type Dimension = 'presupuesto' | 'combustible' | 'carroceria' | 'caja' | 'traccion' | 'prioridad';

export type Carro = VehiculoTarjeta & {
  id: string;
  price: number;
  fuelType: string;
  type: string;
  matchPercentage?: number;
  reasons?: string[];
  afinar?: {
    precio: number;
    combustible: string;
    carroceria: string;
    caja: 'Automática' | 'Manual' | null;
    traccion?: '4 ruedas' | '2 ruedas' | null;
    prioridades: Record<Prioridad, number>;
  };
};

/** Respuesta por dimensión; `null` = "me da igual". */
export type Respuestas = Partial<Record<Dimension, string | null>>;

/** Cuántos resultados bastan para dejar de preguntar. */
const SUFICIENTES = 3;

const RANGOS: { clave: string; texto: string; min: number; max: number }[] = [
  { clave: '0-100', texto: 'Menos de $100 M', min: 0, max: 100e6 },
  { clave: '100-120', texto: '$100 a $120 M', min: 100e6, max: 120e6 },
  { clave: '120-150', texto: '$120 a $150 M', min: 120e6, max: 150e6 },
  { clave: '150-200', texto: '$150 a $200 M', min: 150e6, max: 200e6 },
  { clave: '200-', texto: 'Más de $200 M', min: 200e6, max: Infinity },
];

const PRIORIDADES: { clave: Prioridad; texto: string }[] = [
  { clave: 'economia', texto: 'Que gaste poco' },
  { clave: 'comodidad', texto: 'La comodidad' },
  { clave: 'espacio', texto: 'El espacio' },
  { clave: 'seguridad', texto: 'La seguridad' },
  { clave: 'desempeno', texto: 'Que tenga fuerza' },
];

const COMBUSTIBLE: Record<string, string> = {
  Gasolina: 'A gasolina',
  Híbrido: 'Híbrido',
  'Híbrido enchufable': 'Híbrido enchufable',
  Eléctrico: 'Eléctrico',
  Diesel: 'Diésel',
  Diésel: 'Diésel',
};

const PREGUNTA: Record<Dimension, string> = {
  presupuesto: '¿Cuánto quieres gastar?',
  combustible: '¿Qué motor prefieres?',
  carroceria: '¿Qué tipo de carro?',
  caja: '¿Caja automática o manual?',
  traccion: '¿Necesitas tracción en las 4 ruedas (finca, trocha, lodo)?',
  prioridad: '¿Qué te importa más?',
};

function valor(c: Carro, d: Dimension): string | null {
  const a = c.afinar;
  switch (d) {
    case 'presupuesto':
      return RANGOS.find(r => c.price >= r.min && c.price < r.max)?.clave ?? null;
    case 'combustible':
      return a?.combustible ?? c.fuelType;
    case 'carroceria':
      return a?.carroceria ?? c.type;
    case 'caja':
      return a?.caja ?? null;
    case 'traccion':
      return a?.traccion ?? null;
    default:
      return null;
  }
}

/** Aplica las respuestas: filtra por lo concreto y, si eligió prioridad, ordena y deja los mejores. */
export function aplicar(todos: Carro[], r: Respuestas): Carro[] {
  let lista = todos.filter(c =>
    (['presupuesto', 'combustible', 'carroceria', 'caja', 'traccion'] as Dimension[]).every(d => !r[d] || valor(c, d) === r[d])
  );
  const p = r.prioridad as Prioridad | null | undefined;
  if (p) {
    lista = [...lista]
      .map((c, i) => ({ c, i }))
      .sort((x, y) => (y.c.afinar?.prioridades[p] ?? 50) - (x.c.afinar?.prioridades[p] ?? 50) || x.i - y.i)
      .map(x => x.c)
      .slice(0, SUFICIENTES);
  }
  return lista;
}

interface Opcion {
  clave: string;
  texto: string;
  cuantos?: number;
}

function opciones(d: Dimension, lista: Carro[]): Opcion[] {
  if (d === 'prioridad') return PRIORIDADES.map(p => ({ clave: p.clave, texto: p.texto }));
  const conteo = new Map<string, number>();
  for (const c of lista) {
    const v = valor(c, d);
    if (v) conteo.set(v, (conteo.get(v) ?? 0) + 1);
  }
  const texto = (v: string) =>
    d === 'presupuesto' ? RANGOS.find(r => r.clave === v)!.texto : d === 'combustible' ? (COMBUSTIBLE[v] ?? v) : v;
  const orden = d === 'presupuesto' ? RANGOS.map(r => r.clave) : Array.from(conteo.keys()).sort();
  return orden.filter(v => conteo.has(v)).map(v => ({ clave: v, texto: texto(v), cuantos: conteo.get(v) }));
}

function textoRespuesta(d: Dimension, v: string): string {
  if (d === 'presupuesto') return RANGOS.find(r => r.clave === v)?.texto ?? v;
  if (d === 'prioridad') return PRIORIDADES.find(p => p.clave === v)?.texto ?? v;
  if (d === 'combustible') return COMBUSTIBLE[v] ?? v;
  return v;
}

export function Afinador({
  todos,
  visibles,
  orden,
  respuestas,
  onCambio,
}: {
  todos: Carro[];
  visibles: Carro[];
  orden: Dimension[];
  respuestas: Respuestas;
  onCambio: (r: Respuestas) => void;
}) {
  // La siguiente pregunta: la primera sin responder que de verdad divide lo que queda.
  const siguiente =
    visibles.length > SUFICIENTES
      ? orden.find(d => !(d in respuestas) && (d === 'prioridad' || opciones(d, visibles).length >= 2))
      : undefined;
  const respondidas = (Object.entries(respuestas) as [Dimension, string | null][]).filter(([, v]) => v);

  if (!siguiente && respondidas.length === 0) return null;

  const responder = (d: Dimension, v: string | null) => onCambio({ ...respuestas, [d]: v });
  const quitar = (d: Dimension) => {
    const r = { ...respuestas };
    delete r[d];
    onCambio(r);
  };

  return (
    <div className="rounded-[28px] bg-blanco p-6 md:p-8" data-recorrido="afinador">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[15px] text-tinta-2">
          {siguiente
            ? respondidas.length === 0
              ? `Hay ${visibles.length} opciones que te sirven. Afinemos para quedarnos con las mejores.`
              : `Quedan ${visibles.length}. Una más:`
            : visibles.length === 0
              ? 'No queda ninguna con esas respuestas.'
              : `Listo: ${visibles.length === 1 ? 'queda 1 opción' : `quedan ${visibles.length} opciones`} de ${todos.length}.`}
        </p>
        {respondidas.length > 0 && (
          <button onClick={() => onCambio({})} className="text-[13px] text-tinta-2 underline-offset-4 hover:text-tinta hover:underline">
            Empezar de nuevo
          </button>
        )}
      </div>

      {respondidas.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {respondidas.map(([d, v]) => (
            <button
              key={d}
              onClick={() => quitar(d)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#efe4f7] px-3.5 text-[13px] font-medium text-wise"
              aria-label={`Quitar: ${textoRespuesta(d, v!)}`}
            >
              {textoRespuesta(d, v!)} <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}

      {siguiente && (
        <div key={siguiente} className="sube mt-6">
          <p className="text-[26px] font-semibold tracking-[-0.03em] md:text-[32px]">{PREGUNTA[siguiente]}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {opciones(siguiente, visibles).map(o => (
              <button key={o.clave} data-opcion onClick={() => responder(siguiente, o.clave)} className="pastilla h-11 px-5">
                {o.texto}
                {o.cuantos != null && <span className="cifra text-[12px] text-tinta-2">{o.cuantos}</span>}
              </button>
            ))}
            <button
              onClick={() => responder(siguiente, null)}
              className="h-11 rounded-full px-4 text-[14px] text-tinta-2 hover:text-tinta"
            >
              Me da igual
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
