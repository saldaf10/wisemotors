import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { runIngestPipeline, type DocumentoConcesionario } from '@/lib/ingest/pipeline';
import { parseVehicleQuery } from '@/lib/ingest/parse-query';
import { ANGULOS, type Angulo } from '@/lib/ingest/fotos';

// La ingesta hace varias llamadas LLM + fetch de fuentes: necesita más que
// los 30s por defecto del proyecto.
// Búsqueda web + lectura de 6 fuentes + extracción: ~50 s. Margen para sitios lentos.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// POST /api/admin/ingest — corre el pipeline y devuelve un BORRADOR.
// No escribe nada en la base de datos: eso lo hace /publish tras la revisión.
//
// Acepta { query: "Ónix RS 2026" } (una línea, lo normal) o { brand, model, year }.
// Con query la marca puede faltar: resolveIdentity la deduce del modelo.
//
// Con documentos del concesionario (fichas en PDF o foto) llega como
// multipart/form-data: los mismos campos + archivos en "documentos". Vercel
// corta el cuerpo en ~4,5 MB: el cliente reduce las fotos antes de subir.
// Con "enlaces" (URLs que eligió el equipo) se leen antes que la web, como
// fuentes principales; sirven igual sin documentos.
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'] as const;

async function leerCuerpo(request: NextRequest): Promise<{ body: any; documentos: DocumentoConcesionario[] }> {
  if (!(request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    return { body: await request.json(), documentos: [] };
  }
  const form = await request.formData();
  const body = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === 'string'));
  const documentos: DocumentoConcesionario[] = [];
  for (const archivo of form.getAll('documentos')) {
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

/**
 * Enlaces que puso el equipo: solo http(s) públicos (el servidor los descarga,
 * así que nada de localhost ni redes internas). Uno por línea o arreglo.
 */
function enlacesDe(x: unknown): string[] {
  const lista = Array.isArray(x) ? x : typeof x === 'string' ? x.split(/[\s,]+/) : [];
  const vistos = new Set<string>();
  for (const crudo of lista) {
    try {
      const u = new URL(String(crudo).trim());
      const host = u.hostname.toLowerCase();
      if (!/^https?:$/.test(u.protocol)) continue;
      if (/^(localhost|.*\.local|.*\.internal)$/.test(host) || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.includes(':')) continue;
      vistos.add(u.toString());
    } catch {}
  }
  return Array.from(vistos).slice(0, 6);
}

/** Vistas ya cubiertas: arreglo en JSON o "lado,frente" en multipart. */
function angulosDe(x: unknown): Angulo[] {
  const lista = Array.isArray(x) ? x : typeof x === 'string' ? x.split(',') : [];
  return lista.filter((a): a is Angulo => ANGULOS.includes(a as Angulo));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { body, documentos } = await leerCuerpo(request);
    let { brand, model, year } = body ?? {};
    const { query, country } = body ?? {};

    if (typeof query === 'string' && query.trim()) {
      const parsed = parseVehicleQuery(query);
      if (!parsed) {
        return NextResponse.json({ error: 'No entendí el vehículo. Ejemplo: "Onix RS 2026"' }, { status: 400 });
      }
      ({ brand, model, year } = parsed);
    } else if (!String(model ?? '').trim() || !year) {
      // La marca puede faltar ("Blazer EV 2025"): resolveIdentity la deduce del modelo.
      return NextResponse.json(
        { error: 'Falta el vehículo: escribe al menos el modelo y el año (ej. "Onix RS 2026")' },
        { status: 400 }
      );
    }

    const yearNum = parseInt(String(year));
    if (!Number.isFinite(yearNum) || yearNum < 1990 || yearNum > new Date().getFullYear() + 2) {
      return NextResponse.json({ error: 'Año inválido' }, { status: 400 });
    }

    const draft = await runIngestPipeline({
      brand: String(brand ?? '').trim(),
      model: String(model).trim(),
      year: yearNum,
      country: String(country ?? 'CO').trim().toUpperCase(),
      documentos,
      enlaces: enlacesDe(body?.enlaces),
      angulosCubiertos: angulosDe(body?.angulosCubiertos),
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('Error en pipeline de ingesta:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno en la ingesta' },
      { status: 500 }
    );
  }
}
