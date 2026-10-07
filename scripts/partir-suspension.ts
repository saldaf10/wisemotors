// ============================================================================
// Pasa el campo viejo "Suspensión" (chassis.suspensionSetup) a Suspensión
// delantera y trasera (lógica en lib/db/partir-suspension.ts). En producción ya
// corre solo en cada deploy (scripts/preparar-bd.ts); esto es para verlo a mano.
//
//   npx tsx --env-file=.env.local scripts/partir-suspension.ts           # simulación
//   npx tsx --env-file=.env.local scripts/partir-suspension.ts --write   # aplica
// ============================================================================

import { prisma } from '../lib/prisma';
import { partirSuspensiones } from '../lib/db/partir-suspension';

const APLICAR = process.argv.includes('--write');

async function main() {
  const r = await partirSuspensiones(prisma, APLICAR);
  console.log(`\nModo: ${APLICAR ? 'APLICAR' : 'simulación (usa --write para guardar)'} · ${r.carros} carros con "Suspensión"\n`);
  for (const l of r.lineas) console.log(l);
  console.log(`\n${APLICAR ? 'Escritos' : 'Se escribirían'}: ${r.escritos} datos.`);
  if (r.revisar.length) console.log(`Para revisar a mano (${r.revisar.length}):\n  ${r.revisar.join('\n  ')}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
