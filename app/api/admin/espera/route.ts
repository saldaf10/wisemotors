import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// La lista de espera en CSV (Excel la abre directo), con cuántos invitó cada uno.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const filas = await prisma.listaEspera.findMany({ orderBy: { createdAt: 'asc' } });
  const invitados = new Map<string, number>();
  for (const f of filas) if (f.referidoPor) invitados.set(f.referidoPor, (invitados.get(f.referidoPor) ?? 0) + 1);

  const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [
    ['Fecha', 'Nombre', 'Correo', 'Ciudad', 'Origen', 'Invitó a', 'Código', 'Invitado por'].map(celda).join(','),
    ...filas.map(f =>
      [f.createdAt.toISOString().slice(0, 16).replace('T', ' '), f.nombre, f.email, f.ciudad, f.origen, invitados.get(f.codigo) ?? 0, f.codigo, f.referidoPor]
        .map(celda)
        .join(',')
    ),
  ];
  return new NextResponse('﻿' + lineas.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lista-espera-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
