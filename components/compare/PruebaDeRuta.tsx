'use client';

// ============================================================================
// Al final de toda comparación: una tarjetica por carro con "Separar prueba de
// ruta". Es el mismo contacto de la ficha (lead + WhatsApp): si lo vende un solo
// concesionario (o ninguno), pide el nombre y abre WhatsApp; si lo venden
// varios, abre la lista para elegir, ordenada por cercanía.
// ============================================================================

import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarCheck } from 'lucide-react';
import { CarRender } from '@/components/car/CarRender';
import { ListaContacto, useContactar } from '@/components/concesionarios/Contacto';
import type { Concesionario } from '@/components/concesionarios/piezas';
import { useAuth } from '@/contexts/AuthContext';
import { useMiUbicacion } from '@/hooks/useMiUbicacion';
import { porCercania } from '@/lib/distancia';
import { millones } from '@/lib/vehiculo-datos';
import { whatsappDe } from '@/lib/whatsapp';
import { serie } from '@/lib/palette';

type Carro = { id: string; brand: string; model: string; year: number; price: number; type?: string; fuelType?: string; images?: any[]; imageUrl?: string | null };

/** Quién vende cada carro (el comparador no siempre lo trae): se pide una vez por carro. */
function useConcesionarios(ids: string[]) {
  const [porCarro, setPorCarro] = useState<Record<string, Concesionario[]>>({});
  const clave = ids.join(',');
  useEffect(() => {
    let vivo = true;
    Promise.all(
      clave.split(',').filter(Boolean).map(async id => {
        const r = await fetch(`/api/vehicles/${id}`).then(x => (x.ok ? x.json() : null)).catch(() => null);
        const lista: Concesionario[] = (r?.vehicleDealers ?? [])
          .map((vd: any) => vd.dealer)
          .filter((d: any) => d && d.status !== 'Inactivo')
          .map((d: any) => ({
            id: d.id,
            name: d.name,
            location: d.location,
            address: d.address,
            horario: d.horario ?? null,
            lat: d.lat ?? null,
            lng: d.lng ?? null,
            mapsUrl: d.mapsUrl ?? null,
            phone: d.phone,
            whatsapp: whatsappDe(d.phone),
          }));
        return [id, lista] as const;
      })
    ).then(pares => vivo && setPorCarro(Object.fromEntries(pares)));
    return () => {
      vivo = false;
    };
  }, [clave]);
  return porCarro;
}

export function PruebaDeRuta({ vehiculos }: { vehiculos: Carro[] }) {
  const { user } = useAuth();
  const ubicacion = useMiUbicacion();
  const contactar = useContactar('comparador');
  const porCarro = useConcesionarios(vehiculos.map(v => v.id));
  const [nombre, setNombre] = useState(user?.username ?? '');
  const [abierto, setAbierto] = useState<string | null>(null); // carro con el campo del nombre abierto
  const [lista, setLista] = useState<Carro | null>(null); // carro con la lista de concesionarios abierta

  const separar = (v: Carro) => {
    const cs = porCarro[v.id] ?? [];
    if (cs.length > 1) return setLista(v);
    setAbierto(a => (a === v.id ? null : v.id));
  };

  const escribir = (e: React.FormEvent, v: Carro) => {
    e.preventDefault();
    const cs = porCercania(porCarro[v.id] ?? [], ubicacion.yo);
    contactar('prueba', nombre, { id: v.id, brand: v.brand, model: v.model, year: v.year }, cs[0] ?? null);
    setAbierto(null);
  };

  return (
    <section className="pt-6 md:pt-10" data-recorrido="prueba-ruta">
      <h2 className="t-titulo text-[26px] md:text-[44px]">
        ¿Ya sabes cuál? <span className="text-tinta-2/50">Pruébalo.</span>
      </h2>
      <p className="mt-2 max-w-[52ch] text-[13px] text-tinta-2 md:text-[15px]">
        Separa una prueba de ruta con quien lo vende. Te responden por WhatsApp con el día y la hora.
      </p>
      <div className={`mt-4 grid grid-cols-2 gap-2 md:mt-6 md:gap-4 ${vehiculos.length === 3 ? 'xl:grid-cols-3' : vehiculos.length >= 4 ? 'xl:grid-cols-4' : ''}`}>
        {vehiculos.map((v, i) => {
          const cs = porCarro[v.id];
          return (
            <div key={v.id} className="flex flex-col rounded-[20px] bg-blanco p-3 md:rounded-[28px] md:p-5">
              <div className="flex items-start gap-1.5 md:items-center md:gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full md:mt-0 md:h-2.5 md:w-2.5" style={{ background: serie(i) }} />
                <p className="line-clamp-2 min-h-[2lh] text-[13px] font-semibold leading-tight tracking-[-0.02em] md:line-clamp-1 md:min-h-0 md:text-[17px]">
                  {v.brand} {v.model}
                </p>
              </div>
              <p className="cifra mt-0.5 text-[12px] text-tinta-2 md:text-[13px]">{millones(v.price)}</p>
              <div className="estudio mt-2 flex aspect-[16/8] items-center justify-center rounded-[14px] p-2 md:mt-4 md:aspect-[16/7] md:rounded-[20px] md:p-3">
                <CarRender car={v as any} className="aspect-[480/180] w-full" />
              </div>
              <p className="mt-2 flex-1 text-[11px] leading-snug text-tinta-2 md:mt-3 md:text-[13px]">
                {cs === undefined
                  ? 'Buscando quién lo vende…'
                  : cs.length === 0
                    ? 'Te conectamos con quien lo vende'
                    : cs.length === 1
                      ? `Lo vende ${cs[0].name}`
                      : `Lo venden ${cs.length} concesionarios`}
              </p>
              <button
                type="button"
                onClick={() => separar(v)}
                aria-expanded={cs && cs.length > 1 ? lista?.id === v.id : abierto === v.id}
                className="pastilla pastilla--verde mt-2 !h-auto min-h-10 justify-center !gap-1.5 !px-2 !py-2 text-center !text-[12px] font-semibold leading-tight !whitespace-normal md:mt-3 md:min-h-12 md:!gap-2 md:!whitespace-nowrap md:!px-4 md:!text-[15px]"
              >
                <CalendarCheck className="h-4 w-4 shrink-0" /> Separar prueba de ruta
              </button>
              {abierto === v.id && (
                <form onSubmit={e => escribir(e, v)} className="sube mt-2 flex flex-col gap-2 md:mt-3 md:flex-row">
                  <label htmlFor={`nombre-prueba-${v.id}`} className="sr-only">
                    Tu nombre
                  </label>
                  <input
                    id={`nombre-prueba-${v.id}`}
                    autoFocus
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="¿Cómo te llamas?"
                    className="h-11 w-full min-w-0 shrink-0 rounded-full border border-linea bg-blanco px-4 text-[14px] outline-none focus:border-tinta md:w-auto md:flex-1"
                  />
                  <button type="submit" className="pastilla pastilla--tinta h-11 justify-center px-4 text-[14px]">
                    WhatsApp <ArrowUpRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
      <ListaContacto
        abierta={lista !== null}
        motivo="prueba"
        carro={lista ? { id: lista.id, brand: lista.brand, model: lista.model, year: lista.year } : null}
        concesionarios={lista ? porCarro[lista.id] ?? [] : []}
        nombre={nombre}
        setNombre={setNombre}
        onCerrar={() => setLista(null)}
        ubicacion={ubicacion}
        fuente="comparador"
      />
    </section>
  );
}
