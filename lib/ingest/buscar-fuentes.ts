// ============================================================================
// Fuentes REALES con búsqueda web (plan §5.1, paso 2).
//
// Antes las URLs se adivinaban (chevrolet.com.co/onix → 404). Ahora Claude
// busca en la web la página oficial del fabricante en Colombia y reseñas o
// fichas técnicas de prensa colombiana, y SOLO se aceptan URLs que aparecieron
// en los resultados de búsqueda: si el modelo escribe una que no vino de la
// búsqueda, se descarta (no inventa fuentes).
//
// leerConClaude(): cuando el fetch directo falla (sitio que bloquea a Vercel,
// WAF, robots), la página se lee con la herramienta web_fetch de Anthropic y
// se devuelve el TEXTO tal cual, para que la extracción y la verificación de
// citas trabajen sobre el contenido real.
//
// Se usan las versiones básicas de las herramientas (20250305 / 20250910):
// devuelven los resultados y el documento completos en la respuesta, sin el
// filtrado dinámico que los procesa en código antes de verlos.
// ============================================================================

import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { claude, MODELOS } from '@/lib/ai/claude';
import type { DiscoveredSource, SourceTier } from './types';

const TIPOS = ['fabricante_colombia', 'prensa_colombia', 'prensa_internacional', 'enciclopedia', 'otro'] as const;

const FuentesSchema = z.object({
  fuentes: z.array(
    z.object({
      url: z.string().describe('URL EXACTA tal como apareció en los resultados de búsqueda'),
      nombre: z.string().describe('Nombre corto del sitio, ej. "Chevrolet Colombia", "El Carro Colombiano"'),
      tipo: z.enum(TIPOS),
    })
  ),
});

const normalizar = (u: string) => u.trim().replace(/#.*$/, '').replace(/\/+$/, '').replace(/^http:\/\//, 'https://').toLowerCase();

/** Tier de una URL cuando no hay un tipo declarado: 1 si es del fabricante en Colombia, 2 en cualquier otro caso. */
export function tierPorDominio(url: string, marca: string): SourceTier {
  return tierDe('fabricante_colombia', url, marca) === 1 ? 1 : 2;
}

function tierDe(tipo: (typeof TIPOS)[number], url: string, marca: string): SourceTier {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const marcaSlug = marca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  // Tier 1 solo si el dominio es del fabricante y de Colombia: el tipo que diga el modelo no basta.
  if (tipo === 'fabricante_colombia' && host.replace(/[^a-z0-9.]/g, '').includes(marcaSlug) && (host.endsWith('.co') || host.includes('.com.co') || url.toLowerCase().includes('/co/'))) {
    return 1;
  }
  if (tipo === 'otro') return 3;
  return 2;
}

/** Busca en la web las mejores fuentes para el vehículo. Nunca inventa URLs. */
export async function buscarFuentes(marca: string, modelo: string, version: string, anio: number): Promise<DiscoveredSource[]> {
  const nombre = `${marca} ${modelo}${version ? ` ${version}` : ''}`;
  const res = await claude().beta.messages.parse({
    model: MODELOS.sonnet,
    max_tokens: 4000,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
        // user_location no admite Colombia (400 "Country code CO is not supported"):
        // el foco en Colombia va en el prompt.
      },
    ],
    system: `Buscas fuentes de especificaciones técnicas de carros nuevos vendidos en Colombia. Prioridad:
1. La página OFICIAL del modelo en el sitio del fabricante en Colombia (la ficha del modelo, no el home ni un concesionario).
2. Reseñas, pruebas de manejo o fichas técnicas de prensa automotriz colombiana (El Carro Colombiano, Autos de Primera, Motor.com.co, Revista Autos, El Tiempo Motor, etc.) de la generación actual.
3. Si hace falta, prensa internacional seria o Wikipedia en español.
Evita concesionarios, clasificados de usados, foros y videos. Prefiere páginas de la generación/año más reciente vendida en Colombia.`,
    messages: [
      {
        role: 'user',
        content: `Encuentra entre 3 y 4 páginas con la ficha técnica del ${nombre} (modelo ${anio} o la generación vigente) para Colombia. Devuelve solo URLs que hayas visto en los resultados de la búsqueda, copiadas exactas.`,
      },
    ],
    output_config: { format: betaZodOutputFormat(FuentesSchema) },
  });

  // URLs que de verdad vinieron de la búsqueda.
  const vistas = new Set<string>();
  for (const b of res.content as any[]) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r?.url) vistas.add(normalizar(r.url));
    }
  }

  const datos = res.parsed_output;
  if (!datos) return [];

  const unicas = new Map<string, DiscoveredSource>();
  for (const f of datos.fuentes) {
    const n = normalizar(f.url);
    if (!vistas.has(n) || unicas.has(n)) continue;
    unicas.set(n, { url: f.url.trim(), tier: tierDe(f.tipo, f.url, marca), nameEs: f.nombre.slice(0, 60) });
  }
  // Fabricante primero, luego prensa: si hay que recortar, se recorta lo menos confiable.
  return Array.from(unicas.values()).sort((a, b) => a.tier - b.tier).slice(0, 4);
}

