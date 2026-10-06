'use client';

// ============================================================================
// Estudio de ingesta: el humano escribe una línea por vehículo ("Onix RS 2026")
// → la cola corre el pipeline uno a uno → cada borrador queda listo para que el
// humano acepte/rechace/edite CAMPO POR CAMPO → publicar.
// Nada llega a la base sin pasar por esta pantalla.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch, mensajeDeErrorDeAuth } from '@/lib/admin-fetch';
import { Button } from '@/components/ui/button';
import { RevisionFotos, fotosIniciales, subirFotoVista, VISTAS, type FotoRevision } from '@/components/admin/RevisionFotos';
import { parseVehicleList, type ParsedVehicleQuery } from '@/lib/ingest/parse-query';
import { DatosClave, numeroEscrito, type ValorManual } from '@/components/admin/DatosClave';
import { clavesFaltantes } from '@/lib/attributes/clave';
import { ATTRIBUTE_REGISTRY, fueraDeRango } from '@/lib/attributes/registry';
import { CATEGORIAS, CLASES, claseDeTipo, TIPOS_CARROCERIA, type ClaseVehiculo } from '@/lib/attributes/clase';
import { Loader2, ExternalLink, AlertTriangle, CheckCircle2, XCircle, Sparkles, Clock, ChevronRight, Paperclip, FileText, Link2 } from 'lucide-react';

const TYPES = TIPOS_CARROCERIA;
const VEHICLE_TYPES = CATEGORIAS;
const FUEL_TYPES = ['Gasolina', 'Diesel', 'Eléctrico', 'Híbrido', 'Híbrido Enchufable'];

interface DraftFact {
  key: string;
  labelEs: string;
  unit?: string;
  displayGroup: string;
  value: number | string | boolean;
  confidence: number;
  sourceUrl: string;
  tier: number;
  quote: string;
  conflict: boolean;
  outOfRange: boolean;
  alternatives: { value: number | string | boolean; sourceUrl: string; tier: number }[];
}

interface Draft {
  brand: string;
  model: string;
  year: number;
  country: string;
  type: string;
  vehicleType: string;
  fuelType: string;
  price: { value: number; estimated: boolean; reasoningEs: string; sourceUrl?: string; confidence: number } | null;
  facts: DraftFact[];
  sourcesReport: { url: string; nameEs: string; tier: number; ok: boolean; note?: string }[];
  fotos?: Omit<FotoRevision, 'usar' | 'portada'>[];
  warningsEs: string[];
}

type Phase = 'form' | 'review' | 'publishing' | 'done';

type EstadoItem = 'en cola' | 'buscando' | 'listo' | 'error' | 'publicado';

interface ItemCola {
  id: number;
  raw: string;
  parsed: ParsedVehicleQuery;
  estado: EstadoItem;
  draft?: Draft;
  error?: string;
  publicadoId?: string;
  /** Nombres de los documentos del concesionario (los archivos viven en memoria). */
  documentos?: string[];
  /** Enlaces que puso el equipo como fuentes principales. */
  enlaces?: string[];
  /** Fotos del concesionario ya subidas y procesadas, por vista. */
  fotosPropias?: FotoRevision[];
  /** Qué etapa de la ingesta va corriendo ("Leyendo fuentes 2 de 5…"). */
  avance?: string;
  /** Carro, pickup o van/camión: lo elige el equipo al subir. */
  clase?: ClaseVehiculo;
}

// ── Ingesta por etapas (lib/ingest/pipeline.ts): cada etapa es su propia
// petición de hasta 300 s, así una ficha larga se lee completa. ──
type Ctx = Record<string, unknown>;
type Fuente = { url: string; tier: number; nameEs: string };
type Leida = { report: Draft['sourcesReport'][number]; facts: { key: string; value: unknown }[] };
type FotosEtapa = { fotos: NonNullable<Draft['fotos']>; avisos: string[] };

/** Llama una etapa. Lanza con `fatal` si es un error que no se arregla reintentando (saldo, sesión). */
async function etapa<T>(cuerpo: Record<string, unknown> | FormData): Promise<T> {
  const res = await adminFetch(
    '/api/admin/ingest',
    cuerpo instanceof FormData
      ? { method: 'POST', body: cuerpo }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }
  );
  // Si Vercel corta la función responde con su página de error en texto, no JSON.
  const texto = await res.text();
  let data: any;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new Error(
      res.status === 504 || /timeout|timed out|FUNCTION_INVOCATION/i.test(texto)
        ? 'Una etapa se pasó del tiempo del servidor (5 min).'
        : `El servidor respondió con un error (${res.status}).`
    );
  }
  if (!res.ok) {
    const auth = mensajeDeErrorDeAuth(res);
    throw Object.assign(new Error(auth ?? data?.error ?? 'Falló la ingesta'), { fatal: !!auth || !!data?.fatal });
  }
  return data as T;
}

const esFatal = (err: unknown) => !!(err as { fatal?: boolean })?.fatal;

/** Una fuente que no se pudo leer queda en el informe; la ingesta sigue. */
function leidaFallida(url: string, nameEs: string, tier: number, err: unknown): Leida {
  if (esFatal(err)) throw err;
  return { report: { url, nameEs, tier, ok: false, note: `No se pudo leer (${err instanceof Error ? err.message : 'error'}). Reintenta el vehículo si era importante.` }, facts: [] };
}

