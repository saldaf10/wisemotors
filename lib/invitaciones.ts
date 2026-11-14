// ============================================================================
// Códigos de invitación (nov-2026).
//
// Mientras el sitio está cerrado (lib/acceso.ts), crear cuenta exige un código:
// uno de la tabla codigos_invitacion (sirve una sola vez) o el código del equipo
// (CODIGO_ACCESO, sin límite). Al canjearlo, la cuenta queda creada y el
// navegador recibe la cookie de acceso. Las cuentas ya creadas solo ingresan.
// ============================================================================

import { randomInt } from 'crypto';
import type { PrismaClient } from '@prisma/client';

// Sin letras ni números que se confunden al dictarlos o copiarlos a mano (0/O, 1/I/L).
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function nuevoCodigoInvitacion(): string {
  let x = '';
  for (let i = 0; i < 6; i++) x += ALFABETO[randomInt(ALFABETO.length)];
  return `WISE-${x}`;
}

/** "wise 7k3-pq9", "7K3PQ9" → "WISE-7K3PQ9" (sin espacios, guiones ni minúsculas). */
export function normalizarCodigo(valor: string): string {
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cuerpo = limpio.startsWith('WISE') ? limpio.slice(4) : limpio;
  return `WISE-${cuerpo}`;
}

/** Crea `n` códigos nuevos con número consecutivo. Devuelve cuántos creó. */
export async function generarCodigos(prisma: PrismaClient, n: number): Promise<number> {
  const ultimo = await prisma.codigoInvitacion.aggregate({ _max: { numero: true } });
  let numero = ultimo._max.numero ?? 0;
  const existentes = new Set((await prisma.codigoInvitacion.findMany({ select: { codigo: true } })).map(c => c.codigo));
  const nuevos: { codigo: string; numero: number }[] = [];
  while (nuevos.length < n) {
    const codigo = nuevoCodigoInvitacion();
    if (existentes.has(codigo)) continue;
    existentes.add(codigo);
    nuevos.push({ codigo, numero: ++numero });
  }
  const r = await prisma.codigoInvitacion.createMany({ data: nuevos, skipDuplicates: true });
  return r.count;
}
