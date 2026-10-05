// ============================================================================
// Tipos del pipeline de ingesta (plan §5).
//
// El resultado del pipeline es un BORRADOR: nada llega a la base de datos
// hasta que un humano acepta o rechaza cada hecho en la pantalla de revisión.
// ============================================================================

/** Nivel de la fuente. 1 = fabricante CO, 2 = prensa especializada / fabricante global, 3 = comunidad. */
export type SourceTier = 1 | 2 | 3;

export interface DiscoveredSource {
  url: string;
  tier: SourceTier;
  /** Nombre legible para la UI de revisión ("El Carro Colombiano"). */
  nameEs: string;
}

/** Un hecho extraído de UNA fuente, antes de reconciliar. */
export interface RawFact {
  /** Key del registro de atributos (path del JSON, ej. 'performance.maxSpeed'). */
  key: string;
  value: number | string | boolean;
  /** Cita textual de la página que respalda el valor. */
  quote: string;
  sourceUrl: string;
  tier: SourceTier;
  /** Fecha que la fuente asocia al dato ("octubre de 2025"), sobre todo en precios. */
  vigencia?: string;
  /** Año modelo del que habla la fuente (0 = no se sabe): a igual tier gana la más reciente. */
  anioFuente?: number;
}

/** Un hecho ya reconciliado entre fuentes, listo para revisión humana. */
export interface DraftFact {
  key: string;
  labelEs: string;
  unit?: string;
  displayGroup: string;
  value: number | string | boolean;
  confidence: number;
  sourceUrl: string;
  tier: SourceTier;
  quote: string;
  vigencia?: string;
  /** true si otras fuentes dieron un valor distinto (>10% en numéricos). */
  conflict: boolean;
  /** Valores alternativos descartados, para que el humano pueda elegir. */
  alternatives: { value: number | string | boolean; sourceUrl: string; tier: SourceTier }[];
  /** true si el valor quedó fuera del rango físico esperado (se muestra, no se publica por defecto). */
  outOfRange: boolean;
}

export interface PriceDraft {
  /** COP. */
  value: number;
  /** true si no se encontró en fuentes y se estimó. */
  estimated: boolean;
  /** Razonamiento explícito de la estimación — sin esto no se muestra nada. */
  reasoningEs: string;
  sourceUrl?: string;
  confidence: number;
}

/** Foto candidata del vehículo (ver lib/ingest/fotos.ts). */
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

export interface VehicleDraft {
  /** Identidad canónica resuelta. */
  brand: string;
  model: string;
  year: number;
  country: string;
  /** Enums canónicos del schema Zod — el humano los confirma en la revisión. */
  type: string;
  vehicleType: string;
  fuelType: string;
  price: PriceDraft | null;
  /** Vehículos del catálogo contra los que se contrastó el precio estimado. */
  priceComparables: { etiqueta: string; precio: number }[];
  facts: DraftFact[];
  /** Fuentes consultadas, con resultado, para transparencia total. */
  sourcesReport: { url: string; nameEs: string; tier: SourceTier; ok: boolean; note?: string }[];
  /** Fotos candidatas, las recomendadas primero. */
  fotos?: FotoDraft[];
  warningsEs: string[];
}
