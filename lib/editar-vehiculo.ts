// ============================================================================
// Edición de un carro publicado desde el panel (reemplaza el formulario viejo
// de 200 campos). Un solo guardado con todo lo que cambió:
//   - identidad (marca, modelo, año, carrocería, categoría, tren motriz, estado),
//   - precio: lo pone una persona, así que deja de ser "estimado",
//   - datos del registro (poner o cambiar) y datos a quitar,
//   - concesionarios que lo venden,
//   - fotos (las seis vistas y la portada).
// Los datos pasan por escribirHechos / quitarHechos: hecho + specifications +
// cobertura siempre juntos.
// ============================================================================

import { prisma } from '@/lib/prisma';
import { escribirHechos, quitarHechos, upsertPrecioHecho } from '@/lib/auditoria';
import { specsDe } from '@/lib/vehiculo-datos';

export interface CambiosVehiculo {
  identidad?: Partial<{ brand: string; model: string; year: number; type: string; vehicleType: string; fuelType: string; status: string }>;
  precio?: number;
  hechos?: { key: string; valor: unknown }[];
  quitar?: string[];
  dealerIds?: string[];
  fotos?: { url: string; angulo: string; portada?: boolean }[];
  /** Campos clave marcados "el dato no existe" (reemplaza la lista). */
  sinDato?: string[];
}

const TIPOS = ['Sedán', 'SUV', 'Pickup', 'Deportivo', 'Wagon', 'Hatchback', 'Convertible'];
const CATEGORIAS = ['Automóvil', 'Deportivo', 'Todoterreno', 'Lujo', 'Económico'];
const TRENES = ['Gasolina', 'Diesel', 'Eléctrico', 'Híbrido', 'Híbrido Enchufable'];
const ESTADOS = ['Disponible', 'Agotado', 'Próximamente'];
const ALT: Record<string, string> = {
  lado: 'lateral',
  frente: 'frontal',
  atras: 'trasera',
  tres_cuartos_frente: 'vista 3/4 delantera',
  tres_cuartos_atras: 'vista 3/4 trasera',
  interior: 'interior',
};

