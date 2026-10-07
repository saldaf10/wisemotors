// ============================================================================
// Prepara la base en cada deploy de PRODUCCIÓN (Vercel), antes del build:
//
//   1. prisma db push: crea las tablas que falten y aplica cambios de schema
//      NO destructivos. Si un cambio borraría datos, Prisma se niega y el
//      deploy falla a propósito (hay que resolverlo a mano, nunca solo).
//   2. Datos base: definiciones de atributos y parámetros de los Índices
//      WiseMotors (siempre, idempotente; un valor cambiado abre vigencia nueva) y, si
//      la base está vacía, bandas de precio y percepción de marca.
//   3. Los 10 vehículos de prueba (data/semillas/vehiculos-demo.json), UNA sola
//      vez y marcados DEMO. Si el equipo los borra no vuelven. CARGAR_DEMO=no
//      en Vercel los apaga.
//   5. Pasa la "Suspensión" vieja a delantera/trasera (lib/db/partir-suspension.ts):
//      idempotente, solo llena vacíos; si falla, no tumba el deploy.
//   4. Cuenta admin inicial: si están ADMIN_EMAIL y ADMIN_PASSWORD y ese
//      correo NO existe, la crea con rol admin. Nunca asciende a un usuario
//      que ya exista (el registro no verifica correos: cualquiera pudo haber
//      usado ese email) ni cambia contraseñas. Corre en el build, antes de que
//      el deploy quede público, así que nadie alcanza a registrarse primero.
//
// En preview/desarrollo no hace nada: una rama de prueba nunca debe alterar
// la base real. Para correrlo a mano en local: npx tsx scripts/preparar-bd.ts --forzar
// ============================================================================

import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { VAR_BD, VAR_BD_DIRECTA, fuenteBaseDatos, fuenteBaseDatosDirecta } from '../lib/db/url';
import { sembrarBandas, sembrarDefiniciones, sembrarPercepcion } from '../lib/db/semillas';
import { crearAdminInicial } from '../lib/db/admin-inicial';
import { cargarVehiculosDemo } from '../lib/db/vehiculos-demo';
import { sembrarParametros } from '../lib/indices/parametros';
import { partirSuspensiones } from '../lib/db/partir-suspension';

async function main() {
  const produccion = process.env.VERCEL_ENV === 'production';
  if (!produccion && !process.argv.includes('--forzar')) {
    console.log(`[preparar-bd] VERCEL_ENV=${process.env.VERCEL_ENV ?? '(local)'}: no se toca la base.`);
    return;
  }

  // Diagnóstico en el log (solo nombres y sí/no; nunca valores).
  const fuente = fuenteBaseDatos();
  const fuenteDirecta = fuenteBaseDatosDirecta();
  const si = (v?: string) => (v ? 'sí' : 'NO');
  console.log(
    `[preparar-bd] base: ${fuente?.nombre ?? 'NO ENCONTRADA'} · directa: ${fuenteDirecta?.nombre ?? '—'} · ` +
      `JWT_SECRET: ${si(process.env.JWT_SECRET)} · ANTHROPIC_API_KEY: ${si(process.env.ANTHROPIC_API_KEY)} · ` +
      `ADMIN_EMAIL: ${si(process.env.ADMIN_EMAIL)} · ADMIN_PASSWORD: ${si(process.env.ADMIN_PASSWORD)}`
  );
  if (!fuente || !fuenteDirecta) {
    console.warn('[preparar-bd] ⚠ No hay ninguna variable de base de datos (…DATABASE_URL / …POSTGRES_URL): se omite.');
    return;
  }
  const url = fuente.valor;
  const directa = fuenteDirecta.valor;

  // El CLI de Prisma lee los nombres exactos del schema: se normalizan aquí
  // por si Vercel los creó con el prefijo en minúscula.
  const env = { ...process.env, [VAR_BD]: url, [VAR_BD_DIRECTA]: directa };

  console.log('[preparar-bd] Aplicando schema (prisma db push)…');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const n = await sembrarDefiniciones(prisma);
    console.log(`[preparar-bd] ✓ ${n} definiciones de atributos al día`);

    const cambios = await sembrarParametros(prisma);
    console.log(`[preparar-bd] ✓ parámetros de los Índices WiseMotors al día (${cambios} con valor nuevo)`);

    if ((await prisma.priceBand.count()) === 0) {
      console.log(`[preparar-bd] ✓ ${await sembrarBandas(prisma)} bandas de precio sembradas (base nueva)`);
    }
    if ((await prisma.brandPerception.count()) === 0) {
      console.log(`[preparar-bd] ✓ ${await sembrarPercepcion(prisma)} marcas sembradas (base nueva)`);
    }

    // Un problema con los carros de prueba nunca debe tumbar el deploy.
    const demo = await cargarVehiculosDemo(prisma).catch(e => ({
      estado: 'omitido' as const,
      motivo: `⚠ falló (${e instanceof Error ? e.message : e}); se reintenta en el próximo deploy`,
    }));
    if (demo.estado === 'omitido') {
      console.log(`[preparar-bd] ℹ vehículos de prueba: ${demo.motivo}`);
    } else {
      console.log(
        `[preparar-bd] ✓ vehículos de prueba: ${demo.creados.length} creados, ${demo.yaExistian.length} ya existían` +
          (demo.errores.length ? ` · ⚠ ${demo.errores.length} con error (se reintenta en el próximo deploy): ${demo.errores.join('; ')}` : '')
      );
    }

    try {
      const susp = await partirSuspensiones(prisma, true);
      console.log(`[preparar-bd] ✓ suspensión vieja → delantera/trasera: ${susp.escritos} datos nuevos en ${susp.carros} carros` + (susp.revisar.length ? ` · revisar a mano: ${susp.revisar.join('; ')}` : ''));
    } catch (e) {
      console.log(`[preparar-bd] ⚠ partir suspensión falló (${e instanceof Error ? e.message : e}); se reintenta en el próximo deploy`);
    }

    const admin = await crearAdminInicial(prisma);
    const textos = {
      creada: `✓ cuenta admin creada: ${process.env.ADMIN_EMAIL}`,
      ya_existe_admin: `✓ la cuenta admin ${process.env.ADMIN_EMAIL} ya existe`,
      existe_no_admin: `⚠ ${process.env.ADMIN_EMAIL} ya existe y NO es admin: no se asciende sola (scripts/set-admin.js)`,
      sin_configurar: 'ℹ sin ADMIN_EMAIL + ADMIN_PASSWORD (≥10): no se crea cuenta admin',
    };
    console.log(`[preparar-bd] ${textos[admin]}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error('[preparar-bd] ✗', e);
  process.exit(1);
});
