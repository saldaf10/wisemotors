'use client';

// ============================================================================
// La ficha por secciones: Desempeño · Consumo (o Batería) · Espacio ·
// Seguridad · Tecnología · Su categoría.
//
// Cada sección es un bento de bloques de TAMAÑOS DISTINTOS y con una gráfica
// propia (velocímetro, carrera en tiempo real, ruta desde Medellín, maletas,
// estrellas...). Un bloque sin dato no existe: no deja hueco ni muestra cero.
// Las comparaciones se hacen contra el catálogo de su mismo tipo (lo que se
// vende aquí), nunca contra el mundo.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Armchair,
  BatteryCharging,
  Bluetooth,
  Camera,
  Car,
  Cpu,
  Eye,
  Fuel,
  Gauge,
  Lightbulb,
  Map,
  MonitorSmartphone,
  ParkingSquare,
  Radar,
  Package,
  Ruler,
  ScanLine,
  Shield,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Sparkles,
  Timer,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { CarRender } from '@/components/car/CarRender';
import { useEnVista } from '@/components/ui/useEnVista';
import { leer, millones, rendimiento, specsDe, tanque } from '@/lib/vehiculo-datos';
import { claseDeTipo } from '@/lib/attributes/clase';
import { masParecidos } from '@/lib/similares';
import { hayIndices, SeccionIndices } from './IndicesWise';
import type { IndicesVehiculo } from '@/lib/indices/calculo';
import { Anillo, BarrasPar, Carrera, Estrellas, Maletas, Nivel, Parqueadero, Personas, Ruta, TiraCategoria, Velocimetro, type Tira } from './graficas';

const fmt = (n: number, dec = 0) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: dec }).format(n);

type Tono = 'blanco' | 'tinta' | 'wise' | 'lila' | 'estudio';

export function Bloque({ tono = 'blanco', className = '', children }: { tono?: Tono; className?: string; children: React.ReactNode }) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.15);
  const fondo = {
    blanco: 'bg-blanco text-tinta',
    tinta: 'bg-showroom text-white',
    wise: 'bg-wise text-white',
    lila: 'bg-[#efe4f7] text-tinta',
    estudio: 'estudio text-tinta',
  }[tono];
  return (
    <div
      ref={ref}
      data-shown={visto}
      className={`reveal relative overflow-hidden rounded-[30px] p-6 md:p-8 ${fondo} ${className}`}
    >
      {children}
    </div>
  );
}