/**
 * Segunda búsqueda, dirigida: páginas que traigan ESTOS datos que las primeras
 * fuentes no tenían (el 0-100, el rendimiento, el equipamiento). Mismas reglas:
 * solo URLs vistas en la búsqueda y ninguna ya leída.
 */
export async function buscarFuentesPara(
  marca: string,
  modelo: string,
  version: string,
  anio: number,
  datos: string[],
  yaLeidas: string[]
): Promise<DiscoveredSource[]> {
  const nombre = `${marca} ${modelo}${version ? ` ${version}` : ''}`;
  const excluir = new Set(yaLeidas.map(normalizar));
  const res = await claude().beta.messages.parse({
    model: MODELOS.sonnet,
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
    system: `Buscas páginas que publiquen datos técnicos concretos de un carro vendido en Colombia. Sirven: la ficha técnica oficial (a veces PDF), pruebas de manejo de prensa automotriz (colombiana o internacional seria) y catálogos de versiones con equipamiento. Evita clasificados de usados, foros y videos.`,
    messages: [
      {
        role: 'user',
        content: `Del ${nombre} (modelo ${anio} o la generación vigente), necesito páginas que digan estos datos: ${datos.join(', ')}.
Busca, por ejemplo, "${nombre} ficha técnica", "${nombre} prueba de manejo 0 a 100 consumo", "${nombre} equipamiento versiones".
No repitas estas páginas, ya las leí: ${yaLeidas.join(' · ') || '(ninguna)'}.
Devuelve entre 1 y 3 URLs que hayas visto en los resultados, copiadas exactas.`,
      },
    ],
    output_config: { format: betaZodOutputFormat(FuentesSchema) },
  });

  const vistas = new Set<string>();
  for (const b of res.content as any[]) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r?.url) vistas.add(normalizar(r.url));
    }
  }
  const unicas = new Map<string, DiscoveredSource>();
  for (const f of res.parsed_output?.fuentes ?? []) {
    const n = normalizar(f.url);
    if (!vistas.has(n) || excluir.has(n) || unicas.has(n)) continue;
    unicas.set(n, { url: f.url.trim(), tier: tierDe(f.tipo, f.url, marca), nameEs: f.nombre.slice(0, 60) });
  }
  return Array.from(unicas.values()).sort((a, b) => a.tier - b.tier).slice(0, 3);
}

/**
 * Contenido de una fuente: texto plano, PDF (las fichas técnicas oficiales
 * suelen serlo) o imagen (la foto de una ficha que mandó el concesionario).
 */
export type Contenido =
  | { texto: string }
  | { pdfBase64: string }
  | { imagenBase64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' };

/**
 * Lee una página o PDF con web_fetch de Anthropic. null si no se pudo.
 */
export async function leerConClaude(url: string): Promise<Contenido | null> {
  const res = await claude().beta.messages.create({
    // Aquí el modelo solo dispara la descarga: el más barato basta.
    model: MODELOS.haiku,
    max_tokens: 300,
    tools: [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 1, max_content_tokens: 12000 }],
    messages: [{ role: 'user', content: `Usa web_fetch para leer exactamente esta URL y luego responde solo "listo": ${url}` }],
    betas: ['web-fetch-2025-09-10'],
  } as any);

  for (const b of res.content as any[]) {
    if (b.type === 'web_fetch_tool_result' && b.content?.type === 'web_fetch_result') {
      const src = b.content.content?.source;
      if (src?.type === 'text' && typeof src.data === 'string' && src.data.trim().length > 200) return { texto: src.data };
      if (src?.type === 'base64' && src.media_type === 'application/pdf' && typeof src.data === 'string') return { pdfBase64: src.data };
    }
  }
  return null;
}
