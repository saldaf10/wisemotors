import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import {
  buscarFaltantes,
  cerrarIngesta,
  fotosDeIngesta,
  leerDocumento,
  leerFuente,
  prepararIngesta,
  runIngestPipeline,
  type ContextoIngesta,
  type DocumentoConcesionario,
  type FuenteLeida,
} from '@/lib/ingest/pipeline';
import { parseVehicleQuery } from '@/lib/ingest/parse-query';
import { ANGULOS, type Angulo } from '@/lib/ingest/fotos';
import { esErrorDeCuenta } from '@/lib/ai/claude';
import type { DiscoveredSource, SourceTier } from '@/lib/ingest/types';

// Cada etapa tiene su propia petición de hasta 300 s (vercel.json).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// POST /api/admin/ingest — la ingesta POR ETAPAS (lib/ingest/pipeline.ts).
// Devuelve piezas de un BORRADOR; nada se escribe en la base: eso lo hace
// /publish tras la revisión. El panel encadena las etapas:
//
//   { etapa: 'preparar', query | brand+model+year, country, enlaces } → { ctx, fuentes }
//   { etapa: 'fuente', ctx, source, soloKeys? }                       → FuenteLeida
//   multipart { etapa: 'documento', ctx (JSON), documento }           → FuenteLeida
//   { etapa: 'fotos', ctx, fuentes, angulosCubiertos }                → { fotos, avisos }
//   { etapa: 'faltantes', ctx, facts, yaLeidas }                      → { fuentes, soloKeys }
//   { etapa: 'cerrar', ctx, leidas, fotos }                           → { draft }
//
// Sin `etapa`: todo junto en una petición (compatibilidad; puede pasarse de 300 s).
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'] as const;

class ErrorEntrada extends Error {}

async function leerCuerpo(request: NextRequest): Promise<{ body: any; documentos: DocumentoConcesionario[] }> {
  if (!(request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    return { body: await request.json(), documentos: [] };
  }
  const form = await request.formData();
  const body = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === 'string'));
  const documentos: DocumentoConcesionario[] = [];
  for (const archivo of [...form.getAll('documentos'), ...form.getAll('documento')]) {
    if (typeof archivo === 'string') continue;
    const base64 = Buffer.from(await archivo.arrayBuffer()).toString('base64');
    const nombre = (archivo.name || 'documento').slice(0, 80);
    if (archivo.type === 'application/pdf') documentos.push({ nombre, contenido: { pdfBase64: base64 } });
    else if ((TIPOS_IMAGEN as readonly string[]).includes(archivo.type)) {
      documentos.push({ nombre, contenido: { imagenBase64: base64, mediaType: archivo.type as (typeof TIPOS_IMAGEN)[number] } });
    }
  }
  return { body, documentos };
}

