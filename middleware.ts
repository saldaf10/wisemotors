import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_ACCESO, huellaAcceso, sitioAbierto } from '@/lib/acceso';

// Portero de la expectativa (lib/acceso.ts): sin la cookie del equipo, toda
// página muestra la de espera (misma URL, así ?ref= y ?utm_ llegan intactos) y
// toda API responde 403, salvo las de la lista de espera.
const LIBRES = ['/espera', '/api/espera', '/api/salud'];

export async function middleware(request: NextRequest) {
  if (sitioAbierto()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (LIBRES.some(p => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const cookie = request.cookies.get(COOKIE_ACCESO)?.value;
  if (cookie && cookie === (await huellaAcceso())) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'WiseMotors abre muy pronto.' }, { status: 403 });
  }
  return NextResponse.rewrite(new URL(`/espera${search}`, request.url));
}

export const config = {
  // Todo menos los archivos de Next y los estáticos (cualquier ruta con extensión).
  matcher: ['/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)'],
};
