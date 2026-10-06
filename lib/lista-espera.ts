import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

// Cada amigo que se suma con tu enlace te adelanta estos puestos.
export const PUESTOS_POR_INVITADO = 10;

export const CIUDADES = ['Medellín', 'Bogotá', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena', 'Pereira', 'Manizales', 'Otra'] as const;

export function correoValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export function nuevoCodigo(): string {
  return randomBytes(5).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 7).padEnd(7, 'w');
}

/** Puesto en la fila: por orden de llegada, adelantado por los invitados. */
export async function puestoDe(fila: { codigo: string; createdAt: Date }) {
  const [antes, invitados] = await Promise.all([
    prisma.listaEspera.count({ where: { createdAt: { lt: fila.createdAt } } }),
    prisma.listaEspera.count({ where: { referidoPor: fila.codigo } }),
  ]);
  return { puesto: Math.max(1, antes + 1 - invitados * PUESTOS_POR_INVITADO), invitados };
}
