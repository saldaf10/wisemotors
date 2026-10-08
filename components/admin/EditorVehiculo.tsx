'use client';

// ============================================================================
// Editor de un carro publicado (reemplaza el formulario viejo de 200 campos).
//
// Todo sale del registro de atributos: si mañana se agrega un campo, aparece
// aquí solo. Arriba lo que más se toca (identidad, precio, concesionarios,
// fotos por vista, datos clave); abajo la ficha técnica
// completa por grupos, con buscador. Los cambios se acumulan y se guardan en un
// solo paso; dejar un campo vacío borra ese dato.
// ============================================================================

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Loader2, Search, Trash2 } from 'lucide-react';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';
import { ATTRIBUTE_REGISTRY, attributeAppliesTo, type AttributeDef } from '@/lib/attributes/registry';
import { sinDatoDeSpecs, valoresDeSpecs } from '@/lib/attributes/clave';
import { DatosClave, numeroEscrito } from './DatosClave';
import { RevisionFotos, VISTAS, type FotoRevision } from './RevisionFotos';
import { CATEGORIAS, claseDeTipo, TIPOS_CARROCERIA } from '@/lib/attributes/clase';

const TIPOS = TIPOS_CARROCERIA;
const TRENES = ['Gasolina', 'Diesel', 'Eléctrico', 'Híbrido', 'Híbrido Enchufable'];
const ESTADOS = ['Disponible', 'Agotado', 'Próximamente'];

type Valor = number | string | boolean;
/** key → nuevo valor; null = quitar el dato. */
type Cambios = Record<string, Valor | null>;

const ANGULO_DE_TIPO: Record<string, string> = Object.fromEntries(VISTAS.map(v => [v.angulo, v.angulo]));

/** La vista de la portada sale de su texto alternativo ("Onix RS, de lado" / "…, vista 3/4 delantera"). */
function vistaDeAlt(alt: string): string {
  const t = alt.toLowerCase();
  if (/3\/4 delant/.test(t)) return 'tres_cuartos_frente';
  if (/3\/4 tras/.test(t)) return 'tres_cuartos_atras';
  if (/interior/.test(t)) return 'interior';
  if (/de frente|frontal/.test(t)) return 'frente';
  if (/de atr[aá]s|trasera/.test(t)) return 'atras';
  return 'lado';
}

