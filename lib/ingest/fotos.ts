// ============================================================================
// Fotos de un vehículo (SIN IA desde oct-2026): el equipo sube su foto por vista
// y aquí solo se procesa en Cloudinary (sin fondo, recortada, volteada si se
// pide). La búsqueda y clasificación de fotos con IA se eliminó.
// ============================================================================

import { cloudinaryConfigurado, procesarFotoCarro } from '@/lib/cloudinary';
import type { FotoDraft } from './types';

export const ANGULOS = ['lado', 'tres_cuartos_frente', 'tres_cuartos_atras', 'frente', 'atras', 'interior', 'detalle', 'otro'] as const;
export type Angulo = (typeof ANGULOS)[number];

/** Las seis vistas de la ficha, en orden: la primera es la portada. */
export const VISTAS: Angulo[] = ['lado', 'frente', 'atras', 'tres_cuartos_frente', 'tres_cuartos_atras', 'interior'];

export const ETIQUETA_ANGULO: Record<Angulo, string> = {
  lado: 'Lateral',
  tres_cuartos_frente: '3/4 delantera',
  tres_cuartos_atras: '3/4 trasera',
  frente: 'Frontal',
  atras: 'Trasera',
  interior: 'Interior',
  detalle: 'Detalle',
  otro: 'Otro',
};

/** Una foto que subió el equipo, ya en su vista. */
export async function procesarFotoSubida(dataUrl: string, angulo: Angulo, voltear = false): Promise<FotoDraft> {
  const exterior = angulo !== 'interior' && angulo !== 'detalle';
  const r = await procesarFotoCarro(dataUrl, { recortar: exterior, voltear });
  return {
    original: r.original,
    pagina: 'concesionario',
    oficial: true,
    angulo,
    miraA: 'no_aplica',
    estudio: true,
    calidad: 5,
    recomendada: true,
    procesada: r.url,
    publicId: r.publicId,
    recortada: r.recortada,
    volteada: voltear,
  };
}

/** Descarga una imagen (para volver a procesarla, p. ej. al voltearla). */
async function descargarImagen(url: string): Promise<{ datos: Buffer; tipo: string } | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const tipo = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(tipo)) return null;
    const datos = Buffer.from(await res.arrayBuffer());
    return datos.length > 10_000_000 ? null : { datos, tipo };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Vuelve a procesar una foto ya subida (voltearla). Sin Cloudinary, queda la original. */
export async function procesarFoto(
  f: Pick<FotoDraft, 'original' | 'angulo'> & { voltear?: boolean }
): Promise<Pick<FotoDraft, 'procesada' | 'publicId' | 'recortada' | 'volteada'>> {
  if (!cloudinaryConfigurado()) return { procesada: f.original, recortada: false, volteada: false };
  const exterior = f.angulo !== 'interior' && f.angulo !== 'detalle';
  const voltear = !!f.voltear;
  const img = await descargarImagen(f.original);
  const origen = img ? `data:${img.tipo};base64,${img.datos.toString('base64')}` : f.original;
  const r = await procesarFotoCarro(origen, { recortar: exterior, voltear });
  return { procesada: r.url, publicId: r.publicId, recortada: r.recortada, volteada: voltear };
}
