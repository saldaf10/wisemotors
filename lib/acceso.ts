// ============================================================================
// Acceso durante la expectativa.
//
// Mientras SITIO_ABIERTO no sea "1", wisemotors.co solo muestra la bienvenida
// por invitación (app/bienvenida): crear cuenta con un código de invitación
// (lib/invitaciones.ts) o ingresar con la cuenta. Las dos cosas dejan la cookie
// `wm_acceso` y el sitio se ve normal. El código del equipo (CODIGO_ACCESO)
// sirve como invitación sin límite.
//
// La cookie guarda una huella del código + JWT_SECRET, nunca el código. Al
// cambiar CODIGO_ACCESO en Vercel, todas las cookies anteriores dejan de valer.
// Usa Web Crypto para correr igual en el middleware (edge) y en Node.
// ============================================================================

export const COOKIE_ACCESO = 'wm_acceso';
export const DURACION_ACCESO_S = 60 * 60 * 24 * 90;

export function sitioAbierto(): boolean {
  return process.env.SITIO_ABIERTO === '1';
}

function codigoAcceso(): string {
  return (process.env.CODIGO_ACCESO || 'admin931').trim().toLowerCase();
}

export function esCodigoAcceso(valor: string): boolean {
  return valor.trim().toLowerCase() === codigoAcceso();
}

export async function huellaAcceso(): Promise<string> {
  const datos = new TextEncoder().encode(`acceso:${codigoAcceso()}:${process.env.JWT_SECRET ?? ''}`);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

/** Pone la cookie de acceso en la respuesta (al crear cuenta con invitación o al ingresar). */
export async function darAcceso(res: { cookies: { set: (nombre: string, valor: string, opciones: Record<string, unknown>) => unknown } }) {
  res.cookies.set(COOKIE_ACCESO, await huellaAcceso(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_ACCESO_S,
  });
}