/** Fotos publicadas → estado de la revisión de fotos (una por vista; la portada es la lateral). */
function fotosDeImagenes(imagenes: any[]): FotoRevision[] {
  const ordenadas = [...(imagenes ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const ocupadas = new Set<string>();
  return ordenadas.map(img => {
    // La portada se guarda como type 'cover'; su vista sale del texto alternativo o se asume lateral.
    const angulo = img.type === 'cover' ? vistaDeAlt(String(img.alt ?? '')) : (ANGULO_DE_TIPO[img.type] ?? 'detalle');
    const usar = !ocupadas.has(angulo);
    ocupadas.add(angulo);
    return {
      original: img.url,
      pagina: 'publicada',
      oficial: true,
      angulo,
      miraA: 'no_aplica',
      estudio: true,
      calidad: 5,
      recomendada: true,
      procesada: img.url,
      usar,
      portada: !!img.isThumbnail || img.type === 'cover',
    };
  });
}

function EntradaDato({ def, valor, onCambio }: { def: AttributeDef; valor: Valor | null | undefined; onCambio: (v: Valor | null) => void }) {
  const [texto, setTexto] = useState(valor === null || valor === undefined ? '' : String(valor));
  useEffect(() => setTexto(valor === null || valor === undefined ? '' : String(valor)), [valor]);

  if (def.dataType === 'boolean') {
    return (
      <select
        value={valor === true ? 'si' : valor === false ? 'no' : ''}
        onChange={e => onCambio(e.target.value === 'si' ? true : e.target.value === 'no' ? false : null)}
        className="h-9 w-40 rounded-lg border border-linea bg-blanco px-2 text-[13px]"
        aria-label={def.labelEs}
      >
        <option value="">Sin dato</option>
        <option value="si">Sí lo tiene</option>
        <option value="no">No lo tiene</option>
      </select>
    );
  }
  if (def.opciones) {
    return (
      <select
        value={typeof valor === 'string' ? valor : ''}
        onChange={e => onCambio(e.target.value || null)}
        className="h-9 w-40 rounded-lg border border-linea bg-blanco px-2 text-[13px]"
        aria-label={def.labelEs}
      >
        <option value="">Sin dato</option>
        {def.opciones.map(o => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  const guardar = () => {
    const t = texto.trim();
    if (!t) return onCambio(null);
    if (def.dataType === 'numeric') {
      const n = numeroEscrito(t);
      if (n !== null && n > 0) onCambio(n);
      else setTexto(valor === null || valor === undefined ? '' : String(valor));
    } else onCambio(t.slice(0, 200));
  };
  return (
    <span className="flex items-center gap-1.5">
      <input
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        inputMode={def.dataType === 'numeric' ? 'decimal' : 'text'}
        className={`h-9 rounded-lg border border-linea bg-blanco px-2 text-[13px] font-semibold ${def.dataType === 'numeric' ? 'w-28 text-right' : 'w-40'}`}
        aria-label={def.labelEs}
      />
      <span className="w-14 text-[12px] text-tinta-2">{def.unit ?? ''}</span>
    </span>
  );
}

export function EditorVehiculo({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [v, setV] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Estado editable
  const [identidad, setIdentidad] = useState<Record<string, any>>({});
  const [precio, setPrecio] = useState('');
  const [cambios, setCambios] = useState<Cambios>({});
  const [fotos, setFotos] = useState<FotoRevision[]>([]);
  const [fotosTocadas, setFotosTocadas] = useState(false);
  const [dealerIds, setDealerIds] = useState<string[]>([]);
  const [sinDato, setSinDato] = useState<string[]>([]);
  const [concesionarios, setConcesionarios] = useState<{ id: string; name: string; location: string }[]>([]);
  const [filtro, setFiltro] = useState('');
  const [soloConDato, setSoloConDato] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/vehicles/${vehicleId}`);
    if (!res.ok) {
      setError('No se encontró el vehículo');
      return;
    }
    const d = await res.json();
    setV(d);
    setIdentidad({ brand: d.brand, model: d.model, year: d.year, type: d.type, vehicleType: d.vehicleType, fuelType: d.fuelType, status: d.status });
    setPrecio(String(Math.round(d.price)));
    setCambios({});
    setFotos(fotosDeImagenes(d.images));
    setFotosTocadas(false);
    setDealerIds((d.vehicleDealers ?? []).map((x: any) => x.dealerId ?? x.dealer?.id));
    setSinDato(sinDatoDeSpecs(d.specifications ?? {}));
  }, [vehicleId]);

  useEffect(() => {
    cargar();
    fetch('/api/dealers')
      .then(r => (r.ok ? r.json() : []))
      .then((d: any) => setConcesionarios(Array.isArray(d) ? d : (d.dealers ?? [])))
      .catch(() => setConcesionarios([]));
  }, [cargar]);

  const specs = v?.specifications ?? {};
  const actuales = useMemo(() => valoresDeSpecs(specs), [specs]);
  const valores = useMemo(() => {
    const out: Record<string, unknown> = { ...actuales };
    for (const [k, x] of Object.entries(cambios)) {
      if (x === null) delete out[k];
      else out[k] = x;
    }
    return out;
  }, [actuales, cambios]);

  const fuelType = identidad.fuelType ?? v?.fuelType ?? 'Gasolina';
  const grupos = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    const map = new Map<string, AttributeDef[]>();
    for (const d of ATTRIBUTE_REGISTRY) {
      if (d.key === 'commercial.priceCop' || !attributeAppliesTo(d, fuelType)) continue;
      if (f && !d.labelEs.toLowerCase().includes(f) && !d.displayGroup.toLowerCase().includes(f)) continue;
      if (soloConDato && valores[d.key] === undefined) continue;
      const lista = map.get(d.displayGroup) ?? [];
      lista.push(d);
      map.set(d.displayGroup, lista);
    }
    return Array.from(map.entries()).map(([g, defs]) => [g, defs.sort((a, b) => b.displayPriority - a.displayPriority)] as const);
  }, [fuelType, filtro, soloConDato, valores]);

  if (error) return <p className="mt-8 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>;
  if (!v) {
    return (
      <div className="flex items-center gap-2 p-10 text-tinta-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const identidadCambiada = Object.fromEntries(Object.entries(identidad).filter(([k, x]) => String(x) !== String(v[k])));
  const precioCambiado = Number(precio) > 0 && Math.round(Number(precio)) !== Math.round(v.price);
  const dealersOriginales = (v.vehicleDealers ?? []).map((x: any) => x.dealerId ?? x.dealer?.id).sort().join(',');
  const dealersCambiados = [...dealerIds].sort().join(',') !== dealersOriginales;
  const sinDatoCambiado = [...sinDato].sort().join(',') !== [...sinDatoDeSpecs(specs)].sort().join(',');
  const nCambios =
    Object.keys(identidadCambiada).length + (precioCambiado ? 1 : 0) + Object.keys(cambios).length + (fotosTocadas ? 1 : 0) + (dealersCambiados ? 1 : 0) + (sinDatoCambiado ? 1 : 0);
  const precioEstimado = !!specs.commercial?.priceEstimated;

  const poner = (key: string, x: Valor | null) =>
    setCambios(prev => {
      const antes = actuales[key];
      const sigue = x === null ? antes === undefined : x === antes;
      const nuevo = { ...prev };
      if (sigue) delete nuevo[key];
      else nuevo[key] = x;
      return nuevo;
    });

  async function guardar() {
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const cuerpo: Record<string, unknown> = {};
      if (Object.keys(identidadCambiada).length) cuerpo.identidad = { ...identidadCambiada, year: identidadCambiada.year !== undefined ? Number(identidadCambiada.year) : undefined };
      if (precioCambiado) cuerpo.precio = Number(precio);
      const hechos = Object.entries(cambios).filter(([, x]) => x !== null).map(([key, valor]) => ({ key, valor }));
      const quitar = Object.entries(cambios).filter(([, x]) => x === null).map(([k]) => k);
      if (hechos.length) cuerpo.hechos = hechos;
      if (quitar.length) cuerpo.quitar = quitar;
      if (dealersCambiados) cuerpo.dealerIds = dealerIds;
      if (sinDatoCambiado) cuerpo.sinDato = sinDato;
      if (fotosTocadas) {
        cuerpo.fotos = [...fotos.filter(f => f.usar && f.portada), ...fotos.filter(f => f.usar && !f.portada)]
          .filter(f => f.procesada)
          .map(f => ({ url: f.procesada, angulo: f.angulo, portada: f.portada }));
      }
      const res = await adminFetch(`/api/admin/vehicles/${vehicleId}/editar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeDeErrorDeAuth(res) ?? d.error ?? 'No se pudo guardar');
      await cargar();
      setAviso('Cambios guardados.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar ${v.brand} ${v.model} ${v.year} del catálogo? No se puede deshacer.`)) return;
    const res = await adminFetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin');
    else setError('No se pudo eliminar');
  }

  const campo = 'h-10 w-full rounded-lg border border-linea bg-blanco px-3 text-[14px]';

  return (
    <div className="mt-6 space-y-6 pb-28">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-6">
        <div>
          <h1 className="t-titulo text-[40px] md:text-[64px]">
            {v.brand} <span className="text-tinta-2/60">{v.model}</span>
          </h1>
          <p className="mt-1 text-tinta-2">{v.year} · {v.fuelType} · {v.type}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/vehicles/${v.id}`} target="_blank" className="pastilla h-11 px-5">
            Ver ficha <ArrowUpRight className="h-4 w-4" />
          </Link>
          <button type="button" onClick={eliminar} className="pastilla h-11 px-5 text-red-700">
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        </div>
      </div>

      {/* Identidad, precio y concesionarios */}
      <div className="rounded-[28px] border border-linea bg-blanco p-6">
        <h3 className="font-bold text-tinta">Identidad y precio</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="text-xs text-tinta-2">
            Marca
            <input className={campo} value={identidad.brand ?? ''} onChange={e => setIdentidad({ ...identidad, brand: e.target.value })} />
          </label>
          <label className="text-xs text-tinta-2">
            Modelo (con versión)
            <input className={campo} value={identidad.model ?? ''} onChange={e => setIdentidad({ ...identidad, model: e.target.value })} />
          </label>
          <label className="text-xs text-tinta-2">
            Año
            <input className={campo} inputMode="numeric" value={identidad.year ?? ''} onChange={e => setIdentidad({ ...identidad, year: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="text-xs text-tinta-2">
            Precio (COP){precioEstimado && !precioCambiado && <span className="ml-1 text-wise">· estimado, confírmalo</span>}
            <input className={campo} inputMode="numeric" value={precio} onChange={e => setPrecio(e.target.value.replace(/\D/g, ''))} />
            {Number(precio) > 0 && <span className="mt-1 block">= ${Math.round(Number(precio) / 1e6)} millones</span>}
          </label>
          <label className="text-xs text-tinta-2">
            Carrocería
            <select className={campo} value={identidad.type ?? ''} onChange={e => setIdentidad({ ...identidad, type: e.target.value })}>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-tinta-2">
            Categoría
            <select className={campo} value={identidad.vehicleType ?? ''} onChange={e => setIdentidad({ ...identidad, vehicleType: e.target.value })}>
              {CATEGORIAS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-tinta-2">
            Tren motriz
            <select className={campo} value={identidad.fuelType ?? ''} onChange={e => setIdentidad({ ...identidad, fuelType: e.target.value })}>
              {TRENES.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-tinta-2">
            Estado (solo "Disponible" sale en el catálogo)
            <select className={campo} value={identidad.status ?? ''} onChange={e => setIdentidad({ ...identidad, status: e.target.value })}>
              {ESTADOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-5">
          <p className="text-xs text-tinta-2">¿Quién lo vende?</p>
          {concesionarios.length === 0 ? (
            <p className="mt-1 text-sm text-tinta-2">
              Aún no hay concesionarios. <Link href="/admin/dealerships/new" className="text-wise hover:underline">Crear uno ↗</Link>
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {concesionarios.map(c => {
                const activo = dealerIds.includes(c.id);
                return (
                  <button key={c.id} type="button" className="pastilla h-10 px-4" data-activa={activo} aria-pressed={activo}
                    onClick={() => setDealerIds(activo ? dealerIds.filter(x => x !== c.id) : [...dealerIds, c.id])}>
                    {c.name}<span className="text-xs text-tinta-2/70">· {c.location}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fotos */}
      <RevisionFotos
        fotos={fotos}
        onChange={cambio => {
          setFotos(cambio);
          setFotosTocadas(true);
        }}
      />

      {/* Datos clave + complementar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DatosClave
          fuelType={fuelType}
          clase={claseDeTipo(identidad?.type)}
          valores={valores}
          sinDato={sinDato}
          onValor={(key, valor) => poner(key, valor)}
          onSinDato={(id, marcar) => setSinDato(marcar ? [...sinDato, id] : sinDato.filter(x => x !== id))}
        />
      </div>

      {/* Ficha técnica completa */}
      <div className="rounded-[28px] border border-linea bg-blanco p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-tinta">Ficha técnica completa</h3>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-tinta-2">
              <input type="checkbox" className="h-4 w-4 accent-[#881cb7]" checked={soloConDato} onChange={e => setSoloConDato(e.target.checked)} />
              Solo los que tienen dato
            </label>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-2" />
              <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar un campo…" className="h-10 w-56 rounded-full border border-linea pl-9 pr-3 text-sm" />
            </span>
          </div>
        </div>
        <p className="mt-1 text-sm text-tinta-2">Deja un campo vacío (o "Sin dato") para quitarlo de la ficha.</p>
        <div className="mt-4 columns-1 gap-6 lg:columns-2">
          {grupos.map(([grupo, defs]) => (
            <div key={grupo} className="mb-6 break-inside-avoid">
              <p className="t-meta mb-1 text-tinta-2">{grupo}</p>
              <ul className="divide-y divide-linea">
                {defs.map(d => (
                  <li key={d.key} className={`flex items-center justify-between gap-3 py-2 ${d.key in cambios ? 'bg-[#faf5ff]' : ''}`}>
                    <span className="text-[13px]">{d.labelEs}</span>
                    <EntradaDato def={d} valor={valores[d.key] as Valor | undefined} onCambio={x => poner(d.key, x)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Guardar */}
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linea bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="text-sm text-tinta-2">
          {error ? <span className="text-red-700">{error}</span> : aviso && nCambios === 0 ? aviso : nCambios ? `${nCambios} cambios sin guardar` : 'Sin cambios'}
        </p>
        <div className="flex gap-2">
          <button type="button" className="pastilla h-11 px-5" disabled={!nCambios || guardando} onClick={cargar}>
            Descartar
          </button>
          <button type="button" className="pastilla pastilla--wise h-11 px-5" disabled={!nCambios || guardando} onClick={guardar}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : `Guardar ${nCambios || ''} cambios`}
          </button>
        </div>
      </div>
    </div>
  );
}
