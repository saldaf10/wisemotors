'use client';

// ============================================================================
// Tarjeta de catálogo (referencia Carzone).
//
// Nombre fuerte + detalle pequeño, precio con botón ↗, el carro al centro y
// tres cifras con divisores. Al pasar el cursor: la tarjeta se inclina en 3D
// siguiendo el mouse, se tiñe de morado desde arriba y el nombre del modelo
// aparece gigante detrás del carro.
//
// Con `versiones` (el mismo carro en varias versiones, lib/versiones) la
// tarjeta es una sola y un toggle amarillo cambia de versión en el sitio.
// ============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { ArrowUpRight, Heart, Layers } from 'lucide-react';
import { CarRender, type CarLike } from '@/components/car/CarRender';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { millones, palabraGigante, tresDatos } from '@/lib/vehiculo-datos';
import { etiquetaVersion, nombreFamilia } from '@/lib/versiones';

export interface VehiculoTarjeta extends CarLike {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  fuelType: string;
  type: string;
  specifications?: unknown;
  /** Agrupa las versiones del mismo carro (lib/versiones). */
  familia?: string | null;
}

/** Toggle amarillo entre versiones. Va dentro de un enlace: no navega, solo cambia. */
export function ToggleVersiones({
  versiones,
  activa,
  onCambio,
  chica = false,
}: {
  versiones: { id: string; model: string; familia?: string | null }[];
  activa: number;
  onCambio: (i: number) => void;
  chica?: boolean;
}) {
  const parar = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div
      role="radiogroup"
      aria-label={`${versiones.length} versiones`}
      onClick={parar}
      className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-version/20 p-0.5 [scrollbar-width:none]"
    >
      <span className={`flex shrink-0 items-center gap-1 font-semibold text-version-oscuro ${chica ? 'pl-1.5 pr-0.5 text-[10px] md:pl-2 md:text-[11px]' : 'pl-2 pr-1 text-[11px]'}`} title={`${versiones.length} versiones`}>
        <Layers className={chica ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        {versiones.length}
      </span>
      {versiones.map((v, i) => (
        <button
          key={v.id}
          type="button"
          role="radio"
          aria-checked={i === activa}
          onClick={e => {
            parar(e);
            onCambio(i);
          }}
          className={`whitespace-nowrap rounded-full font-semibold transition-colors ${chica ? 'px-2 py-0.5 text-[10px] md:px-2.5 md:py-1 md:text-[12px]' : 'px-3 py-1 text-[12px]'} ${
            i === activa ? 'bg-version text-tinta shadow-sm' : 'text-version-oscuro hover:bg-version/30'
          }`}
        >
          {etiquetaVersion(v)}
        </button>
      ))}
    </div>
  );
}

