'use client';

// ============================================================================
// Ficha del vehículo (referencia Car Sell Center / Mercedes).
//
// Marca enorme + modelo en gris. Categorías en pastillas a la izquierda; al
// elegir una, los puntos de interés se reacomodan SOBRE el carro con datos
// reales de esa categoría, y la tarjeta negra de la derecha explica en
// palabras de persona qué significan. Debajo: datos destacados, el bloque
// para hablar con el concesionario (botones verdes: prueba de manejo y
// contacto, directo a su WhatsApp) y los 3 más parecidos, con botón para
// compararlos.
// Una categoría sin datos no aparece; un dato faltante no se inventa.
// ============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Armchair,
  CalendarCheck,
  Scale,
  Fuel,
  Heart,
  Luggage,
  MessageCircle,
  Shield,
  Timer,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { CarRender } from '@/components/car/CarRender';
import { TarjetaCarro, type VehiculoTarjeta } from '@/components/car/TarjetaCarro';
import { SeccionesFicha } from '@/components/vehicles/ficha/SeccionesFicha';
import type { IndicesVehiculo } from '@/lib/indices/calculo';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { useMiUbicacion } from '@/hooks/useMiUbicacion';
import { porCercania } from '@/lib/distancia';
import { BotonCercania, TarjetaConcesionario, tieneUbicacion, type Concesionario } from '@/components/concesionarios/piezas';
import { ListaContacto, useContactar, type Motivo } from '@/components/concesionarios/Contacto';
import { datosClave, precioCompleto, specsDe, tresDatos } from '@/lib/vehiculo-datos';
import { urlImagen } from '@/lib/data/imagen';
import { AvisoEstimados, EstimadosProvider, MOSTRAR_ESTIMADOS, MarcaE } from '@/components/ui/Estimado';
import { AvisoIA } from '@/components/ui/AvisoIA';
import { fotoDe, pinturaDe } from '@/components/car/CarRender';


// Las vistas del carro (fotos reales que sube el equipo), en el orden en que se recorren.
const ORDEN_VISTAS = ['lado', 'tres_cuartos_frente', 'frente', 'tres_cuartos_atras', 'atras', 'interior', 'detalle'];
const ETIQUETA_VISTA: Record<string, string> = {
  lado: 'Lateral',
  tres_cuartos_frente: '3/4 delantera',
  frente: 'Frontal',
  tres_cuartos_atras: '3/4 trasera',
  atras: 'Trasera',
  interior: 'Interior',
  detalle: 'Detalle',
};
// La portada se guarda como "cover": su vista sale del texto alternativo ("…, de lado").
const VISTA_POR_ALT: [RegExp, string][] = [
  [/3\/4 delantera/i, 'tres_cuartos_frente'],
  [/3\/4 trasera/i, 'tres_cuartos_atras'],
  [/de lado|lateral/i, 'lado'],
  [/de frente|frontal/i, 'frente'],
  [/de atr[aá]s|trasera/i, 'atras'],
  [/interior/i, 'interior'],
  [/detalle/i, 'detalle'],
];

interface Vista {
  url: string;
  vista: string;
  etiqueta: string;
  interior: boolean;
}

function vistasDe(vehicle: any): Vista[] {
  const imgs: any[] = Array.isArray(vehicle.images) ? vehicle.images : [];
  const lista = imgs
    .map((img, i) => {
      const url = urlImagen(vehicle.id, img?.url, img?.order ?? i);
      if (!url) return null;
      const esPortada = !!img.isThumbnail || img.type === 'cover';
      const porAlt = VISTA_POR_ALT.find(([re]) => re.test(String(img.alt ?? '').split(',').pop() ?? ''))?.[1];
      const vista = ETIQUETA_VISTA[img.type] ? img.type : porAlt ?? (esPortada ? 'lado' : 'otra');
      return { url, vista, etiqueta: ETIQUETA_VISTA[vista] ?? 'Foto', interior: vista === 'interior', esPortada };
    })
    .filter((x): x is Vista & { esPortada: boolean } => !!x);
  const peso = (v: Vista & { esPortada: boolean }) => (v.esPortada ? -1 : ORDEN_VISTAS.indexOf(v.vista) === -1 ? 99 : ORDEN_VISTAS.indexOf(v.vista));
  return lista.sort((a, b) => peso(a) - peso(b));
}

