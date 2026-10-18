'use client';

import { SERIES } from '@/lib/palette';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Crown, Info } from 'lucide-react';
import { ATTRIBUTE_REGISTRY, attributeAppliesTo, type AttributeDef } from '@/lib/attributes/registry';
import { formatPrice } from '@/lib/utils';
import { estimadosDe } from '@/lib/vehiculo-datos';
import { MOSTRAR_ESTIMADOS, MarcaE } from '@/components/ui/Estimado';
import { AvisoIA } from '@/components/ui/AvisoIA';

// ============================================================================
// MATRIZ DE COMPARACIÓN
//
// Se construye sobre el registro de atributos, no sobre una lista de campos
// escrita a mano: agregar un dato al registro lo hace comparable aquí sin
// tocar este archivo.
//
// Tres reglas que definen el diseño:
//
// 1. Un atributo que NO APLICA a un tren motriz no es un hueco. Comparar la
//    cilindrada de un eléctrico contra la de un gasolina no da "0 cc": da
//    "no aplica", y se dice con esas palabras. Un guion ahí es una mentira
//    silenciosa (plan §8.3).
// 2. Un dato que FALTA tampoco es un cero. Se marca como "sin dato" y el
//    atributo no se puntúa para nadie.
// 3. Solo se muestran filas donde al menos DOS vehículos tengan el dato: una
//    fila donde solo uno tiene valor no compara nada.
// ============================================================================

interface VehiculoComparado {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  fuelType: string;
  imageUrl?: string | null;
  specifications?: any;
}

interface Props {
  vehicles: VehiculoComparado[];
}

type Celda =
  | { estado: 'valor'; valor: number | string | boolean; estimado?: boolean }
  | { estado: 'no_aplica' }
  | { estado: 'sin_dato' };

const PALETA = SERIES;

function leerPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function parseSpecs(v: VehiculoComparado): any {
  let s = v.specifications;
  if (typeof s === 'string') {
    try {
      s = JSON.parse(s);
    } catch {
      return {};
    }
  }
  return s ?? {};
}

function formatearValor(def: AttributeDef, valor: number | string | boolean): string {
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  // El precio tiene su propio formato; "150.000.000 COP" se lee peor que "$ 150.000.000"
  if (def.key === 'commercial.priceCop' && typeof valor === 'number') return formatPrice(valor);
  if (typeof valor === 'number') {
    const n = Number.isInteger(valor) ? valor.toLocaleString('es-CO') : valor.toFixed(1).replace('.', ',');
    return def.unit ? `${n} ${def.unit}` : n;
  }
  return String(valor);
}