/** Vercel corta el cuerpo en ~4,5 MB. */
const MAX_BYTES_DOCUMENTOS = 4.2 * 1024 * 1024;

/**
 * Reduce una foto de ficha técnica a 2000 px de lado mayor en JPEG: sigue
 * legible para la IA y pesa una fracción. Los PDF pasan tal cual.
 */
async function prepararArchivo(f: File): Promise<File> {
  if (!f.type.startsWith('image/')) return f;
  const bitmap = await createImageBitmap(f).catch(() => null);
  if (!bitmap) return f;
  const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85));
  return blob && blob.size < f.size ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
}

const CLAVE_COLA = 'wisemotors:cola-ingesta';

const DEF = new Map(ATTRIBUTE_REGISTRY.map(d => [d.key, d]));

/** ¿Este valor numérico se sale del rango físico de la clase? (texto escrito por el revisor incluido) */
function fueraDeSuRango(key: string, valor: unknown, clase: ClaseVehiculo): boolean {
  const d = DEF.get(key);
  if (!d || d.dataType !== 'numeric') return false;
  const n = typeof valor === 'number' ? valor : numeroEscrito(String(valor ?? ''));
  return n !== null && fueraDeRango(d, n, clase);
}

const EJEMPLO = 'Onix RS 2026\nRenault Duster 2026\nBYD Dolphin Mini';