export async function editarVehiculo(id: string, c: CambiosVehiculo, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await prisma.vehicle.findUnique({ where: { id }, select: { brand: true, model: true, year: true, specifications: true } });
  if (!v) return { ok: false, error: 'Vehículo no encontrado' };

  // Identidad
  const idt = c.identidad ?? {};
  const datos: Record<string, unknown> = {};
  if (idt.brand?.trim()) datos.brand = idt.brand.trim().slice(0, 60);
  if (idt.model?.trim()) datos.model = idt.model.trim().slice(0, 80);
  if (idt.year !== undefined) {
    const y = Number(idt.year);
    if (!Number.isInteger(y) || y < 1990 || y > new Date().getFullYear() + 2) return { ok: false, error: 'Año inválido' };
    datos.year = y;
  }
  if (idt.type !== undefined) {
    if (!TIPOS.includes(idt.type)) return { ok: false, error: 'Carrocería inválida' };
    datos.type = idt.type;
  }
  if (idt.vehicleType !== undefined) {
    if (!CATEGORIAS.includes(idt.vehicleType)) return { ok: false, error: 'Categoría inválida' };
    datos.vehicleType = idt.vehicleType;
  }
  if (idt.fuelType !== undefined) {
    if (!TRENES.includes(idt.fuelType)) return { ok: false, error: 'Tren motriz inválido' };
    datos.fuelType = idt.fuelType;
  }
  if (idt.status !== undefined) {
    if (!ESTADOS.includes(idt.status)) return { ok: false, error: 'Estado inválido' };
    datos.status = idt.status;
  }
  if (datos.brand || datos.model || datos.year) {
    const dup = await prisma.vehicle.findFirst({
      where: {
        id: { not: id },
        brand: { equals: String(datos.brand ?? v.brand), mode: 'insensitive' },
        model: { equals: String(datos.model ?? v.model), mode: 'insensitive' },
        year: Number(datos.year ?? v.year),
      },
      select: { id: true },
    });
    if (dup) return { ok: false, error: 'Ya existe otro carro con esa marca, modelo y año' };
  }

  // Precio: lo pone una persona → deja de ser estimado.
  if (c.precio !== undefined) {
    const p = Math.round(Number(c.precio));
    if (!Number.isFinite(p) || p < 20_000_000 || p > 5_000_000_000) return { ok: false, error: 'Precio fuera de rango (entre $20 M y $5.000 M)' };
    const s = specsDe(v.specifications);
    s.commercial = { ...(s.commercial ?? {}), priceCop: p, priceConfirmedAt: new Date().toISOString() };
    delete s.commercial.priceEstimated;
    delete s.commercial.priceReasoningEs;
    datos.price = p;
    datos.priceEstimated = false;
    datos.specifications = JSON.stringify(s);
  }
  if (Object.keys(datos).length) await prisma.vehicle.update({ where: { id }, data: datos });
  if (c.precio !== undefined) {
    await upsertPrecioHecho(id, Number(datos.price), userId);
  }

  // Datos: primero lo que se quita, después lo que se pone (una persona: confianza plena).
  const quitar = (c.quitar ?? []).filter(k => typeof k === 'string' && k !== 'commercial.priceCop');
  if (quitar.length) {
    const r = await quitarHechos(id, quitar);
    if (!r.ok) return r;
  }
  const hechos = (c.hechos ?? []).filter(h => typeof h?.key === 'string' && h.key !== 'commercial.priceCop');
  if (hechos.length) {
    const r = await escribirHechos(id, hechos.map(h => ({ key: h.key, valor: h.valor, confianza: 1, tier: 1 })), userId);
    if (!r.ok) return r;
  }

  // Concesionarios: se reemplaza el conjunto.
  if (c.dealerIds) {
    const validos = await prisma.dealer.findMany({ where: { id: { in: c.dealerIds.slice(0, 50) } }, select: { id: true } });
    await prisma.$transaction([
      prisma.vehicleDealer.deleteMany({ where: { vehicleId: id } }),
      prisma.vehicleDealer.createMany({ data: validos.map(d => ({ vehicleId: id, dealerId: d.id })) }),
    ]);
  }

  // Fotos: se reemplaza el conjunto, portada primero.
  if (c.fotos) {
    const ok = c.fotos.filter(f => typeof f?.url === 'string' && (/^https?:\/\//.test(f.url) || f.url.startsWith('/'))).slice(0, 12);
    const portada = Math.max(0, ok.findIndex(f => f.portada));
    const nombre = `${datos.brand ?? v.brand} ${datos.model ?? v.model}`;
    await prisma.$transaction([
      prisma.vehicleImage.deleteMany({ where: { vehicleId: id } }),
      prisma.vehicleImage.createMany({
        data: ok.map((f, i) => ({
          vehicleId: id,
          url: f.url.slice(0, 1000),
          alt: `${nombre}, ${ALT[f.angulo] ?? 'foto'}`,
          type: i === portada ? 'cover' : String(f.angulo ?? 'gallery').slice(0, 40),
          order: i === portada ? 0 : i + 1,
          isThumbnail: i === portada,
        })),
      }),
    ]);
  }
  // "No existe" va al final: lee las specifications ya actualizadas por lo anterior.
  if (c.sinDato) {
    const actual = await prisma.vehicle.findUnique({ where: { id }, select: { specifications: true } });
    const s = specsDe(actual?.specifications);
    s.meta = { ...(s.meta ?? {}), sinDato: c.sinDato.filter(x => typeof x === 'string').slice(0, 60) };
    await prisma.vehicle.update({ where: { id }, data: { specifications: JSON.stringify(s) } });
  }
  return { ok: true };
}
