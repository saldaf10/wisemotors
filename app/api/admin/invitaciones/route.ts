import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import { generarCodigos } from '@/lib/invitaciones';

export const dynamic = 'force-dynamic';

// Códigos de invitación (lib/invitaciones.ts).
// GET: todos, con quién los usó (?formato=csv → CSV). POST { cantidad }: crea
// más. PATCH { codigo, nota }: anota a quién se le entregó.

const ENLACE = (codigo: string) => `https://wisemotors.co/?codigo=${codigo}`;

function celda(v: unknown) {
  const t = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const codigos = await prisma.codigoInvitacion.findMany({ orderBy: { numero: 'asc' } });
  const usuarios = await prisma.user.findMany({
    where: { id: { in: codigos.map(c => c.usadoPor).filter((x): x is string => !!x) } },
    select: { id: true, email: true, username: true },
  });
  const quien = new Map(usuarios.map(u => [u.id, u]));
  const lista = codigos.map(c => ({
    codigo: c.codigo,
    numero: c.numero,
    nota: c.nota,
    enlace: ENLACE(c.codigo),
    usadoEn: c.usadoEn,
    nombre: c.usadoPor ? quien.get(c.usadoPor)?.username ?? null : null,
    email: c.usadoPor ? quien.get(c.usadoPor)?.email ?? null : null,
  }));

  if (request.nextUrl.searchParams.get('formato') === 'csv') {
    const lineas = lista.map(c =>
      [c.numero, c.codigo, c.enlace, c.nota, c.usadoEn ? 'usado' : 'libre', c.usadoEn?.toISOString().slice(0, 10), c.nombre, c.email].map(celda).join(',')
    );
    return new NextResponse('﻿' + ['numero,codigo,enlace,entregado_a,estado,usado_el,nombre,correo', ...lineas].join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }
  return NextResponse.json({ total: lista.length, usados: lista.filter(c => c.usadoEn).length, lista });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  const cantidad = Math.floor(Number(body?.cantidad));
  if (!(cantidad >= 1 && cantidad <= 500)) return NextResponse.json({ error: 'Entre 1 y 500 códigos.' }, { status: 400 });
  return NextResponse.json({ creados: await generarCodigos(prisma, cantidad) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  const codigo = String(body?.codigo ?? '');
  const nota = String(body?.nota ?? '').trim().slice(0, 120) || null;
  const r = await prisma.codigoInvitacion.updateMany({ where: { codigo }, data: { nota } });
  if (!r.count) return NextResponse.json({ error: 'Código no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
