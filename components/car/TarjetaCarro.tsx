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
}: {
  vehiculo: VehiculoTarjeta;
  indice?: number;
  destacada?: boolean;
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
      className="tarjeta-carro group block p-5 md:p-6"
      data-destacada={destacada}
    >
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

      <div className={`relative my-4 flex items-center justify-center overflow-hidden ${destacada ? "aspect-[16/7]" : "aspect-[16/7.5]"}`}>
        <span
          aria-hidden
          className="marca-agua absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[clamp(72px,11vw,150px)]"
        >
          {palabraGigante(vehiculo.model, vehiculo.brand)}
        </span>
        <CarRender car={vehiculo} ajustado className="carro relative h-full w-[92%]" />
      </div>

      <div className="relative z-10 flex items-end justify-between gap-3">
        {datos.length > 0 ? (
          <div className="fila-datos flex-1">
            {datos.map(d => (
              <div key={d.clave} className="px-3 text-center first:pl-0 last:pr-0">
                <p className="cifra text-[17px] font-semibold text-tinta">
                  {d.valor}
                  {d.unidad && <span className="ml-0.5 text-[12px] font-normal text-tinta-2">{d.unidad}</span>}
                </p>
                <p className="mt-0.5 text-[12px] text-tinta-2">{d.etiqueta}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-tinta-2">Ficha técnica en camino</p>
        )}
        <button
          onClick={alternarFavorito}
          aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          aria-pressed={fav}
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
            fav ? 'border-wise bg-wise text-white' : 'border-linea bg-blanco text-tinta hover:border-tinta'
          }`}
        >
          <Heart className="h-[21px] w-[21px]" fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
    </Link>
    </div>
  );
}
