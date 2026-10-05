// ============================================================================
// Fotos del vehículo en la ingesta.
//
// 1. Candidatas: las imágenes de las páginas que la ingesta ya leyó (primero la
//    oficial del fabricante). Si salen muy pocas, Haiku busca en la web una
//    página de fotos oficiales o de prensa (complemento barato).
// 2. Haiku MIRA las candidatas (visión) y dice de cada una: ángulo, hacia dónde
//    mira el carro, si es de verdad este modelo, si es foto de estudio y qué tan
//    buena es. No se adivina por el nombre del archivo.
// 3. Se recomienda la mejor de cada una de las SEIS vistas (lateral, frontal,
//    trasera, 3/4 delantera, 3/4 trasera, interior) y se procesan en
//    Cloudinary con el mismo acabado (ver procesarFotoCarro).
// 4. El humano aprueba, cambia o quita en la revisión. Nada se publica solo.
//
// Las fotos que manda el concesionario se suben a su vista (procesarFotoSubida)
// y la búsqueda solo intenta las vistas que quedaron vacías (`cubiertos`).
// ============================================================================

import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { claude, MODELOS, pedirJson } from '@/lib/ai/claude';
import { cloudinaryConfigurado, procesarFotoCarro } from '@/lib/cloudinary';
import { fetchHtml, fetchImagen, htmlDescargado } from './fetcher';
import type { DiscoveredSource, FotoDraft } from './types';
import { medir } from './tiempos';

export const ANGULOS = ['lado', 'tres_cuartos_frente', 'tres_cuartos_atras', 'frente', 'atras', 'interior', 'detalle', 'otro'] as const;
export type Angulo = (typeof ANGULOS)[number];

/** Las seis vistas de la ficha, en orden: la primera es la portada. */
export const VISTAS: Angulo[] = ['lado', 'frente', 'atras', 'tres_cuartos_frente', 'tres_cuartos_atras', 'interior'];

const MAX_CANDIDATAS = 14;

// ---------------------------------------------------------------------------
// 1. Candidatas desde el HTML
// ---------------------------------------------------------------------------

const RUIDO = /logo|icon|sprite|favicon|badge|flag|banner-app|avatar|placeholder|loader|pixel|tracking|whatsapp|facebook|instagram|youtube|twitter|payment|dealer-locator|mapa|\.svg($|\?)/i;

