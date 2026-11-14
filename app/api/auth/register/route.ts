import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/schemas/auth';
import { hashPassword, generateToken } from '@/lib/auth';
import { darAcceso, esCodigoAcceso, sitioAbierto } from '@/lib/acceso';
import { normalizarCodigo } from '@/lib/invitaciones';

class CodigoInvalido extends Error {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar datos de entrada
    const validatedData = registerSchema.parse(body);

    // Con el sitio cerrado, crear cuenta exige un código de invitación (lib/invitaciones.ts).
    const cerrado = !sitioAbierto();
    const codigoCrudo = String(body?.codigoInvitacion ?? '').trim();
    const delEquipo = cerrado && esCodigoAcceso(codigoCrudo);
    const codigo = cerrado && !delEquipo ? normalizarCodigo(codigoCrudo) : null;
    if (cerrado && !codigoCrudo) {
      return NextResponse.json({ error: 'Escribe tu código de invitación.' }, { status: 400 });
    }
    if (cerrado && body?.autoriza !== true) {
      return NextResponse.json({ error: 'Necesitamos tu autorización para guardar tus datos.' }, { status: 400 });
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username }
        ]
      }
    });

    if (existingUser) {
      const errorMessage = existingUser.email === validatedData.email
        ? 'Ese correo ya tiene cuenta: ingresa con ella.'
        : 'Ese nombre ya lo usa otra persona: prueba con otro.';
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Encriptar contraseña
    const hashedPassword = await hashPassword(validatedData.password);

    // Cuenta y canje del código van juntos: si el código no sirve, no queda cuenta.
    let numero: number | null = null;
    let user;
    try {
      user = await prisma.$transaction(async tx => {
        const creado = await tx.user.create({
          data: {
            username: validatedData.username,
            email: validatedData.email,
            password: hashedPassword,
            role: 'user'
          }
        });
        if (codigo) {
          const canje = await tx.codigoInvitacion.updateMany({
            where: { codigo, usadoPor: null },
            data: { usadoPor: creado.id, usadoEn: new Date() },
          });
          if (canje.count !== 1) throw new CodigoInvalido();
          numero = (await tx.codigoInvitacion.findUnique({ where: { codigo }, select: { numero: true } }))?.numero ?? null;
        }
        return creado;
      });
    } catch (e) {
      if (e instanceof CodigoInvalido) {
        // Pausa corta: probar códigos a mano se vuelve lento.
        await new Promise(r => setTimeout(r, 800));
        return NextResponse.json({ error: 'Ese código no existe o ya lo usó otra persona.' }, { status: 400 });
      }
      throw e;
    }

    // Generar token JWT
    const token = generateToken(user.id, user.email, user.role);

    // Retornar usuario sin contraseña y token
    const { password, ...userWithoutPassword } = user;

    const res = NextResponse.json({
      message: 'Usuario registrado exitosamente',
      user: userWithoutPassword,
      token,
      // "Invitación #037 de 100": la bienvenida lo muestra.
      invitacion: numero,
      invitaciones: numero !== null ? await prisma.codigoInvitacion.count() : null,
    }, { status: 201 });
    if (cerrado) await darAcceso(res);
    return res;

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors?.[0]?.message ?? 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
