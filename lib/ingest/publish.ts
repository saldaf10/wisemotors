// ============================================================================
// Escritura de un borrador aprobado a la base de datos.
//
// Vive aquí y no en el route handler para que la ruta de admin y los scripts
// de carga masiva usen exactamente el mismo camino: si la regla cambia, cambia
// en un solo lugar.
// ============================================================================

import { prisma } from '@/lib/prisma';
import { ATTRIBUTE_REGISTRY, attributeAppliesTo } from '@/lib/attributes/registry';
import { computeCoverage } from '@/lib/attributes/coverage';

export interface AcceptedFact {
  key: string;
  value: number | string | boolean;
  confidence: number;
  sourceTier: number;
  sourceUrl?: string;
}

export interface PublishInput {
  brand: string;
  model: string;
  year: number;
  type: string;
  vehicleType: string;
  fuelType: string;
  price: number;
  priceEstimated?: boolean;
  priceReasoningEs?: string;
  /** Confianza y fuente del precio (para guardarlo como hecho, igual que el resto). */
  priceConfidence?: number;
  priceSourceUrl?: string;
  facts: AcceptedFact[];
  /** Fotos aprobadas en la revisión, en orden; la de `portada` es la principal. */
  fotos?: { url: string; angulo: string; portada?: boolean }[];
  /** Campos clave que el revisor marcó "el dato no existe" (lib/attributes/clave). */
  sinDato?: string[];
  /** Concesionarios que lo venden (ids de Dealer). Los que no existan se ignoran. */
  dealerIds?: string[];
  /** userId del revisor humano; null en cargas automáticas de prueba. */
  verifiedBy: string | null;
}

export type PublishResult =
  | { ok: true; vehicleId: string; factsWritten: number; coverage: number }
  | { ok: false; error: string; status: number };

/** a.b.c = 1 → { a: { b: { c: 1 } } } — las keys del registro SON paths del JSON. */
function nestByPath(facts: AcceptedFact[]): Record<string, any> {
  const specs: Record<string, any> = {};
  for (const f of facts) {
    const parts = f.key.split('.');
    let node = specs;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] ?? {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = f.value;
  }
  return specs;
}

const ALT_ANGULO: Record<string, string> = {
  lado: 'de lado',
  tres_cuartos_frente: 'vista 3/4 delantera',
  tres_cuartos_atras: 'vista 3/4 trasera',
  frente: 'de frente',
  atras: 'de atrás',
  interior: 'interior',
  detalle: 'detalle',
};

/** Solo URLs http(s), máx. 12; una sola portada (la marcada o la primera). */
function fotosLimpias(fotos: PublishInput['fotos'], nombre: string) {
  const ok = (fotos ?? []).filter(f => typeof f?.url === 'string' && /^https?:\/\//.test(f.url)).slice(0, 12);
  const portada = Math.max(0, ok.findIndex(f => f.portada));
  return ok.map((f, i) => ({
    url: f.url.slice(0, 1000),
    alt: `${nombre}, ${ALT_ANGULO[f.angulo] ?? 'foto'}`,
    type: i === portada ? 'cover' : String(f.angulo ?? 'gallery').slice(0, 40),
    order: i === portada ? 0 : i + 1,
    isThumbnail: i === portada,
  }));
}

export async function publishDraft(input: PublishInput): Promise<PublishResult> {
  const { brand, model, year, type, vehicleType, fuelType, price } = input;

  if (!brand || !model || !year || !type || !vehicleType || !fuelType) {
    return { ok: false, error: 'Identidad incompleta', status: 400 };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: 'El precio es obligatorio para publicar', status: 400 };
  }

  // Solo keys del registro que aplican a este tren motriz: un híbrido no guarda combustion.*.
  const validKeys = new Set(ATTRIBUTE_REGISTRY.filter(d => attributeAppliesTo(d, fuelType)).map(d => d.key));
  const clean = (input.facts ?? []).filter(
    f => validKeys.has(f.key) && f.key !== 'commercial.priceCop' && f.value !== null && f.value !== undefined
  );

  const existing = await prisma.vehicle.findFirst({
    where: {
      brand: { equals: brand, mode: 'insensitive' },
      model: { equals: model, mode: 'insensitive' },
      year: Number(year),
    },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: `Ya existe ${brand} ${model} ${year} (id ${existing.id})`,
      status: 409,
    };
  }

  const specs = nestByPath(clean);
  specs.commercial = specs.commercial ?? {};
  specs.commercial.priceCop = price;
  if (input.priceEstimated) {
    specs.commercial.priceEstimated = true;
    specs.commercial.priceReasoningEs = String(input.priceReasoningEs ?? '');
  }

  const sinDato = (input.sinDato ?? []).filter(x => typeof x === 'string').slice(0, 60);
  if (sinDato.length) specs.meta = { ...(specs.meta ?? {}), sinDato };

  const coverage = computeCoverage(fuelType, new Set([...clean.map(f => f.key), 'commercial.priceCop']));

  const pedidos = Array.from(new Set((input.dealerIds ?? []).filter(x => typeof x === 'string'))).slice(0, 50);
  const dealers = pedidos.length
    ? await prisma.dealer.findMany({ where: { id: { in: pedidos } }, select: { id: true } })
    : [];

  const vehicle = await prisma.vehicle.create({
    data: {
      brand,
      model,
      year: Number(year),
      price,
      priceEstimated: !!input.priceEstimated,
      type,
      vehicleType,
      fuelType,
      specifications: JSON.stringify(specs),
      status: 'Disponible',
      coverageGlobal: coverage.global,
      coverageByDimension: JSON.stringify(coverage.byDimension),
      images: {
        create: fotosLimpias(input.fotos, `${brand} ${model} ${year}`),
      },
      vehicleDealers: {
        create: dealers.map(d => ({ dealerId: d.id })),
      },
      attributes: {
        create: [
          // El precio también es un hecho: con confianza, fuente y revisor, como los demás.
          {
            attributeKey: 'commercial.priceCop',
            valueNum: price,
            valueBool: null,
            valueText: null,
            confidence: input.priceEstimated ? Math.min(0.6, Number(input.priceConfidence) || 0.4) : Math.max(0, Math.min(1, Number(input.priceConfidence) || 0.85)),
            sourceTier: input.priceEstimated ? 3 : 2,
            sourceUrl: input.priceSourceUrl ? String(input.priceSourceUrl).slice(0, 500) : null,
            verifiedBy: input.verifiedBy,
            verifiedAt: input.verifiedBy ? new Date() : null,
          },
          ...clean.map(f => {
          const def = ATTRIBUTE_REGISTRY.find(d => d.key === f.key)!;
          return {
            attributeKey: f.key,
            valueNum: def.dataType === 'numeric' ? Number(f.value) : null,
            valueBool: def.dataType === 'boolean' ? Boolean(f.value) : null,
            valueText:
              def.dataType === 'text' || def.dataType === 'enum' ? String(f.value) : null,
            confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.5)),
            sourceTier: [1, 2, 3].includes(Number(f.sourceTier)) ? Number(f.sourceTier) : 3,
            sourceUrl: f.sourceUrl ? String(f.sourceUrl).slice(0, 500) : null,
            verifiedBy: input.verifiedBy,
            verifiedAt: input.verifiedBy ? new Date() : null,
          };
          }),
        ],
      },
    },
    select: { id: true },
  });

  return {
    ok: true,
    vehicleId: vehicle.id,
    factsWritten: clean.length,
    coverage: coverage.global,
  };
}
