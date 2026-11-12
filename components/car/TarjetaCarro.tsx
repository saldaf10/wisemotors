'use client';

// ============================================================================
// Tarjeta de catálogo (referencia Carzone).
//
// Nombre fuerte + detalle pequeño, precio con botón ↗, el carro al centro y
// tres cifras con divisores. Al pasar el cursor: la tarjeta se inclina en 3D
// siguiendo el mouse, se tiñe de morado desde arriba y el nombre del modelo
// aparece gigante detrás del carro.
// ============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';
import { ArrowUpRight, Heart } from 'lucide-react';
import { CarRender, type CarLike } from '@/components/car/CarRender';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { millones, palabraGigante, tresDatos } from '@/lib/vehiculo-datos';

export interface VehiculoTarjeta extends CarLike {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  fuelType: string;
  type: string;
  specifications?: unknown;
}

export function TarjetaCarro({
  vehiculo,
  indice = 0,
  destacada = false,
  compacta = false,
}: {
  vehiculo: VehiculoTarjeta;
  indice?: number;
  destacada?: boolean;
  /** Para ir de a tres por fila hasta en celular: nombre arriba, un solo dato y todo más chico. */
  compacta?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const frame = useRef(0);
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(vehiculo.id);
  const datos = tresDatos(vehiculo);

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

  return (
    // La entrada va en un envoltorio: su animación de transform no debe pisar la inclinación.
    <div className="sube" style={{ '--d': `${Math.min(indice, 8) * 70}ms` } as React.CSSProperties}>
    <Link
      ref={ref}
      href={`/vehicles/${vehiculo.id}`}
      onMouseMove={mover}
      onMouseLeave={salir}
      className={`tarjeta-carro group block ${compacta ? 'max-md:!rounded-[18px] p-2.5 md:p-4 xl:p-6' : 'p-5 md:p-6'}`}
      data-destacada={destacada}
    >
      {compacta ? (
        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 min-h-[2lh] text-[13px] xl:min-h-0 font-semibold leading-tight tracking-[-0.02em] text-tinta md:text-[17px] xl:text-[22px]">
              {vehiculo.brand} {vehiculo.model}
            </h3>
            <p className="mt-0.5 hidden text-[12px] text-tinta-2 md:block xl:text-[13px]">
              {vehiculo.year} · {vehiculo.fuelType}
            </p>
            <p className="cifra mt-1 whitespace-nowrap text-[12px] font-semibold text-tinta md:text-[15px] xl:text-[16px]">{millones(vehiculo.price)}</p>
          </div>
          <span className="flecha h-9 w-9 shrink-0 max-md:!hidden">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      ) : (
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[20px] font-semibold tracking-[-0.03em] text-tinta md:text-[22px]">
            {vehiculo.brand} {vehiculo.model}
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
      )}

      <div className={`relative flex items-center justify-center overflow-hidden ${compacta ? 'my-2 aspect-[4/3] md:my-3 md:aspect-[16/9] xl:my-4 xl:aspect-[16/7.5]' : destacada ? 'my-4 aspect-[16/7]' : 'my-4 aspect-[16/7.5]'}`}>
        <span
          aria-hidden
          className={`marca-agua absolute inset-x-0 top-1/2 -translate-y-1/2 text-center ${compacta ? 'hidden text-[clamp(56px,7vw,120px)] md:block' : 'text-[clamp(72px,11vw,150px)]'}`}
        >
          {palabraGigante(vehiculo.model, vehiculo.brand)}
        </span>
        <CarRender car={vehiculo} ajustado className="carro relative h-full w-[92%]" />
      </div>

      <div className={`relative z-10 flex items-end justify-between ${compacta ? 'gap-1.5 md:gap-3' : 'gap-3'}`}>
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
        <button
          onClick={alternarFavorito}
          aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          aria-pressed={fav}
          className={`inline-flex shrink-0 items-center justify-center rounded-full border transition-colors ${compacta ? 'h-8 w-8 md:h-10 md:w-10 xl:h-12 xl:w-12' : 'h-12 w-12'} ${
            fav ? 'border-wise bg-wise text-white' : 'border-linea bg-blanco text-tinta hover:border-tinta'
          }`}
        >
          <Heart className={compacta ? 'h-4 w-4 md:h-[18px] md:w-[18px] xl:h-[21px] xl:w-[21px]' : 'h-[21px] w-[21px]'} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
    </Link>
    </div>
  );
}