export function TarjetaCarro({
  vehiculo: inicial,
  versiones,
  indice = 0,
  destacada = false,
  compacta = false,
  detallada = false,
}: {
  vehiculo: VehiculoTarjeta;
  /** Todas las versiones del mismo carro (incluida `vehiculo`), en el orden del toggle; con 2 o más sale. */
  versiones?: VehiculoTarjeta[];
  indice?: number;
  destacada?: boolean;
  /** Para ir de a tres por fila hasta en celular: nombre arriba, un solo dato y todo más chico. */
  compacta?: boolean;
  /** Con `compacta`, de a dos (catálogo): suma año, combustible y carrocería, y los tres datos en lista. */
  detallada?: boolean;
}) {
  // Arranca en la versión que se pasó como `vehiculo` (la que ubicó la tarjeta); el toggle va por precio.
  const [activa, setActiva] = useState(() => Math.max(0, versiones?.findIndex(v => v.id === inicial.id) ?? 0));
  const variasVersiones = !!versiones && versiones.length > 1;
  const vehiculo = (variasVersiones && versiones[Math.min(activa, versiones.length - 1)]) || inicial;
  // Con versiones, el título es el carro ("Seagull EV") y la versión va en el toggle.
  const nombre = variasVersiones ? nombreFamilia(vehiculo) : vehiculo.model;
  const ref = useRef<HTMLAnchorElement>(null);
  const frame = useRef(0);
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(vehiculo.id);
  const datos = tresDatos(vehiculo);
  // Lista de datos (y corazón sobre la foto) solo en la detallada, mientras no haya ancho para la fila.
  const lista = compacta && detallada && datos.length > 0;

  const mover = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || frame.current) return;
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width - 0.5;
      const y = (clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${x * 7}deg`);
      el.style.setProperty('--rx', `${-y * 6}deg`);
      frame.current = 0;
    });
  }, []);

  const salir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
  }, []);

  const alternarFavorito = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push('/login');
      return;
    }
    await toggleFavorite(vehiculo.id);
  };

  const corazon = (extra = '') => (
    <button
      onClick={alternarFavorito}
      aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      aria-pressed={fav}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border transition-colors ${compacta ? 'h-8 w-8 md:h-10 md:w-10 xl:h-12 xl:w-12' : 'h-12 w-12'} ${
        fav ? 'border-wise bg-wise text-white' : 'border-linea bg-blanco text-tinta hover:border-tinta'
      } ${extra}`}
    >
      <Heart className={compacta ? 'h-4 w-4 md:h-[18px] md:w-[18px] xl:h-[21px] xl:w-[21px]' : 'h-[21px] w-[21px]'} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );

  return (
    // La entrada va en un envoltorio: su animación de transform no debe pisar la inclinación.
    <div className="sube h-full" style={{ '--d': `${Math.min(indice, 8) * 70}ms` } as React.CSSProperties}>
    <Link
      ref={ref}
      href={`/vehicles/${vehiculo.id}`}
      onMouseMove={mover}
      onMouseLeave={salir}
      className={`tarjeta-carro group flex h-full flex-col ${compacta ? 'max-md:!rounded-[18px] p-2.5 md:p-4 xl:p-6' : 'p-5 md:p-6'}`}
      data-destacada={destacada}
    >
      {compacta ? (
        <div className="relative z-10 flex items-start justify-between gap-2 xl:hidden">
          <div className="min-w-0">
            <h3 className="line-clamp-2 min-h-[2lh] text-[13px] font-semibold leading-tight tracking-[-0.02em] text-tinta md:text-[17px]">
              {vehiculo.brand} {nombre}
            </h3>
            {detallada ? (
              <p className="mt-0.5 truncate text-[11px] text-tinta-2 md:text-[12px]">
                {vehiculo.year} · {vehiculo.fuelType} · {vehiculo.type}
              </p>
            ) : (
              <p className="mt-0.5 hidden text-[12px] text-tinta-2 md:block">
                {vehiculo.year} · {vehiculo.fuelType}
              </p>
            )}
            <p className="cifra mt-1 whitespace-nowrap text-[12px] font-semibold text-tinta md:text-[15px]">{millones(vehiculo.price)}</p>
          </div>
          <span className="flecha h-9 w-9 shrink-0 max-md:!hidden">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      ) : null}
      {/* Cabecera completa; en la compacta solo aparece en pantallas anchas. */}
      <div className={`relative z-10 flex items-start justify-between gap-3 ${compacta ? 'max-xl:!hidden' : ''}`}>
        <div className="min-w-0">
          <h3 className="truncate text-[20px] font-semibold tracking-[-0.03em] text-tinta md:text-[22px]">
            {vehiculo.brand} {nombre}
          </h3>
          <p className="mt-0.5 text-[13px] text-tinta-2">
            {vehiculo.year} · {vehiculo.fuelType} · {vehiculo.type}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="cifra text-[16px] font-semibold text-tinta">{millones(vehiculo.price)}</span>
          <span className="flecha h-9 w-9">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>

      {variasVersiones && (
        <div className={`relative z-10 ${compacta ? 'mt-1.5 md:mt-2' : 'mt-3'}`}>
          <ToggleVersiones versiones={versiones!} activa={Math.min(activa, versiones!.length - 1)} onCambio={setActiva} chica={compacta} />
        </div>
      )}

      <div className={`relative flex items-center justify-center overflow-hidden ${compacta ? `my-2 aspect-[4/3] md:my-3 md:aspect-[16/9] xl:my-4 ${destacada ? 'xl:aspect-[16/7]' : 'xl:aspect-[16/7.5]'}` : destacada ? 'my-4 aspect-[16/7]' : 'my-4 aspect-[16/7.5]'}`}>
        <span
          aria-hidden
          className={`marca-agua absolute inset-x-0 top-1/2 -translate-y-1/2 text-center ${compacta ? 'hidden text-[clamp(56px,7vw,120px)] md:block xl:text-[clamp(72px,11vw,150px)]' : 'text-[clamp(72px,11vw,150px)]'}`}
        >
          {palabraGigante(vehiculo.model, vehiculo.brand)}
        </span>
        <CarRender car={vehiculo} ajustado className="carro relative h-full w-[92%]" />
        {lista && corazon('absolute right-0 top-0 z-10 lg:hidden')}
      </div>

      {/* Lo de abajo, abajo: con el toggle unas tarjetas son más altas que otras en la fila. */}
      <div className="mt-auto">
      {lista && (
        <dl className="relative z-10 divide-y divide-linea lg:hidden">
          {datos.map(d => (
            <div key={d.clave} className="flex items-baseline justify-between gap-2 py-1 md:py-1.5">
              <dt className="truncate text-[11px] text-tinta-2 md:text-[13px]">{d.etiqueta}</dt>
              <dd className="cifra whitespace-nowrap text-[12px] font-semibold text-tinta md:text-[15px]">
                {d.valor}
                {d.unidad && <span className="ml-0.5 text-[10px] font-normal text-tinta-2 md:text-[12px]">{d.unidad}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className={`relative z-10 flex items-end justify-between ${compacta ? 'gap-1.5 md:gap-3' : 'gap-3'} ${lista ? 'max-lg:!hidden' : ''}`}>
        {datos.length > 0 ? (
          <div className="fila-datos min-w-0 flex-1">
            {datos.map((d, i) =>
              compacta ? (
                // Compacta: un dato en celular, los tres cuando hay ancho.
                <div key={d.clave} className={`px-1.5 text-left first:pl-0 last:pr-0 lg:px-3 lg:text-center ${i > 0 ? 'hidden lg:block' : ''}`}>
                  <p className="cifra text-[13px] font-semibold leading-tight text-tinta md:text-[15px] xl:text-[17px]">
                    {d.valor}
                    {d.unidad && <span className="ml-0.5 text-[10px] font-normal text-tinta-2 md:text-[12px]">{d.unidad}</span>}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-tinta-2 md:text-[12px]">{d.etiqueta}</p>
                </div>
              ) : (
              <div key={d.clave} className="px-3 text-center first:pl-0 last:pr-0">
                <p className="cifra text-[17px] font-semibold text-tinta">
                  {d.valor}
                  {d.unidad && <span className="ml-0.5 text-[12px] font-normal text-tinta-2">{d.unidad}</span>}
                </p>
                <p className="mt-0.5 text-[12px] text-tinta-2">{d.etiqueta}</p>
              </div>
              ),
            )}
          </div>
        ) : (
          <p className={`${compacta ? 'text-[10px] md:text-[13px]' : 'text-[13px]'} text-tinta-2`}>Ficha técnica en camino</p>
        )}
        {corazon()}
      </div>
      </div>
    </Link>
    </div>
  );
}