/** Anima el ancho de las barras cuando la fila entra en pantalla. */
function useEnPantalla<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      e => {
        if (e[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ---------------------------------------------------------------------------
// Una fila = un atributo comparado entre todos los vehículos
// ---------------------------------------------------------------------------
function Fila({
  def,
  celdas,
  vehicles,
  indice,
}: {
  def: AttributeDef;
  celdas: Celda[];
  vehicles: VehiculoComparado[];
  indice: number;
}) {
  const { ref, visible } = useEnPantalla<HTMLDivElement>();

  const numericos = celdas
    .map((c, i) => (c.estado === 'valor' && typeof c.valor === 'number' ? { i, v: c.valor } : null))
    .filter(Boolean) as { i: number; v: number }[];

  // Ganador solo si el atributo tiene dirección: en un dato neutro (ej. tipo de
  // tracción) "más" no es "mejor" y coronar a alguien sería inventarse un juicio.
  let ganador = -1;
  if (def.direction !== 'neutral' && numericos.length >= 2) {
    const mejor = numericos.reduce((a, b) =>
      def.direction === 'higher_better' ? (b.v > a.v ? b : a) : b.v < a.v ? b : a
    );
    const empatados = numericos.filter(n => n.v === mejor.v);
    if (empatados.length === 1) ganador = mejor.i;
  }

  const max = numericos.length ? Math.max(...numericos.map(n => n.v)) : 0;

  return (
    <div
      ref={ref}
      className="grid items-center gap-4 border-t border-foreground/[0.07] px-5 py-3.5"
      style={{ gridTemplateColumns: `minmax(150px, 200px) repeat(${vehicles.length}, minmax(0, 1fr))` }}
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground/80">{def.labelEs}</p>
        {def.direction !== 'neutral' && (
          <p className="text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
            {def.direction === 'higher_better' ? 'más es mejor' : 'menos es mejor'}
          </p>
        )}
      </div>

      {celdas.map((celda, i) => {
        if (celda.estado === 'no_aplica') {
          return (
            <div key={i} className="text-[13px] italic text-muted-foreground/70">
              No aplica
            </div>
          );
        }
        if (celda.estado === 'sin_dato') {
          return (
            <div key={i} className="text-[13px] text-muted-foreground/50">
              Sin dato
            </div>
          );
        }

        const esNum = typeof celda.valor === 'number';
        const proporcion = esNum && max > 0 ? Math.max(0.06, (celda.valor as number) / max) : 0;
        const esGanador = i === ganador;

        return (
          <div key={i} className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-mono text-[15px] tabular-nums ${
                  esGanador ? 'font-bold text-wise' : 'font-semibold text-foreground'
                }`}
              >
                <span className={celda.estimado ? 'estimado' : undefined}>{formatearValor(def, celda.valor)}</span>
              </span>
              {celda.estimado && <MarcaE />}
              {esGanador && <Crown className="h-3 w-3 shrink-0 text-wise" strokeWidth={2.5} />}
            </div>
            {esNum && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className="metric-bar h-full rounded-full"
                  data-shown={visible}
                  style={{
                    width: `${proporcion * 100}%`,
                    background: esGanador ? 'rgb(var(--wise-glow))' : PALETA[i % PALETA.length],
                    opacity: esGanador ? 1 : 0.45,
                    transitionDelay: `${indice * 25}ms`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CompareMatrix({ vehicles }: Props) {
  const { grupos, sinDatos, totalFilas, hayEstimados } = useMemo(() => {
    const specsPorVehiculo = vehicles.map(parseSpecs);
    const estimadosPorVehiculo = specsPorVehiculo.map(x => new Set(MOSTRAR_ESTIMADOS ? estimadosDe(x) : []));

    const comparables = ATTRIBUTE_REGISTRY.filter(
      d => d.comparable !== false && d.dimension !== 'editorial' && d.coAvailability !== 'never_published'
    );

    const filas: { def: AttributeDef; celdas: Celda[] }[] = [];

    for (const def of comparables) {
      const celdas: Celda[] = vehicles.map((v, i) => {
        if (!attributeAppliesTo(def, v.fuelType)) return { estado: 'no_aplica' };
        const bruto = leerPath(specsPorVehiculo[i], def.key);
        if (bruto === undefined || bruto === null || bruto === '') return { estado: 'sin_dato' };
        if (def.dataType === 'numeric') {
          const n = Number(bruto);
          if (!Number.isFinite(n)) return { estado: 'sin_dato' };
          return { estado: 'valor', valor: n, estimado: estimadosPorVehiculo[i].has(def.key) };
        }
        return { estado: 'valor', valor: bruto, estimado: estimadosPorVehiculo[i].has(def.key) };
      });

      // Menos de dos valores reales: la fila no compara nada, no se muestra
      if (celdas.filter(c => c.estado === 'valor').length < 2) continue;
      filas.push({ def, celdas });
    }

    const porGrupo = new Map<string, typeof filas>();
    for (const f of filas) {
      const lista = porGrupo.get(f.def.displayGroup) ?? [];
      lista.push(f);
      porGrupo.set(f.def.displayGroup, lista);
    }

    const grupos = Array.from(porGrupo.entries())
      .map(([nombre, items]) => ({
        nombre,
        items: items.sort((a, b) => b.def.displayPriority - a.def.displayPriority),
      }))
      .sort((a, b) => b.items.length - a.items.length);

    const hayEstimados = filas.some(f => f.celdas.some(c => c.estado === 'valor' && c.estimado));
    return { grupos, sinDatos: filas.length === 0, totalFilas: filas.length, hayEstimados };
  }, [vehicles]);

  return (
    <div className="space-y-5">
      {/* Cabecera pegajosa: al bajar por la tabla sigues sabiendo qué columna es cuál */}
      <div className="glass sticky top-[86px] z-20 overflow-hidden rounded-3xl">
        <div
          className="grid items-end gap-4 px-5 py-4"
          style={{ gridTemplateColumns: `minmax(150px, 200px) repeat(${vehicles.length}, minmax(0, 1fr))` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Comparando
          </p>
          {vehicles.map((v, i) => (
            <Link key={v.id} href={`/vehicles/${v.id}`} className="group min-w-0">
              <span
                className="mb-2 block h-1 w-8 rounded-full"
                style={{ background: PALETA[i % PALETA.length] }}
              />
              <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.015em] text-foreground group-hover:text-wise">
                {v.brand} {v.model}
                <ArrowUpRight className="ml-0.5 inline h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {v.year} · {v.fuelType}
              </p>
              <p className="mt-1 font-mono text-[14px] font-bold tabular-nums text-foreground">
                {formatPrice(v.price)}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {sinDatos ? (
        <div className="glass rounded-3xl p-8 text-center">
          <Info className="mx-auto mb-3 h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-foreground">
            No hay ni un dato que estos vehículos compartan
          </p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Para comparar una fila hacen falta al menos dos fichas con ese dato. Las de estos
            vehículos todavía están casi vacías: se llenan desde el panel de ingesta.
          </p>
        </div>
      ) : (
        <>
          {grupos.map(grupo => (
            <div key={grupo.nombre} className="glass overflow-hidden rounded-3xl">
              <div className="flex items-baseline justify-between px-5 pb-1 pt-5">
                <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">
                  {grupo.nombre}
                </h3>
                <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                  {grupo.items.length}
                </span>
              </div>
              {grupo.items.map((f, i) => (
                <Fila key={f.def.key} def={f.def} celdas={f.celdas} vehicles={vehicles} indice={i} />
              ))}
            </div>
          ))}

          <p className="px-2 text-[13px] text-muted-foreground">
            {totalFilas} datos comparables. Los que solo tiene un vehículo no se muestran: no
            comparan nada. «No aplica» significa que el dato no existe para ese tren motriz, no que
            falte.
            {hayEstimados && (
              <>
                {' '}
                Los marcados con <MarcaE className="!ml-0 !align-middle" /> son estimados: la marca no los publica, así que salen de
                pruebas en video, revistas especializadas o un cálculo nuestro.
              </>
            )}
          </p>
          <AvisoIA className="px-2" />
        </>
      )}
    </div>
  );
}
