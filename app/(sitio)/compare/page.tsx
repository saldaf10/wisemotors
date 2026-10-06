'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Comparador } from '@/components/compare/Comparador';
import { CarRender } from '@/components/car/CarRender';
import { millones } from '@/lib/vehiculo-datos';

// ============================================================================
// Comparador. La selección es una tira de favoritos que se prenden y apagan;
// la comparación arranca de una con los primeros marcados.
// Con ?ids=a,b (desde "Comparar con este" en la ficha) compara esos carros
// directamente: no hace falta cuenta ni favoritos.
// ============================================================================

const MAX = 4;

function Vacio({ titulo, texto, children }: { titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-20 md:px-8 md:py-28">
      <div className="estudio relative overflow-hidden rounded-[36px] px-8 py-16 md:px-16 md:py-24">
        <p aria-hidden className="t-display pointer-events-none absolute -bottom-6 right-4 text-[22vw] leading-none text-tinta/[0.04]">
          VS
        </p>
        <h1 className="t-titulo relative max-w-[14ch] text-[48px] md:text-[80px]">{titulo}</h1>
        <p className="relative mt-5 max-w-[46ch] text-[17px] leading-relaxed text-tinta-2">{texto}</p>
        <div className="relative mt-10 flex flex-wrap gap-3">{children}</div>
      </div>
    </div>
  );
}

/** Comparación directa de los carros de la URL. */
function CompararIds({ lista }: { lista: string }) {
  const [datos, setDatos] = useState<any[] | null>(null);

  // La dependencia es el texto de la URL: un arreglo nuevo en cada render volvería a pedir todo.
  useEffect(() => {
    const ids = lista.split(',');
    Promise.all(ids.map(id => fetch(`/api/vehicles/${id}`).then(r => (r.ok ? r.json() : null))))
      .then(vs => setDatos(vs.filter(Boolean)))
      .catch(() => setDatos([]));
  }, [lista]);

  if (datos === null) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-28 md:px-8">
        <div className="h-[420px] animate-pulse rounded-[36px] bg-tarjeta" />
      </div>
    );
  }
  if (datos.length < 2) {
    return (
      <Vacio titulo="No encontramos esos carros." texto="Puede que alguno ya no esté en el catálogo. Elige otros para ponerlos frente a frente.">
        <Link href="/vehicles" className="pastilla pastilla--tinta h-12 px-6">
          Ir al catálogo <ArrowUpRight className="h-4 w-4" />
        </Link>
      </Vacio>
    );
  }
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-10 md:px-8 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-linea pb-8">
        <h1 className="t-titulo text-[48px] md:text-[80px]">Frente a frente</h1>
        <div className="flex flex-wrap gap-2">
          {datos.map(v => (
            <Link key={v.id} href={`/vehicles/${v.id}`} className="pastilla h-11 px-4">
              {v.brand} {v.model} <ArrowUpRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-10">
        <Comparador vehiculos={datos} />
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <Comparar />
    </Suspense>
  );
}

function Comparar() {
  const ids = useSearchParams()
    .get('ids')
    ?.split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, MAX);
  if (ids && ids.length >= 2) return <CompararIds lista={ids.join(',')} />;
  return <CompararFavoritos />;
}

function CompararFavoritos() {
  const { user } = useAuth();
  const { favorites, loading } = useFavorites();
  const [seleccion, setSeleccion] = useState<string[]>([]);

  useEffect(() => {
    setSeleccion(favorites.slice(0, 2).map(v => v.id));
  }, [favorites]);

  const alternar = (id: string) =>
    setSeleccion(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length < MAX ? [...prev, id] : prev));

  const datos = useMemo(() => favorites.filter(v => seleccion.includes(v.id)), [favorites, seleccion]);

  if (!user) {
    return (
      <Vacio titulo="Ponlos frente a frente." texto="Crea una cuenta para guardar los carros que te gusten y compararlos pregunta por pregunta.">
        <Link href="/register?next=%2Fcompare" className="pastilla pastilla--wise h-12 px-6">
          Crear cuenta <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link href="/login?next=%2Fcompare" className="pastilla h-12 px-6">
          Ya tengo cuenta
        </Link>
      </Vacio>
    );
  }

  if (loading && favorites.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-28 md:px-8">
        <div className="h-[420px] animate-pulse rounded-[36px] bg-tarjeta" />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <Vacio titulo="Todavía no tienes favoritos." texto="Marca con el corazón los carros que te interesen en el catálogo y aquí los pones frente a frente.">
        <Link href="/vehicles" className="pastilla pastilla--tinta h-12 px-6">
          Ir al catálogo <ArrowUpRight className="h-4 w-4" />
        </Link>
      </Vacio>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-10 md:px-8 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-linea pb-8">
        <h1 className="t-titulo text-[48px] md:text-[80px]">
          Frente a frente <span className="t-ligero text-tinta-2/50">({datos.length})</span>
        </h1>
        <p className="max-w-[40ch] text-[15px] text-tinta-2">Elige de 2 a {MAX} de tus favoritos. La IA te dice para quién es cada uno y las gráficas muestran en qué gana cada cual.</p>
      </div>

      {/* Selección */}
      <div className="mt-8 flex snap-x gap-3 overflow-x-auto pb-2">
        {favorites.map(v => {
          const on = seleccion.includes(v.id);
          const lleno = !on && seleccion.length >= MAX;
          return (
            <button
              key={v.id}
              onClick={() => alternar(v.id)}
              disabled={lleno}
              aria-pressed={on}
              className={`group relative w-[220px] shrink-0 snap-start rounded-[24px] border p-4 text-left transition-all duration-300 ${
                on ? 'border-tinta bg-blanco' : 'border-transparent bg-tarjeta hover:bg-blanco'
              } ${lleno ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <span
                className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                  on ? 'bg-wise text-white' : 'border border-linea bg-blanco'
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <CarRender car={v as any} className="aspect-[480/180] w-full" />
              <p className="mt-3 truncate text-[15px] font-semibold tracking-[-0.02em]">
                {v.brand} {v.model}
              </p>
              <p className="cifra text-[13px] text-tinta-2">{millones(v.price)}</p>
            </button>
          );
        })}
      </div>

      {datos.length < 2 ? (
        <div className="mt-10 rounded-[28px] bg-tarjeta p-10 text-center">
          <p className="text-[22px] font-semibold tracking-[-0.03em]">Marca al menos dos.</p>
          <p className="mt-1 text-tinta-2">Con uno solo no hay nada que poner frente a frente.</p>
        </div>
      ) : (
        <div className="mt-10">
          <Comparador vehiculos={datos as any} />
        </div>
      )}
    </div>
  );
}
