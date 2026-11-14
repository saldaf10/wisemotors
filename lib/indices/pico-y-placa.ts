// ============================================================================
// Pico y placa por ciudad para carro particular: solo SÍ o NO (nov-2026).
//
// Cada ciudad dice si tiene pico y placa para particulares y qué trenes están
// exentos. Las reglas cambian por decreto: cada una lleva su fuente y la fecha
// en que se verificó. Para actualizar: cambiar la regla, la fuente y la fecha
// aquí y desplegar. Una medida temporal lleva `hasta` y, pasada esa fecha, la
// ciudad deja de mostrarse hasta que alguien la vuelva a verificar.
//
// Pereira no está: en sep–nov de 2026 las fuentes se contradicen sobre si
// eléctricos e híbridos están exentos. Mejor no decir nada que decir algo falso.
//
// Ojo con los híbridos livianos (MHEV): en Bogotá no se cuentan como híbridos
// para la exención. El catálogo hoy no los separa ("Híbrido" = híbrido
// completo); si llegan, hay que distinguirlos antes de marcarlos exentos.
// ============================================================================

export type TrenPyP = 'electrico' | 'hibrido' | 'combustion';

export interface ReglaPicoYPlaca {
  ciudad: string;
  /** ¿Hay pico y placa para carros particulares? */
  tiene: boolean;
  /** Trenes que no tienen pico y placa aunque la ciudad lo tenga. */
  exentos: TrenPyP[];
  fuente: string;
  verificado: string; // AAAA-MM-DD
  /** Medida temporal: vence este día (inclusive). */
  hasta?: string;
}

const VERIFICADO = '2026-11-14';

export const REGLAS_PICO_Y_PLACA: ReglaPicoYPlaca[] = [
  {
    ciudad: 'Barranquilla',
    tiene: false,
    exentos: [],
    fuente: 'Secretaría de Tránsito de Barranquilla: pico y placa permanente solo para taxis; a particulares solo en eventos (Carnaval, Decreto 0036 de 2026)',
    verificado: VERIFICADO,
  },
  {
    ciudad: 'Cartagena',
    tiene: true,
    exentos: ['electrico', 'hibrido'],
    fuente: 'DATT Cartagena, Decreto 0015 de 2026: eléctricos e híbridos exentos',
    verificado: VERIFICADO,
  },
  {
    ciudad: 'Bucaramanga',
    tiene: true,
    exentos: ['electrico', 'hibrido'],
    fuente: 'Dirección de Tránsito de Bucaramanga, Resolución 854 de 2025: eléctricos e híbridos (registrados en la licencia) exentos',
    verificado: VERIFICADO,
  },
  {
    ciudad: 'Cali',
    tiene: true,
    exentos: ['electrico', 'hibrido'],
    fuente: 'Secretaría de Movilidad de Cali, rotación jul–dic 2026: eléctricos e híbridos exentos',
    verificado: VERIFICADO,
  },
  {
    ciudad: 'Medellín',
    tiene: true,
    exentos: ['electrico', 'hibrido'],
    fuente: 'Secretaría de Movilidad de Medellín, segundo semestre 2026: eléctricos, híbridos y gas natural exentos',
    verificado: VERIFICADO,
  },
  {
    ciudad: 'Manizales',
    tiene: true,
    exentos: ['electrico'],
    fuente: 'Alcaldía de Manizales, Decreto 0357 de 2026: pico y placa temporal del 3 al 30 de noviembre; eléctricos exentos, híbridos no',
    verificado: VERIFICADO,
    hasta: '2026-11-30',
  },
  {
    ciudad: 'Pasto',
    tiene: true,
    exentos: ['electrico', 'hibrido'],
    fuente: 'Secretaría de Tránsito de Pasto, noviembre 2026: eléctricos e híbridos exentos',
    verificado: VERIFICADO,
  },
  {
    ciudad: 'Bogotá',
    tiene: true,
    exentos: ['electrico', 'hibrido'],
    fuente: 'Secretaría Distrital de Movilidad: eléctricos e híbridos exentos (inscritos en el registro de exceptuados); confirmado por la Alcaldía en 2026',
    verificado: VERIFICADO,
  },
  {
    ciudad: 'Tunja',
    tiene: true,
    exentos: ['electrico', 'hibrido'],
    fuente: 'Alcaldía de Tunja, Decreto 0097 de 2023 (vigente en 2026): eléctricos e híbridos exentos',
    verificado: VERIFICADO,
  },
];

export interface ResultadoPicoYPlaca {
  disponible: true;
  ciudades: { nombre: string; tiene: boolean }[];
  /** Mes y año de la verificación, para el pie ("noviembre de 2026"). */
  verificado: string;
}

export function trenPicoYPlaca(fuelType: string): TrenPyP {
  if (fuelType === 'Eléctrico') return 'electrico';
  if (fuelType === 'Híbrido' || fuelType === 'Híbrido Enchufable') return 'hibrido';
  return 'combustion';
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Sí o no por ciudad. Los vehículos de carga (camiones y vans comerciales)
 * tienen reglas distintas en cada ciudad: para ellos no se muestra.
 */
export function picoYPlaca(
  v: { fuelType: string; type?: string | null; vehicleType?: string | null },
  hoy: Date = new Date()
): ResultadoPicoYPlaca | { disponible: false; faltan: string[]; nota?: string } {
  if (v.vehicleType === 'Comercial' && (v.type === 'Camión' || v.type === 'Van')) {
    return { disponible: false, faltan: [], nota: 'Los vehículos de carga tienen reglas propias en cada ciudad.' };
  }
  const tren = trenPicoYPlaca(v.fuelType);
  const dia = hoy.toISOString().slice(0, 10);
  const vigentes = REGLAS_PICO_Y_PLACA.filter(r => !r.hasta || dia <= r.hasta);
  if (!vigentes.length) return { disponible: false, faltan: [] };
  const ultima = vigentes.map(r => r.verificado).sort().pop()!;
  const [anio, mes] = ultima.split('-').map(Number);
  return {
    disponible: true,
    ciudades: vigentes.map(r => ({ nombre: r.ciudad, tiene: r.tiene && !r.exentos.includes(tren) })),
    verificado: `${MESES[mes - 1]} de ${anio}`,
  };
}
