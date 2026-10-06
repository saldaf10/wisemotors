import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CIUDADES, correoValido, nuevoCodigo, puestoDe } from '@/lib/lista-espera';

// Inscripción a la lista de espera. Si el correo ya está, devuelve su puesto.
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  // Campo trampa: los humanos no lo ven, los bots lo llenan.
  if (body?.sitio) return NextResponse.json({ puesto: 0, invitados: 0, codigo: '' });

  const nombre = String(body?.nombre ?? '').trim().slice(0, 80);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const ciudad = String(body?.ciudad ?? '').trim();
  const ref = String(body?.ref ?? '').trim().toLowerCase().slice(0, 12) || null;
  const utm = String(body?.utm ?? '').trim().slice(0, 60) || null;

  if (nombre.length < 2) return NextResponse.json({ error: 'Escribe tu nombre.' }, { status: 400 });
  if (!correoValido(email)) return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 });
  if (!(CIUDADES as readonly string[]).includes(ciudad)) return NextResponse.json({ error: 'Elige tu ciudad.' }, { status: 400 });
  if (body?.autoriza !== true) {
    return NextResponse.json({ error: 'Necesitamos tu autorización para guardar tus datos.' }, { status: 400 });
  }

  let fila = await prisma.listaEspera.findUnique({ where: { email } });
  if (!fila) {
    const referidor = ref ? await prisma.listaEspera.findUnique({ where: { codigo: ref }, select: { codigo: true } }) : null;
    for (let intento = 0; !fila && intento < 3; intento++) {
      try {
        fila = await prisma.listaEspera.create({
          data: {
            nombre,
            email,
            ciudad,
            codigo: nuevoCodigo(),
            referidoPor: referidor?.codigo ?? null,
            origen: utm ?? (referidor ? 'referido' : null),
            autorizacion: new Date(),
          },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        // Choque de código (raro) o el mismo correo enviado dos veces a la vez.
        fila = await prisma.listaEspera.findUnique({ where: { email } });
      }
    }
  }
  if (!fila) return NextResponse.json({ error: 'No pudimos guardarte. Intenta de nuevo.' }, { status: 500 });

  const { puesto, invitados } = await puestoDe(fila);
  return NextResponse.json({ puesto, invitados, codigo: fila.codigo, nombre: fila.nombre.split(' ')[0] });
}

// Puesto actualizado de quien ya se inscribió (la página lo pide al volver).
export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get('codigo')?.trim().toLowerCase();
  if (!codigo) return NextResponse.json({ error: 'Falta el código' }, { status: 400 });
  const fila = await prisma.listaEspera.findUnique({ where: { codigo }, select: { codigo: true, createdAt: true, nombre: true } });
  if (!fila) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ ...(await puestoDe(fila)), codigo: fila.codigo, nombre: fila.nombre.split(' ')[0] });
}
