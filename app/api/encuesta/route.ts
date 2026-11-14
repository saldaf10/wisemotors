import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Encuesta al terminar el recorrido guiado (components/recorrido/Encuesta.tsx).
// Una por cuenta: responder otra vez reemplaza la anterior.

const nota10 = z.number().int().min(1).max(10);
const escala5 = z.number().int().min(1).max(5);
const texto = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform(t => (t ? t : null));

const Esquema = z
  .object({
    busquedaIA: nota10,
    busquedaComentario: texto,
    informacion: escala5,
    organizacion: escala5,
    organizacionComentario: texto,
    comparacion: escala5,
    likesFacilidad: escala5,
    likesPorQue: texto,
    rendimiento: nota10,
    diseno: nota10,
    comentarios: texto,
  })
  .refine(d => d.likesFacilidad > 2 || !!d.likesPorQue, {
    message: 'Cuéntanos por qué los me gusta fueron difíciles de entender.',
    path: ['likesPorQue'],
  });

/** ¿Esta cuenta ya respondió? */
export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const ya = await prisma.encuestaRecorrido.findUnique({ where: { userId: auth.userId }, select: { id: true } });
  return NextResponse.json({ respondida: !!ya });
}

export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  const r = Esquema.safeParse(body);
  if (!r.success) {
    return NextResponse.json({ error: r.error.issues[0]?.message ?? 'Respuestas incompletas' }, { status: 400 });
  }
  const datos = { ...r.data, likesPorQue: r.data.likesFacilidad > 2 ? null : r.data.likesPorQue };
  await prisma.encuestaRecorrido.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, ...datos },
    update: datos,
  });
  return NextResponse.json({ ok: true });
}
