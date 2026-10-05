// ============================================================================
// Fetch educado: user-agent identificable, robots.txt respetado, timeout,
// y conversión HTML → texto plano acotado para el extractor.
//
// Regla del plan §5.2: un scraper abusivo es una demanda esperando ocurrir.
// ============================================================================

// UA de navegador: los WAF de la prensa CO bloquean cualquier agente con "Bot"
// (403 o timeout), aunque su robots.txt permite el rastreo. El cumplimiento
// real está en respetar robots.txt, cachear y pedir 1-2 páginas por sitio por
// ingesta — no en el string del agente.
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 20_000;
/** Máximo de texto que pasa al extractor por página. */
// Tope de texto por página que se le manda a la IA (costo): la zona más densa en cifras.
export const MAX_TEXT_CHARS = 25_000;

// Cache simple en memoria por proceso (la ingesta de versiones del mismo
// carro comparte el 90% de las fuentes).
const pageCache = new Map<string, { at: number; text: string | null }>();
// HTML crudo de las páginas ya descargadas: de ahí salen las fotos sin volver a pedirlas.
const htmlCache = new Map<string, { at: number; html: string }>();

/** HTML de una página que la ingesta ya descargó (o null). */
export function htmlDescargado(url: string): string | null {
  const c = htmlCache.get(url);
  return c && Date.now() - c.at < CACHE_TTL_MS ? c.html : null;
}

// Descargas en curso: las fotos y la extracción piden la misma página casi a la
// vez; la segunda espera a la primera en vez de pedirla otra vez al sitio.
const enVuelo = new Map<string, Promise<string | null>>();

/** Descarga el HTML de una página (respetando robots.txt). null si no se pudo. Nunca lanza. */
export async function fetchHtml(url: string): Promise<string | null> {
  const ya = htmlDescargado(url);
  if (ya) return ya;
  const pendiente = enVuelo.get(url);
  if (pendiente) return pendiente;
  const p = (async () => {
    try {
      if (!(await isAllowedByRobots(url))) return null;
      const res = await fetchWithTimeout(url, 'text/html');
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null;
      const html = await res.text();
      htmlCache.set(url, { at: Date.now(), html });
      return html;
    } catch {
      return null;
    } finally {
      enVuelo.delete(url);
    }
  })();
  enVuelo.set(url, p);
  return p;
}

/** Descarga una imagen (bytes + tipo). null si no es imagen, es muy chica o muy grande. */
export async function fetchImagen(url: string): Promise<{ datos: Buffer; tipo: string } | null> {
  try {
    const res = await fetchWithTimeout(url, 'image/avif,image/webp,image/png,image/jpeg,*/*');
    const tipo = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(tipo)) return null;
    const datos = Buffer.from(await res.arrayBuffer());
    // < 25 KB: íconos y miniaturas. > 4,5 MB: se pasa del límite de imágenes de Claude.
    if (datos.length < 25_000 || datos.length > 4_500_000) return null;
    return { datos, tipo };
  } catch {
    return null;
  }
}
const robotsCache = new Map<string, { at: number; disallows: string[] }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': accept, 'Accept-Language': 'es-CO,es;q=0.9' },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/** Parser mínimo de robots.txt: reglas Disallow del agente * (y del nuestro). */
async function getDisallows(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.disallows;

  let disallows: string[] = [];
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, 'text/plain');
    if (res.ok) {
      const text = await res.text();
      let applies = false;
      for (const line of text.split('\n')) {
        const l = line.trim().toLowerCase();
        if (l.startsWith('user-agent:')) {
          const agent = l.slice('user-agent:'.length).trim();
          applies = agent === '*' || agent.includes('wisemotors');
        } else if (applies && l.startsWith('disallow:')) {
          const path = line.slice(line.toLowerCase().indexOf('disallow:') + 9).trim();
          if (path) disallows.push(path);
        }
      }
    }
  } catch {
    // Sin robots.txt legible: se asume permitido (comportamiento estándar).
  }
  robotsCache.set(origin, { at: Date.now(), disallows });
  return disallows;
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const disallows = await getDisallows(u.origin);
    return !disallows.some(d => d !== '/' ? u.pathname.startsWith(d.replace(/\*$/, '')) : true);
  } catch {
    return false;
  }
}

/** Quita tags, scripts y estilos; colapsa espacios. Sin dependencias. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ') // conservar la estructura de tablas de specs
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Trae una página como texto plano, o null si no se pudo o robots lo prohíbe.
 * Nunca lanza: el pipeline reporta la fuente como fallida y sigue.
 */
export async function fetchPageText(url: string): Promise<string | null> {
  const cached = pageCache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.text;

  let text: string | null = null;
  const html = await fetchHtml(url);
  if (html) {
    const full = htmlToText(html);
    // Si la página es enorme, quedarse con la zona más densa en números
    // (las tablas de especificaciones), no con el arranque del artículo.
    text = full.length <= MAX_TEXT_CHARS ? full : denserWindow(full, MAX_TEXT_CHARS);
  }
  pageCache.set(url, { at: Date.now(), text });
  return text;
}

/** Ventana del texto con mayor densidad de dígitos: ahí viven las specs. */
export function denserWindow(text: string, size: number): string {
  const step = Math.floor(size / 2);
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i + size <= text.length; i += step) {
    const slice = text.slice(i, i + size);
    const score = (slice.match(/\d/g) ?? []).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return text.slice(best, best + size);
}

/** Los resultados de búsqueda de sitios WordPress: extraer links de artículos. */
export async function fetchSearchResultLinks(searchUrl: string, mustContain: string[]): Promise<string[]> {
  try {
    if (!(await isAllowedByRobots(searchUrl))) return [];
    const res = await fetchWithTimeout(searchUrl, 'text/html');
    if (!res.ok) return [];
    const html = await res.text();
    const origin = new URL(searchUrl).origin;
    const hrefs = Array.from(html.matchAll(/href="(https?:\/\/[^"]+)"/g)).map(m => m[1]);

    const slugTerms = mustContain.map(t =>
      t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')
    );

    const unique: string[] = [];
    for (const href of hrefs) {
      if (!href.startsWith(origin)) continue;
      const path = href.toLowerCase();
      if (path.includes('/?s=') || path.includes('/tag/') || path.includes('/category/')) continue;
      if (!slugTerms.every(term => path.includes(term))) continue;
      if (!unique.includes(href)) unique.push(href);
    }
    return unique.slice(0, 2);
  } catch {
    return [];
  }
}