/** ¿URL pública http(s)? El servidor la descarga: nada de localhost ni redes internas. */
function urlPublica(crudo: unknown): string | null {
  try {
    const u = new URL(String(crudo).trim());
    const host = u.hostname.toLowerCase();
    if (!/^https?:$/.test(u.protocol)) return null;
    if (/^(localhost|.*\.local|.*\.internal)$/.test(host) || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.includes(':')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Enlaces que puso el equipo: uno por línea o arreglo. */
function enlacesDe(x: unknown): string[] {
  const lista = Array.isArray(x) ? x : typeof x === 'string' ? x.split(/[\s,]+/) : [];
  return Array.from(new Set(lista.map(urlPublica).filter((u): u is string => !!u))).slice(0, 6);
}

/** Vistas ya cubiertas: arreglo en JSON o "lado,frente" en multipart. */
function angulosDe(x: unknown): Angulo[] {
  const lista = Array.isArray(x) ? x : typeof x === 'string' ? x.split(',') : [];
  return lista.filter((a): a is Angulo => ANGULOS.includes(a as Angulo));
}

function fuenteDe(x: any): DiscoveredSource {
  const url = urlPublica(x?.url);
  if (!url) throw new ErrorEntrada('Fuente inválida');
  const tier = [1, 2, 3].includes(Number(x?.tier)) ? (Number(x.tier) as SourceTier) : 2;
  return { url, tier, nameEs: String(x?.nameEs ?? new URL(url).hostname).slice(0, 80) };
}

/** El contexto viaja por el panel (solo admins): se valida la forma, no se confía en más. */
function ctxDe(x: unknown): ContextoIngesta {
  const c = typeof x === 'string' ? JSON.parse(x) : x;
  const textos = ['brand', 'model', 'modeloPublicado', 'country', 'type', 'vehicleType', 'fuelType', 'versionObjetivo', 'label'] as const;
  if (!c || typeof c !== 'object' || textos.some(k => typeof c[k] !== 'string') || !Number.isInteger(c.year)) {
    throw new ErrorEntrada('Contexto de ingesta inválido: vuelve a empezar este vehículo.');
  }
  return { ...c, versionPedida: !!c.versionPedida, warningsEs: Array.isArray(c.warningsEs) ? c.warningsEs.map(String).slice(0, 30) : [] };
}

/** Identidad pedida: una línea ("Onix RS 2026") o marca/modelo/año sueltos. */
function pedido(body: any) {
  let { brand, model, year } = body ?? {};
  if (typeof body?.query === 'string' && body.query.trim()) {
    const parsed = parseVehicleQuery(body.query);
    if (!parsed) throw new ErrorEntrada('No entendí el vehículo. Ejemplo: "Onix RS 2026"');
    ({ brand, model, year } = parsed);
  } else if (!String(model ?? '').trim() || !year) {
    // La marca puede faltar ("Blazer EV 2025"): resolveIdentity la deduce del modelo.
    throw new ErrorEntrada('Falta el vehículo: escribe al menos el modelo y el año (ej. "Onix RS 2026")');
  }
  const yearNum = parseInt(String(year));
  if (!Number.isFinite(yearNum) || yearNum < 1990 || yearNum > new Date().getFullYear() + 2) throw new ErrorEntrada('Año inválido');
  return {
    brand: String(brand ?? '').trim(),
    model: String(model).trim(),
    year: yearNum,
    country: String(body?.country ?? 'CO').trim().toUpperCase(),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { body, documentos } = await leerCuerpo(request);

    switch (body?.etapa) {
      case 'preparar':
        return NextResponse.json(await prepararIngesta({ ...pedido(body), enlaces: enlacesDe(body?.enlaces) }));

      case 'fuente': {
        const soloKeys = Array.isArray(body?.soloKeys) ? body.soloKeys.filter((k: unknown) => typeof k === 'string').slice(0, 200) : undefined;
        return NextResponse.json(await leerFuente(ctxDe(body?.ctx), fuenteDe(body?.source), soloKeys?.length ? soloKeys : undefined));
      }

      case 'documento': {
        if (documentos.length !== 1) throw new ErrorEntrada('Manda un documento (PDF, JPG, PNG o WebP) por petición');
        return NextResponse.json(await leerDocumento(ctxDe(body?.ctx), documentos[0]));
      }

      case 'fotos': {
        const fuentes = (Array.isArray(body?.fuentes) ? body.fuentes : []).slice(0, 8).map(fuenteDe);
        return NextResponse.json(await fotosDeIngesta(ctxDe(body?.ctx), fuentes, angulosDe(body?.angulosCubiertos)));
      }

      case 'faltantes': {
        const facts = (Array.isArray(body?.facts) ? body.facts : []).filter((f: any) => typeof f?.key === 'string');
        const yaLeidas = (Array.isArray(body?.yaLeidas) ? body.yaLeidas : []).map(String).slice(0, 20);
        return NextResponse.json(await buscarFaltantes(ctxDe(body?.ctx), facts, yaLeidas));
      }

      case 'cerrar': {
        const leidas: FuenteLeida[] = (Array.isArray(body?.leidas) ? body.leidas : []).filter(
          (l: any) => l?.report && typeof l.report.url === 'string' && Array.isArray(l.facts)
        );
        const fotos = body?.fotos && Array.isArray(body.fotos.fotos) ? { fotos: body.fotos.fotos, avisos: (body.fotos.avisos ?? []).map(String) } : undefined;
        return NextResponse.json({ draft: await cerrarIngesta(ctxDe(body?.ctx), leidas, fotos) });
      }

      default: {
        // Compatibilidad: todo en una sola petición.
        const draft = await runIngestPipeline({
          ...pedido(body),
          documentos,
          enlaces: enlacesDe(body?.enlaces),
          angulosCubiertos: angulosDe(body?.angulosCubiertos),
        });
        return NextResponse.json({ draft });
      }
    }
  } catch (error) {
    if (error instanceof ErrorEntrada) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error en la ingesta:', error);
    const mensaje = error instanceof Error ? error.message : 'Error interno en la ingesta';
    // fatal: sin saldo o con la clave mala, el panel detiene la cola en vez de seguir fallando.
    const fatal = esErrorDeCuenta(error) || /sin saldo|no es válida/i.test(mensaje);
    return NextResponse.json({ error: mensaje, fatal }, { status: fatal ? 503 : 500 });
  }
}
