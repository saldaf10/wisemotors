// ============================================================================
// Pasa los datos de los campos retirados por redundantes (8-oct-2026, ver el
// comentario "CAMPOS RETIRADOS" en lib/attributes/registry.ts) al campo que se
// queda. Lo usan scripts/fusionar-campos.ts (a mano, con simulación) y
// scripts/preparar-bd.ts (en cada deploy de producción).
//
// Igual que partir-suspension: idempotente, solo llena lo que esté vacío, el
// dato nuevo hereda fuente/confianza/verificación del viejo, y specifications y
// cobertura se actualizan en la misma transacción. Los viejos no se borran.
// ============================================================================

import type { PrismaClient } from '@prisma/client';
import { ATTRIBUTE_REGISTRY, attributeAppliesTo } from '@/lib/attributes/registry';
import { computeCoverage } from '@/lib/attributes/coverage';
import { fijarEnSpecs, specsDe } from '@/lib/vehiculo-datos';

type Valor = number | string | boolean;
type Hechos = Map<string, Valor>;

interface Regla {
  /** Campos retirados de los que sale el dato. */
  de: string[];
  /** Campo que se queda. */
  a: string;
  /** El valor nuevo a partir de los hechos del carro; null = no hay nada que pasar. */
  valor: (h: Hechos) => Valor | null;
}

const copiar = (k: string) => (h: Hechos) => h.get(k) ?? null;

export const REGLAS: Regla[] = [
  { de: ['combustion.startStop', 'hybrid.startStop'], a: 'technology.startStop', valor: h => (h.get('combustion.startStop') === true || h.get('hybrid.startStop') === true ? true : null) },
  { de: ['combustion.ecoMode', 'hybrid.ecoMode'], a: 'drivetrain.driveModes', valor: h => (h.get('combustion.ecoMode') === true || h.get('hybrid.ecoMode') === true ? 'Eco' : null) },
  {
    de: ['combustion.turbo', 'combustion.supercharger'],
    a: 'combustion.inductionType',
    valor: h => {
      const turbo = h.get('combustion.turbo'), sc = h.get('combustion.supercharger');
      if (turbo === true && sc === true) return 'Turbo y supercargado';
      if (turbo === true) return 'Turbo';
      if (sc === true) return 'Supercargado';
      if (turbo === false) return 'Atmosférico';
      return null;
    },
  },
  { de: ['electric.theoreticalRangeMixed'], a: 'electric.electricRange', valor: copiar('electric.theoreticalRangeMixed') },
  { de: ['electric.chargingTime1080'], a: 'electric.dcChargingTime', valor: copiar('electric.chargingTime1080') },
  { de: ['interior.interiorCargoCapacity'], a: 'weight.cargoBoxVolume', valor: copiar('interior.interiorCargoCapacity') },
  { de: ['offRoad.wadingHeight'], a: 'offRoad.wadingDepth', valor: copiar('offRoad.wadingHeight') },
  {
    de: ['safety.brakingSystem'],
    a: 'assistance.brakeAssist',
    valor: h => (/\bBA\b|asist|brake ?assist/i.test(String(h.get('safety.brakingSystem') ?? '')) ? true : null),
  },
];

const DEF = new Map(ATTRIBUTE_REGISTRY.map(d => [d.key, d]));

export interface ResultadoFusion {
  carros: number;
  escritos: number;
  lineas: string[];
}

export async function fusionarCampos(prisma: PrismaClient, aplicar: boolean): Promise<ResultadoFusion> {
  const viejasKeys = Array.from(new Set(REGLAS.flatMap(r => r.de)));
  const conViejos = await prisma.vehicleAttribute.findMany({ where: { attributeKey: { in: viejasKeys } }, select: { vehicleId: true }, distinct: ['vehicleId'] });
  const r: ResultadoFusion = { carros: conViejos.length, escritos: 0, lineas: [] };

  for (const { vehicleId } of conViejos) {
    const v = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { brand: true, model: true, year: true, fuelType: true, specifications: true } });
    if (!v) continue;
    const filas = await prisma.vehicleAttribute.findMany({ where: { vehicleId } });
    const hechos: Hechos = new Map();
    for (const f of filas) {
      const val = f.valueNum ?? f.valueBool ?? f.valueText;
      if (val !== null && val !== undefined) hechos.set(f.attributeKey, val);
    }

    const nuevos: { a: string; valor: Valor; origen: (typeof filas)[number] }[] = [];
    for (const regla of REGLAS) {
      const d = DEF.get(regla.a);
      if (!d || !attributeAppliesTo(d, v.fuelType) || hechos.has(regla.a)) continue;
      const valor = regla.valor(hechos);
      const origen = filas.find(f => regla.de.includes(f.attributeKey));
      if (valor === null || !origen) continue;
      nuevos.push({ a: regla.a, valor, origen });
    }
    if (!nuevos.length) continue;
    r.escritos += nuevos.length;
    r.lineas.push(`▸ ${v.brand} ${v.model} ${v.year}: ${nuevos.map(n => `${n.origen.attributeKey} → ${n.a} = ${n.valor}`).join(' · ')}`);
    if (!aplicar) continue;

    const s = specsDe(v.specifications);
    for (const n of nuevos) fijarEnSpecs(s, n.a, n.valor);
    const cobertura = computeCoverage(v.fuelType, new Set([...filas.map(f => f.attributeKey), ...nuevos.map(n => n.a)]));
    await prisma.$transaction([
      ...nuevos.map(n => {
        const d = DEF.get(n.a)!;
        const datos = {
          valueNum: d.dataType === 'numeric' ? (n.valor as number) : null,
          valueBool: d.dataType === 'boolean' ? (n.valor as boolean) : null,
          valueText: d.dataType === 'text' || d.dataType === 'enum' ? String(n.valor) : null,
          confidence: n.origen.confidence,
          sourceTier: n.origen.sourceTier,
          sourceUrl: n.origen.sourceUrl,
          verifiedBy: n.origen.verifiedBy,
          verifiedAt: n.origen.verifiedAt,
          auditedBy: n.origen.auditedBy,
          auditedAt: n.origen.auditedAt,
        };
        return prisma.vehicleAttribute.upsert({
          where: { vehicleId_attributeKey: { vehicleId, attributeKey: n.a } },
          create: { vehicleId, attributeKey: n.a, ...datos },
          update: datos,
        });
      }),
      prisma.vehicle.update({
        where: { id: vehicleId },
        data: { specifications: JSON.stringify(s), coverageGlobal: cobertura.global, coverageByDimension: JSON.stringify(cobertura.byDimension) },
      }),
    ]);
  }
  return r;
}
