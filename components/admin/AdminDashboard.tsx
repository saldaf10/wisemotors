'use client';

// ============================================================================
// Panel de administración, en el sistema "Estudio".
//
// Arriba: título, las tres acciones del día a día (subir con IA, concesionario
// nuevo, leads) y un resumen del catálogo. Debajo: pestañas en pastillas.
// La subida manual (formulario de 200 campos) ya no existe: los carros entran
// por "Subir carro", con revisión humana campo por campo.
// ============================================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, Car, ClipboardCheck, Download, MessageCircle, Sparkles, Star, ThumbsUp, TrendingUp } from 'lucide-react';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';
import { VehiclesTable } from './VehiclesTable';
import { DealershipsTable } from './DealershipsTable';
import { TrendingManagement } from './TrendingManagement';
import { ColaAuditoria } from './ColaAuditoria';
import { Calificaciones } from './Calificaciones';
import { Demanda } from './Demanda';
import { specsDe } from '@/lib/vehiculo-datos';

type Pestana = 'vehicles' | 'auditoria' | 'demanda' | 'calificaciones' | 'dealerships' | 'trending';

const PESTANAS: { clave: Pestana; texto: string; icono: typeof Car }[] = [
  { clave: 'vehicles', texto: 'Vehículos', icono: Car },
  { clave: 'auditoria', texto: 'Por revisar', icono: ClipboardCheck },
  { clave: 'demanda', texto: 'Demanda', icono: TrendingUp },
  { clave: 'calificaciones', texto: 'Calificaciones', icono: ThumbsUp },
  { clave: 'dealerships', texto: 'Concesionarios', icono: Building2 },
  { clave: 'trending', texto: 'Destacados', icono: Star },
];

function BotonListaEspera() {
  const [bajando, setBajando] = useState(false);
  async function descargar() {
    setBajando(true);
    try {
      const r = await adminFetch('/api/admin/espera');
      if (!r.ok) throw new Error(mensajeDeErrorDeAuth(r) ?? 'No se pudo descargar la lista.');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `lista-espera-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo descargar la lista.');
    } finally {
      setBajando(false);
    }
  }
  return (
    <button type="button" onClick={descargar} disabled={bajando} className="pastilla h-12 px-5 disabled:opacity-60">
      <Download className="h-4 w-4" /> {bajando ? 'Descargando…' : 'Lista de espera'}
    </button>
  );
}

export function AdminDashboard() {
  const [pestana, setPestana] = useState<Pestana>('vehicles');
  const [resumen, setResumen] = useState<{ carros: number; estimados: number; concesionarios: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/vehicles?limit=1000').then(r => (r.ok ? r.json() : { vehicles: [] })),
      fetch('/api/dealers').then(r => (r.ok ? r.json() : [])),
    ])
      .then(([v, d]) => {
        const lista: any[] = v.vehicles ?? [];
        const dealers: any[] = Array.isArray(d) ? d : (d.dealers ?? []);
        setResumen({
          carros: lista.length,
          estimados: lista.filter(x => specsDe(x.specifications)?.commercial?.priceEstimated).length,
          concesionarios: dealers.length,
        });
      })
      .catch(() => setResumen(null));
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-20 pt-10 md:px-8 md:pt-14">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-linea pb-8">
        <div>
          <h1 className="t-titulo text-[48px] md:text-[80px]">Panel</h1>
          <p className="mt-2 text-[15px] text-tinta-2">Lo que se publica en WiseMotors, en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/ingest" className="pastilla pastilla--wise h-12 px-5">
            <Sparkles className="h-4 w-4" /> Subir carro
          </Link>
          <Link href="/admin/dealerships/new" className="pastilla h-12 px-5">
            <Building2 className="h-4 w-4" /> Nuevo concesionario
          </Link>
          <Link href="/admin/whatsapp-leads" className="pastilla h-12 px-5">
            <MessageCircle className="h-4 w-4" /> Leads de WhatsApp
          </Link>
          <BotonListaEspera />
        </div>
      </div>

      {/* Resumen */}
      <div className="mt-8 grid gap-4 md:grid-cols-12">
        <div className="relative overflow-hidden rounded-[28px] bg-showroom p-6 text-white md:col-span-5">
          <p className="text-[13px] text-white/55">Vehículos publicados</p>
          <p className="mt-2 text-[56px] font-light leading-none tracking-[-0.05em]">{resumen ? resumen.carros : '—'}</p>
          <Link href="/vehicles" className="mt-5 inline-flex items-center gap-1.5 text-[14px] text-white/80 hover:text-white">
            Ver el catálogo público <ArrowUpRight className="h-4 w-4" />
          </Link>
          <p aria-hidden className="t-display pointer-events-none absolute -bottom-6 -right-2 text-[140px] leading-none text-white/[0.05]">
            WISE
          </p>
        </div>
        <div className="rounded-[28px] bg-[#efe4f7] p-6 md:col-span-4">
          <p className="text-[13px] text-tinta-2">Con precio estimado</p>
          <p className="mt-2 text-[56px] font-light leading-none tracking-[-0.05em]">{resumen ? resumen.estimados : '—'}</p>
          <p className="mt-3 text-[13px] leading-snug text-tinta-2">
            Confírmalos con el concesionario y edita el precio: dejan de mostrarse como "estimado".
          </p>
        </div>
        <div className="rounded-[28px] bg-blanco p-6 md:col-span-3">
          <p className="text-[13px] text-tinta-2">Concesionarios</p>
          <p className="mt-2 text-[56px] font-light leading-none tracking-[-0.05em]">{resumen ? resumen.concesionarios : '—'}</p>
          <Link href="/admin/dealerships/new" className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-wise hover:underline">
            Agregar uno <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Pestañas */}
      <div className="mt-12 flex flex-wrap gap-2" role="tablist">
        {PESTANAS.map(p => (
          <button
            key={p.clave}
            role="tab"
            aria-selected={pestana === p.clave}
            onClick={() => setPestana(p.clave)}
            className="pastilla h-11 px-5"
            data-activa={pestana === p.clave}
          >
            <p.icono className="h-4 w-4" /> {p.texto}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[28px] bg-blanco">
        {pestana === 'vehicles' ? (
          <VehiclesTable />
        ) : pestana === 'auditoria' ? (
          <ColaAuditoria />
        ) : pestana === 'demanda' ? (
          <Demanda />
        ) : pestana === 'calificaciones' ? (
          <Calificaciones />
        ) : pestana === 'dealerships' ? (
          <DealershipsTable />
        ) : (
          <div className="p-6">
            <TrendingManagement onClose={() => setPestana('vehicles')} />
          </div>
        )}
      </div>
    </div>
  );
}
