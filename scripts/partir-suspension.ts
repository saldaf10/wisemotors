// ============================================================================
// Pasa el campo viejo "Suspensión" (chassis.suspensionSetup) a Suspensión
// delantera y trasera en los carros publicados (ver lib/attributes/suspension.ts).
//
//   npx tsx --env-file=.env.local scripts/partir-suspension.ts           # simulación
//   npx tsx --env-file=.env.local scripts/partir-suspension.ts --write   # aplica
//
// Solo llena lo que esté vacío: nunca pisa una suspensión que ya exista.
// El dato nuevo hereda la fuente, la confianza y la verificación del viejo.
// El dato viejo no se borra (ya no se muestra ni se pide).
// ============================================================================

import { prisma } from '../lib/prisma';
import { partirSuspension } from '../lib/attributes/suspension';
import { computeCoverage } from '../lib/attributes/coverage';
import { fijarEnSpecs } from '../lib/auditoria';
import { specsDe } from '../lib/vehiculo-datos';

const APLICAR = process.argv.includes('--write');
const VIEJO = 'chassis.suspensionSetup';
const DEL = 'chassis.frontSuspension';
const TRAS = 'chassis.rearSuspension';

async function main() {
  const viejos = await prisma.vehicleAttribute.findMany({
    where: { attributeKey: VIEJO, valueText: { not: null } },
    include: { vehicle: { select: { id: true, brand: true, model: true, year: true, fuelType: true, specifications: true } } },
    orderBy: { vehicle: { brand: 'asc' } },
  });
  console.log(`\nModo: ${APLICAR ? 'APLICAR' : 'simulación (usa --write para guardar)'} · ${viejos.length} carros con "Suspensión"\n`);

  const revisar: string[] = [];
  let escritos = 0;

  for (const viejo of viejos) {
    const v = viejo.vehicle;
    const nombre = `${v.brand} ${v.model} ${v.year}`;
    const texto = viejo.valueText!;
    const partes = partirSuspension(texto);
    const ya = await prisma.vehicleAttribute.findMany({ where: { vehicleId: v.id, attributeKey: { in: [DEL, TRAS] } }, select: { attributeKey: true, valueText: true } });
    const tiene = new Map(ya.map(a => [a.attributeKey, a.valueText]));

    const nuevos: [string, string][] = [];
    if (partes.delantera && !tiene.get(DEL)) nuevos.push([DEL, partes.delantera]);
    if (partes.trasera && !tiene.get(TRAS)) nuevos.push([TRAS, partes.trasera]);

    if (!partes.delantera && !partes.trasera) {
      revisar.push(`${nombre}: «${texto}»`);
      console.log(`? ${nombre}\n    «${texto}» → no se entiende, queda para revisar a mano`);
      continue;
    }
    console.log(`${nuevos.length ? '▸' : '·'} ${nombre}${partes.porOrden ? '  (por orden: primero delantera)' : ''}\n    «${texto}»`);
    console.log(`    delantera: ${partes.delantera ?? '—'}${tiene.get(DEL) ? `  (ya tenía «${tiene.get(DEL)}», no se toca)` : ''}`);
    console.log(`    trasera:   ${partes.trasera ?? '—'}${tiene.get(TRAS) ? `  (ya tenía «${tiene.get(TRAS)}», no se toca)` : ''}`);
    if (!nuevos.length || !APLICAR) {
      escritos += nuevos.length;
      continue;
    }

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
    escritos += nuevos.length;
  }

  console.log(`\n${APLICAR ? 'Escritos' : 'Se escribirían'}: ${escritos} datos.`);
  if (revisar.length) console.log(`Para revisar a mano (${revisar.length}):\n  ${revisar.join('\n  ')}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
