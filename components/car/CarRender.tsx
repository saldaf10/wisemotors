'use client';

// ============================================================================
// El carro como protagonista.
//
// Si el vehículo tiene foto (recortada, fondo transparente) se usa la foto.
// Si no, un render de estudio en SVG según la carrocería: nunca un ícono ni un
// placeholder gris. Perfil lateral mirando a la derecha, pintura con degradado
// y reflejo de hombro, vidrio oscuro con destello, rines con aro morado (el
// acento de marca como luz, igual que los aros azules de la referencia
// Porsche) y sombra de piso.
// ============================================================================

import { useId } from 'react';
import { vistaDeFoto } from '@/lib/vistas';

export interface CarLike {
  id?: string;
  brand?: string;
  model?: string;
  type?: string;
  fuelType?: string;
  specifications?: unknown;
  imageUrl?: string | null;
  images?: { url: string; type?: string | null; isThumbnail?: boolean | null; alt?: string | null; order?: number | null }[] | null;
}

type Carroceria = 'sedan' | 'hatch' | 'suv' | 'suvCoupe' | 'pickup';

function dimension(car: CarLike, clave: 'length' | 'height'): number | null {
  let s: any = car.specifications;
  if (typeof s === 'string') {
    try {
      s = JSON.parse(s);
    } catch {
      return null;
    }
  }
  const v = Number(s?.dimensions?.[clave]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Silueta y escala horizontal según carrocería, nombre y dimensiones reales. */
export function carroceriaDe(type?: string, car?: CarLike): { forma: Carroceria; escala: number } {
  const t = (type ?? '').toLowerCase();
  const largo = car ? dimension(car, 'length') : null;
  const alto = car ? dimension(car, 'height') : null;
  const nombre = `${car?.model ?? ''}`.toLowerCase();
  if (t.includes('pickup') || t.includes('camioneta')) return { forma: 'pickup', escala: 1 };
  if (t.includes('suv') || t.includes('todoterreno') || t.includes('crossover')) {
    // SUV de techo que cae (tipo coupé): baja o con nombre conocido
    const coupe = /model y|cx-30|cx30|coup|x4|x6|gle|q3 sport|arkana|fastback/.test(nombre) || (alto !== null && alto < 1590);
    const escala = largo !== null && largo < 4350 ? 0.93 : 1;
    return { forma: coupe ? 'suvCoupe' : 'suv', escala };
  }
  if (t.includes('hatch')) return { forma: 'hatch', escala: largo !== null && largo < 3800 ? 0.92 : 1 };
  return { forma: 'sedan', escala: 1 };
}

/** Pinturas de estudio (sin verdes ni azules). Estable por vehículo. */
const PINTURAS = [
  { base: '#e9e7ec', nombre: 'perla' },
  { base: '#b9b7bf', nombre: 'plata' },
  { base: '#3a3740', nombre: 'grafito' },
  { base: '#16141a', nombre: 'negro' },
  { base: '#3b0d55', nombre: 'morado' },
  { base: '#6b1a30', nombre: 'vino' },
];

export function pinturaDe(car: CarLike) {
  const semilla = `${car.brand ?? ''}|${car.model ?? ''}`;
  let h = 7;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) >>> 0;
  return PINTURAS[h % PINTURAS.length];
}

/**
 * La foto principal: la 3/4 delantera si existe (la imagen por defecto de la
 * página), si no la portada guardada. Con `vista: 'lado'` solo sirve la lateral
 * (las medidas se dibujan sobre el perfil); sin ella, null → el dibujo.
 */
export function fotoDe(car: CarLike, vista: 'portada' | 'lado' = 'portada'): string | null {
  const imgs = car.images ?? [];
  if (vista === 'lado') return imgs.find(i => vistaDeFoto(i) === 'lado')?.url ?? null;
  const tresCuartos = imgs.find(i => vistaDeFoto(i) === 'tres_cuartos_frente');
  const portada = tresCuartos ?? imgs.find(i => i.isThumbnail) ?? imgs.find(i => i.type === 'cover') ?? imgs[0];
  return portada?.url ?? car.imageUrl ?? null;
}

function mezclar(hex: string, con: string, t: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(con.slice(1), 16);
  const c = (x: number) => [(x >> 16) & 255, (x >> 8) & 255, x & 255];
  const [r1, g1, b1] = c(a);
  const [r2, g2, b2] = c(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${((1 << 24) | (m(r1, r2) << 16) | (m(g1, g2) << 8) | m(b1, b2)).toString(16).slice(1)}`;
}

interface Silueta {
  cuerpo: string;
  vidrio: string;
  pilares: [number, number, number, number][]; // x1,y1,x2,y2
  ruedas: [number, number];
  ry: number;
  r: number;
  /** Radio del paso de rueda (holgura sobre la llanta). */
  arco: number;
  /** y de la base de la carrocería entre ruedas (altura al piso). */
  faldon: number;
  hombro: string;
  faro: string;
  stop: string;
  espejo: string;
  manijas: [number, number][];
  revestimiento?: boolean;
  extra?: string;
}

// Geometría a escala (≈90 px por metro): largo, alto, distancia entre ejes y
// voladizos de un carro típico de cada carrocería vendido en Colombia.
// viewBox 0 0 480 180, piso en y = 160, el carro mira a la derecha.
const SILUETAS: Record<Carroceria, Silueta> = {
  sedan: {
    cuerpo:
      'M40 144 L34 122 C33 110 36 102 44 98 L92 92 C104 90 112 86 120 80 C140 58 164 40 196 34 C224 29 262 29 286 34 C304 38 320 50 338 70 C352 78 360 82 372 84 C404 88 430 94 444 102 C450 106 452 114 451 122 L449 138 C448 143 444 145 438 145 L397.8 145 A37 37 0 1 0 330.2 145 L151.8 145 A37 37 0 1 0 84.2 145 L46 145 C42 145 40 145 40 144 Z',
    vidrio: 'M128 80 C146 60 168 44 198 40 C226 35 262 35 284 40 C300 44 314 56 328 72 L331 78 Z',
    pilares: [[238, 36, 236, 79]],
    ruedas: [118, 364],
    ry: 130,
    r: 30,
    arco: 37,
    faldon: 145,
    hombro: 'M46 104 C150 96 300 92 444 106',
    faro: 'M414 96 C428 99 440 104 447 111',
    stop: 'M36 104 L52 100',
    espejo: 'M330 76 L346 73 L349 82 L334 84 Z',
    manijas: [[172, 92], [262, 92]],
  },
  hatch: {
    cuerpo:
      'M72 145 L66 122 C64 108 66 98 72 90 C80 70 92 52 108 40 C114 34 122 31 134 30 L250 28 C266 28 276 32 286 40 L322 76 C350 80 380 86 402 94 C412 98 418 108 417 120 L415 138 C414 143 410 145 404 145 L378.1 145 A35 35 0 1 0 313.9 145 L154.1 145 A35 35 0 1 0 89.9 145 L76 145 C73 145 72 145 72 145 Z',
    vidrio: 'M92 78 C100 63 110 51 122 43 C126 40 130 39 138 38 L248 36 C262 36 270 39 279 47 L304 74 Z',
    pilares: [[202, 37, 200, 75], [124, 42, 112, 76]],
    ruedas: [122, 346],
    ry: 131,
    r: 29,
    arco: 35,
    faldon: 145,
    hombro: 'M70 92 C170 86 300 84 412 100',
    faro: 'M388 92 C400 94 410 99 415 106',
    stop: 'M68 94 L76 80',
    espejo: 'M300 72 L316 69 L319 78 L304 80 Z',
    manijas: [[166, 86], [240, 86]],
  },

  suv: {
    cuerpo:
      'M54 144 L50 116 C49 100 54 84 64 72 L100 38 C106 33 112 31 122 31 L250 26 C266 25 276 29 286 37 L322 76 C360 82 400 88 428 96 C438 100 442 108 442 118 L440 138 C439 142 436 144 430 144 L390.6 144 A39 39 0 1 0 321.4 144 L148.6 144 A39 39 0 1 0 79.4 144 L60 144 C56 144 54 144 54 144 Z',
    vidrio: 'M88 70 L110 44 C114 40 118 38 126 38 L248 33 C261 33 269 36 277 43 L304 70 Z',
    pilares: [[196, 34, 195, 70], [142, 37, 128, 70]],
    ruedas: [114, 356],
    ry: 126,
    r: 33,
    arco: 39,
    faldon: 144,
    hombro: 'M58 84 C160 80 300 80 432 100',
    faro: 'M404 92 C420 95 432 100 439 107',
    stop: 'M52 92 L64 88',
    espejo: 'M308 72 L326 69 L329 79 L312 81 Z',
    manijas: [[164, 82], [250, 82]],
    revestimiento: true,
  },

  suvCoupe: {
    cuerpo:
      'M54 144 L50 114 C50 102 54 92 62 84 C84 56 116 34 160 28 C200 23 240 23 266 27 C278 29 286 33 294 40 L326 78 C360 82 400 88 428 96 C438 100 442 108 442 118 L440 138 C439 142 436 144 430 144 L390.6 144 A39 39 0 1 0 321.4 144 L148.6 144 A39 39 0 1 0 79.4 144 L60 144 C56 144 54 144 54 144 Z',
    vidrio: 'M92 74 C110 54 134 40 164 35 C200 29 238 29 262 33 C272 35 280 40 286 46 L306 72 Z',
    pilares: [[212, 31, 211, 73]],
    ruedas: [114, 356],
    ry: 126,
    r: 33,
    arco: 39,
    faldon: 144,
    hombro: 'M58 90 C160 84 300 82 432 100',
    faro: 'M404 92 C420 95 432 100 439 107',
    stop: 'M56 90 C62 88 68 86 74 84',
    espejo: 'M314 76 L332 73 L335 83 L318 85 Z',
    manijas: [[160, 86], [252, 86]],
    revestimiento: true,
  },


  pickup: {
    cuerpo:
      'M28 146 L22 118 L24 72 L198 70 L202 26 C203 18 208 14 216 14 L310 12 C324 12 332 16 340 24 L372 72 C404 76 436 82 452 90 C460 94 462 104 461 116 L459 140 C458 145 454 147 448 147 L419 147 A40 40 0 1 0 351 147 L163 147 A40 40 0 1 0 95 147 L32 147 C29 147 28 147 28 146 Z',
    vidrio: 'M214 64 L220 24 C221 21 223 20 227 20 L306 19 C318 19 326 22 332 29 L360 66 Z',
    pilares: [[288, 20, 287, 66]],
    ruedas: [129, 385],
    ry: 126,
    r: 34,
    arco: 40,
    faldon: 147,
    hombro: 'M26 84 L196 82 M206 84 C300 84 380 86 452 98',
    faro: 'M428 86 C442 89 454 94 459 102',
    stop: 'M24 78 L24 96',
    espejo: 'M360 70 L378 67 L381 78 L364 80 Z',
    manijas: [[248, 86], [312, 86]],
    revestimiento: true,
    extra: 'M199 72 L199 140 M26 78 L196 76',
  },
};

function Rueda({ cx, cy, r, id, acento }: { cx: number; cy: number; r: number; id: string; acento: boolean }) {
  const rin = r * 0.7;
  const rayos = [0, 72, 144, 216, 288];
  return (
    <g>
      <ellipse cx={cx} cy={cy + r - 1} rx={r * 1.05} ry={3.5} fill="#000" opacity={0.6} />
      <circle cx={cx} cy={cy} r={r} fill="#111014" />
      <circle cx={cx} cy={cy} r={r - 2.5} fill="none" stroke="#24212a" strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={rin + 1.5} fill={`url(#rin-${id})`} />
      {/* Disco de freno detrás de los rayos */}
      <circle cx={cx} cy={cy} r={rin * 0.72} fill="#2b2830" />
      <circle cx={cx} cy={cy} r={rin * 0.72} fill="none" stroke="#45414c" strokeWidth={1} strokeDasharray="1.5 2" />
      {rayos.map(a => (
        <g key={a} transform={`rotate(${a} ${cx} ${cy})`}>
          <path
            d={`M${cx - 2.6} ${cy - rin * 0.22} L${cx - 4.2} ${cy - rin + 1} L${cx - 0.8} ${cy - rin + 0.5} L${cx - 0.6} ${cy - rin * 0.22} Z`}
            fill="#dcdae0"
          />
          <path
            d={`M${cx + 0.6} ${cy - rin * 0.22} L${cx + 0.8} ${cy - rin + 0.5} L${cx + 4.2} ${cy - rin + 1} L${cx + 2.6} ${cy - rin * 0.22} Z`}
            fill="#b9b6c0"
          />
        </g>
      ))}
      <circle cx={cx} cy={cy} r={rin + 1.2} fill="none" stroke="#e7e5ea" strokeWidth={1.6} />
      {acento && (
        <>
          <circle cx={cx} cy={cy} r={rin + 3.2} fill="none" stroke="#a855f7" strokeWidth={3} opacity={0.6} filter={`url(#brillo-${id})`} />
          <circle cx={cx} cy={cy} r={rin + 3.2} fill="none" stroke="#c084fc" strokeWidth={1.2} />
        </>
      )}
      <circle cx={cx} cy={cy} r={rin * 0.2} fill="#cfcdd4" />
      <circle cx={cx} cy={cy} r={rin * 0.09} fill="#2b2830" />
    </g>
  );
}

function RenderSvg({ car, className, ajustado = false }: { car: CarLike; className?: string; ajustado?: boolean }) {
  const id = useId().replace(/:/g, '');
  const { forma, escala } = carroceriaDe(car.type, car);
  const base = SILUETAS[forma];
  // Escala horizontal para compactos: la carrocería se angosta alrededor del
  // centro y las ruedas se reubican (sin deformarse).
  const cx0 = 240;
  const sx = (x: number) => cx0 + (x - cx0) * escala;
  const s = { ...base, ruedas: [sx(base.ruedas[0]), sx(base.ruedas[1])] as [number, number] };
  const transformar = escala === 1 ? undefined : `translate(${cx0} 0) scale(${escala} 1) translate(${-cx0} 0)`;
  const pintura = pinturaDe(car);
  const oscura = ['grafito', 'negro', 'morado', 'vino'].includes(pintura.nombre);
  const alto = mezclar(pintura.base, '#ffffff', oscura ? 0.32 : 0.6);
  const bajo = mezclar(pintura.base, '#000000', oscura ? 0.55 : 0.32);
  const acento = /el[eé]ctric|h[ií]brid/i.test(car.fuelType ?? '');
  const [r1, r2] = s.ruedas;
  const centro = (r1 + r2) / 2;

  const arcos = base.ruedas.map(cx => {
    const dy = base.faldon - base.ry;
    const dx = Math.sqrt(s.arco * s.arco - dy * dy);
    return `M${cx + dx} ${s.ry + dy} A${s.arco} ${s.arco} 0 1 0 ${cx - dx} ${s.ry + dy}`;
  });

  return (
    <svg viewBox={ajustado ? '30 6 424 164' : '0 0 480 180'} className={className} role="img" aria-label={`${car.brand ?? ''} ${car.model ?? ''}`}>
      <defs>
        <linearGradient id={`pintura-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={alto} />
          <stop offset="0.42" stopColor={pintura.base} />
          <stop offset="0.7" stopColor={pintura.base} />
          <stop offset="1" stopColor={bajo} />
        </linearGradient>
        <linearGradient id={`lateral-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <stop offset="0.35" stopColor="#fff" stopOpacity={oscura ? 0.08 : 0.25} />
          <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={`vidrio-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4553" />
          <stop offset="0.5" stopColor="#1b1820" />
          <stop offset="1" stopColor="#0b0a0d" />
        </linearGradient>
        <radialGradient id={`rin-${id}`}>
          <stop offset="0.6" stopColor="#1a181e" />
          <stop offset="1" stopColor="#57535e" />
        </radialGradient>
        <radialGradient id={`sombra-${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.45" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`hombro-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity={oscura ? 0.45 : 0.9} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`brillo-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <clipPath id={`cuerpo-${id}`}>
          <path d={s.cuerpo} />
        </clipPath>
      </defs>

      <ellipse cx={centro} cy={160} rx={228} ry={11} fill={`url(#sombra-${id})`} />

      {/* Hueco del paso de rueda: oscuro, recortado a la altura del faldón */}
      <clipPath id={`pozo-${id}`}>
        <rect x="0" y="0" width="480" height={s.faldon + 1} />
      </clipPath>
      <g clipPath={`url(#pozo-${id})`}>
        {s.ruedas.map(x => (
          <circle key={x} cx={x} cy={s.ry} r={s.arco} fill="#0c0a0f" />
        ))}
      </g>

      <g transform={transformar}>
      {/* Carrocería con volumen: degradado vertical + luz lateral */}
      <path d={s.cuerpo} fill={`url(#pintura-${id})`} />
      <g clipPath={`url(#cuerpo-${id})`}>
        <rect x="0" y="0" width="480" height="180" fill={`url(#lateral-${id})`} />
        {/* Reflejo del piso en la parte baja de las puertas */}
        <rect x="0" y={s.ry - 8} width="480" height="30" fill="#000" opacity={oscura ? 0.25 : 0.12} />
        {s.revestimiento && <rect x="0" y={s.ry + 6} width="480" height="30" fill="#1c1a20" opacity={0.85} />}
      </g>

      {/* Revestimiento de los pasos de rueda (SUV y pickup) */}
      {s.revestimiento &&
        arcos.map((d, i) => <path key={i} d={d} fill="none" stroke="#1c1a20" strokeWidth={7} strokeLinecap="round" />)}

      {/* Línea de hombro: la arista que atrapa la luz */}
      <path d={s.hombro} fill="none" stroke={`url(#hombro-${id})`} strokeWidth={1.6} strokeLinecap="round" />
      <path d={s.hombro} fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={1} transform="translate(0 3)" />

      {s.extra && <path d={s.extra} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={1.2} />}

      {/* Vidrio */}
      <path d={s.vidrio} fill={`url(#vidrio-${id})`} />
      <path d={s.vidrio} fill="none" stroke="#0b0a0d" strokeWidth={2} />
      {s.pilares.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0b0a0d" strokeWidth={5} />
      ))}
      {/* Destello en el vidrio */}
      <clipPath id={`vidrio-clip-${id}`}>
        <path d={s.vidrio} />
      </clipPath>
      <g clipPath={`url(#vidrio-clip-${id})`}>
        <path d="M150 90 L230 0 L262 0 L182 90 Z" fill="#fff" opacity={0.1} />
        <path d="M196 90 L276 0 L288 0 L208 90 Z" fill="#fff" opacity={0.07} />
      </g>

      {/* Juntas de puertas y estribo: lo que hace que se lea como lámina ensamblada */}
      <g clipPath={`url(#cuerpo-${id})`} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={1}>
        {s.pilares.slice(0, 1).map(([, , x2, y2], i) => (
          <path key={i} d={`M${x2} ${y2} L${x2 - 3} ${s.faldon - 7}`} />
        ))}
        <path d={`M${base.ruedas[1] - base.arco - 4} ${s.pilares[0][3] + 2} L${base.ruedas[1] - base.arco - 6} ${s.faldon - 8}`} />
        <path d={`M${base.ruedas[0] + base.arco} ${s.faldon - 7} L${base.ruedas[1] - base.arco} ${s.faldon - 7}`} strokeOpacity={0.3} />
      </g>
      <path
        d={`M${base.ruedas[0] + base.arco} ${s.faldon - 5.5} L${base.ruedas[1] - base.arco} ${s.faldon - 5.5}`}
        stroke="#fff"
        strokeOpacity={oscura ? 0.12 : 0.35}
        strokeWidth={1}
        clipPath={`url(#cuerpo-${id})`}
      />

      {/* Espejo y manijas */}
      <path d={s.espejo} fill={bajo} />
      {s.manijas.map(([x, y]) => (
        <rect key={x} x={x} y={y} width={16} height={3} rx={1.5} fill="#000" opacity={0.35} />
      ))}

      {/* Luces */}
      <path d={s.faro} fill="none" stroke="#fbf7ff" strokeWidth={3} strokeLinecap="round" />
      <path d={s.faro} fill="none" stroke="#e9d5ff" strokeWidth={7} strokeLinecap="round" opacity={0.45} filter={`url(#brillo-${id})`} />
      <path d={s.stop} fill="none" stroke="#be123c" strokeWidth={3.2} strokeLinecap="round" />
      </g>

      <g opacity={0.9}>
        <Rueda cx={r1} cy={s.ry} r={s.r} id={id} acento={acento} />
      </g>
      <Rueda cx={r2} cy={s.ry} r={s.r} id={id} acento={acento} />
    </svg>
  );
}

/**
 * El carro, en foto o render. `reflejo` añade el piso de estudio pulido
 * (referencia Porsche).
 */
export function CarRender({
  car,
  className = '',
  reflejo = false,
  prioridad = false,
  abajo = false,
  ajustado = false,
  vista = 'portada',
}: {
  car: CarLike;
  className?: string;
  reflejo?: boolean;
  prioridad?: boolean;
  /** Asienta la foto en la base de su caja (para que pise el piso, no flote). */
  abajo?: boolean;
  /** Render recortado al carro (sin margen): llena la caja como una foto recortada. */
  ajustado?: boolean;
  /** 'lado': solo la foto lateral (o el dibujo), para lo que se mide sobre el perfil. */
  vista?: 'portada' | 'lado';
}) {
  const foto = fotoDe(car, vista);
  const alt = `${car.brand ?? ''} ${car.model ?? ''}`.trim();

  const pieza = foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={foto}
      alt={alt}
      loading={prioridad ? 'eager' : 'lazy'}
      className={`block h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.28)] ${abajo ? 'object-bottom' : ''}`}
      draggable={false}
    />
  ) : (
    <RenderSvg car={car} ajustado={ajustado} className="block h-full w-full" />
  );

  if (!reflejo) return <div className={className}>{pieza}</div>;

  return (
    <div className={`relative ${className}`}>
      {pieza}
      <div className="carro-reflejo pointer-events-none absolute inset-x-0 top-full h-[38%] overflow-hidden" aria-hidden>
        <div className="h-full w-full -scale-y-100 opacity-[0.16] blur-[1px]">{pieza}</div>
      </div>
    </div>
  );
}
