// ============================================================================
// Deja en la base SOLO los campos del registro (decisión del equipo, 8-oct-2026):
// borra los datos y las definiciones de los campos retirados (los que están en
// attribute_definitions pero ya no en lib/attributes/registry.ts) y los quita del
// JSON de specifications de cada carro.
//
// Antes de borrar guarda TODO lo que borra en estado_sistema
// (clave "respaldo_campos_retirados_<fecha>"), para poder recuperar un dato.
// Corre en cada deploy de producción DESPUÉS de partir-suspension y
// fusionar-campos (que primero pasan esos datos a los campos que se quedan).
// Idempotente: si ya no hay campos retirados, no hace nada.
// ============================================================================

import type { PrismaClient } from '@prisma/client';
import { ATTRIBUTE_REGISTRY } from '@/lib/attributes/registry';
import { computeCoverage } from '@/lib/attributes/coverage';
import { fijarEnSpecs, specsDe } from '@/lib/vehiculo-datos';

export interface ResultadoLimpieza {
  campos: string[];
  datos: number;
  carros: number;
  respaldo: string | null;
}

export async function limpiarCamposRetirados(prisma: PrismaClient, aplicar: boolean): Promise<ResultadoLimpieza> {
  const vigentes = ATTRIBUTE_REGISTRY.map(d => d.key);
  const retiradas = (await prisma.attributeDefinition.findMany({ where: { key: { notIn: vigentes } }, select: { key: true } })).map(d => d.key);
  const r: ResultadoLimpieza = { campos: retiradas, datos: 0, carros: 0, respaldo: null };
  if (!retiradas.length) return r;

  const filas = await prisma.vehicleAttribute.findMany({ where: { attributeKey: { in: retiradas } } });
  r.datos = filas.length;

  // Carros a tocar: los que tienen filas de esos campos o los traen en su JSON.
  const vehiculos = await prisma.vehicle.findMany({ select: { id: true, fuelType: true, specifications: true } });
  const enJson = (s: Record<string, any>, key: string) => {
    let nodo: any = s;
    for (const p of key.split('.')) {
      if (nodo === null || typeof nodo !== 'object' || !(p in nodo)) return false;
      nodo = nodo[p];
    }
    return true;
  };
  const tocar = vehiculos
    .map(v => ({ v, s: specsDe(v.specifications) }))
    .filter(({ v, s }) => filas.some(f => f.vehicleId === v.id) || retiradas.some(k => enJson(s, k)));
  r.carros = tocar.length;
  if (!aplicar) return r;

  // 1. Respaldo de todo lo que se borra (filas + valores del JSON).
  const respaldo = {
    fecha: new Date().toISOString(),
    campos: retiradas,
    filas,
    json: tocar.map(({ v, s }) => ({
      vehicleId: v.id,
      valores: Object.fromEntries(
        retiradas.filter(k => enJson(s, k)).map(k => [k, k.split('.').reduce((n: any, p) => n?.[p], s)])
      ),
    })),
  };
  r.respaldo = `respaldo_campos_retirados_${respaldo.fecha.slice(0, 19).replace(/[:T]/g, '-')}`;
  await prisma.estadoSistema.create({ data: { clave: r.respaldo, valor: JSON.stringify(respaldo) } });

  // 2. Quitar del JSON y recalcular cobertura.
  for (const { v, s } of tocar) {
    for (const k of retiradas) fijarEnSpecs(s, k, undefined);
    const quedan = await prisma.vehicleAttribute.findMany({ where: { vehicleId: v.id, attributeKey: { notIn: retiradas } }, select: { attributeKey: true } });
    const cobertura = computeCoverage(v.fuelType, new Set(quedan.map(q => q.attributeKey)));
    await prisma.vehicle.update({
      where: { id: v.id },
      data: { specifications: JSON.stringify(s), coverageGlobal: cobertura.global, coverageByDimension: JSON.stringify(cobertura.byDimension) },
    });
  }

  // 3. Borrar los datos y después las definiciones (la FK va de datos a definición).
  await prisma.$transaction([
    prisma.vehicleAttribute.deleteMany({ where: { attributeKey: { in: retiradas } } }),
    prisma.attributeDefinition.deleteMany({ where: { key: { in: retiradas } } }),
  ]);
  return r;
}
