// ============================================================================
// Deja en la base solo los campos del registro (lógica en lib/db/limpiar-campos.ts).
// En producción ya corre solo en cada deploy (scripts/preparar-bd.ts), después
// de pasar los datos a los campos que se quedan; esto es para verlo a mano.
//
//   npx tsx --env-file=.env.local scripts/limpiar-campos.ts           # simulación
//   npx tsx --env-file=.env.local scripts/limpiar-campos.ts --write   # aplica (con respaldo)
// ============================================================================

import { prisma } from '../lib/prisma';
import { limpiarCamposRetirados } from '../lib/db/limpiar-campos';

const APLICAR = process.argv.includes('--write');

async function main() {
  const r = await limpiarCamposRetirados(prisma, APLICAR);
  console.log(`\nModo: ${APLICAR ? 'APLICAR' : 'simulación (usa --write para borrar)'}`);
  console.log(`Campos retirados en la base (${r.campos.length}): ${r.campos.join(', ') || '—'}`);
  console.log(`${APLICAR ? 'Borrados' : 'Se borrarían'}: ${r.datos} datos, en ${r.carros} carros.`);
  if (r.respaldo) console.log(`Respaldo guardado en estado_sistema: ${r.respaldo}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