function absoluta(src: string, base: string): string | null {
  try {
    const u = new URL(src.trim().replace(/&amp;/g, '&'), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** La opción más grande de un srcset ("a.jpg 480w, b.jpg 1200w" → b.jpg). */
function mayorDeSrcset(srcset: string): string | null {
  const opciones = srcset
    .split(',')
    .map(p => p.trim().split(/\s+/))
    .filter(p => p[0])
    .map(([u, d]) => ({ u, n: parseFloat(d ?? '1') || 1 }));
  opciones.sort((a, b) => b.n - a.n);
  return opciones[0]?.u ?? null;
}

export function imagenesDelHtml(html: string, base: string): string[] {
  const urls: string[] = [];
  const add = (u: string | null | undefined) => {
    const a = u ? absoluta(u, base) : null;
    if (a && !RUIDO.test(a)) urls.push(a);
  };
  // og:image primero: suele ser la foto principal del modelo.
  for (const m of Array.from(html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/gi))) {
    add(m[0].match(/content=["']([^"']+)["']/i)?.[1]);
  }
  for (const m of Array.from(html.matchAll(/<(?:img|source)\b[^>]*>/gi))) {
    const tag = m[0];
    const srcset = tag.match(/\b(?:data-)?srcset=["']([^"']+)["']/i)?.[1];
    add(srcset ? mayorDeSrcset(srcset) : null);
    add(tag.match(/\b(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["']/i)?.[1]);
  }
  // Galerías armadas con JavaScript: URLs de imagen sueltas dentro del HTML.
  // (en JSON las barras vienen escapadas: https:\/\/cdn…)
  const plano = html.replace(/\\\//g, '/');
  for (const m of Array.from(plano.matchAll(/https?:\/\/[^"'\s()<>]+?\.(?:jpe?g|png|webp)(?:\?[^"'\s()<>]*)?/gi))) add(m[0]);

  // Sin duplicados (misma ruta con distintos parámetros de tamaño).
  const vistas = new Set<string>();
  return urls.filter(u => {
    const clave = u.replace(/\?.*$/, '').toLowerCase();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Complemento: Haiku busca una página de fotos si las fuentes no traen
// ---------------------------------------------------------------------------

const PaginasSchema = z.object({ urls: z.array(z.string()) });

async function paginasDeFotos(nombre: string): Promise<string[]> {
  const res = await claude().beta.messages.parse({
    model: MODELOS.haiku,
    max_tokens: 1000,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
    messages: [
      {
        role: 'user',
        content: `Busca la página oficial del ${nombre} en Colombia o una galería de fotos oficiales / de prensa (sala de prensa del fabricante). Devuelve hasta 2 URLs de páginas (no de imágenes sueltas) que hayas visto en los resultados, copiadas exactas.`,
      },
    ],
    output_config: { format: betaZodOutputFormat(PaginasSchema) },
  });
  const vistas = new Set<string>();
  for (const b of res.content as any[]) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r?.url) vistas.add(r.url);
  }
  return (res.parsed_output?.urls ?? []).filter(u => vistas.has(u)).slice(0, 2);
}

// ---------------------------------------------------------------------------
// 2. Clasificación con visión (Haiku)
// ---------------------------------------------------------------------------

const ClasificacionSchema = z.object({
  fotos: z.array(
    z.object({
      n: z.number().describe('Número de la imagen'),
      queSeVe: z.string().describe('Qué carro ves (marca y modelo, si lo reconoces) o qué es la imagen, en pocas palabras'),
      esElModelo: z.boolean().describe('true si se ve un carro de la MISMA marca y modelo. No lo descartes por año, generación, versión ni color: las páginas del modelo muestran sus fotos. false solo si es claramente OTRO modelo o no es un carro (logo, persona, banner, mapa)'),
      angulo: z.enum(ANGULOS),
      estudio: z.boolean().describe('Fondo liso de estudio (blanco, gris o transparente), sin calle, paisaje ni gente'),
      calidad: z.number().describe('1 a 5: nitidez, carro completo y sin cortar, sin textos encima'),
    })
  ),
});

type Clasificada = z.infer<typeof ClasificacionSchema>['fotos'][number];

async function clasificar(
  nombre: string,
  imagenes: { url: string; datos: Buffer; tipo: string }[]
): Promise<Map<number, Clasificada>> {
  const bloques: any[] = [];
  imagenes.forEach((img, i) => {
    bloques.push({ type: 'text', text: `Imagen ${i + 1}:` });
    bloques.push({ type: 'image', source: { type: 'base64', media_type: img.tipo, data: img.datos.toString('base64') } });
  });
  bloques.push({
    type: 'text',
    text: `Estas imágenes salieron de páginas sobre el ${nombre}. Clasifica TODAS (n = número de la imagen). Primero di qué ves (queSeVe) y después decide. "lado" = perfil lateral completo; "tres_cuartos_frente" = en diagonal viendo el frente; "tres_cuartos_atras" = en diagonal viendo la cola; "interior" = cabina/tablero; "detalle" = un rin, una luz, un botón.`,
  });
  const r = await pedirJson({ schema: ClasificacionSchema, modelo: 'haiku', maxTokens: 2000, prompt: bloques });
  return new Map(r.fotos.map(f => [f.n - 1, f]));
}

// ---------------------------------------------------------------------------
// 3. Selección y procesamiento
// ---------------------------------------------------------------------------

function puntaje(c: { calidad: number; estudio: boolean }, origenOficial: boolean) {
  return c.calidad * 2 + (c.estudio ? 3 : 0) + (origenOficial ? 1 : 0);
}

/**
 * Procesa una foto en Cloudinary según su ángulo. Sin Cloudinary, queda la original.
 * `voltear`: espejo horizontal (lo pide el revisor para que el carro mire a la derecha).
 */
/** Una foto que subió el revisor (la del concesionario), ya en su vista. */
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

export async function procesarFoto(
  f: Pick<FotoDraft, 'original' | 'angulo'> & { voltear?: boolean }
): Promise<Pick<FotoDraft, 'procesada' | 'publicId' | 'recortada' | 'volteada'>> {
  if (!cloudinaryConfigurado()) return { procesada: f.original, recortada: false, volteada: false };
  const exterior = f.angulo !== 'interior' && f.angulo !== 'detalle';
  const voltear = !!f.voltear;
  const img = await fetchImagen(f.original);
  const origen = img ? `data:${img.tipo};base64,${img.datos.toString('base64')}` : f.original;
  const r = await procesarFotoCarro(origen, { recortar: exterior, voltear });
  return { procesada: r.url, publicId: r.publicId, recortada: r.recortada, volteada: voltear };
}

const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Palabras de versión o carrocería que no identifican el modelo.
const GENERICAS = new Set(['rs', 'lt', 'ltz', 'premier', 'touring', 'grand', 'hibrido', 'hibrida', 'hybrid', 'sedan', 'hatchback', 'hb', 'plus', 'pro', 'max', 'turbo', 'at', 'mt', '4x4', '4x2', 'diesel', 'gasolina', 'electrico']);

export async function buscarFotos(opts: {
  nombre: string;
  /** Solo el modelo ("Onix RS", "RAV4 Híbrida"): para confirmar que la foto es de este carro. */
  modelo: string;
  fuentes: DiscoveredSource[];
  avisos: string[];
  /** Vistas que ya tienen foto (del concesionario): no se buscan. */
  cubiertos?: Angulo[];
}): Promise<FotoDraft[]> {
  const { nombre, fuentes, avisos } = opts;
  const buscados = VISTAS.filter(v => !(opts.cubiertos ?? []).includes(v));
  if (buscados.length === 0) return [];

  // Candidatas de las fuentes ya leídas, la oficial primero.
  const porPagina = async (url: string) => {
    const html = htmlDescargado(url) ?? (await fetchHtml(url));
    return html ? imagenesDelHtml(html, url) : [];
  };
  const origenDe = new Map<string, { pagina: string; oficial: boolean }>();
  const juntar = (pagina: string, oficial: boolean, urls: string[]) => {
    for (const u of urls) if (!origenDe.has(u)) origenDe.set(u, { pagina, oficial });
  };
  await medir('fotos: html de las fuentes', async () => {
    for (const f of [...fuentes].sort((a, b) => a.tier - b.tier)) {
      juntar(f.url, f.tier === 1, (await porPagina(f.url)).slice(0, 30));
    }
  });

  // Descarga (valida que sea imagen de tamaño útil) hasta tener suficientes.
  const descargar = async () => {
    const out: { url: string; datos: Buffer; tipo: string }[] = [];
    for (const url of Array.from(origenDe.keys())) {
      if (out.length >= MAX_CANDIDATAS) break;
      if (out.some(o => o.url === url)) continue;
      const img = await fetchImagen(url);
      if (img) out.push({ url, ...img });
    }
    return out;
  };
  if (process.env.INGESTA_TIEMPOS) console.log(`[t] fotos: ${origenDe.size} candidatas`);
  let imagenes = await medir('fotos: descargar candidatas', descargar);

  if (imagenes.length < 4) {
    try {
      for (const pagina of await medir('fotos: búsqueda complementaria', () => paginasDeFotos(nombre))) juntar(pagina, /\.co\b|\/co\//.test(pagina), await porPagina(pagina));
      imagenes = await medir('fotos: descargar candidatas (2)', descargar);
    } catch (err) {
      avisos.push(`La búsqueda complementaria de fotos falló: ${String(err).slice(0, 100)}`);
    }
  }
  if (imagenes.length === 0) {
    avisos.push('No se encontraron fotos del vehículo: súbelas a mano después de publicar.');
    return [];
  }

  const clases = await medir(`fotos: clasificar ${imagenes.length} con visión`, () => clasificar(nombre, imagenes));
  // ¿Es este modelo? Lo decide el código con lo que Haiku dice ver (su sí/no
  // suelto no es estable): si nombra el modelo, sí; si no lo reconoce, se
  // respeta su veredicto.
  const tokensModelo = norm(opts.modelo)
    .split(/\s+/)
    .filter(t => t.length >= 2 && !GENERICAS.has(t));
  const esEste = (c: Clasificada) => {
    const visto = norm(c.queSeVe).replace(/[^a-z0-9 ]/g, ' ');
    const compacto = visto.replace(/\s+/g, '');
    const nombra = tokensModelo.length > 0 && tokensModelo.some(t => compacto.includes(t.replace(/[^a-z0-9]/g, '')));
    return nombra || c.esElModelo;
  };
  const candidatas: FotoDraft[] = [];
  imagenes.forEach((img, i) => {
    const c = clases.get(i);
    if (!c || !esEste(c) || c.angulo === 'otro') return;
    const origen = origenDe.get(img.url)!;
    candidatas.push({
      original: img.url,
      pagina: origen.pagina,
      oficial: origen.oficial,
      angulo: c.angulo,
      // Haiku no distingue izquierda/derecha de forma confiable (probado): la
      // orientación la corrige el revisor con "Voltear".
      miraA: 'no_aplica',
      estudio: c.estudio,
      calidad: Math.max(1, Math.min(5, Math.round(c.calidad))),
      recomendada: false,
    });
  });

  // La mejor de cada vista que falta.
  for (const angulo of buscados) {
    const mejor = candidatas
      .filter(c => c.angulo === angulo)
      .sort((a, b) => puntaje(b, b.oficial) - puntaje(a, a.oficial))[0];
    if (mejor) mejor.recomendada = true;
  }
  const faltan = buscados.filter(a => !candidatas.some(c => c.angulo === a && c.recomendada));
  if (faltan.length) avisos.push(`Fotos: no se encontró la vista ${faltan.map(a => ETIQUETA_ANGULO[a].toLowerCase()).join(', ')}. Súbela en la revisión.`);
  if (!cloudinaryConfigurado()) {
    avisos.push('Cloudinary no está configurado: las fotos quedan con su fondo original (sin recortar).');
  }

  // Procesar las recomendadas ya, para verlas terminadas en la revisión.
  await medir('fotos: procesar en Cloudinary', () => Promise.all(
    candidatas
      .filter(c => c.recomendada)
      .map(async c => {
        try {
          Object.assign(c, await procesarFoto(c));
        } catch (err) {
          c.error = `No se pudo procesar: ${String(err).slice(0, 100)}`;
        }
      })
  ));

  // Recomendadas primero (en el orden buscado), luego el resto por calidad.
  const orden = (c: FotoDraft) => (c.recomendada ? VISTAS.indexOf(c.angulo) : 10 + (5 - c.calidad));
  return candidatas.sort((a, b) => orden(a) - orden(b));
}

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
