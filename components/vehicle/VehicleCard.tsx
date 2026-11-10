'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { VehicleCard as VehicleCardType } from '@/lib/types';
import { formatPrice, getFuelLabel, getCategoryLabel } from '@/lib/utils';
import { useVehicleImage } from '@/lib/utils/imageUtils';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PhotoCarousel } from '@/components/ui/PhotoCarousel';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';

interface VehicleCardProps {
  vehicle: VehicleCardType;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onExplore?: (id: string) => void;
  showAffinity?: boolean;
  affinityScore?: number;
  reasons?: string[];
  compact?: boolean;
  matchPercentage?: number;
  /** Posición en la grilla: controla el retraso de la cascada de entrada (40ms por tarjeta). */
  index?: number;
}

export const VehicleCard = React.memo(function VehicleCard({
  vehicle,
  isFavorite: externalIsFavorite,
  onToggleFavorite: externalOnToggleFavorite,
  onExplore,
  showAffinity = false,
  affinityScore,
  reasons,
  compact = false,
  matchPercentage,
  index
}: VehicleCardProps) {
  const router = useRouter();
  const glowFrame = useRef<number | null>(null);
  const [latido, setLatido] = useState(false);

  // Spotlight que sigue al cursor: actualiza --mx/--my con rAF para no
  // disparar más de un cálculo por frame. El pintado es solo opacity (CSS).
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (glowFrame.current !== null) return;
    glowFrame.current = requestAnimationFrame(() => {
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
      glowFrame.current = null;
    });
  }, []);
  const { user } = useAuth();
  // `loading` del contexto NO se usa para deshabilitar: es global, así que un
  // refetch de favoritos apagaba el corazón de TODAS las tarjetas a la vez.
  const { isFavorite, toggleFavorite } = useFavorites();

  // Usar el estado interno de favoritos si no se proporciona externamente
  const isFav = externalIsFavorite !== undefined ? externalIsFavorite : isFavorite(vehicle.id);

  const handleFavoriteClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      router.push('/login');
      return;
    }
    // El latido se dispara con el clic, no con la respuesta: es la confirmación
    // inmediata de que el gesto se registró.
    setLatido(true);
    window.setTimeout(() => setLatido(false), 420);
    try {
      if (externalOnToggleFavorite) {
        externalOnToggleFavorite(vehicle.id);
      } else {
        await toggleFavorite(vehicle.id);
      }
    } catch (error) {
      // El estado ya se revirtió en el contexto; se registra para no perder el
      // rastro (antes esto se tragaba en silencio y el fallo era invisible).
      console.error('No se pudo actualizar el favorito:', error);
    }
  }, [user, router, vehicle.id, externalOnToggleFavorite, toggleFavorite]);

  const handleCardClick = useCallback(() => {
    if (onExplore) {
      onExplore(vehicle.id);
    } else {
      router.push(`/vehicles/${vehicle.id}`);
    }
  }, [onExplore, vehicle.id, router]);

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handleCardClick();
  }, [handleCardClick]);

  // Memoize image computations
  const { vehicleImages, displayThumbnailUrl, hasMultipleImages } = useMemo(() => {
    const allImages = (vehicle.images || []).sort((a: any, b: any) => a.order - b.order);
    const cover = allImages.find((img: any) => img.type === 'cover');
    const gallery = allImages.filter((img: any) => img.type === 'gallery');

    const images = [
      ...(cover ? [cover.url] : []),
      ...gallery.map((img: any) => img.url)
    ].filter(Boolean);

    return {
      vehicleImages: images,
      displayThumbnailUrl: cover?.url || gallery[0]?.url || vehicle.imageUrl,
      hasMultipleImages: images.length > 1
    };
  }, [vehicle.images, vehicle.imageUrl]);

  const displayThumbnail = useVehicleImage(displayThumbnailUrl, vehicle.brand, vehicle.model);

  // Tres cifras de cabecera sacadas de las especificaciones reales. Solo se
  // muestran las que existen: un dato ausente no se rellena con un guion.
  const especificaciones = useMemo(() => {
    // Llega como objeto desde getVehicles y como string desde /api/vehicles:
    // se normaliza aquí en vez de confiar en que todas las rutas coincidan.
    let specs = (vehicle as any).specifications;
    if (typeof specs === 'string') {
      try {
        specs = JSON.parse(specs);
      } catch {
        return [];
      }
    }
    if (!specs || typeof specs !== 'object') return [];

    const num = (...candidatos: any[]) => {
      for (const c of candidatos) {
        const n = parseFloat(c);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return null;
    };

    const potencia = num(
      specs.powertrain?.potenciaMaxMotorTermico,
      specs.powertrain?.potenciaMaxSistemaHibrido,
      specs.powertrain?.potenciaMaxEV,
      specs.performance?.maxPower,
      specs.combustion?.maxPower,
      specs.electric?.maxPower,
      specs.hybrid?.maxPower
    );
    const aceleracion = num(specs.performance?.acceleration0to100);
    const consumo = num(
      specs.combustion?.cityConsumption,
      specs.hybrid?.cityConsumption,
      specs.phev?.cityConsumption
    );
    const autonomia = num(specs.electric?.range, specs.electric?.autonomy);

    const filas: { etiqueta: string; valor: string }[] = [];
    if (potencia) filas.push({ etiqueta: 'Potencia', valor: `${Math.round(potencia)} HP` });
    if (aceleracion) filas.push({ etiqueta: '0–100', valor: `${aceleracion.toFixed(1).replace('.', ',')} s` });
    if (autonomia) filas.push({ etiqueta: 'Autonomía', valor: `${Math.round(autonomia)} km` });
    else if (consumo) filas.push({ etiqueta: 'Consumo', valor: `${consumo.toFixed(1).replace('.', ',')} L` });

    return filas.slice(0, 3);
  }, [vehicle]);

  return (
    <Card
      // flex-col + h-full: sin esto la tarjeta es un bloque y el botón queda a
      // distinta altura en cada una según cuántos datos tenga, que es lo que
      // hace que la grilla se vea despareja aunque las cajas midan igual.
      className="glass group flex h-full flex-col overflow-hidden rounded-2xl border-0 card-glow card-enter transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
      onClick={handleCardClick}
      onMouseMove={handleMouseMove}
      style={index !== undefined
        ? ({ '--enter-delay': `${Math.min(index, 12) * 40}ms` } as React.CSSProperties)
        : undefined}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <PhotoCarousel
          images={hasMultipleImages
            ? vehicleImages.slice(0, 5)
            : [displayThumbnail]}
          alt={`${vehicle.brand} ${vehicle.model}`}
          className="w-full h-full"
          showNavigation={hasMultipleImages}
          autoPlay={false}
        />

        {/* Favorite button */}
        <button
          onClick={handleFavoriteClick}
          className="like-btn absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-soft transition-transform duration-200 hover:bg-white hover:scale-110"
          aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          aria-pressed={isFav}
          data-latido={latido}
        >
          <Heart
            className={`like-heart w-[21px] h-[21px] ${isFav ? 'fill-wise text-wise' : 'text-gray-400'}`}
          />
          {/* Onda que sale del corazón al marcarlo: solo transform y opacity */}
          <span className="like-onda" aria-hidden="true" />
        </button>

        {/* Category badge */}
        {vehicle.category && !showAffinity && (
          <div className="absolute bottom-3 left-3">
            <Badge variant="wise" className="text-xs">
              {getCategoryLabel(vehicle.category)}
            </Badge>
          </div>
        )}

        {/* Affinity badge */}
        {showAffinity && affinityScore !== undefined && (
          <div className="absolute bottom-3 left-3">
            <Badge
              variant="wise"
              className={`text-xs ${affinityScore >= 80
                ? 'bg-wise text-white'
                : affinityScore >= 60
                  ? 'bg-fuchsia-500 text-white'
                  : 'bg-rose-500 text-white'
                }`}
            >
              {affinityScore}% match
            </Badge>
          </div>
        )}

        {/* Match percentage badge for objective searches */}
        {!showAffinity && matchPercentage !== undefined && matchPercentage < 100 && (
          <div className="absolute bottom-3 left-3">
            <Badge
              variant="wise"
              className={`text-xs ${matchPercentage >= 90
                ? 'bg-wise text-white'
                : matchPercentage >= 75
                  ? 'bg-purple-500 text-white'
                  : matchPercentage >= 60
                    ? 'bg-fuchsia-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}
            >
              {matchPercentage}% coincidencia
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="flex-1 p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-foreground">
            {vehicle.brand} {vehicle.model}
          </h3>

          <p className="text-sm text-muted-foreground">
            {getFuelLabel(vehicle.fuel)} • {vehicle.status || 'Nuevo'} • {vehicle.year}
          </p>

          <p className="font-mono text-xl font-bold tabular-nums text-foreground">
            {formatPrice(vehicle.price)}
          </p>

          {/* Cifras de cabecera: lo que un comprador mira antes de entrar */}
          {especificaciones.length > 0 && (
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-foreground/[0.07] pt-3">
              {especificaciones.map(fila => (
                <div key={fila.etiqueta}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    {fila.etiqueta}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-foreground">
                    {fila.valor}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* AI Reasons */}
          {reasons && reasons.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-wise mb-2">¿Por qué te lo recomendamos?</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {reasons.slice(0, 3).map((reason, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span className="text-wise mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleButtonClick}
          className="w-full bg-wise hover:bg-wise-dark transition-colors"
        >
          Explorar Vehículo
        </Button>
      </CardFooter>
    </Card>
  );
});
