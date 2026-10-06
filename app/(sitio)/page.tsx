'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HeroShowroom } from '@/components/home/HeroShowroom';
import { BandaComparar, ComoFunciona, Destacados, Marquesina } from '@/components/home/Secciones';
import type { VehiculoTarjeta } from '@/components/car/TarjetaCarro';
import { AIResultsLoader } from '@/components/vehicles/AIResultsLoader';
import { ResultadosIA } from '@/components/home/ResultadosIA';
import { FilterButtons } from '@/components/landing/FilterButtons';
import { getAuthToken } from '@/lib/admin-fetch';
import { sesionAnonima } from '@/lib/sesion-anonima';

function Inicio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [vehiculos, setVehiculos] = useState<VehiculoTarjeta[]>([]);
  const [total, setTotal] = useState(0);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [resultados, setResultados] = useState<any[] | null>(null);

  useEffect(() => {
    fetch('/api/vehicles?limit=200')
      .then(r => r.json())
      .then(d => {
        setVehiculos(d.vehicles ?? []);
        setTotal(d.pagination?.total ?? d.vehicles?.length ?? 0);
      })
      .catch(() => setVehiculos([]));
  }, []);

  useEffect(() => {
    if (!query) {
      setResultados(null);
      return;
    }
    setCargandoIA(true);
    setResultados(null);
    const token = getAuthToken();
    fetch('/api/ai/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      // La sesión anónima cuenta personas únicas en la demanda (se guarda con hash).
      body: JSON.stringify({ prompt: query, sesion: sesionAnonima() }),
    })
      .then(r => r.json())
      .then(d => setResultados(d.results || d))
      .catch(() => setResultados([]))
      .finally(() => setCargandoIA(false));
    requestAnimationFrame(() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth' }));
  }, [query]);

  const hayResultados =
    resultados && (Array.isArray(resultados) ? resultados.length > 0 : (resultados as any).total_matches > 0);
  const irA = (q: string) => router.push(`/?q=${encodeURIComponent(q)}#resultados`);

  return (
    <>
      <HeroShowroom consulta={query} />

      {query && (
        <section id="resultados" className="scroll-mt-24 border-b border-linea">
          <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-8">
            <p className="t-meta text-tinta-2">(Tu búsqueda)</p>
            <h2 className="t-titulo mt-3 max-w-[22ch] text-[36px] md:text-[52px]">“{query}”</h2>
            <div className="mt-10">
              {cargandoIA && <AIResultsLoader />}
              {!cargandoIA && hayResultados && (
                <ResultadosIA key={query} resultados={resultados} consulta={query} catalogo={vehiculos} />
              )}
              {!cargandoIA && resultados && !hayResultados && (
                <div className="rounded-[28px] bg-tarjeta p-10">
                  <p className="text-[22px] font-semibold tracking-[-0.03em]">No encontramos carros con esa combinación.</p>
                  <p className="mt-2 text-tinta-2">Prueba con menos condiciones o usa una de estas opciones.</p>
                  <div className="mt-6">
                    <FilterButtons currentQuery={query} onFilterClick={irA} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <Marquesina />
      <ComoFunciona />
      <Destacados vehiculos={vehiculos} total={total} />
      <BandaComparar vehiculos={vehiculos} />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-showroom" />}>
      <Inicio />
    </Suspense>
  );
}
