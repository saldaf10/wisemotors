// Tipos de la subida de vehículos que siguen vivos sin la IA (oct-2026).

/** Foto de un vehículo (ver lib/ingest/fotos.ts). */
export interface FotoDraft {
  /** URL original en la página de donde salió. */
  original: string;
  /** Página donde apareció (para saber de dónde es). */
  pagina: string;
  /** Salió del sitio oficial del fabricante. */
  oficial: boolean;
  angulo: 'lado' | 'tres_cuartos_frente' | 'tres_cuartos_atras' | 'frente' | 'atras' | 'interior' | 'detalle' | 'otro';
  miraA: 'izquierda' | 'derecha' | 'de_frente' | 'no_aplica';
  estudio: boolean;
  /** 1 a 5, según Haiku. */
  calidad: number;
  /** Propuesta para publicar (la mejor de su ángulo). */
  recomendada: boolean;
  /** Ya procesada (Cloudinary): sin fondo, recortada y orientada. */
  procesada?: string;
  publicId?: string;
  recortada?: boolean;
  /** Se procesó en espejo (el revisor la volteó). */
  volteada?: boolean;
  error?: string;
}
