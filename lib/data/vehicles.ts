import { leer } from '@/lib/vehiculo-datos';
import { masParecidos } from '@/lib/similares';
import { urlImagen } from '@/lib/data/imagen';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';

import { whatsappDe } from '@/lib/whatsapp';
// Vive en lib/whatsapp (sin base de datos) para poder usarlo también en el navegador.
export { whatsappDe };

// Cachear la obtención de un vehículo para evitar dupicados en generateMetadata y page
export const getVehicle = cache(async (id: string) => {
  const startTotal = performance.now();

  // 1. Fetch main vehicle with related data
  const vehiclePromise = prisma.vehicle.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          url: true,
          type: true,
          order: true,
          isThumbnail: true
        }
      },
      vehicleDealers: {
        include: {
          dealer: true
        }
      }
    }
  });

  // Wait for vehicle first to get type/price for similar vehicles query logic
  // Optimizing strictly parallel is hard if similar depends on main vehicle data.
  // BUT, we can at least measure the main vehicle fetch time.
  const startMain = performance.now();
  const vehicle = await vehiclePromise;

  if (!vehicle) {
    return null;
  }

  // Parse specifications safely
  let parsedSpecs = vehicle.specifications as any;
  if (typeof parsedSpecs === 'string') {
    try {
      parsedSpecs = JSON.parse(parsedSpecs);
    } catch (e) {
      parsedSpecs = {};
    }
  }

  // 2. Los 3 más parecidos en tipo, precio, tren motriz y características
  // (lib/similares). El catálogo es chico: se compara contra todo lo
  // disponible y se ordena en memoria.
  const candidatos = await prisma.vehicle.findMany({
    where: { id: { not: vehicle.id }, status: 'Disponible' },
    select: {
      id: true,
      brand: true,
      model: true,
      year: true,
      price: true,
      fuelType: true,
      type: true,
      status: true,
      specifications: true,
      images: {
        take: 1,
        orderBy: { order: 'asc' },
        select: { id: true, url: true, type: true, order: true, isThumbnail: true },
      },
    },
  });
  const similarVehicles = masParecidos(
    { id: vehicle.id, price: vehicle.price, type: vehicle.type, fuelType: vehicle.fuelType, specifications: parsedSpecs },
    candidatos,
    3
  );

  const transformedSimilar = similarVehicles.map(v => {
    let vSpecs = v.specifications as any;
    if (typeof vSpecs === 'string') {
      try { vSpecs = JSON.parse(vSpecs); } catch (e) { vSpecs = {}; }
    }
    const firstImage = v.images?.[0];
    const imageUrl = urlImagen(v.id, firstImage?.url);
    return {
      id: v.id,
      brand: v.brand,
      model: v.model,
      year: v.year,
      price: v.price,
      fuel: v.fuelType?.toUpperCase() || 'GASOLINA',
      fuelType: v.fuelType,
      images: v.images,
      imageUrl,
      category: v.type,
      status: v.status || 'NUEVO',
      type: v.type,
      specifications: vSpecs
    };
  });

  // Get the cover image URL directly from Cloudinary if available
  const coverImg = vehicle.images?.find((img: any) => img.type === 'cover');
  const firstImg = vehicle.images?.[0];
  const mainImageUrl = urlImagen(vehicle.id, coverImg?.url || firstImg?.url);

  const result = {
    ...vehicle,
    fuel: vehicle.fuelType.toUpperCase(),
    imageUrl: mainImageUrl,
    category: vehicle.type,
    status: vehicle.status || 'NUEVO',
    power: leer(parsedSpecs ?? {}, 'combustion.maxPower', 'hybrid.maxPower', 'phev.maxPower', 'electric.maxPower') ?? undefined,
    engine: leer(parsedSpecs ?? {}, 'combustion.displacement', 'hybrid.displacement', 'phev.displacement') ?? undefined,
    acceleration: parsedSpecs?.performance?.acceleration0to100,
    cityConsumption: parsedSpecs?.efficiency?.consumoCiudad,
    rating: 4.3,
    slogan: `${vehicle.brand} ${vehicle.model} - Experiencia de conducción excepcional`,
    // Quién lo vende (los inactivos no se muestran), con lo necesario para el
    // mapa, "Cómo llegar" y la distancia a la persona.
    dealerships: (vehicle.vehicleDealers ?? [])
      .filter((vd: any) => vd.dealer.status !== 'Inactivo')
      .map((vd: any) => ({
        id: vd.dealer.id,
        name: vd.dealer.name,
        location: vd.dealer.location,
        address: vd.dealer.address,
        horario: vd.dealer.horario ?? null,
        lat: vd.dealer.lat ?? null,
        lng: vd.dealer.lng ?? null,
        mapsUrl: vd.dealer.mapsUrl ?? null,
        phone: vd.dealer.phone,
        whatsapp: whatsappDe(vd.dealer.phone),
      })),
    specifications: parsedSpecs || {},
    wisemetrics: parsedSpecs?.wisemetrics || null,
    fuelType: vehicle.fuelType, // Raw string
    vehicleType: vehicle.vehicleType,
    type: vehicle.type,
    reviewVideoUrl: vehicle.reviewVideoUrl,
    similarVehicles: transformedSimilar,
    categories: vehicle.wiseCategories
      ? vehicle.wiseCategories.split(',').map((cat: string, index: number) => ({
        id: (index + 1).toString(),
        label: cat.trim(),
        description: `Categoría personalizada: ${cat.trim()}`
      }))
      : [
        { id: '1', label: vehicle.type || 'Automóvil', description: 'Vehículo de alta calidad' },
        { id: '2', label: 'Excelente para diario', description: 'Perfecto para uso diario' },
        { id: '3', label: 'Alto rendimiento', description: 'Rendimiento deportivo excepcional' }
      ]
  };

  return result;
});

