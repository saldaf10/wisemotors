import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/encuestas — promedios y respuestas de la encuesta del recorrido.
// ?formato=csv → todas las respuestas en CSV.

const CALIDAD = ['', 'Muy mala', 'Mala', 'Normal', 'Buena', 'Excelente'];
const FACILIDAD = ['', 'Muy difícil', 'Difícil', 'Normal', 'Fácil', 'Muy fácil'];

const promedio = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
/** Cuántas respuestas hubo de cada valor (1..max). */
const reparto = (xs: number[], max: number) => Array.from({ length: max }, (_, i) => xs.filter(x => x === i + 1).length);

function celda(v: unknown) {
  const t = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const filas = await prisma.encuestaRecorrido.findMany({ orderBy: { updatedAt: 'desc' } });
  const usuarios = await prisma.user.findMany({
    where: { id: { in: filas.map(f => f.userId) } },
    select: { id: true, email: true, username: true },
  });
  const quien = new Map(usuarios.map(u => [u.id, u]));
  const lista = filas.map(f => ({
    ...f,
    email: quien.get(f.userId)?.email ?? null,
    nombre: quien.get(f.userId)?.username ?? null,
  }));

  if (request.nextUrl.searchParams.get('formato') === 'csv') {
    const cabecera = [
      'fecha', 'nombre', 'correo', 'busqueda_ia_1a10', 'busqueda_comentario', 'informacion', 'organizacion',
      'organizacion_comentario', 'comparacion', 'likes_facilidad', 'likes_por_que', 'rendimiento_1a10', 'diseno_1a10', 'comentarios',
    ];
    const lineas = lista.map(f =>
      [
        f.updatedAt.toISOString().slice(0, 10), f.nombre, f.email, f.busquedaIA, f.busquedaComentario, CALIDAD[f.informacion],
        CALIDAD[f.organizacion], f.organizacionComentario, CALIDAD[f.comparacion], FACILIDAD[f.likesFacilidad], f.likesPorQue,
        f.rendimiento, f.diseno, f.comentarios,
      ].map(celda).join(',')
    );
    return new NextResponse('﻿' + [cabecera.join(','), ...lineas].join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }

  const col = <K extends keyof (typeof filas)[number]>(k: K) => filas.map(f => f[k] as unknown as number);
  return NextResponse.json({
    total: filas.length,
    resumen: {
      busquedaIA: { promedio: promedio(col('busquedaIA')), reparto: reparto(col('busquedaIA'), 10) },
      rendimiento: { promedio: promedio(col('rendimiento')), reparto: reparto(col('rendimiento'), 10) },
      diseno: { promedio: promedio(col('diseno')), reparto: reparto(col('diseno'), 10) },
      informacion: { promedio: promedio(col('informacion')), reparto: reparto(col('informacion'), 5) },
      organizacion: { promedio: promedio(col('organizacion')), reparto: reparto(col('organizacion'), 5) },
      comparacion: { promedio: promedio(col('comparacion')), reparto: reparto(col('comparacion'), 5) },
      likesFacilidad: { promedio: promedio(col('likesFacilidad')), reparto: reparto(col('likesFacilidad'), 5) },
    },
    lista: lista.slice(0, 200),
  });
}
