// ============================================================================
// Pasa los datos de los campos retirados por redundantes al campo que se queda
// (lógica y reglas en lib/db/fusionar-campos.ts). En producción ya corre solo en
// cada deploy (scripts/preparar-bd.ts); esto es para verlo a mano.
//
//   npx tsx --env-file=.env.local scripts/fusionar-campos.ts           # simulación
//   npx tsx --env-file=.env.local scripts/fusionar-campos.ts --write   # aplica
// ============================================================================

import { prisma } from '../lib/prisma';
import { fusionarCampos } from '../lib/db/fusionar-campos';

const APLICAR = process.argv.includes('--write');

async function main() {
  const r = await fusionarCampos(prisma, APLICAR);
  console.log(`\nModo: ${APLICAR ? 'APLICAR' : 'simulación (usa --write para guardar)'} · ${r.carros} carros con campos retirados\n`);
  for (const l of r.lineas) console.log(l);
  console.log(`\n${APLICAR ? 'Escritos' : 'Se escribirían'}: ${r.escritos} datos.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
