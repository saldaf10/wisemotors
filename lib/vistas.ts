// ============================================================================
// Las fotos reales de un carro, vista por vista (nov-2026).
//
// La ficha y las tarjetas recorren las mismas vistas en el mismo orden: la
// portada primero y luego 3/4 delantera, frontal, trasera e interior. La vista
// de cada foto sale de su tipo o, si es "cover"/"angulo", del texto alternativo
// ("BYD Dolphin 2025, de lado"). Sin base de datos: sirve en el navegador.
// ============================================================================

import { urlImagen } from '@/lib/data/imagen';

// Las vistas del carro (fotos reales que sube el equipo), en el orden en que se recorren.
export const ORDEN_VISTAS = ['lado', 'tres_cuartos_frente', 'frente', 'tres_cuartos_atras', 'atras', 'interior', 'detalle'];
export const ETIQUETA_VISTA: Record<string, string> = {
  lado: 'Lateral',
  tres_cuartos_frente: '3/4 delantera',
  frente: 'Frontal',
  tres_cuartos_atras: '3/4 trasera',
  atras: 'Trasera',
  interior: 'Interior',
  detalle: 'Detalle',
};
// La portada se guarda como "cover": su vista sale del texto alternativo ("…, de lado").
const VISTA_POR_ALT: [RegExp, string][] = [
  [/3\/4 delantera/i, 'tres_cuartos_frente'],
  [/3\/4 trasera/i, 'tres_cuartos_atras'],
  [/de lado|lateral/i, 'lado'],
  [/de frente|frontal/i, 'frente'],
  [/de atr[aá]s|trasera/i, 'atras'],
  [/interior/i, 'interior'],
  [/detalle/i, 'detalle'],
];

export interface Vista {
  url: string;
  vista: string;
  etiqueta: string;
  interior: boolean;
}

export function vistasDe(vehicle: { id?: string; images?: unknown }): Vista[] {
  const imgs: any[] = Array.isArray(vehicle.images) ? vehicle.images : [];
  const id = vehicle.id ?? '';
  const lista = imgs
    .map((img, i) => {
      const url = urlImagen(id, img?.url, img?.order ?? i);
      if (!url) return null;
      const esPortada = !!img.isThumbnail || img.type === 'cover';
      const porAlt = VISTA_POR_ALT.find(([re]) => re.test(String(img.alt ?? '').split(',').pop() ?? ''))?.[1];
      const vista = ETIQUETA_VISTA[img.type] ? img.type : porAlt ?? (esPortada ? 'lado' : 'otra');
      return { url, vista, etiqueta: ETIQUETA_VISTA[vista] ?? 'Foto', interior: vista === 'interior', esPortada };
    })
    .filter((x): x is Vista & { esPortada: boolean } => !!x);
  const peso = (v: Vista & { esPortada: boolean }) => (v.esPortada ? -1 : ORDEN_VISTAS.indexOf(v.vista) === -1 ? 99 : ORDEN_VISTAS.indexOf(v.vista));
  return lista.sort((a, b) => peso(a) - peso(b));
}