/** El nombre antes de abrir WhatsApp: el concesionario sabe con quién habla. */
function FormNombre({ nombre, setNombre, onSubmit }: { nombre: string; setNombre: (v: string) => void; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <form onSubmit={onSubmit} className="sube flex w-full max-w-[420px] gap-2 md:justify-end">
      <label htmlFor="nombre-lead" className="sr-only">
        Tu nombre
      </label>
      <input
        id="nombre-lead"
        autoFocus
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        placeholder="¿Cómo te llamas?"
        className="h-12 min-w-0 flex-1 rounded-full border border-linea bg-blanco px-5 text-[15px] outline-none focus:border-tinta"
      />
      <button type="submit" className="pastilla pastilla--tinta h-12 px-5">
        Abrir WhatsApp <ArrowUpRight className="h-4 w-4" />
      </button>
    </form>
  );
}

export function FichaVehiculo({ vehicle, indices = null }: { vehicle: any; indices?: IndicesVehiculo | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const s = useMemo(() => specsDe(vehicle.specifications), [vehicle.specifications]);
  const vistas = useMemo(() => vistasDe(vehicle), [vehicle]);
  const [vista, setVista] = useState(0);
  const vistaActual = vistas[vista] ?? null;
  // Cuatro datos fijos bajo la foto: los tres de las tarjetas y el siguiente que haya.
  const datosHero = useMemo(() => {
    const tres = tresDatos(vehicle);
    const extra = datosClave(vehicle).find(d => !tres.some(t => t.clave === d.clave));
    return extra ? [...tres, extra] : tres;
  }, [vehicle]);
  const precioEstimado = MOSTRAR_ESTIMADOS && (!!vehicle.priceEstimated || !!s.commercial?.priceEstimated);
  // Un solo concesionario (o ninguno): el nombre junto al botón que se tocó y
  // directo a WhatsApp. Varios: la lista para elegir, ordenada por distancia.
  const [contacto, setContacto] = useState<{ motivo: Motivo; lugar: 'arriba' | 'abajo' } | null>(null);
  const [lista, setLista] = useState<Motivo | null>(null);
  const ubicacion = useMiUbicacion();
  const concesionarios = useMemo(() => porCercania<Concesionario>(vehicle.dealerships ?? [], ubicacion.yo), [vehicle.dealerships, ubicacion.yo]);
  const varios = concesionarios.length > 1;
  const contactar = useContactar('ficha');
  const carro = { id: vehicle.id, brand: vehicle.brand, model: vehicle.model, year: vehicle.year };
  const [nombre, setNombre] = useState(user?.username ?? '');
  const fav = isFavorite(vehicle.id);
  const similares: VehiculoTarjeta[] = (vehicle.similarVehicles ?? []).map((v: any) => ({
    ...v,
    fuelType: v.fuelType ?? (v.fuel ? v.fuel.charAt(0) + v.fuel.slice(1).toLowerCase() : ''),
    type: v.type ?? v.category,
  }));

  const favorito = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(`/vehicles/${vehicle.id}`)}`);
    await toggleFavorite(vehicle.id);
  };

  const pedir = (motivo: Motivo, lugar: 'arriba' | 'abajo') => {
    if (varios) return setLista(motivo);
    setContacto(c => (c?.motivo === motivo && c.lugar === lugar ? null : { motivo, lugar }));
  };

  const cerrarLista = useCallback(() => setLista(null), []);

  const escribir = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contacto) return;
    contactar(contacto.motivo, nombre, carro, concesionarios[0] ?? null);
    setContacto(null);
  };

  return (
    <div className="pb-10">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-5 pt-8 md:px-8 md:pt-12">
        <Link href="/vehicles" className="inline-flex items-center gap-2 text-[14px] text-tinta-2 hover:text-tinta">
          <ArrowLeft className="h-4 w-4" /> Catálogo
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-8">
          <div className="sube">
            <h1 className="t-titulo text-[56px] md:text-[96px]">{vehicle.brand}</h1>
            <p className="t-ligero mt-2 text-[28px] text-tinta-2 md:text-[40px]">
              {vehicle.model} · {vehicle.year}
            </p>
          </div>
          <div className="sube flex w-full flex-col items-start gap-4 md:w-auto md:items-end" style={{ '--d': '120ms' } as React.CSSProperties}>
            <div className="md:text-right">
              <p className="text-[13px] text-tinta-2">{precioEstimado ? 'Precio estimado' : 'Precio de lista'}</p>
              <p className="cifra text-[32px] font-semibold md:text-[40px]">
                <span className={precioEstimado ? 'estimado' : undefined}>
                  <AnimatedNumber value={vehicle.price} format={n => precioCompleto(Math.round(n))} durationMs={1100} />
                </span>
                {precioEstimado && <MarcaE />}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={favorito}
                aria-pressed={fav}
                className={`inline-flex h-16 w-16 items-center justify-center rounded-full border transition-colors ${
                  fav ? 'border-wise bg-wise text-white' : 'border-linea bg-blanco hover:border-tinta'
                }`}
                aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              >
                <Heart className="h-[27px] w-[27px]" fill={fav ? 'currentColor' : 'none'} />
              </button>
              <Link href="/compare" className="pastilla h-12 px-5">
                Comparar
              </Link>
            </div>
            <button
              onClick={() => pedir('prueba', 'arriba')}
              aria-expanded={varios ? lista === 'prueba' : contacto?.lugar === 'arriba'}
              aria-haspopup={varios ? 'dialog' : undefined}
              className="pastilla pastilla--verde h-14 w-full justify-center px-8 text-[17px] font-semibold md:w-auto"
            >
              <CalendarCheck className="h-5 w-5" /> Agendar prueba de manejo
            </button>
            {contacto?.lugar === 'arriba' && <FormNombre nombre={nombre} setNombre={setNombre} onSubmit={escribir} />}
          </div>
        </div>
      </section>

      {/* ── Escenario: las fotos reales del carro, vista por vista, y sus datos clave ── */}
      <section className="mx-auto mt-8 max-w-[1440px] px-5 md:px-8">
        <div className="estudio relative overflow-hidden rounded-[36px] px-4 pb-5 pt-8 md:px-8 md:pb-8 md:pt-12">
          {!vistaActual?.interior && (
            <p
              aria-hidden
              className="t-display pointer-events-none absolute inset-x-0 top-[38%] hidden -translate-y-1/2 select-none text-center text-[clamp(120px,19vw,300px)] leading-none md:block"
              style={
                !fotoDe(vehicle) && ['perla', 'plata'].includes(pinturaDe(vehicle).nombre)
                  ? { color: 'transparent', WebkitTextStroke: '1.5px #cfcdd5' }
                  : { color: '#dcdae0' }
              }
            >
              {vehicle.brand.toUpperCase()}
            </p>
          )}

          <div className="relative mx-auto aspect-[480/220] w-full max-w-[980px]">
            {!vistaActual ? (
              <CarRender car={vehicle} prioridad className="carro-entra absolute inset-x-0 bottom-0 top-[6%]" />
            ) : vistaActual.interior ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={vistaActual.url}
                src={vistaActual.url}
                alt={`${vehicle.brand} ${vehicle.model}, interior`}
                className="sube absolute inset-0 h-full w-full rounded-[24px] object-cover"
                draggable={false}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={vistaActual.url}
                src={vistaActual.url}
                alt={`${vehicle.brand} ${vehicle.model}, ${vistaActual.etiqueta.toLowerCase()}`}
                className="carro-entra absolute inset-x-0 bottom-0 top-[6%] h-[94%] w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.28)]"
                draggable={false}
              />
            )}
          </div>

          {vistas.length > 1 && (
            <div className="relative mt-5 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Vistas del carro">
              {vistas.map((f, i) => (
                <button
                  key={f.url}
                  type="button"
                  role="tab"
                  aria-selected={i === vista}
                  onClick={() => setVista(i)}
                  className={`shrink-0 rounded-[18px] border p-1.5 transition-colors ${
                    i === vista ? 'border-tinta bg-blanco' : 'border-transparent bg-blanco/60 hover:bg-blanco'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" loading="lazy" className={`h-11 w-[76px] rounded-xl ${f.interior ? 'object-cover' : 'object-contain'}`} draggable={false} />
                  <span className={`mt-1 block text-center text-[11px] ${i === vista ? 'font-semibold text-tinta' : 'text-tinta-2'}`}>{f.etiqueta}</span>
                </button>
              ))}
            </div>
          )}

          {datosHero.length > 0 && (
            <dl className="relative mx-auto mt-5 grid max-w-[980px] grid-cols-2 gap-2 md:grid-cols-4">
              {datosHero.map(d => (
                <div key={d.clave} className="rounded-[20px] bg-blanco/90 px-4 py-3.5 text-center">
                  <dd className="cifra text-[22px] font-semibold leading-none">
                    {d.valor}
                    {d.unidad && <span className="ml-1 text-[13px] font-normal text-tinta-2">{d.unidad}</span>}
                  </dd>
                  <dt className="mt-1.5 text-[12.5px] text-tinta-2">{d.etiqueta}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <EstimadosProvider specs={vehicle.specifications}>
        <div className="mx-auto mt-6 max-w-[1440px] px-5 md:px-8">
          <AvisoEstimados className="md:max-w-[760px]" />
        </div>
        <SeccionesFicha vehicle={vehicle} indices={indices} />
      </EstimadosProvider>

      {/* ── Contacto: hablar con quien lo vende (verde = una persona al otro lado) ── */}
      <section className="mx-auto mt-24 max-w-[1440px] px-5 md:px-8">
        <div className="grid gap-8 rounded-[36px] bg-blanco p-8 md:grid-cols-[1.2fr_1fr] md:items-start md:p-12">
          <div>
            <h2 className="t-titulo text-[32px] md:text-[44px]">
              ¿Te gustó el {vehicle.model}? <span className="text-tinta-2/50">Habla con quien lo vende.</span>
            </h2>
            <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-tinta-2">
              Te responden por WhatsApp: precio final, colores disponibles, financiación y cuándo puedes probarlo.
            </p>
            {concesionarios.length > 0 && (
              <div className="mt-6 space-y-3">
                {varios && concesionarios.some(tieneUbicacion) && (
                  <BotonCercania estado={ubicacion.estado} pedir={ubicacion.pedir} />
                )}
                <TarjetaConcesionario
                  c={concesionarios[0]}
                  yo={ubicacion.yo}
                  conMapa
                  enlace={false}
                  etiqueta={varios ? (ubicacion.yo ? 'El más cercano' : 'Uno de los que lo venden') : 'Lo vende'}
                />
                {varios && (
                  <p className="text-[14px] text-tinta-2">
                    Y {concesionarios.length - 1} {concesionarios.length - 1 === 1 ? 'concesionario más' : 'concesionarios más'}: al contactar eliges a cuál (o a cuáles) escribirle.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 md:sticky md:top-28">
            {!varios && concesionarios[0] && (
              <p className="text-[14px] text-tinta-2">
                Le escribes a <span className="font-semibold text-tinta">{concesionarios[0].name}</span>
              </p>
            )}
            <button
              onClick={() => pedir('info', 'abajo')}
              aria-expanded={varios ? lista === 'info' : contacto?.lugar === 'abajo' && contacto.motivo === 'info'}
              aria-haspopup={varios ? 'dialog' : undefined}
              className="pastilla pastilla--verde h-14 justify-center px-8 text-[17px] font-semibold"
            >
              <MessageCircle className="h-5 w-5" /> Contactar al concesionario
            </button>
            <button
              onClick={() => pedir('prueba', 'abajo')}
              aria-expanded={varios ? lista === 'prueba' : contacto?.lugar === 'abajo' && contacto.motivo === 'prueba'}
              aria-haspopup={varios ? 'dialog' : undefined}
              className="pastilla pastilla--verde h-14 justify-center px-8 text-[17px] font-semibold"
            >
              <CalendarCheck className="h-5 w-5" /> Agendar prueba de manejo
            </button>
            {contacto?.lugar === 'abajo' && <FormNombre nombre={nombre} setNombre={setNombre} onSubmit={escribir} />}
            <AvisoIA className="mt-2" />
          </div>
        </div>
      </section>
      <ListaContacto
        abierta={lista !== null}
        motivo={lista ?? 'info'}
        carro={carro}
        concesionarios={concesionarios}
        nombre={nombre}
        setNombre={setNombre}
        onCerrar={cerrarLista}
        ubicacion={ubicacion}
      />

      {/* ── Similares: los 3 más parecidos en tipo, precio y características ── */}
      {similares.length > 0 && (
        <section className="mx-auto mt-24 max-w-[1440px] px-5 md:px-8" data-recorrido="similares">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <div>
              <h2 className="t-titulo text-[32px] md:text-[44px]">
                Si te gusta este, <span className="text-tinta-2/50">mira y compara similares.</span>
              </h2>
              <p className="mt-2 max-w-[52ch] text-[15px] text-tinta-2">Los más parecidos en precio, tamaño y tipo de carro.</p>
            </div>
            {/* Este carro y sus similares, todos en una sola comparación (por ids: sin favoritos). */}
            {similares.length >= 2 && (
              <div className="w-full sm:w-auto">
                <Link
                  href={`/compare?ids=${[vehicle.id, ...similares.slice(0, 3).map(v => v.id)].join(',')}`}
                  className="pastilla pastilla--wise h-14 w-full justify-center px-7 text-[16px] font-semibold sm:w-auto"
                >
                  <Scale className="h-5 w-5" /> Comparar los {Math.min(3, similares.length) + 1} a la vez <ArrowUpRight className="h-4 w-4" />
                </Link>
                <p className="mt-2 text-center text-[13px] text-tinta-2 sm:text-right">
                  El {vehicle.model} frente a estos {Math.min(3, similares.length)}, lado a lado.
                </p>
              </div>
            )}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {similares.slice(0, 3).map((v, i) => (
              <div key={v.id} className="flex flex-col gap-3">
                <TarjetaCarro vehiculo={v} indice={i} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href={`/vehicles/${v.id}`} className="pastilla h-11 justify-center whitespace-nowrap px-3 text-[14px]">
                    Ir al panel dinámico <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link href={`/compare?ids=${vehicle.id},${v.id}`} className="pastilla pastilla--wise h-11 justify-center whitespace-nowrap px-3 text-[14px]">
                    Comparar cara a cara
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
