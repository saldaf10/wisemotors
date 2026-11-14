import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import { generarCodigos } from '@/lib/invitaciones';

export const dynamic = 'force-dynamic';

// Códigos de invitación (lib/invitaciones.ts).
// GET: todos, con quién los usó (?formato=csv → CSV). POST { nombre }: aparta
// el primer código libre para esa persona (la imagen la dibuja el panel);
// POST { cantidad }: crea más. PATCH { codigo, nota }: anota a quién se le entregó.

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
  return NextResponse.json({
    total: lista.length,
    usados: lista.filter(c => c.usadoEn).length,
    entregados: lista.filter(c => !c.usadoEn && c.nota).length,
    lista,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);

  // Invitación para una persona: el primer código que nadie usó ni se le dio a nadie.
  if (body?.nombre !== undefined) {
    const nombre = String(body.nombre).trim().replace(/\s+/g, ' ').slice(0, 40);
    if (nombre.length < 2) return NextResponse.json({ error: 'Escribe el nombre de la persona.' }, { status: 400 });
    for (let intento = 0; intento < 3; intento++) {
      const libre = await prisma.codigoInvitacion.findFirst({ where: { usadoPor: null, nota: null }, orderBy: { numero: 'asc' } });
      if (!libre) {
        await generarCodigos(prisma, 1);
        continue;
      }
      // Solo si sigue libre (dos personas del equipo generando a la vez no se pisan).
      const r = await prisma.codigoInvitacion.updateMany({ where: { codigo: libre.codigo, nota: null, usadoPor: null }, data: { nota: nombre } });
      if (r.count !== 1) continue;
      const total = await prisma.codigoInvitacion.count();
      return NextResponse.json({ codigo: libre.codigo, numero: libre.numero, nombre, total, enlace: ENLACE(libre.codigo) });
    }
    return NextResponse.json({ error: 'No se pudo apartar un código. Intenta de nuevo.' }, { status: 409 });
  }

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
