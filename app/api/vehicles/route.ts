import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { vehicleSchema } from '@/lib/schemas/vehicle';
import { requireAdmin } from '@/lib/api-auth';

// GET /api/vehicles - Obtener vehículos con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parámetros de consulta
    const recommended = searchParams.get('recommended');
    const limit = searchParams.get('limit');
    const page = searchParams.get('page') || '1';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const getCategories = searchParams.get('getCategories') === 'true';
    const getFuelTypes = searchParams.get('getFuelTypes') === 'true';

    // Si solo queremos las categorías únicas
    if (getCategories) {
      const categories = await prisma.vehicle.findMany({
        select: {
          type: true
        },
        distinct: ['type']
      });

      const uniqueCategories = categories
        .map(cat => cat.type)
        .filter(Boolean) // Filtrar valores null/undefined
        .sort();

      return NextResponse.json({
        categories: uniqueCategories
      });
    }

    // Si solo queremos los tipos de combustible únicos
    if (getFuelTypes) {
      const fuelTypes = await prisma.vehicle.findMany({
        select: {
          fuelType: true
        },
        distinct: ['fuelType']
      });

      const uniqueFuelTypes = fuelTypes
        .map(fuel => fuel.fuelType)
        .filter(Boolean) // Filtrar valores null/undefined
        .sort();

      return NextResponse.json({
        fuelTypes: uniqueFuelTypes
      });
    }

    // Parámetros de filtrado
    const search = searchParams.get('search');
    const categories = searchParams.getAll('category'); // Soporte para múltiples categorías
    const fuelTypes = searchParams.getAll('fuelType'); // Soporte para múltiples tipos de combustible
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const dealerId = searchParams.get('dealerId');

    // Construir filtros básicos
    const where: any = {};

    // Filtro de búsqueda
    if (search) {
      where.OR = [
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filtro de categorías (múltiples)
    if (categories.length > 0) {
      where.type = { in: categories };
    }

    // Filtro de tipos de combustible (múltiples)
    if (fuelTypes.length > 0) {
      where.fuelType = { in: fuelTypes };
    }

    // Filtro de precio
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    // Filtro de concesionario
    if (dealerId) {
      where.vehicleDealers = {
        some: {
          dealerId: dealerId
        }
      };
    }

    // Paginación
    const pageNumber = parseInt(page);
    // recommended=1 limita en la consulta (antes se traían pageSize filas y se
    // recortaban con splice en memoria, y el total devuelto no correspondía)
    const pageSize = recommended === '1' ? 3 : (limit ? parseInt(limit) : 9);
    const skip = recommended === '1' ? 0 : (pageNumber - 1) * pageSize;

    // Ordenamiento con conversión de parámetros del frontend
    const orderBy: any = {};

    // Convertir sortBy del frontend a campos válidos de Prisma
    switch (sortBy) {
      case 'price-low':
        orderBy.price = 'asc';
        break;
      case 'price-high':
        orderBy.price = 'desc';
        break;
      case 'year-new':
        orderBy.year = 'desc';
        break;
      case 'year-old':
        orderBy.year = 'asc';
        break;
      case 'brand':
        orderBy.brand = 'asc';
        break;
      case 'relevance':
      default:
        orderBy.createdAt = 'desc';
        break;
    }

    // Consulta principal
    const start = performance.now();
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        select: {
          id: true,
          brand: true,
          model: true,
          // Versiones del mismo carro (lib/versiones): el buscador y las tarjetas las agrupan.
          familia: true,
          year: true,
          price: true,
          fuelType: true,
          type: true,
          status: true,
          // Las tarjetas del catálogo muestran potencia, 0-100 y consumo:
          // sin este campo llegaban sin cifras y la grilla quedaba muda.
          specifications: true,
          images: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              url: true,
              alt: true,
              type: true,
              order: true,
              isThumbnail: true
            }
          }
        }
      }),
      prisma.vehicle.count({ where })
    ]);

    return NextResponse.json({
      vehicles,
      pagination: {
        page: pageNumber,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
// POST /api/vehicles - Crear nuevo vehículo
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Validar datos de entrada
    const validatedData = vehicleSchema.parse(body);

    // Extraer dealerIds e imágenes del payload
    const { dealerIds, coverImage, galleryImages, thumbnailIndex, ...vehicleData } = validatedData;

    // Convertir specifications a string para la base de datos
    const vehicleDataForDB = {
      ...vehicleData,
      specifications: JSON.stringify(vehicleData.specifications)
    };

    // Crear vehículo con transacción (aumentar timeout para imágenes)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el vehículo
      const vehicle = await tx.vehicle.create({
        data: vehicleDataForDB
      });

      // 2. Crear las relaciones con concesionarios
      if (dealerIds && dealerIds.length > 0) {
        const vehicleDealers = dealerIds.map(dealerId => ({
          vehicleId: vehicle.id,
          dealerId: dealerId
        }));

        await tx.vehicleDealer.createMany({
          data: vehicleDealers
        });
      }

      // 3. Crear las imágenes
      const imagesToCreate = [];

      // Imagen de portada
      if (coverImage) {
        imagesToCreate.push({
          vehicleId: vehicle.id,
          url: coverImage,
          type: 'cover',
          order: 0
        });
      }

      // Imágenes de galería
      if (galleryImages && galleryImages.length > 0) {
        galleryImages.forEach((imageUrl, index) => {
          imagesToCreate.push({
            vehicleId: vehicle.id,
            url: imageUrl,
            type: 'gallery',
            order: index + 1,
            isThumbnail: thumbnailIndex === index
          });
        });
      }

      if (imagesToCreate.length > 0) {
        await tx.vehicleImage.createMany({
          data: imagesToCreate
        });
      }

      return vehicle;
    }, {
      timeout: 30000, // 30 segundos para completar la transacción
      maxWait: 5000   // 5 segundos para esperar que la transacción esté disponible
    });

    // Retornar el vehículo creado con sus relaciones
    const createdVehicle = await prisma.vehicle.findUnique({
      where: { id: result.id },
      include: {
        images: {
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

    return NextResponse.json(createdVehicle, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

