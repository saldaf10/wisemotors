import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_ACCESO, DURACION_ACCESO_S, esCodigoAcceso, huellaAcceso } from '@/lib/acceso';

// Código del equipo (lib/acceso.ts): si es correcto, deja la cookie que abre el sitio.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!esCodigoAcceso(String(body?.codigo ?? ''))) {
    // Pausa corta: probar códigos a mano se vuelve lento.
    await new Promise(r => setTimeout(r, 800));
    return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_ACCESO, await huellaAcceso(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_ACCESO_S,
  });
  return res;
}