export interface GetVehiclesOptions {
  search?: string;
  category?: string | string[];
  fuelType?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  dealerId?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  recommended?: boolean;
}

export const getVehicles = cache(async (options: GetVehiclesOptions = {}) => {
  const start = performance.now();
  const {
    search,
    category,
    fuelType,
    minPrice,
    maxPrice,
    dealerId,
    limit = 9,
    page = 1,
    sortBy = 'createdAt',
    recommended
  } = options;

  // Build filters
  const where: any = {};

  if (search) {
    where.OR = [
      { brand: { contains: search, mode: 'insensitive' } }, // Add mode insensitive for better UX
      { model: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (category) {
    const categories = Array.isArray(category) ? category : [category];
    if (categories.length > 0) where.type = { in: categories };
  }

  if (fuelType) {
    const types = Array.isArray(fuelType) ? fuelType : [fuelType];
    if (types.length > 0) where.fuelType = { in: types };
  }

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = minPrice;
    if (maxPrice) where.price.lte = maxPrice;
  }

  if (dealerId) {
    where.vehicleDealers = {
      some: { dealerId: dealerId }
    };
  }

  // Pagination
  const pageSize = limit;
  const skip = (page - 1) * pageSize;

  // Sort
  const orderBy: any = {};
  switch (sortBy) {
    case 'price-low': orderBy.price = 'asc'; break;
    case 'price-high': orderBy.price = 'desc'; break;
    case 'year-new': orderBy.year = 'desc'; break;
    case 'year-old': orderBy.year = 'asc'; break;
    case 'brand': orderBy.brand = 'asc'; break;
    case 'relevance':
    default: orderBy.createdAt = 'desc'; break;
  }

  // Consulta principal - SPLIT FOR DEBUGGING
  const startFind = performance.now();
  const vehicles = await prisma.vehicle.findMany({
    where,
    skip,
    take: pageSize,
    orderBy,
    select: {
      id: true,
      brand: true,
      model: true,
      year: true,
      price: true,
      fuelType: true,
      type: true,
      status: true,
      // Las tarjetas del catálogo muestran potencia, 0-100 y consumo
      specifications: true,
      images: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          url: true,
          type: true,
          order: true,
          isThumbnail: true
        }
      }
    }
  });

  const startCount = performance.now();
  const total = await prisma.vehicle.count({ where });


  // If recommended, limit (Note: original API sliced array AFTER query, which is inefficient but consistent)
  // Better to use 'take' in query, but logic depends on 'recommended' flag being just a filter or a sort?
  // Original code: if (recommended === '1') vehicles.splice(3);
  // We will keep behavior but maybe optimize query later.
  let resultVehicles = vehicles;
  if (recommended) {
    resultVehicles = vehicles.slice(0, 3);
  }

  // Transform to match UI expectation (VehicleCard interface)
  const transformedVehicles = resultVehicles.map((vehicle: any) => {
    const firstImage = vehicle.images?.[0];
    const imageUrl = urlImagen(vehicle.id, firstImage?.url);
    return {
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      price: vehicle.price,
      fuel: vehicle.fuelType.toUpperCase(),
      fuelType: vehicle.fuelType,
      type: vehicle.type,
      imageUrl,
      category: vehicle.type,
      status: vehicle.status || 'NUEVO',
      specifications: vehicle.specifications,
      images: vehicle.images?.map((img: any) => ({
        ...img,
        url: urlImagen(vehicle.id, img.url, img.order)
      })) || []
    };
  });

  return {
    vehicles: transformedVehicles,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
});

