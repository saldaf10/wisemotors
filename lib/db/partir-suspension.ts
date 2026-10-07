// ============================================================================
// Pasa el campo viejo "Suspensión" (chassis.suspensionSetup, retirado del
// registro el 7-oct-2026) a Suspensión delantera y trasera, en la base que le
// pasen. Lo usan scripts/partir-suspension.ts (a mano, con simulación) y
// scripts/preparar-bd.ts (en cada deploy de producción).
//
// Idempotente: solo llena lo que esté vacío, nunca pisa una suspensión que ya
// exista. El dato nuevo hereda la fuente, la confianza y la verificación del
// viejo, y se actualizan specifications y cobertura en la misma transacción.
// El dato viejo no se borra (ya no se muestra ni se pide).
// ============================================================================

import type { PrismaClient } from '@prisma/client';
import { partirSuspension } from '@/lib/attributes/suspension';
import { computeCoverage } from '@/lib/attributes/coverage';
import { fijarEnSpecs, specsDe } from '@/lib/vehiculo-datos';

const VIEJO = 'chassis.suspensionSetup';
const DEL = 'chassis.frontSuspension';
const TRAS = 'chassis.rearSuspension';

export interface ResultadoSuspension {
  carros: number;
  escritos: number;
  revisar: string[];
  lineas: string[];
}

export async function partirSuspensiones(prisma: PrismaClient, aplicar: boolean): Promise<ResultadoSuspension> {
  const viejos = await prisma.vehicleAttribute.findMany({
    where: { attributeKey: VIEJO, valueText: { not: null } },
    include: { vehicle: { select: { id: true, brand: true, model: true, year: true, fuelType: true, specifications: true } } },
    orderBy: { vehicle: { brand: 'asc' } },
  });
  const r: ResultadoSuspension = { carros: viejos.length, escritos: 0, revisar: [], lineas: [] };

  for (const viejo of viejos) {
    const v = viejo.vehicle;
    const nombre = `${v.brand} ${v.model} ${v.year}`;
    const texto = viejo.valueText!;
    const partes = partirSuspension(texto);
    const ya = await prisma.vehicleAttribute.findMany({ where: { vehicleId: v.id, attributeKey: { in: [DEL, TRAS] } }, select: { attributeKey: true, valueText: true } });
    const tiene = new Map(ya.map(a => [a.attributeKey, a.valueText]));

    if (!partes.delantera && !partes.trasera) {
      r.revisar.push(`${nombre}: «${texto}»`);
      r.lineas.push(`? ${nombre}\n    «${texto}» → no se entiende, queda para revisar a mano`);
      continue;
    }
    const nuevos: [string, string][] = [];
    if (partes.delantera && !tiene.get(DEL)) nuevos.push([DEL, partes.delantera]);
    if (partes.trasera && !tiene.get(TRAS)) nuevos.push([TRAS, partes.trasera]);
    r.lineas.push(
      `${nuevos.length ? '▸' : '·'} ${nombre}${partes.porOrden ? '  (por orden: primero delantera)' : ''}\n    «${texto}»\n` +
        `    delantera: ${partes.delantera ?? '—'}${tiene.get(DEL) ? `  (ya tenía «${tiene.get(DEL)}», no se toca)` : ''}\n` +
        `    trasera:   ${partes.trasera ?? '—'}${tiene.get(TRAS) ? `  (ya tenía «${tiene.get(TRAS)}», no se toca)` : ''}`
    );
    r.escritos += nuevos.length;
    if (!nuevos.length || !aplicar) continue;

    const s = specsDe(v.specifications);
    for (const [k, valor] of nuevos) fijarEnSpecs(s, k, valor);
    const existentes = await prisma.vehicleAttribute.findMany({ where: { vehicleId: v.id }, select: { attributeKey: true } });
    const cobertura = computeCoverage(v.fuelType, new Set([...existentes.map(e => e.attributeKey), ...nuevos.map(n => n[0])]));
    const herencia = {
      confidence: viejo.confidence,
      sourceTier: viejo.sourceTier,
      sourceUrl: viejo.sourceUrl,
      verifiedBy: viejo.verifiedBy,
      verifiedAt: viejo.verifiedAt,
      auditedBy: viejo.auditedBy,
      auditedAt: viejo.auditedAt,
    };
    await prisma.$transaction([
      ...nuevos.map(([k, valor]) =>
        prisma.vehicleAttribute.upsert({
          where: { vehicleId_attributeKey: { vehicleId: v.id, attributeKey: k } },
          create: { vehicleId: v.id, attributeKey: k, valueText: valor, ...herencia },
          update: { valueText: valor, valueNum: null, valueBool: null, ...herencia },
        })
      ),
      prisma.vehicle.update({
        where: { id: v.id },
        data: { specifications: JSON.stringify(s), coverageGlobal: cobertura.global, coverageByDimension: JSON.stringify(cobertura.byDimension) },
      }),
    ]);
  }
  return r;
}