export function Titulito({ icono: Icono, children, claro = false }: { icono: LucideIcon; children: React.ReactNode; claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${claro ? 'bg-white/10 text-white' : 'bg-wise/10 text-wise'}`}>
        <Icono className="h-4 w-4" />
      </span>
      <p className={`text-[15px] font-semibold tracking-[-0.02em] ${claro ? 'text-white' : ''}`}>{children}</p>
    </div>
  );
}

export function Cabecera({ id, icono: Icono, titulo, bajada }: { id: string; icono: LucideIcon; titulo: string; bajada: string }) {
  return (
    <div id={id} className="scroll-mt-40 flex flex-wrap items-end justify-between gap-4 pb-8 pt-20">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-tinta text-white shadow-[0_14px_30px_-14px_rgba(14,12,17,0.7)]">
          <Icono className="h-6 w-6" />
        </span>
        <h2 className="t-titulo text-[40px] md:text-[64px]">{titulo}</h2>
      </div>
      <p className="max-w-[44ch] text-[15px] leading-relaxed text-tinta-2">{bajada}</p>
    </div>
  );
}

/** "Mejor que 7 de cada 10" en palabras. */
function frase(propio: number, otros: number[], menorEsMejor = false) {
  if (otros.length < 2) return null;
  const mejores = otros.filter(o => (menorEsMejor ? propio < o : propio > o)).length;
  const pct = Math.round((mejores / otros.length) * 10);
  return { mejores, total: otros.length, deCada10: pct };
}

// ── Equipamiento con ícono ─────────────────────────────────────────────────
const AYUDAS: { key: string; texto: string; icono: LucideIcon }[] = [
  { key: 'safety.autonomousEmergencyBraking', texto: 'Frena solo si ve un choque', icono: ShieldCheck },
  { key: 'safety.forwardCollisionWarning', texto: 'Te avisa si vas a chocar', icono: Radar },
  { key: 'safety.laneAssist', texto: 'Te mantiene en el carril', icono: ScanLine },
  { key: 'safety.blindSpotDetection', texto: 'Vigila el punto ciego', icono: Eye },
  { key: 'safety.crossTrafficAlert', texto: 'Avisa al salir de reversa', icono: Radar },
  { key: 'safety.adaptiveCruiseControl', texto: 'Crucero que guarda distancia', icono: Gauge },
  { key: 'safety.fatigueMonitor', texto: 'Detecta si estás cansado', icono: Eye },
  { key: 'safety.stabilityControl', texto: 'Control de estabilidad', icono: Shield },
  { key: 'safety.tractionControl', texto: 'Control de tracción', icono: Shield },
  { key: 'assistance.hillStartAssist', texto: 'No se devuelve en loma', icono: Car },
  { key: 'safety.tirePressureMonitoring', texto: 'Vigila la presión de las llantas', icono: Gauge },
];

const EQUIPO: { key: string; texto: string; icono: LucideIcon; esTexto?: boolean }[] = [
  { key: 'technology.smartphoneIntegration', texto: 'Conecta tu celular', icono: Smartphone, esTexto: true },
  { key: 'technology.touchscreen', texto: 'Pantalla táctil', icono: MonitorSmartphone },
  { key: 'technology.bluetooth', texto: 'Bluetooth', icono: Bluetooth },
  { key: 'technology.navigation', texto: 'Navegador', icono: Map },
  { key: 'technology.wirelessCharger', texto: 'Carga el celular sin cable', icono: Zap },
  { key: 'assistance.reverseCamera', texto: 'Cámara de reversa', icono: Camera },
  { key: 'assistance.cameras360', texto: 'Cámaras 360°', icono: Camera },
  { key: 'assistance.parkingSensors', texto: 'Sensores de parqueo', icono: Radar },
  { key: 'comfort.airConditioning', texto: 'Aire acondicionado', icono: Snowflake },
  { key: 'comfort.automaticClimateControl', texto: 'Clima automático', icono: Wind },
  { key: 'comfort.heatedSeats', texto: 'Asientos con calefacción', icono: Armchair },
  { key: 'comfort.ventilatedSeats', texto: 'Asientos ventilados', icono: Armchair },
  { key: 'comfort.automaticHighBeam', texto: 'Luces altas automáticas', icono: Lightbulb },
];

function valorEn(s: Record<string, any>, path: string) {
  let cur: any = s;
  for (const k of path.split('.')) cur = cur?.[k];
  return cur;
}

// ── Componente ─────────────────────────────────────────────────────────────
export function SeccionesFicha({ vehicle, indices = null }: { vehicle: any; indices?: IndicesVehiculo | null }) {
  const s = useMemo(() => specsDe(vehicle.specifications), [vehicle.specifications]);
  const electrico = vehicle.fuelType === 'Eléctrico';
  const [catalogo, setCatalogo] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/vehicles?limit=200')
      .then(r => r.json())
      .then(j => setCatalogo((j.vehicles ?? []).map((v: any) => ({ ...v, s: specsDe(v.specifications) }))))
      .catch(() => setCatalogo([]));
  }, []);

  // Pares: mismo tipo de carrocería. Si son muy pocos, todo el catálogo (y se dice).
  const mismoTipo = catalogo.filter(v => v.id !== vehicle.id && v.type === vehicle.type);
  const pares = mismoTipo.length >= 3 ? mismoTipo : catalogo.filter(v => v.id !== vehicle.id);
  const grupo = mismoTipo.length >= 3 ? `${vehicle.type === 'SUV' ? 'SUV' : vehicle.type.toLowerCase()}s del catálogo` : 'carros del catálogo';
  const deTodos = (f: (x: Record<string, any>, v: any) => number | null) =>
    catalogo.map(v => f(v.s, v)).filter((n): n is number => n !== null);
  const dePares = (f: (x: Record<string, any>, v: any) => number | null) =>
    pares.map(v => ({ nombre: `${v.brand} ${v.model}`, valor: f(v.s, v) })).filter((o): o is { nombre: string; valor: number } => o.valor !== null);

  // Datos
  const potencia = leer(s, 'combustion.maxPower', 'hybrid.maxPower', 'phev.maxPower', 'electric.maxPower');
  const torque = leer(s, 'combustion.maxTorque', 'hybrid.maxTorque', 'phev.maxTorque', 'electric.maxTorque');
  const cero100 = leer(s, 'performance.acceleration0to100');
  const vmax = leer(s, 'performance.maxSpeed');
  const motor = leer(s, 'combustion.displacement', 'hybrid.displacement', 'phev.displacement');
  const config = valorEn(s, 'combustion.engineConfiguration') ?? valorEn(s, 'hybrid.engineConfiguration') ?? valorEn(s, 'phev.engineConfiguration');
  const caja = valorEn(s, 'combustion.transmissionType') ?? valorEn(s, 'hybrid.transmissionType') ?? valorEn(s, 'phev.transmissionType');
  // El turbo hoy vive en «Tipo de inducción»; los carros viejos lo traen como sí/no.
  const turbo = valorEn(s, 'combustion.turbo') === true || /turbo|supercarg/i.test(String(valorEn(s, 'combustion.inductionType') ?? ''));
  const rinde = rendimiento(s);
  const ciudad = leer(s, 'combustion.cityConsumption', 'hybrid.cityConsumption', 'phev.cityConsumption');
  const carretera = leer(s, 'combustion.highwayConsumption', 'hybrid.highwayConsumption', 'phev.highwayConsumption');
  const galones = tanque(s);
  const autonomia = leer(s, 'electric.realRangeMixed', 'electric.electricRange');
  const autCiudad = leer(s, 'electric.realRangeCity');
  const autCarretera = leer(s, 'electric.realRangeHighway');
  const bateria = leer(s, 'electric.batteryCapacity', 'phev.batteryCapacity');
  const cargaAC = leer(s, 'electric.acChargingTime', 'phev.acChargingTime');
  const cargaDC = leer(s, 'electric.dcChargingTime', 'phev.dcChargingTime');
  const alcance = electrico ? autonomia : galones && rinde ? galones * rinde : null;
  const largo = leer(s, 'dimensions.length');
  const ancho = leer(s, 'dimensions.width');
  const alto = leer(s, 'dimensions.height');
  const entreEjes = leer(s, 'dimensions.wheelbase');
  const altura = leer(s, 'chassis.groundClearance');
  const baul = leer(s, 'dimensions.cargoCapacity');
  const baulAbatido = leer(s, 'interior.trunkCapacitySeatsDown');
  const pasajeros = leer(s, 'interior.passengerCapacity');
  const peso = leer(s, 'dimensions.curbWeight');
  // Potencia por tonelada: el dato si viene; si no, se calcula con la potencia y el peso.
  const potPeso = leer(s, 'performance.powerToWeight') ?? (potencia !== null && peso ? potencia / (peso / 1000) : null);
  const remolque = leer(s, 'weight.towingCapacity');
  // Pickups, vans y camiones: lo que importa para trabajar.
  const clase = claseDeTipo(vehicle.type);
  const cargaUtil = leer(s, 'weight.payload');
  const pesoBruto = leer(s, 'weight.grossVehicleWeight');
  const zona = { largo: leer(s, 'cargoArea.length'), ancho: leer(s, 'cargoArea.width'), alto: leer(s, 'cargoArea.height') };
  // En una van o un camión "el baúl" es el furgón: se cuenta en m³, no en maletas.
  const volumenCarga = clase === 'comercial' ? leer(s, 'dimensions.cargoCapacity', 'interior.interiorCargoCapacity', 'weight.cargoBoxVolume') : null;
  // Solo a vehículos de trabajo: una SUV con remolque lo sigue mostrando junto a la altura al piso.
  const datosTrabajo = (clase === 'auto' ? [] : [
    cargaUtil !== null && { etiqueta: 'Carga útil', valor: `${fmt(cargaUtil)} kg`, ayuda: 'Lo que puede llevar encima' },
    remolque !== null && { etiqueta: 'Remolque', valor: `${fmt(remolque)} kg`, ayuda: 'Lo que puede halar' },
    pesoBruto !== null && { etiqueta: 'Peso bruto', valor: `${fmt(pesoBruto)} kg`, ayuda: 'Peso máximo ya cargado' },
    volumenCarga !== null && { etiqueta: 'Volumen de carga', valor: `${fmt(volumenCarga / 1000, 1)} m³`, ayuda: 'Lo que cabe en el furgón o la caja' },
    zona.largo !== null && {
      etiqueta: clase === 'pickup' ? 'Platón' : 'Zona de carga',
      valor: [zona.largo, zona.ancho, zona.alto].filter((x): x is number => x !== null).map(x => fmt(x / 1000, 2)).join(' × ') + ' m',
      ayuda: zona.ancho !== null ? (zona.alto !== null ? 'Largo × ancho × alto' : 'Largo × ancho') : 'Largo',
    },
  ]).filter((x): x is { etiqueta: string; valor: string; ayuda: string } => !!x);
  const airbags = leer(s, 'safety.airbags');
  const ncap = leer(s, 'safety.ncapRating');
  const adultos = leer(s, 'safety.adultSafetyScore');
  const ninos = leer(s, 'safety.childSafetyScore');
  const ayudas = AYUDAS.filter(a => valorEn(s, a.key) === true);
  const equipo = EQUIPO.filter(e => (e.esTexto ? typeof valorEn(s, e.key) === 'string' && valorEn(s, e.key) : valorEn(s, e.key) === true));
  const celular = valorEn(s, 'technology.smartphoneIntegration');
  const luces = valorEn(s, 'lighting.headlightType');
  const trucos = [
    (valorEn(s, 'combustion.startStop') === true || valorEn(s, 'hybrid.startStop') === true || valorEn(s, 'technology.startStop') === true) && {
      t: 'Se apaga solo en los semáforos',
      d: 'Start-stop: no gasta mientras esperas.',
    },
    // Modo eco: hoy vive en «Modos de manejo»; los carros viejos lo traen como sí/no.
    (/\beco\b/i.test(String(valorEn(s, 'drivetrain.driveModes') ?? '')) || valorEn(s, 'combustion.ecoMode') === true || valorEn(s, 'hybrid.ecoMode') === true) && { t: 'Modo ECO', d: 'Suaviza el acelerador para gastar menos.' },
    valorEn(s, 'hybrid.regenerativeBraking') === true && {
      t: 'Recupera energía al frenar',
      d: 'La batería se carga sola: este híbrido no se enchufa.',
    },
    (valorEn(s, 'phev.regenerativeBraking') === true || valorEn(s, 'electric.regenerativeBraking') === true) && {
      t: 'Recupera energía al frenar',
      d: 'Al frenar, la batería recupera parte de la energía y te rinde más la carga.',
    },
    valorEn(s, 'combustion.octanajeRecomendado') && { t: `Gasolina ${valorEn(s, 'combustion.octanajeRecomendado')}`, d: 'La que recomienda el fabricante.' },
  ].filter((x): x is { t: string; d: string } => !!x);
  const garantiaAnos = leer(s, 'commercial.warrantyYears');
  const garantiaKm = leer(s, 'commercial.warrantyKm');

  const potencias = deTodos(x => leer(x, 'combustion.maxPower', 'hybrid.maxPower', 'phev.maxPower', 'electric.maxPower'));
  const paresPot = dePares(x => leer(x, 'combustion.maxPower', 'hybrid.maxPower', 'phev.maxPower', 'electric.maxPower'));
  const fPot = potencia !== null ? frase(potencia, paresPot.map(p => p.valor)) : null;

  // Carrera: el propio contra sus 3 más parecidos (precio, tipo y
  // características, como "Carros similares"), entre los que tienen el dato.
  const paresAcel = dePares(x => leer(x, 'performance.acceleration0to100'));
  const rivales = masParecidos(
    vehicle,
    catalogo.filter(v => leer(v.s, 'performance.acceleration0to100') !== null),
    3
  );
  const carriles =
    cero100 !== null
      ? [
          { nombre: `${vehicle.brand} ${vehicle.model}`, segundos: cero100, propio: true },
          ...rivales.map(v => ({ nombre: `${v.brand} ${v.model}`, segundos: leer(v.s, 'performance.acceleration0to100') as number })),
        ]
      : [];

  // Tiras de categoría
  const tiras = ([
    { etiqueta: 'Precio', unidad: '', menorEsMejor: true, propio: vehicle.price, otros: dePares((_x, v) => v.price || null), formato: millones },
    potencia !== null && { etiqueta: 'Potencia', unidad: 'hp', propio: potencia, otros: paresPot },
    cero100 !== null && { etiqueta: '0 a 100', unidad: 's', menorEsMejor: true, propio: cero100, otros: paresAcel, formato: (n: number) => fmt(n, 1) },
    !electrico && rinde !== null && { etiqueta: 'Consumo', unidad: 'km/gal', propio: rinde, otros: dePares((x, v) => (v.fuelType === 'Eléctrico' ? null : rendimiento(x))) },
    electrico && autonomia !== null && { etiqueta: 'Autonomía', unidad: 'km', propio: autonomia, otros: dePares(x => leer(x, 'electric.realRangeMixed', 'electric.electricRange')) },
    clase === 'auto' && baul !== null && { etiqueta: 'Baúl', unidad: 'L', propio: baul, otros: dePares(x => leer(x, 'dimensions.cargoCapacity')) },
    clase !== 'auto' && cargaUtil !== null && { etiqueta: 'Carga útil', unidad: 'kg', propio: cargaUtil, otros: dePares(x => leer(x, 'weight.payload')) },
    altura !== null && { etiqueta: 'Altura al piso', unidad: 'mm', propio: altura, otros: dePares(x => leer(x, 'chassis.groundClearance')) },
  ] as (Tira | false)[]).filter((t): t is Tira => !!t && t.otros.length >= 2);

  const secciones = [
    { id: 'desempeno', texto: 'Desempeño', hay: potencia !== null || cero100 !== null },
    { id: 'colombia', texto: 'Para Colombia', hay: hayIndices(indices) },
    { id: 'consumo', texto: electrico ? 'Batería' : 'Consumo', hay: alcance !== null || rinde !== null || bateria !== null },
    { id: 'espacio', texto: clase === 'auto' ? 'Espacio' : 'Espacio y carga', hay: baul !== null || largo !== null || pasajeros !== null || datosTrabajo.length > 0 },
    { id: 'seguridad', texto: 'Seguridad', hay: airbags !== null || ncap !== null || ayudas.length > 0 },
    { id: 'tecnologia', texto: 'Tecnología', hay: equipo.length > 0 },
    { id: 'categoria', texto: 'Su categoría', hay: tiras.length > 0 },
  ].filter(x => x.hay);

  return (
    <div className="mx-auto max-w-[1440px] px-5 md:px-8">
      <NavSecciones secciones={secciones} />

      {/* ── DESEMPEÑO ─────────────────────────────────────────────────── */}
      {secciones.some(x => x.id === 'desempeno') && (
        <section>
          <Cabecera
            id="desempeno"
            icono={Zap}
            titulo="Desempeño"
            bajada="La fuerza para subir lomas y adelantar, y qué tan rápido responde cuando pisas a fondo."
          />
          <div className="grid gap-4 md:grid-cols-12">
            {potencia !== null && (
              <Bloque tono="tinta" className="md:col-span-7 md:row-span-2">
                <Titulito icono={Gauge} claro>
                  Potencia
                </Titulito>
                <div className="mt-6">
                  <Velocimetro
                    valor={potencia}
                    min={potencias.length ? Math.min(...potencias) : 0}
                    max={potencias.length ? Math.max(...potencias) : potencia * 1.5}
                    unidad="hp"
                    minTexto={potencias.length ? `${fmt(Math.min(...potencias))} hp · el más suave del catálogo` : undefined}
                    maxTexto={potencias.length ? `${fmt(Math.max(...potencias))} hp · el más potente` : undefined}
                  />
                </div>
                {fPot && (
                  <p className="mt-6 text-[20px] font-medium leading-snug tracking-[-0.02em] md:text-[24px]">
                    Más fuerza que {fPot.mejores} de {fPot.total} {grupo}.
                    <span className="text-white/45"> Los caballos (hp) son la fuerza para subir y adelantar.</span>
                  </p>
                )}
                <p aria-hidden className="t-display pointer-events-none absolute -bottom-10 -right-4 text-[180px] leading-none text-white/[0.04]">
                  HP
                </p>
              </Bloque>
            )}

            {carriles.length > 0 && (
              <Bloque className="md:col-span-5">
                <Titulito icono={Timer}>De 0 a 100 km/h, en tiempo real</Titulito>
                <p className="mt-2 text-[13px] text-tinta-2">
                  {carriles.length > 1 ? 'Contra los carros más parecidos a este. Cuenta los segundos.' : 'Cuenta los segundos: así de rápido responde.'}
                </p>
                <div className="mt-5">
                  <Carrera carriles={carriles} />
                </div>
              </Bloque>
            )}

            {torque !== null && (
              <Bloque tono="lila" className="md:col-span-3">
                <Titulito icono={Zap}>Torque</Titulito>
                <p className="mt-6 text-[48px] font-light leading-none tracking-[-0.05em]">
                  {fmt(torque)}
                  <span className="ml-1 text-[16px] text-tinta-2">Nm</span>
                </p>
                <p className="mt-3 text-[13px] leading-snug text-tinta-2">El empujón al arrancar en una loma. Más es mejor.</p>
              </Bloque>
            )}

            {(vmax !== null || motor !== null || potPeso !== null || caja) && (
              <Bloque tono="estudio" className="md:col-span-2">
                <Titulito icono={Cpu}>Motor</Titulito>
                <dl className="mt-5 space-y-3 text-[13px]">
                  {motor !== null && (
                    <div>
                      <dt className="text-tinta-2">Cilindraje</dt>
                      <dd className="cifra text-[18px] font-semibold">{fmt(motor)} cc{turbo ? ' turbo' : ''}</dd>
                    </div>
                  )}
                  {potPeso !== null && (
                    <div>
                      <dt className="text-tinta-2">Potencia por tonelada</dt>
                      <dd className="cifra text-[18px] font-semibold">{fmt(potPeso)} hp/t</dd>
                    </div>
                  )}
                  {vmax !== null && (
                    <div>
                      <dt className="text-tinta-2">Vel. máxima</dt>
                      <dd className="cifra text-[18px] font-semibold">{fmt(vmax)} km/h</dd>
                    </div>
                  )}
                </dl>
              </Bloque>
            )}

            {(caja || config) && (
              <Bloque className="md:col-span-12 md:py-6">
                <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-[14px]">
                  {config && (
                    <p>
                      <span className="text-tinta-2">Motor: </span>
                      <span className="font-medium">{config}</span>
                    </p>
                  )}
                  {caja && (
                    <p>
                      <span className="text-tinta-2">Caja: </span>
                      <span className="font-medium">{caja}</span>
                      {/autom|cvt/i.test(caja) && <span className="ml-2 rounded-full bg-wise/10 px-2.5 py-0.5 text-[12px] text-wise">no hay que hacer cambios</span>}
                    </p>
                  )}
                  {peso !== null && (
                    <p>
                      <span className="text-tinta-2">Peso: </span>
                      <span className="cifra font-medium">{fmt(peso)} kg</span>
                    </p>
                  )}
                </div>
              </Bloque>
            )}
          </div>
        </section>
      )}

      {/* ── ÍNDICES WISEMOTORS ─────────────────────────────────────────── */}
      {indices && secciones.some(x => x.id === 'colombia') && <SeccionIndices indices={indices} />}

      {/* ── CONSUMO / BATERÍA ─────────────────────────────────────────── */}
      {secciones.some(x => x.id === 'consumo') && (
        <section>
          <Cabecera
            id="consumo"
            icono={electrico ? BatteryCharging : Fuel}
            titulo={electrico ? 'Batería' : 'Consumo'}
            bajada={
              electrico
                ? 'Cuántos kilómetros haces con una carga y cuánto tardas en volver a llenarla.'
                : 'Cuántos kilómetros haces con un galón y hasta dónde llegas con el tanque lleno.'
            }
          />
          <div className="grid gap-4 md:grid-cols-12">
            {alcance !== null && (
              <Bloque tono="tinta" className="md:col-span-8">
                <Titulito icono={Map} claro>
                  ¿Hasta dónde llegas?
                </Titulito>
                <div className="mt-5">
                  <Ruta km={alcance} electrico={electrico} />
                </div>
              </Bloque>
            )}

            {(galones !== null || bateria !== null) && (
              <Bloque className="md:col-span-4">
                <Titulito icono={electrico ? BatteryCharging : Fuel}>{electrico ? 'La batería' : 'El tanque'}</Titulito>
                <div className="mt-6">
                  {electrico && bateria !== null ? (
                    <Nivel etiqueta="Capacidad" valor={fmt(bateria, 1)} unidad="kWh" electrico />
                  ) : galones !== null ? (
                    <Nivel etiqueta="Le caben" valor={fmt(galones, 1)} unidad="galones" electrico={false} />
                  ) : null}
                </div>
                {!electrico && rinde !== null && (
                  <p className="mt-5 border-t border-linea pt-4 text-[14px]">
                    <span className="cifra text-[22px] font-semibold">{fmt(rinde)}</span> <span className="text-tinta-2">km por galón en promedio</span>
                  </p>
                )}
              </Bloque>
            )}

            {!electrico && ciudad !== null && carretera !== null && (
              <Bloque tono="lila" className={trucos.length ? 'md:col-span-5' : 'md:col-span-12'}>
                <Titulito icono={Fuel}>Ciudad o carretera</Titulito>
                <div className="mt-6">
                  <BarrasPar
                    max={Math.max(ciudad, carretera)}
                    filas={[
                      { etiqueta: 'En ciudad', valor: ciudad, texto: `${fmt(ciudad)} km/gal` },
                      { etiqueta: 'En carretera', valor: carretera, texto: `${fmt(carretera)} km/gal` },
                    ]}
                  />
                </div>
                <p className="mt-4 text-[12px] text-tinta-2">
                  {ciudad > carretera ? 'Como buen híbrido, rinde más en el trancón que en la autopista.' : 'En carretera rinde más que en el trancón.'}
                </p>
              </Bloque>
            )}

            {!electrico && trucos.length > 0 && (
              <Bloque tono="estudio" className={ciudad !== null && carretera !== null ? 'md:col-span-7' : 'md:col-span-12'}>
                <Titulito icono={Sparkles}>Lo que le ayuda a gastar menos</Titulito>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {trucos.map(x => (
                    <li key={x.t} className="rounded-[20px] bg-blanco/85 p-4">
                      <p className="text-[16px] font-semibold tracking-[-0.02em]">{x.t}</p>
                      <p className="mt-1 text-[13px] leading-snug text-tinta-2">{x.d}</p>
                    </li>
                  ))}
                </ul>
              </Bloque>
            )}

            {electrico && autCiudad !== null && autCarretera !== null && (
              <Bloque tono="lila" className="md:col-span-5">
                <Titulito icono={Map}>Ciudad o carretera</Titulito>
                <div className="mt-6">
                  <BarrasPar
                    max={Math.max(autCiudad, autCarretera)}
                    filas={[
                      { etiqueta: 'En ciudad', valor: autCiudad, texto: `${fmt(autCiudad)} km` },
                      { etiqueta: 'En carretera', valor: autCarretera, texto: `${fmt(autCarretera)} km` },
                    ]}
                  />
                </div>
                <p className="mt-4 text-[12px] text-tinta-2">Los eléctricos rinden más en ciudad: frenan y recuperan energía.</p>
              </Bloque>
            )}

            {electrico && (cargaAC !== null || cargaDC !== null) && (
              <Bloque className="md:col-span-7">
                <Titulito icono={Zap}>Cuánto tarda en cargar</Titulito>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {cargaDC !== null && (
                    <div className="rounded-[22px] bg-wise p-5 text-white">
                      <p className="text-[13px] text-white/70">Cargador rápido (estación)</p>
                      <p className="mt-2 text-[44px] font-light leading-none tracking-[-0.05em]">
                        {fmt(cargaDC)}
                        <span className="ml-1 text-[16px] text-white/70">min</span>
                      </p>
                      <p className="mt-2 text-[12px] text-white/60">Lo que dura un almuerzo</p>
                    </div>
                  )}
                  {cargaAC !== null && (
                    <div className="rounded-[22px] bg-tarjeta p-5">
                      <p className="text-[13px] text-tinta-2">En la casa (toma normal o wallbox)</p>
                      <p className="mt-2 text-[44px] font-light leading-none tracking-[-0.05em]">
                        {fmt(cargaAC, 1)}
                        <span className="ml-1 text-[16px] text-tinta-2">horas</span>
                      </p>
                      <p className="mt-2 text-[12px] text-tinta-2">Se conecta de noche y amanece lleno</p>
                    </div>
                  )}
                </div>
              </Bloque>
            )}

            {!electrico && (ciudad === null || carretera === null) && rinde !== null && (
              <Bloque tono="lila" className="md:col-span-12">
                <p className="text-[15px]">
                  <span className="cifra text-[28px] font-semibold">{fmt(rinde)}</span> km por galón en uso combinado.
                </p>
              </Bloque>
            )}
          </div>
        </section>
      )}

      {/* ── ESPACIO ───────────────────────────────────────────────────── */}
      {secciones.some(x => x.id === 'espacio') && (
        <section>
          <Cabecera
            id="espacio"
            icono={Ruler}
            titulo={clase === 'auto' ? 'Espacio' : 'Espacio y carga'}
            bajada={
              clase === 'auto'
                ? 'Lo que le cabe por dentro, cuánto ocupa por fuera y si pasa los reductores sin raspar.'
                : 'Cuánto carga, cuánto hala, cuánto ocupa por fuera y si pasa los reductores sin raspar.'
            }
          />
          <div className="grid gap-4 md:grid-cols-12">
            {/* Vehículos de trabajo: lo primero que se mira, arriba. */}
            {datosTrabajo.length > 0 && (
              <Bloque tono="tinta" className="md:col-span-12">
                <Titulito icono={Package} claro>
                  Para trabajar
                </Titulito>
                <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-5">
                  {datosTrabajo.map(d => (
                    <div key={d.etiqueta}>
                      <dt className="text-[13px] text-white/60">{d.etiqueta}</dt>
                      <dd className="cifra mt-1 text-[28px] font-light leading-none tracking-[-0.04em] md:text-[34px]">{d.valor}</dd>
                      <dd className="mt-2 text-[12px] leading-snug text-white/50">{d.ayuda}</dd>
                    </div>
                  ))}
                </dl>
              </Bloque>
            )}
            {(largo !== null || alto !== null) && (
              <Bloque tono="estudio" className="md:col-span-7 md:row-span-2">
                <Titulito icono={Ruler}>Sus medidas</Titulito>
                <Medidas vehicle={vehicle} largo={largo} alto={alto} entreEjes={entreEjes} altura={altura} ancho={ancho} />
              </Bloque>
            )}
            {baul !== null && clase !== 'comercial' && (
              <Bloque className="md:col-span-5">
                <Titulito icono={Car}>El baúl</Titulito>
                <div className="mt-5">
                  <Maletas litros={baul} />
                </div>
                {baulAbatido !== null && (
                  <p className="mt-3 text-[13px] text-tinta-2">
                    Con la silla de atrás abajo: <span className="cifra font-semibold text-tinta">{fmt(baulAbatido)} L</span>
                  </p>
                )}
              </Bloque>
            )}
            {pasajeros !== null && (
              <Bloque tono="wise" className="md:col-span-3">
                <Titulito icono={Armchair} claro>
                  Pasajeros
                </Titulito>
                <p className="mt-5 text-[56px] font-light leading-none tracking-[-0.05em]">{fmt(pasajeros)}</p>
                <div className="mt-4">
                  <Personas n={pasajeros} />
                </div>
              </Bloque>
            )}
            {(altura !== null || (remolque !== null && datosTrabajo.length === 0)) && (
              <Bloque tono="lila" className="md:col-span-2">
                {altura !== null && (
                  <>
                    <p className="text-[13px] text-tinta-2">Altura al piso</p>
                    <p className="mt-2 text-[34px] font-light leading-none tracking-[-0.05em]">
                      {fmt(altura / 10, 1)}
                      <span className="ml-1 text-[14px] text-tinta-2">cm</span>
                    </p>
                    <p className="mt-2 text-[12px] leading-snug text-tinta-2">{altura >= 190 ? 'Pasa huecos y reductores tranquilo' : altura >= 160 ? 'Bien para la ciudad' : 'Ojo con los reductores altos'}</p>
                  </>
                )}
                {remolque !== null && datosTrabajo.length === 0 && (
                  <p className="mt-4 text-[12px] text-tinta-2">
                    Remolca <span className="cifra font-semibold text-tinta">{fmt(remolque)} kg</span>
                  </p>
                )}
              </Bloque>
            )}
            {largo !== null && ancho !== null && (
              <Bloque tono="lila" className="md:col-span-12">
                <Titulito icono={ParkingSquare}>¿Cabe en el parqueadero?</Titulito>
                <div className="mt-5">
                  <Parqueadero largo={largo} ancho={ancho} nombre={`${vehicle.brand} ${vehicle.model}`} />
                </div>
              </Bloque>
            )}
          </div>
        </section>
      )}

      {/* ── SEGURIDAD ─────────────────────────────────────────────────── */}
      {secciones.some(x => x.id === 'seguridad') && (
        <section>
          <Cabecera id="seguridad" icono={Shield} titulo="Seguridad" bajada="Cómo te protege en un choque y qué hace para que no llegues a chocar." />
          <div className="grid gap-4 md:grid-cols-12">
            {ncap !== null && (
              <Bloque tono="tinta" className={adultos !== null || ninos !== null ? 'md:col-span-5' : 'md:col-span-7'}>
                <Titulito icono={ShieldCheck} claro>
                  Pruebas de choque
                </Titulito>
                <div className="mt-8">
                  <Estrellas n={ncap} />
                </div>
                <p className="mt-6 text-[22px] font-medium leading-snug tracking-[-0.02em]">
                  {fmt(ncap)} de 5 estrellas.
                  <span className="text-white/45"> Salen de chocar el carro de verdad en laboratorio.</span>
                </p>
              </Bloque>
            )}
            {(adultos !== null || ninos !== null) && (
              <Bloque className="md:col-span-3">
                <Titulito icono={Shield}>Protección</Titulito>
                <div className="mt-6 space-y-4">
                  {adultos !== null && <Anillo pct={adultos} etiqueta="adultos" />}
                  {ninos !== null && <Anillo pct={ninos} etiqueta="niños" />}
                </div>
              </Bloque>
            )}
            {airbags !== null && (
              <Bloque tono="lila" className={adultos !== null || ninos !== null ? 'md:col-span-4' : 'md:col-span-5'}>
                <Titulito icono={Shield}>Airbags</Titulito>
                <p className="mt-5 text-[64px] font-light leading-none tracking-[-0.05em]">{fmt(airbags)}</p>
                <div className="mt-4 flex gap-1.5">
                  {Array.from({ length: Math.min(12, airbags) }).map((_, i) => (
                    <span key={i} className="h-3 w-3 rounded-full bg-wise" style={{ opacity: 0.45 + (i / airbags) * 0.55 }} />
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-tinta-2">Cojines que se inflan en un golpe.</p>
              </Bloque>
            )}
            {ayudas.length > 0 && (
              <Bloque className="md:col-span-12">
                <Titulito icono={Radar}>Te ayuda a no chocar</Titulito>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ayudas.map((a, i) => (
                    <li
                      key={a.key}
                      className="flex items-center gap-3 rounded-[18px] border border-linea px-4 py-3.5 text-[14px]"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <a.icono className="h-4 w-4 shrink-0 text-wise" />
                      {a.texto}
                    </li>
                  ))}
                </ul>
              </Bloque>
            )}
          </div>
        </section>
      )}

      {/* ── TECNOLOGÍA ────────────────────────────────────────────────── */}
      {secciones.some(x => x.id === 'tecnologia') && (
        <section>
          <Cabecera id="tecnologia" icono={Sparkles} titulo="Tecnología y confort" bajada="Lo que usas todos los días: el celular, parquear, el aire, las luces." />
          <div className="grid gap-4 md:grid-cols-12">
            {typeof celular === 'string' && celular && (
              <Bloque tono="wise" className="md:col-span-4">
                <Titulito icono={Smartphone} claro>
                  Tu celular en la pantalla
                </Titulito>
                <p className="mt-6 text-[26px] font-medium leading-tight tracking-[-0.03em]">{celular}</p>
                <p className="mt-3 text-[13px] text-white/60">Mapas, música y WhatsApp en la pantalla del carro.</p>
              </Bloque>
            )}
            <Bloque className={typeof celular === 'string' && celular ? 'md:col-span-8' : 'md:col-span-12'}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {equipo
                  .filter(e => e.key !== 'technology.smartphoneIntegration')
                  .map(e => (
                    <div key={e.key} className="group flex items-center gap-3 rounded-[18px] bg-papel px-4 py-4 transition-colors hover:bg-wise hover:text-white">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blanco text-wise transition-colors group-hover:bg-white/15 group-hover:text-white">
                        <e.icono className="h-4 w-4" />
                      </span>
                      <span className="text-[14px] leading-snug">{e.texto}</span>
                    </div>
                  ))}
                {luces && (
                  <div className="group flex items-center gap-3 rounded-[18px] bg-papel px-4 py-4 transition-colors hover:bg-wise hover:text-white">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blanco text-wise transition-colors group-hover:bg-white/15 group-hover:text-white">
                      <Lightbulb className="h-4 w-4" />
                    </span>
                    <span className="text-[14px] leading-snug">Luces {luces}</span>
                  </div>
                )}
              </div>
            </Bloque>
            {garantiaAnos !== null && (
              <Bloque tono="tinta" className="md:col-span-12">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <p className="text-[13px] text-white/55">Garantía de fábrica</p>
                    <p className="mt-1 text-[34px] font-light tracking-[-0.04em]">
                      {fmt(garantiaAnos)} años{garantiaKm !== null && <span className="text-white/50"> o {fmt(garantiaKm)} km</span>}
                    </p>
                  </div>
                  <div className="flex flex-1 gap-1.5 md:max-w-[520px]">
                    {Array.from({ length: Math.min(10, Math.round(garantiaAnos)) }).map((_, i) => (
                      <span key={i} className="h-10 flex-1 rounded-lg bg-gradient-to-t from-wise to-wise-lila" style={{ opacity: 0.5 + (i / garantiaAnos) * 0.5 }} />
                    ))}
                  </div>
                </div>
              </Bloque>
            )}
          </div>
        </section>
      )}

      {/* ── SU CATEGORÍA ──────────────────────────────────────────────── */}
      {secciones.some(x => x.id === 'categoria') && (
        <section>
          <Cabecera
            id="categoria"
            icono={Radar}
            titulo="Frente a su categoría"
            bajada={`Cada punto es uno de los ${pares.length} ${grupo}. El morado es este. Así sabes si lo que ofrece es mucho o poco para lo que se vende en Colombia.`}
          />
          <Bloque className="!py-4">
            {tiras.map((t, i) => (
              <TiraCategoria key={t.etiqueta} tira={t} indice={i} />
            ))}
          </Bloque>
        </section>
      )}
    </div>
  );
}

// ── Diagrama de medidas ────────────────────────────────────────────────────
function Medidas({
  vehicle,
  largo,
  alto,
  entreEjes,
  altura,
  ancho,
}: {
  vehicle: any;
  largo: number | null;
  alto: number | null;
  entreEjes: number | null;
  altura: number | null;
  ancho: number | null;
}) {
  const [ref, visto] = useEnVista<HTMLDivElement>(0.3);
  const m = (mm: number) => `${fmt(mm / 1000, 2)} m`;
  const linea = (dur: number) => ({ transform: visto ? 'scaleX(1)' : 'scaleX(0)', transition: `transform 1000ms cubic-bezier(0.16,1,0.3,1) ${dur}ms` });
  return (
    <div ref={ref} className="mt-4">
      <div className="relative mx-auto aspect-[480/230] w-full max-w-[640px]">
        <CarRender car={vehicle} ajustado className="absolute inset-x-[6%] top-[4%] h-[78%] w-[88%]" />
        {/* alto */}
        {alto !== null && (
          <div className="absolute bottom-[18%] right-0 top-[4%] flex items-center">
            <div className="relative h-full w-px bg-tinta/40" style={{ transform: visto ? 'scaleY(1)' : 'scaleY(0)', transition: 'transform 1000ms cubic-bezier(0.16,1,0.3,1) 300ms' }}>
              <span className="absolute -left-1 top-0 h-px w-2.5 bg-tinta/60" />
              <span className="absolute -left-1 bottom-0 h-px w-2.5 bg-tinta/60" />
            </div>
            <span className="cifra ml-2 rotate-0 whitespace-nowrap text-[12px] font-semibold">{m(alto)}</span>
          </div>
        )}
        {/* entre ejes */}
        {entreEjes !== null && (
          <div className="absolute inset-x-[27%] bottom-[10%]">
            <div className="h-px origin-center bg-wise" style={linea(500)} />
            <p className="cifra mt-1 text-center text-[11px] text-wise">entre ejes {m(entreEjes)}</p>
          </div>
        )}
        {/* largo */}
        {largo !== null && (
          <div className="absolute inset-x-[6%] bottom-0">
            <div className="relative h-px origin-left bg-tinta/50" style={linea(0)}>
              <span className="absolute -top-1 left-0 h-2.5 w-px bg-tinta/60" />
              <span className="absolute -top-1 right-0 h-2.5 w-px bg-tinta/60" />
            </div>
            <p className="cifra mt-1.5 text-center text-[12px] font-semibold">largo {m(largo)}</p>
          </div>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {ancho !== null && <span className="rounded-full bg-blanco/80 px-3 py-1.5 text-[12px]">Ancho {m(ancho)}</span>}
        {altura !== null && <span className="rounded-full bg-blanco/80 px-3 py-1.5 text-[12px]">{fmt(altura / 10, 1)} cm del piso</span>}
      </div>
    </div>
  );
}

// ── Navegación entre secciones (vidrio, con la sección visible marcada) ────
function NavSecciones({ secciones }: { secciones: { id: string; texto: string }[] }) {
  const [activa, setActiva] = useState(secciones[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver(
      entradas => {
        const visible = entradas.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: '-20% 0px -65% 0px' }
    );
    secciones.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [secciones]);
  if (secciones.length < 2) return null;
  return (
    <div className="pointer-events-none sticky top-[84px] z-30 mt-10 flex justify-center md:top-[92px]">
      <nav aria-label="Secciones de la ficha" className="vidrio pointer-events-auto flex max-w-full gap-1 overflow-x-auto p-[5px] [scrollbar-width:none]">
        {secciones.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition-all duration-300 ${
              activa === s.id ? 'bg-tinta text-white shadow-[0_6px_16px_-6px_rgba(14,12,17,0.6)]' : 'text-tinta/65 hover:text-tinta'
            }`}
          >
            {s.texto}
          </a>
        ))}
      </nav>
    </div>
  );
}