function host(url: string): string {
  if (url.startsWith('concesionario://')) return `documento del concesionario (${url.slice(16)})`;
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function TierBadge({ tier }: { tier: number }) {
  const styles = tier === 1 ? 'bg-purple-100 text-purple-800' : tier === 2 ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-rose-100 text-rose-800';
  const label = tier === 1 ? 'Fabricante' : tier === 2 ? 'Prensa' : 'Comunidad';
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${styles}`}>T{tier} · {label}</span>;
}

function EstadoIcono({ estado }: { estado: EstadoItem }) {
  if (estado === 'buscando') return <Loader2 className="w-4 h-4 text-wise animate-spin shrink-0" />;
  if (estado === 'listo') return <Sparkles className="w-4 h-4 text-wise shrink-0" />;
  if (estado === 'publicado') return <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />;
  if (estado === 'error') return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
  return <Clock className="w-4 h-4 text-gray-300 shrink-0" />;
}

export function IngestStudio() {
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);

  // Cola: una línea por vehículo
  const [texto, setTexto] = useState('');
  const [country, setCountry] = useState('CO');
  // Carro, pickup o van/camión: cambia los rangos válidos (el furgón de una van
  // pasa de 10.000 L) y los datos que se piden (carga útil, remolque, PBV).
  const [clase, setClase] = useState<ClaseVehiculo>('auto');
  const [cola, setCola] = useState<ItemCola[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const siguienteId = useRef(1);
  const corriendo = useRef(false);
  // Documentos del concesionario por item de la cola (no caben en localStorage).
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  // Enlaces principales (página oficial, ficha en PDF…), uno por línea.
  const [textoEnlaces, setTextoEnlaces] = useState('');
  const enlacesForm = useMemo(
    () => Array.from(new Set(textoEnlaces.split(/\s+/).map(x => x.trim()).filter(x => /^https?:\/\/[^\s.]+\.[^\s]+/i.test(x)))).slice(0, 6),
    [textoEnlaces]
  );
  // Fotos del concesionario por vista: se suben y procesan apenas se eligen.
  const [fotosForm, setFotosForm] = useState<Record<string, FotoRevision | 'subiendo'>>({});
  const archivos = useRef(new Map<number, File[]>());

  const vistaPrevia = useMemo(() => parseVehicleList(texto), [texto]);

  // La cola sobrevive a salir de la página: cada borrador ya costó una ingesta.
  // Se guarda en este navegador; lo que estaba corriendo al salir queda como
  // interrumpido (su resultado se perdió) y se reintenta a mano, nunca solo.
  const colaCargada = useRef(false);
  useEffect(() => {
    try {
      const guardada = JSON.parse(localStorage.getItem(CLAVE_COLA) ?? '[]') as ItemCola[];
      if (Array.isArray(guardada) && guardada.length) {
        setCola(
          guardada.map(i =>
            i.estado === 'buscando'
              ? { ...i, estado: 'error', error: 'Se interrumpió al salir de la página. Dale Reintentar.' }
              : i
          )
        );
        siguienteId.current = Math.max(...guardada.map(i => i.id)) + 1;
      }
    } catch {
      /* sin almacenamiento: la cola vive solo en esta pestaña */
    }
    colaCargada.current = true;
  }, []);
  useEffect(() => {
    if (!colaCargada.current) return;
    try {
      localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
    } catch {
      /* cuota llena o bloqueado: se sigue sin guardar */
    }
  }, [cola]);

  // Avisa antes de cerrar o recargar mientras algo se está buscando.
  const buscando = cola.some(i => i.estado === 'buscando');
  useEffect(() => {
    if (!buscando) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [buscando]);

  // Borrador en revisión
  const [draft, setDraft] = useState<Draft | null>(null);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [priceValue, setPriceValue] = useState<string>('');
  const [fotos, setFotos] = useState<FotoRevision[]>([]);
  // Datos clave completados a mano en la revisión, y los marcados "no existe".
  const [manuales, setManuales] = useState<Record<string, ValorManual>>({});
  const [sinDato, setSinDato] = useState<string[]>([]);
  const [published, setPublished] = useState<{ id: string; label: string } | null>(null);

  // Concesionarios que venden el carro. La última selección se recuerda: en una
  // carga por lotes casi siempre es el mismo concesionario.
  const [concesionarios, setConcesionarios] = useState<{ id: string; name: string; location: string }[]>([]);
  const [dealerIds, setDealerIdsState] = useState<string[]>([]);
  const setDealerIds = (ids: string[]) => {
    setDealerIdsState(ids);
    try {
      localStorage.setItem('wise.ingest.concesionarios', JSON.stringify(ids));
    } catch {}
  };
  useEffect(() => {
    try {
      const guardados = JSON.parse(localStorage.getItem('wise.ingest.concesionarios') ?? '[]');
      if (Array.isArray(guardados)) setDealerIdsState(guardados.filter((x: unknown) => typeof x === 'string'));
    } catch {}
    fetch('/api/dealers')
      .then(r => (r.ok ? r.json() : []))
      .then((d: any) => setConcesionarios(Array.isArray(d) ? d : (d.dealers ?? [])))
      .catch(() => setConcesionarios([]));
  }, []);

  const groups = useMemo(() => {
    if (!draft) return [];
    const map = new Map<string, DraftFact[]>();
    for (const f of draft.facts) {
      const list = map.get(f.displayGroup) ?? [];
      list.push(f);
      map.set(f.displayGroup, list);
    }
    return Array.from(map.entries());
  }, [draft]);

  const acceptedCount = draft ? draft.facts.filter(f => accepted[f.key]).length : 0;
  // La clase sale de la carrocería del borrador: si el revisor la cambia a
  // Camión, cambian los rangos y los datos clave al instante.
  const claseDraft = claseDeTipo(draft?.type);
  // Un borrador vacío ("Ninguna fuente respondió") publicaría un carro sin un solo dato.
  const sinDatos = acceptedCount + Object.keys(manuales).length === 0;

  /** key → valor de lo que se publicaría: lo aceptado (con ediciones) + lo puesto a mano. */
  const valoresPublicables = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of draft?.facts ?? []) {
      if (accepted[f.key]) out[f.key] = edited[f.key] !== undefined && edited[f.key] !== '' ? edited[f.key] : f.value;
    }
    return { ...out, ...manuales };
  }, [draft, accepted, edited, manuales]);

  function encolar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nuevos: ItemCola[] = vistaPrevia
      .filter((l): l is { raw: string; parsed: ParsedVehicleQuery } => l.parsed !== null)
      .map(l => ({ id: siguienteId.current++, raw: l.raw, parsed: l.parsed, estado: 'en cola', clase }));
    if (nuevos.length === 0) {
      setError('Escribe al menos un vehículo, por ejemplo "Onix RS 2026".');
      return;
    }
    if (adjuntos.length > 0) {
      if (nuevos.length > 1) {
        setError('Los documentos son de un solo carro: escribe una sola línea cuando adjuntes fichas.');
        return;
      }
      archivos.current.set(nuevos[0].id, adjuntos);
      nuevos[0].documentos = adjuntos.map(f => f.name);
    }
    if (enlacesForm.length > 0) {
      if (nuevos.length > 1) {
        setError('Los enlaces son de un solo carro: escribe una sola línea cuando pongas enlaces.');
        return;
      }
      nuevos[0].enlaces = enlacesForm;
    }
    const propias = Object.values(fotosForm).filter((f): f is FotoRevision => f !== 'subiendo');
    if (Object.values(fotosForm).includes('subiendo')) {
      setError('Espera a que terminen de subir las fotos.');
      return;
    }
    if (propias.length > 0) {
      if (nuevos.length > 1) {
        setError('Las fotos son de un solo carro: escribe una sola línea cuando subas fotos.');
        return;
      }
      nuevos[0].fotosPropias = propias;
    }
    setCola(prev => [...prev, ...nuevos]);
    setTexto('');
    setAdjuntos([]);
    setTextoEnlaces('');
    setFotosForm({});
  }

  // Un pipeline a la vez: cada uno hace ~6 fetch + varias llamadas LLM, y en
  // paralelo se pisan los límites de Claude y de los sitios de prensa.
  useEffect(() => {
    if (corriendo.current) return;
    const item = cola.find(i => i.estado === 'en cola');
    if (!item) return;
    corriendo.current = true;
    const actualizar = (cambio: Partial<ItemCola>) =>
      setCola(prev => prev.map(i => (i.id === item.id ? { ...i, ...cambio } : i)));
    actualizar({ estado: 'buscando' });

    (async () => {
      try {
        const docs = archivos.current.get(item.id) ?? [];
        if (item.documentos?.length && docs.length === 0) {
          throw new Error('Los documentos adjuntos se perdieron al recargar la página: quítalo de la cola y agrégalo de nuevo con sus archivos.');
        }

        // 1. Identidad + fuentes
        actualizar({ avance: 'Identificando el carro y buscando fuentes…' });
        const { ctx, fuentes } = await etapa<{ ctx: Ctx; fuentes: Fuente[] }>({
          etapa: 'preparar',
          brand: item.parsed.brand,
          model: item.parsed.model,
          year: item.parsed.year,
          country,
          clase: item.clase,
          enlaces: item.enlaces ?? [],
        });

        // 2. Documentos y fuentes, cada uno en su petición y todos a la vez; fotos en paralelo.
        const fotosP = etapa<FotosEtapa>({
          etapa: 'fotos',
          ctx,
          fuentes,
          angulosCubiertos: (item.fotosPropias ?? []).map(f => f.angulo),
        }).catch((err): FotosEtapa => {
          if (esFatal(err)) throw err;
          return { fotos: [], avisos: [`No se pudieron buscar fotos (${err instanceof Error ? err.message : 'error'}): súbelas en la revisión.`] };
        });
        fotosP.catch(() => {});
        let leidasN = 0;
        const leerTodas = async (titulo: string, tareas: (() => Promise<Leida>)[]) => {
          leidasN = 0;
          const avance = () => actualizar({ avance: `${titulo} ${leidasN} de ${tareas.length}…` });
          avance();
          return Promise.all(tareas.map(t => t().finally(() => { leidasN++; avance(); })));
        };
        const leidas = await leerTodas('Leyendo fuentes', [
          ...docs.map(f => () => {
            const form = new FormData();
            form.set('etapa', 'documento');
            form.set('ctx', JSON.stringify(ctx));
            form.append('documento', f);
            return etapa<Leida>(form).catch(err => leidaFallida(`concesionario://${f.name}`, `Concesionario: ${f.name}`, 1, err));
          }),
          ...fuentes.map(s => () => etapa<Leida>({ etapa: 'fuente', ctx, source: s }).catch(err => leidaFallida(s.url, s.nameEs, s.tier, err))),
        ]);

        // 3. Los datos CLAVE que no salieron: páginas nuevas, solo esos datos.
        actualizar({ avance: 'Buscando los datos clave que faltan…' });
        const faltantes = await etapa<{ fuentes: Fuente[]; soloKeys: string[] }>({
          etapa: 'faltantes',
          ctx,
          facts: leidas.flatMap(l => l.facts.map(f => ({ key: f.key, value: f.value }))),
          yaLeidas: fuentes.map(s => s.url),
        }).catch(err => {
          if (esFatal(err)) throw err;
          return { fuentes: [], soloKeys: [] };
        });
        const extras = await leerTodas(
          'Leyendo fuentes de los datos que faltaban',
          faltantes.fuentes.map(s => () =>
            etapa<Leida>({ etapa: 'fuente', ctx, source: s, soloKeys: faltantes.soloKeys }).catch(err => leidaFallida(s.url, s.nameEs, s.tier, err))
          )
        );

        // 4. Reconciliar, validar y precio.
        actualizar({ avance: 'Armando el borrador y revisando el precio…' });
        const fotos = await fotosP;
        const { draft } = await etapa<{ draft: Draft }>({ etapa: 'cerrar', ctx, leidas: [...leidas, ...extras], fotos });

        // Las fotos del concesionario van primero: ocupan su vista en la revisión.
        const draftConFotos = item.fotosPropias?.length
          ? { ...draft, fotos: [...item.fotosPropias, ...(draft.fotos ?? [])] }
          : draft;
        actualizar({ estado: 'listo', draft: draftConFotos, avance: undefined });
      } catch (err) {
        actualizar({ estado: 'error', avance: undefined, error: err instanceof Error ? err.message : 'Error inesperado' });
      } finally {
        corriendo.current = false;
        // Dispara el siguiente: el efecto depende de `cola`, que acaba de cambiar.
        setCola(prev => [...prev]);
      }
    })();
  }, [cola, country]);

  function abrirRevision(item: ItemCola) {
    if (!item.draft) return;
    const d = item.draft;
    setAbierto(item.id);
    setDraft(d);
    // Por defecto: aceptado todo lo que no esté fuera de rango físico
    const initial: Record<string, boolean> = {};
    for (const f of d.facts) initial[f.key] = !f.outOfRange;
    setAccepted(initial);
    setEdited({});
    setPriceValue(d.price ? String(d.price.value) : '');
    setFotos(fotosIniciales(d.fotos));
    setManuales({});
    setSinDato([]);
    setError(null);
    setPhase('review');
  }

  function volverACola() {
    setPhase('form');
    setDraft(null);
    setAbierto(null);
    setPublished(null);
  }

  function reintentar(id: number) {
    setCola(prev => prev.map(i => (i.id === id ? { ...i, estado: 'en cola', error: undefined } : i)));
  }

  function quitar(id: number) {
    setCola(prev => prev.filter(i => i.id !== id || i.estado === 'buscando'));
  }

  async function publish() {
    if (!draft) return;
    const faltan = clavesFaltantes(draft.fuelType, valoresPublicables, sinDato, claseDraft);
    if (
      faltan.length > 0 &&
      !confirm(`Faltan ${faltan.length} datos clave (${faltan.map(c => c.etiqueta).join(', ')}). Sus bloques no saldrán en la ficha. ¿Publicar igual?`)
    ) {
      return;
    }
    setError(null);
    setPhase('publishing');
    try {
      const facts = draft.facts
        .filter(f => accepted[f.key])
        .map(f => {
          let value: number | string | boolean = f.value;
          if (edited[f.key] !== undefined && edited[f.key] !== '') {
            // "1.598" es mil quinientos noventa y ocho (como se escribe en Colombia), no 1,598.
            value = typeof f.value === 'number' ? (numeroEscrito(edited[f.key]) ?? NaN) : edited[f.key];
          }
          return { key: f.key, value, confidence: f.confidence, sourceTier: f.tier, sourceUrl: f.sourceUrl };
        })
        .filter(f => !(typeof f.value === 'number' && !Number.isFinite(f.value)))
        // Lo que el revisor puso a mano: un humano lo afirmó, confianza plena.
        .concat(Object.entries(manuales).map(([key, value]) => ({ key, value, confidence: 1, sourceTier: 1, sourceUrl: undefined as any })));

      const res = await adminFetch('/api/admin/ingest/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: draft.brand,
          model: draft.model,
          year: draft.year,
          type: draft.type,
          vehicleType: draft.vehicleType,
          fuelType: draft.fuelType,
          price: parseFloat(priceValue),
          priceEstimated: draft.price?.estimated ?? true,
          priceReasoningEs: draft.price?.reasoningEs ?? 'Precio ingresado a mano en la revisión.',
          priceConfidence: draft.price?.confidence,
          priceSourceUrl: draft.price?.sourceUrl,
          facts,
          sinDato,
          dealerIds: dealerIds.filter(id => concesionarios.some(c => c.id === id)),
          // Portada primero; solo fotos ya procesadas (o la original si no hay Cloudinary).
          fotos: [...fotos.filter(f => f.usar && f.portada), ...fotos.filter(f => f.usar && !f.portada)]
            .filter(f => f.procesada)
            .map(f => ({ url: f.procesada, angulo: f.angulo, portada: f.portada })),
          fotosDescartadas: [
            ...fotos.filter(f => !f.usar && f.publicId).map(f => f.publicId),
            ...fotos.flatMap(f => f.anteriores ?? []),
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(mensajeDeErrorDeAuth(res) ?? data.error ?? 'No se pudo publicar');

      setPublished({ id: data.vehicle.id, label: `${data.vehicle.brand} ${data.vehicle.model} ${data.vehicle.year}` });
      setCola(prev => prev.map(i => (i.id === abierto ? { ...i, estado: 'publicado', publicadoId: data.vehicle.id } : i)));
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setPhase('review');
    }
  }

  // ── Fase: cola ──
  if (phase === 'form') {
    const pendientes = cola.filter(i => i.estado === 'en cola' || i.estado === 'buscando').length;
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-blanco rounded-[28px] border border-linea p-8">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-wise" />
            <h2 className="text-xl font-bold text-tinta">¿Qué vehículos subimos?</h2>
          </div>
          <p className="text-sm text-tinta-2 mb-5">
            Uno por línea, como lo diría el concesionario: <span className="font-medium text-tinta/80">Onix RS 2026</span>.
            La IA busca en el fabricante y la prensa colombiana, extrae cada dato con su cita y te lo deja para
            verificar. Si no pones año, se asume el modelo vigente.
          </p>

          <form onSubmit={encolar} className="space-y-4">
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) encolar(e);
              }}
              rows={4}
              placeholder={EJEMPLO}
              className="w-full px-4 py-3 border border-linea rounded-xl text-[15px] leading-relaxed focus:ring-2 focus:ring-wise focus:border-wise"
            />

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-tinta">¿Qué tipo de vehículo es?</legend>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
                {CLASES.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={clase === c.id}
                    aria-label={`${c.etiqueta}: ${c.ayuda}`}
                    onClick={() => setClase(c.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${clase === c.id ? 'border-wise bg-wise/10' : 'border-linea hover:border-tinta/40'}`}
                  >
                    <span className="block text-sm font-semibold text-tinta">{c.etiqueta}</span>
                    <span className="block text-xs text-tinta-2">{c.ayuda}</span>
                  </button>
                ))}
              </div>
              {clase !== 'auto' && (
                <p className="mt-2 text-xs text-tinta-2">
                  Se aceptan medidas y pesos de vehículo de trabajo y se piden carga útil, remolque, peso bruto y zona de carga.
                  {vistaPrevia.length > 1 && ' Aplica a todas las líneas.'}
                </p>
              )}
            </fieldset>

            {vistaPrevia.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {vistaPrevia.map(l => (
                  <span key={l.raw}
                    className={`px-2.5 py-1 rounded-full text-xs ${l.parsed ? 'bg-wise/10 text-wise' : 'bg-red-50 text-red-700'}`}>
                    {l.parsed
                      ? <>{l.parsed.brand || <span className="italic opacity-70">marca por IA</span>} · {l.parsed.model} · {l.parsed.year}{l.parsed.yearAssumed && ' (asumido)'}</>
                      : <>No entendí: {l.raw}</>}
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-linea p-4">
              <label className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className="pastilla h-10 px-4"><Paperclip className="h-4 w-4" /> Adjuntar ficha técnica</span>
                <span className="text-tinta-2">
                  ¿El concesionario te pasó la ficha o el catálogo? PDF o foto. Se lee primero y la IA completa lo que falte.
                </span>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={async e => {
                    const elegidos = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    const listos = await Promise.all(elegidos.map(prepararArchivo));
                    const todos = [...adjuntos, ...listos].slice(0, 6);
                    const total = todos.reduce((t, f) => t + f.size, 0);
                    if (total > MAX_BYTES_DOCUMENTOS) {
                      setError(`Los documentos pesan ${(total / 1048576).toFixed(1)} MB y el máximo es 4 MB. Sube menos páginas o comprime el PDF.`);
                      return;
                    }
                    setError(null);
                    setAdjuntos(todos);
                  }}
                />
              </label>
              {adjuntos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {adjuntos.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 rounded-full bg-wise/10 px-3 py-1 text-xs text-wise">
                      <FileText className="h-3.5 w-3.5" /> {f.name} · {(f.size / 1024).toFixed(0)} KB
                      <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setAdjuntos(adjuntos.filter((_, k) => k !== i))}>
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-linea p-4">
              <label htmlFor="enlaces-principales" className="flex flex-wrap items-center gap-2 text-sm text-tinta-2">
                <Link2 className="h-4 w-4 text-wise" />
                <span className="font-medium text-tinta">Enlaces principales</span> (opcional). La página oficial, la ficha en PDF o
                una reseña que confíes: se leen primero y la IA completa lo que falte.
              </label>
              <textarea
                id="enlaces-principales"
                value={textoEnlaces}
                onChange={e => setTextoEnlaces(e.target.value)}
                rows={2}
                placeholder={'https://www.chevrolet.com.co/autos/onix-rs\nhttps://…/ficha-tecnica.pdf'}
                className="mt-3 w-full rounded-xl border border-linea px-4 py-2.5 text-[14px] focus:border-wise focus:ring-2 focus:ring-wise"
              />
              {textoEnlaces.trim() && (
                <p className="mt-1 text-xs text-tinta-2">
                  {enlacesForm.length === 0
                    ? 'Pega enlaces completos, con https://'
                    : `${enlacesForm.length} enlace${enlacesForm.length > 1 ? 's' : ''} (máximo 6), uno por línea`}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-linea p-4">
              <p className="text-sm text-tinta-2">
                <span className="font-medium text-tinta">Fotos del concesionario</span> (opcional). Las vistas que dejes vacías las
                busca la IA.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
                {VISTAS.map(v => {
                  const f = fotosForm[v.angulo];
                  return (
                    <label key={v.angulo} className="group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-linea bg-white text-center hover:border-wise">
                      {f === 'subiendo' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-wise" />
                      ) : f ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.procesada ?? f.original} alt={v.etiqueta} className="h-full w-full object-contain p-1" />
                      ) : (
                        <Paperclip className="h-4 w-4 text-tinta-2 group-hover:text-wise" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-white/85 py-0.5 text-[11px] text-tinta">{v.etiqueta}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={async e => {
                          const archivo = e.target.files?.[0];
                          e.target.value = '';
                          if (!archivo) return;
                          setFotosForm(x => ({ ...x, [v.angulo]: 'subiendo' }));
                          try {
                            const subida = await subirFotoVista(archivo, v.angulo);
                            setFotosForm(x => ({ ...x, [v.angulo]: subida }));
                          } catch (err) {
                            setFotosForm(x => Object.fromEntries(Object.entries(x).filter(([k]) => k !== v.angulo)));
                            setError(err instanceof Error ? err.message : 'No se pudo subir la foto');
                          }
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select value={country} onChange={e => setCountry(e.target.value)}
                className="px-3 py-2 border border-linea rounded-lg text-sm focus:ring-2 focus:ring-wise focus:border-wise">
                <option value="CO">Colombia</option>
                <option value="MX">México</option>
                <option value="US">Estados Unidos</option>
              </select>
              <Button type="submit" variant="wise" className="flex-1">
                {vistaPrevia.length > 1 ? `Agregar ${vistaPrevia.length} a la cola` : 'Buscar y extraer datos'}
              </Button>
            </div>
          </form>

          {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
        </div>

        {cola.length > 0 && (
          <div className="bg-blanco rounded-[28px] border border-linea p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-tinta">Cola</h3>
              <span className="text-xs text-tinta-2">
                {pendientes > 0 ? `${pendientes} por procesar · ~2 a 3 min cada uno` : 'Todo procesado'}
              </span>
            </div>
            <ul className="divide-y divide-linea">
              {cola.map(item => (
                <li key={item.id} className="py-3 flex items-center gap-3">
                  <EstadoIcono estado={item.estado} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-tinta truncate">
                      {item.draft ? `${item.draft.brand} ${item.draft.model} ${item.draft.year}` : item.raw}
                      {item.clase && item.clase !== 'auto' && (
                        <span className="ml-2 rounded-full bg-wise/10 px-2 py-0.5 text-[11px] font-medium text-wise">
                          {CLASES.find(c => c.id === item.clase)?.etiqueta}
                        </span>
                      )}
                      {item.documentos?.length ? (
                        <span className="ml-2 text-xs font-normal text-wise">
                          <Paperclip className="inline h-3 w-3" /> {item.documentos.length} documento{item.documentos.length > 1 ? 's' : ''}
                        </span>
                      ) : null}
                      {item.enlaces?.length ? (
                        <span className="ml-2 text-xs font-normal text-wise">
                          <Link2 className="inline h-3 w-3" /> {item.enlaces.length} enlace{item.enlaces.length > 1 ? 's' : ''}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-tinta-2 truncate">
                      {item.estado === 'listo' && item.draft
                        ? `${item.draft.facts.length} datos · ${item.draft.sourcesReport.filter(x => x.ok).length} fuentes · ${item.draft.fotos?.filter(x => x.recomendada).length ?? 0} fotos${item.draft.warningsEs.length ? ` · ${item.draft.warningsEs.length} avisos` : ''}`
                        : item.estado === 'error'
                          ? item.error
                          : item.estado === 'buscando'
                            ? item.avance ?? 'Buscando fuentes y extrayendo…'
                            : item.estado === 'publicado'
                              ? 'Publicado'
                              : 'Esperando turno'}
                    </p>
                  </div>
                  {item.estado === 'listo' && (
                    <Button size="sm" onClick={() => abrirRevision(item)} variant="wise">
                      Revisar <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                  {item.estado === 'publicado' && item.publicadoId && (
                    <Button size="sm" variant="outline" onClick={() => window.open(`/vehicles/${item.publicadoId}`, '_blank', 'noopener')}>
                      Ver ficha
                    </Button>
                  )}
                  {item.estado === 'error' && (
                    <Button size="sm" variant="outline" onClick={() => reintentar(item.id)}>Reintentar</Button>
                  )}
                  {item.estado !== 'buscando' && item.estado !== 'publicado' && (
                    <button onClick={() => quitar(item.id)} aria-label="Quitar de la cola"
                      className="p-1 text-gray-300 hover:text-red-500">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Fase: publicado ──
  if (phase === 'done' && published) {
    return (
      <div className="max-w-xl mx-auto bg-blanco rounded-[28px] border border-linea p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-purple-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-tinta mb-2">{published.label} publicado</h2>
        <p className="text-sm text-tinta-2 mb-6">Con los datos que aceptaste, su fuente y su cobertura calculada.</p>
        <div className="flex gap-3 justify-center">
          {/* En otra pestaña: la cola sigue corriendo aquí */}
          <Button onClick={() => window.open(`/vehicles/${published.id}`, '_blank', 'noopener')} variant="wise">Ver ficha</Button>
          <Button variant="outline" onClick={volverACola}>
            {cola.some(i => i.estado === 'listo' || i.estado === 'en cola' || i.estado === 'buscando') ? 'Siguiente de la cola' : 'Subir otro'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Fase: revisión ──
  if (!draft) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Identidad */}
      <div className="bg-blanco rounded-[28px] border border-linea p-6">
        <h2 className="text-lg font-bold text-tinta mb-4">
          Revisión: {draft.brand} {draft.model} {draft.year}
          <span className="ml-3 text-sm font-normal text-tinta-2">{acceptedCount} de {draft.facts.length} datos aceptados</span>
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-tinta-2 mb-1">Carrocería</label>
            <select value={draft.type} onChange={e => {
                // Cambiar a Van/Camión (o Pickup) cambia los rangos: lo que estaba
                // desmarcado SOLO por fuera de rango y ahora cabe, se vuelve a marcar.
                const nueva = claseDeTipo(e.target.value);
                const reaceptar = draft.facts.filter(f => f.outOfRange && !fueraDeSuRango(f.key, edited[f.key] ?? f.value, nueva));
                if (reaceptar.length) setAccepted({ ...accepted, ...Object.fromEntries(reaceptar.map(f => [f.key, true])) });
                setDraft({ ...draft, type: e.target.value });
              }}
              className="w-full px-3 py-2 border border-linea rounded-lg text-sm">
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-tinta-2 mb-1">Categoría</label>
            <select value={draft.vehicleType} onChange={e => setDraft({ ...draft, vehicleType: e.target.value })}
              className="w-full px-3 py-2 border border-linea rounded-lg text-sm">
              {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-tinta-2 mb-1">Tren motriz</label>
            <select value={draft.fuelType} onChange={e => setDraft({ ...draft, fuelType: e.target.value })}
              className="w-full px-3 py-2 border border-linea rounded-lg text-sm">
              {FUEL_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Advertencias del pipeline */}
      {draft.warningsEs.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          {draft.warningsEs.map((w, i) => (
            <p key={i} className="text-sm text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      {/* Datos clave */}
      <DatosClave
        fuelType={draft.fuelType}
        clase={claseDraft}
        valores={valoresPublicables}
        sinDato={sinDato}
        onValor={(key, v) => setManuales({ ...manuales, [key]: v })}
        onSinDato={(id, marcar) => setSinDato(marcar ? [...sinDato, id] : sinDato.filter(x => x !== id))}
      />
      {Object.keys(manuales).length > 0 && (
        <div className="bg-blanco rounded-[28px] border border-linea p-6">
          <h3 className="font-bold text-tinta mb-2">Puestos a mano</h3>
          <ul className="text-sm divide-y divide-linea">
            {Object.entries(manuales).map(([key, v]) => {
              const def = ATTRIBUTE_REGISTRY.find(d => d.key === key);
              return (
                <li key={key} className="py-2 flex items-center justify-between gap-3">
                  <span className="text-tinta-2">{def?.labelEs ?? key}</span>
                  <span className="font-semibold">
                    {v === true ? 'Sí' : v === false ? 'No lo tiene' : `${v}${def?.unit ? ` ${def.unit}` : ''}`}
                    <button type="button" className="ml-3 text-xs font-normal text-wise hover:underline"
                      onClick={() => setManuales(Object.fromEntries(Object.entries(manuales).filter(([k]) => k !== key)))}>
                      quitar
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Precio */}
      <div className={`rounded-2xl border p-6 ${draft.price?.estimated ? 'bg-rose-50 border-rose-300' : 'bg-white border-linea shadow-soft'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-tinta">Precio (COP)</h3>
          {draft.price?.estimated
            ? <span className="px-2 py-1 rounded-full bg-rose-200 text-rose-900 text-xs font-bold">ESTIMADO — verificar</span>
            : draft.price
              ? (
                <a href={draft.price.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold hover:underline">
                  De fuente: {host(draft.price.sourceUrl ?? '')} ↗
                </a>
              )
              : <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">Sin dato — ingresar a mano</span>}
        </div>
        <input value={priceValue} onChange={e => setPriceValue(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="135000000" inputMode="numeric"
          className="w-full md:w-72 px-3 py-2 border border-linea rounded-lg text-lg font-bold mb-2" />
        {priceValue && Number(priceValue) > 0 && (
          <p className="text-sm text-tinta-2 mb-2">= ${Math.round(Number(priceValue) / 1_000_000)} millones</p>
        )}
        {draft.price && (
          <p className="text-sm text-tinta/80 leading-relaxed">
            <span className="font-medium">{draft.price.estimated ? 'Razonamiento:' : 'De dónde sale:'}</span> {draft.price.reasoningEs}
            <span className="text-tinta-2/80"> · confianza {Math.round(draft.price.confidence * 100)}%</span>
          </p>
        )}
      </div>

      {/* Fotos */}
      <RevisionFotos fotos={fotos} onChange={setFotos} />

      {/* Concesionarios */}
      <div className="bg-blanco rounded-[28px] border border-linea p-6">
        <h3 className="font-bold text-tinta mb-1">¿Quién lo vende?</h3>
        <p className="text-sm text-tinta-2 mb-3">Los leads de WhatsApp de este carro llegan a los concesionarios que marques.</p>
        {concesionarios.length === 0 ? (
          <p className="text-sm text-tinta-2">
            Aún no hay concesionarios. <a href="/admin/dealerships/new" target="_blank" rel="noopener" className="text-wise hover:underline">Crear uno ↗</a>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {concesionarios.map(c => {
              const activo = dealerIds.includes(c.id);
              return (
                <button key={c.id} type="button" className="pastilla h-10 px-4" data-activa={activo} aria-pressed={activo}
                  onClick={() => setDealerIds(activo ? dealerIds.filter(x => x !== c.id) : [...dealerIds, c.id])}>
                  {c.name}<span className="text-tinta-2/70 text-xs">· {c.location}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Fuentes consultadas */}
      <div className="bg-blanco rounded-[28px] border border-linea p-6">
        <h3 className="font-bold text-tinta mb-3">Fuentes consultadas</h3>
        <ul className="space-y-2">
          {draft.sourcesReport.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {s.ok ? <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" /> : <XCircle className="w-4 h-4 text-gray-300 shrink-0" />}
              <TierBadge tier={s.tier} />
              {s.url.startsWith('concesionario://') ? (
                <span className="text-tinta font-medium flex items-center gap-1"><FileText className="w-3 h-3" /> {s.nameEs}</span>
              ) : (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-wise hover:underline flex items-center gap-1">
                  {s.nameEs} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span className="text-tinta-2/80 truncate">{s.note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Hechos por grupo */}
      {groups.map(([group, facts]) => (
        <div key={group} className="bg-blanco rounded-[28px] border border-linea p-6">
          <h3 className="font-bold text-tinta mb-3">{group}</h3>
          <div className="divide-y divide-linea">
            {facts.map(f => (
              <div key={f.key} className={`py-3 flex flex-wrap items-start gap-3 ${!accepted[f.key] ? 'opacity-45' : ''}`}>
                <input type="checkbox" checked={!!accepted[f.key]}
                  onChange={e => setAccepted({ ...accepted, [f.key]: e.target.checked })}
                  className="mt-1 w-4 h-4 accent-[#881cb7]" />

                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-tinta text-sm">{f.labelEs}</span>
                    <TierBadge tier={f.tier} />
                    <span className="text-[10px] text-tinta-2/80">confianza {Math.round(f.confidence * 100)}%</span>
                    {f.conflict && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-semibold">fuentes en desacuerdo</span>}
                    {fueraDeSuRango(f.key, edited[f.key] ?? f.value, claseDraft) && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-semibold">fuera de rango físico</span>}
                  </div>
                  <p className="text-xs text-tinta-2/80 italic mt-0.5">"{f.quote}" — {host(f.sourceUrl)}</p>
                  {f.alternatives.length > 0 && (
                    <p className="text-xs text-orange-600 mt-0.5">
                      Otras fuentes dicen: {f.alternatives.map(a => `${a.value} (${host(a.sourceUrl)})`).join(' · ')}
                    </p>
                  )}
                </div>

                <div className="w-40">
                  {typeof f.value === 'boolean' ? (
                    <span className="text-sm font-semibold">{f.value ? 'Sí' : 'No'}</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        value={edited[f.key] ?? String(f.value)}
                        onChange={e => setEdited({ ...edited, [f.key]: e.target.value })}
                        className="w-full px-2 py-1 border border-linea rounded text-sm text-right font-semibold" />
                      {f.unit && <span className="text-xs text-tinta-2/80 shrink-0">{f.unit}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

      {/* Publicar */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-linea p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-tinta-2">
          {sinDatos ? (
            <span className="text-rose-700 font-medium">Sin datos aceptados no se puede publicar: acepta o completa al menos uno.</span>
          ) : (
            <>
          Se publicará con <span className="font-bold">{acceptedCount} datos verificados</span>
          {fotos.some(f => f.usar) && <>, {fotos.filter(f => f.usar).length} fotos</>}
          {draft.price?.estimated && Number(priceValue) > 0 && <span className="text-rose-700"> y precio estimado</span>}.
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={volverACola}>Volver a la cola</Button>
          <Button onClick={publish} disabled={phase === 'publishing' || sinDatos || !priceValue || Number(priceValue) <= 0 || fotos.some(f => f.procesando)}
            variant="wise">
            {phase === 'publishing'
              ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Publicando…</span>
              : 'Publicar vehículo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
