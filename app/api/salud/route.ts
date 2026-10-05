import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fuenteBaseDatos } from '@/lib/db/url';
import { adminConfigurado } from '@/lib/db/admin-inicial';
import { cloudinaryConfigurado } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

/**
 * GET /api/salud — diagnóstico del deploy SIN secretos: qué variable de base
 * se está usando (solo el nombre), si conecta, si hay tablas y cuenta admin,
 * y qué variables faltan (sí/no). Para destrabar un deploy sin ver los logs.
 */
export async function GET() {
  const fuente = fuenteBaseDatos();
  const cfg = adminConfigurado();
  const salud: Record<string, unknown> = {
    entorno: process.env.VERCEL_ENV ?? 'local',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    variables: {
      baseDeDatos: fuente?.nombre ?? null,
      JWT_SECRET: Boolean(process.env.JWT_SECRET),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      CLOUDINARY: cloudinaryConfigurado(),
      ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL),
      ADMIN_PASSWORD_valida: Boolean(cfg),
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    salud.conectaABase = true;
    try {
      const [usuarios, carros, atributos] = await Promise.all([
        prisma.user.count(),
        prisma.vehicle.count(),
        prisma.attributeDefinition.count(),
      ]);
      const admin = cfg
        ? await prisma.user.findFirst({ where: { email: { equals: cfg.email, mode: 'insensitive' } }, select: { role: true } })
        : null;
      salud.tablas = true;
      salud.conteos = { usuarios, carros, atributos };
      salud.cuentaAdmin = !cfg ? 'sin configurar' : !admin ? 'no existe aún (se crea al iniciar sesión con ADMIN_EMAIL/ADMIN_PASSWORD)' : admin.role === 'admin' ? 'existe y es admin' : 'existe pero NO es admin (se vuelve admin al iniciar sesión con ADMIN_EMAIL/ADMIN_PASSWORD)';
    } catch (e: any) {
      salud.tablas = false;
      salud.error = `Faltan tablas (${e?.code ?? 'error'}): el deploy de producción las crea con scripts/preparar-bd.ts`;
    }
  } catch (e: any) {
    salud.conectaABase = false;
    salud.error = `No conecta a la base (${e?.errorCode ?? e?.code ?? e?.name ?? 'error'})`;
  }

  return NextResponse.json(salud, { headers: { 'Cache-Control': 'no-store' } });
}
