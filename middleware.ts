import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_ACCESO, huellaAcceso, sitioAbierto } from '@/lib/acceso';

// Portero mientras el sitio está cerrado (lib/acceso.ts): sin la cookie de
// acceso, toda página muestra la bienvenida por invitación (misma URL) y toda
// API responde 403, salvo crear cuenta e ingresar.
const LIBRES = ['/bienvenida', '/api/auth/login', '/api/auth/register', '/api/salud'];

export async function middleware(request: NextRequest) {
  if (sitioAbierto()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (LIBRES.some(p => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const cookie = request.cookies.get(COOKIE_ACCESO)?.value;
  if (cookie && cookie === (await huellaAcceso())) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'WiseMotors abre muy pronto.' }, { status: 403 });
  }
  const res = NextResponse.rewrite(new URL(`/bienvenida${search}`, request.url));
  // Todas las URLs muestran la bienvenida: para Google solo cuenta el inicio (sin duplicados).
  if (pathname !== '/') res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}

export const config = {
  // Todo menos los archivos de Next y los estáticos (cualquier ruta con extensión).
  matcher: ['/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)'],
};
