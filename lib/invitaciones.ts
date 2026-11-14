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

// Solo números (nov-2026): fáciles de dictar y escribir en el celular. Seis
// cifras que no empiezan en 0: "482913", que se muestra "482 913".
export function nuevoCodigoInvitacion(): string {
  return String(randomInt(100_000, 1_000_000));
}

/** "482 913", "482-913" → "482913". */
export function normalizarCodigo(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Códigos de la primera versión ("WISE-7K3PQ9"): se reemplazan por numéricos si nadie los usó. */
export const esCodigoViejo = (codigo: string) => !/^\d+$/.test(codigo);

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
