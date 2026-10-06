'use client';

// ============================================================================
// Datos clave que faltan (lib/attributes/clave.ts), para completar a mano.
//
// Se usa en la revisión de la ingesta (antes de publicar) y en "Por revisar"
// (carros ya publicados). Cada faltante trae su entrada según el tipo: número
// con unidad, opciones, Sí / No lo tiene, o texto; y "No existe" para cuando
// el dato de verdad no existe (un carro sin prueba de choque).
// ============================================================================

import { useState } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { camposClave, clavesFaltantes, keyDeEntrada, type CampoClave } from '@/lib/attributes/clave';
import { rangoDe, type ClaseVehiculo } from '@/lib/attributes/registry';

export type ValorManual = number | string | boolean;

/** "4,5" → 4.5 · "1.250.000" → 1250000. null si no es número. */
export function numeroEscrito(t: string): number | null {
  const x = t.trim().replace(/\s/g, '');
  if (!x) return null;
  const n = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(x) ? parseFloat(x.replace(/\./g, '').replace(',', '.')) : parseFloat(x.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function Entrada({
  campo,
  fuelType,
  clase,
  onValor,
  onSinDato,
}: {
  campo: CampoClave;
  fuelType: string;
  clase: ClaseVehiculo;
  onValor: (key: string, v: ValorManual) => void;
  onSinDato: (id: string) => void;
}) {
  const def = keyDeEntrada(campo, fuelType)!;
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');

  const guardar = () => {
    if (def.dataType === 'numeric') {
      const n = numeroEscrito(texto);
      if (n === null || n <= 0) return setError('Escribe un número');
      // Rango de la clase del vehículo: una van lleva 15.000 L, un carro no.
      const { min, max } = rangoDe(def, clase);
      if ((min !== undefined && n < min) || (max !== undefined && n > max)) {
        return setError(`Fuera de rango (${min?.toLocaleString('es-CO') ?? '…'}–${max?.toLocaleString('es-CO') ?? '…'} ${def.unit ?? ''})`);
      }
      onValor(def.key, n);
    } else if (texto.trim()) {
      onValor(def.key, texto.trim().slice(0, 200));
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <div className="min-w-[200px] flex-1">
        <p className="text-[14px] font-medium text-tinta">{campo.etiqueta}</p>
        <p className="text-[12px] text-tinta-2">{campo.porque}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {def.dataType === 'boolean' ? (
          <>
            <button type="button" className="pastilla h-9 px-3 text-[13px]" onClick={() => onValor(def.key, true)}>
              Sí lo tiene
            </button>
            <button type="button" className="pastilla h-9 px-3 text-[13px]" onClick={() => onValor(def.key, false)}>
              No lo tiene
            </button>
          </>
        ) : def.opciones ? (
          <select
            defaultValue=""
            onChange={e => e.target.value && onValor(def.key, e.target.value)}
            className="h-9 rounded-lg border border-linea bg-blanco px-2 text-[13px]"
            aria-label={campo.etiqueta}
          >
            <option value="">Elegir…</option>
            {def.opciones.map(o => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : (
          <>
            <input
              value={texto}
              onChange={e => {
                setTexto(e.target.value);
                setError('');
              }}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), guardar())}
              inputMode={def.dataType === 'numeric' ? 'decimal' : 'text'}
              placeholder={def.dataType === 'numeric' ? '' : campo.id === 'llanta' ? '215/55 R17' : campo.id === 'celular' ? 'CarPlay y Android Auto / No' : ''}
              className="h-9 w-32 rounded-lg border border-linea bg-blanco px-2 text-right text-[13px] font-semibold"
              aria-label={campo.etiqueta}
            />
            {def.unit && <span className="text-[12px] text-tinta-2">{def.unit}</span>}
            <button type="button" className="pastilla pastilla--wise h-9 px-3 text-[13px]" onClick={guardar} disabled={!texto.trim()}>
              Poner
            </button>
          </>
        )}
        <button
          type="button"
          className="h-9 px-2 text-[12px] text-tinta-2 underline-offset-2 hover:underline"
          onClick={() => onSinDato(campo.id)}
          title="El dato no existe para este carro (ej. nunca tuvo prueba de choque)"
        >
          No existe
        </button>
      </div>
      {error && <p className="w-full text-right text-[12px] text-red-600">{error}</p>}
    </li>
  );
}

export function DatosClave({
  fuelType,
  clase = 'auto',
  valores,
  sinDato,
  onValor,
  onSinDato,
}: {
  fuelType: string;
  /** Carro, pickup o van/camión: cambia qué datos se piden y sus rangos. */
  clase?: ClaseVehiculo;
  /** key → valor de lo que ya hay (aceptado o ingresado a mano). */
  valores: Record<string, unknown>;
  sinDato: string[];
  onValor: (key: string, v: ValorManual) => void;
  onSinDato: (id: string, marcar: boolean) => void;
}) {
  const todos = camposClave(fuelType, clase);
  const faltan = clavesFaltantes(fuelType, valores, sinDato, clase);
  const completos = todos.length - faltan.length;
  const secciones = Array.from(new Set(faltan.map(f => f.seccion)));
  const marcadosSinDato = todos.filter(c => sinDato.includes(c.id));

  return (
    <div className={`rounded-[28px] border p-6 ${faltan.length ? 'border-[#d8b4fe] bg-[#faf5ff]' : 'border-linea bg-blanco'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold text-tinta">
          {faltan.length ? <CircleAlert className="h-5 w-5 text-wise" /> : <CheckCircle2 className="h-5 w-5 text-wise" />}
          Datos clave: {completos} de {todos.length}
        </h3>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-tinta/10" aria-hidden>
          <div className="h-full rounded-full bg-wise" style={{ width: `${(completos / Math.max(1, todos.length)) * 100}%` }} />
        </div>
      </div>
      {faltan.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-2">Están todos: la ficha sale completa.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-tinta-2">
            Sin estos datos, su bloque no aparece en la ficha. Complétalos si los tienes (ficha del concesionario, catálogo) o
            márcalos como "no existe".
          </p>
          {secciones.map(sec => (
            <div key={sec} className="mt-4">
              <p className="t-meta text-tinta-2">{sec}</p>
              <ul className="divide-y divide-linea">
                {faltan
                  .filter(f => f.seccion === sec)
                  .map(c => (
                    <Entrada key={c.id} campo={c} fuelType={fuelType} clase={clase} onValor={onValor} onSinDato={id => onSinDato(id, true)} />
                  ))}
              </ul>
            </div>
          ))}
        </>
      )}
      {marcadosSinDato.length > 0 && (
        <p className="mt-4 text-[12px] text-tinta-2">
          Marcados como "no existe":{' '}
          {marcadosSinDato.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              {c.etiqueta}{' '}
              <button type="button" className="text-wise hover:underline" onClick={() => onSinDato(c.id, false)}>
                (deshacer)
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
