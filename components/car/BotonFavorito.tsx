'use client';

// Corazón para guardar un carro en favoritos ("me gusta"). Sirve dentro de un enlace:
// el toque no abre la ficha. Sin sesión, lleva a iniciar sesión y vuelve a la misma página.

import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';

export function BotonFavorito({ id, className = '' }: { id: string; className?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(id);

  const alternar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    await toggleFavorite(id);
  };

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={fav ? 'Quitar de favoritos' : 'Me gusta: guardar en favoritos'}
      aria-pressed={fav}
      title={fav ? 'Quitar de favoritos' : 'Me gusta'}
      className={`inline-flex h-[53px] w-[53px] shrink-0 items-center justify-center rounded-full border transition-colors ${
        fav ? 'border-wise bg-wise text-white' : 'border-linea bg-blanco text-tinta hover:border-tinta'
      } ${className}`}
    >
      <Heart className="h-[21px] w-[21px]" fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}
