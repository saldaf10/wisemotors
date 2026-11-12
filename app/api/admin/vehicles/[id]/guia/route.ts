import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { guiaDeVehiculo } from '@/lib/subida/guia-de-vehiculo';

export const dynamic = 'force-dynamic';

// GET /api/admin/vehicles/[id]/guia — el carro escrito como guía de subida, para
// "Subir versión nueva": lo que la guía nueva no traiga se toma de esta.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const v = await prisma.vehicle.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      brand: true,
      model: true,
      familia: true,
      year: true,
      fuelType: true,
      type: true,
      vehicleType: true,
      price: true,
      specifications: true,
      attributes: { select: { attributeKey: true, valueNum: true, valueBool: true, valueText: true, estimado: true, origen: true, nota: true } },
      vehicleDealers: { select: { dealerId: true } },
    },
  });
  if (!v) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });
  return NextResponse.json({
    vehiculo: { id: v.id, brand: v.brand, model: v.model, familia: v.familia, year: v.year, fuelType: v.fuelType, type: v.type, vehicleType: v.vehicleType, price: v.price },
    dealerIds: v.vehicleDealers.map(d => d.dealerId),
    guia: guiaDeVehiculo(v, v.attributes),
  });
}
