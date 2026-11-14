'use client';

// ============================================================================
// Recorrido guiado para las primeras personas que entran con el código de
// acceso. Arranca solo al entrar con el código (FormularioEspera →
// iniciarRecorrido) y se puede repetir desde el pie de página.
//
// Cada paso dice en qué página va (`donde`), qué resaltar (`objetivo`: un
// selector [data-recorrido=…]) y, si la acción de la persona lo cumple, cuándo
// avanza solo (`avanzaCuando`: buscar, entrar a un carro, comparar…); igual
// siempre hay un botón para seguir. El paso vive en localStorage para seguir
// entre páginas. Es un mensaje emergente en la esquina con un brillo suave en
// lo que menciona: no oscurece, no desplaza ni persigue nada. Al terminarlo
// (no al saltarlo) sale la encuesta (Encuesta.tsx).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { pedirEncuesta } from './Encuesta';

const CLAVE_ESTADO = 'wm_recorrido'; // 'activo' | 'hecho'
const CLAVE_PASO = 'wm_recorrido_paso';

type Lugar = { path: string; params: URLSearchParams };
interface Paso {
  titulo: string;
  texto: string;
  /** Página donde se muestra este paso. */
  donde: (l: Lugar) => boolean;
  /** Qué hacer para llegar si la persona está en otra página. */
  pista: string;
  /** Selectores a resaltar, en orden de preferencia. */
  objetivo?: string[];
  /** La acción que lo cumple: al pasar, avanza solo. */
  avanzaCuando?: (l: Lugar) => boolean;
  /** Botón para avanzar (si no avanza solo). */
  boton?: string;
}

const enInicio = (l: Lugar) => l.path === '/';
const conBusqueda = (l: Lugar) => l.path === '/' && !!l.params.get('q');
const enFicha = (l: Lugar) => /^\/vehicles\/[^/]+$/.test(l.path);
const enComparacionDirecta = (l: Lugar) => l.path === '/compare' && l.params.has('ids');
const enComparar = (l: Lugar) => l.path === '/compare';
const enCatalogo = (l: Lugar) => l.path === '/vehicles';
const NAV = (href: string) => [`[data-recorrido="nav-${href}"]`, '[data-recorrido="menu"]'];

const PASOS: Paso[] = [
  {
    titulo: 'Empecemos',
    texto: 'En un minuto te mostramos cómo encontrar tu carro: buscar, comparar y separar la prueba de ruta.',
    donde: enInicio,
    pista: 'Ve al inicio para empezar.',
    boton: 'Empezar',
  },
  {
    titulo: 'Cuéntale a la IA qué buscas',
    texto: 'Escribe cómo vives o qué necesitas, con tus palabras. Por ejemplo: «una camioneta para la familia que gaste poco».',
    donde: l => enInicio(l) && !l.params.get('q'),
    pista: 'Ve al inicio y usa el buscador.',
    objetivo: ['[data-recorrido="buscador"]'],
    avanzaCuando: conBusqueda,
  },
  {
    titulo: 'Ajusta tu presupuesto',
    texto: 'Con estos botones afinas los resultados: el presupuesto, el tipo de motor y más. Toca los que apliquen para ti.',
    donde: conBusqueda,
    pista: 'Vuelve a tus resultados de búsqueda.',
    objetivo: ['[data-recorrido="afinador"]'],
    boton: 'Siguiente',
    avanzaCuando: enFicha,
  },
  {
    titulo: 'Entra al panel dinámico',
    texto: 'Toca «Ir al panel dinámico» del carro que más te llame la atención para ver toda su información.',
    donde: conBusqueda,
    pista: 'Vuelve a tus resultados y entra a un carro.',
    objetivo: ['[data-recorrido="resultados"]'],
    avanzaCuando: enFicha,
  },
  {
    titulo: 'Explora el carro a tu ritmo',
    texto: 'Baja por la ficha o salta a la categoría que más te importe: desempeño, espacio, seguridad, consumo o tecnología. Cuando quieras, toca Siguiente.',
    donde: enFicha,
    pista: 'Entra al panel dinámico de un carro.',
    boton: 'Siguiente',
    avanzaCuando: enComparacionDirecta,
  },
  {
    titulo: 'Compáralo antes de probarlo',
    texto: 'Antes de programar la prueba de ruta, baja hasta «Si te gusta este»: ponlo cara a cara con uno parecido, o toca «Comparar los 4 a la vez» para verlo junto a los similares.',
    donde: enFicha,
    pista: 'Entra a un carro y baja hasta «Si te gusta este».',
    avanzaCuando: enComparacionDirecta,
  },
  {
    titulo: 'Cara a cara',
    texto: 'Aquí ves en qué gana cada uno, pregunta por pregunta. Toca un carro de arriba para sacarlo o volverlo a meter.',
    donde: enComparacionDirecta,
    pista: 'Abre una comparación desde la ficha de un carro.',
    objetivo: ['[data-recorrido="seleccion"]'],
    boton: 'Siguiente',
    avanzaCuando: enCatalogo,
  },
  {
    titulo: 'Ahora ve al catálogo',
    texto: 'Mira todos los carros, pasa sus fotos con las flechas y guarda los que te gusten.',
    donde: l => !enCatalogo(l),
    pista: 'Ve al catálogo.',
    objetivo: NAV('/vehicles'),
    avanzaCuando: enCatalogo,
  },
  {
    titulo: 'Dale me gusta a tus favoritos',
    texto: 'Toca el corazón de los carros que más te llamen la atención. Si un carro viene en varias versiones, cámbiala con el selector amarillo: el me gusta es de la versión que estés viendo.',
    donde: enCatalogo,
    pista: 'Ve al catálogo y toca el corazón de los que te gusten.',
    objetivo: ['button[aria-label*="avoritos"]'],
    boton: 'Ya les di me gusta',
  },
  {
    titulo: 'Tus me gusta quedan en Comparar',
    texto: 'Todo lo que marques con el corazón se guarda en Comparar. Entra ahí para ponerlos frente a frente.',
    donde: l => !(enComparar(l) && !l.params.has('ids')),
    pista: 'Ve a Comparar.',
    objetivo: NAV('/compare'),
    avanzaCuando: l => enComparar(l) && !l.params.has('ids'),
  },
  {
    titulo: 'Arma tu comparación',
    texto: 'Selecciona o deselecciona tus carros para personalizar la comparación: de 2 a 4 a la vez.',
    donde: l => enComparar(l) && !l.params.has('ids'),
    pista: 'Ve a Comparar.',
    objetivo: ['[data-recorrido="seleccion"]'],
    boton: 'Siguiente',
  },
  {
    titulo: 'Separa tu prueba de ruta',
    texto: 'Por último, escríbele al concesionario desde aquí abajo para agendar la prueba de ruta del que más te gustó.',
    donde: enComparar,
    pista: 'Ve a Comparar y baja hasta el final.',
    objetivo: ['[data-recorrido="prueba-ruta"]'],
    boton: 'Terminar',
  },
];

/** Arranca el recorrido (al entrar con el código, o desde el pie de página). */
export function iniciarRecorrido(forzar = false) {
  try {
    if (!forzar && localStorage.getItem(CLAVE_ESTADO) === 'hecho') return;
    localStorage.setItem(CLAVE_ESTADO, 'activo');
    localStorage.setItem(CLAVE_PASO, '0');
    window.dispatchEvent(new Event('wm-recorrido'));
  } catch {}
}

function leerPaso(): number | null {
  try {
    if (localStorage.getItem(CLAVE_ESTADO) !== 'activo') return null;
    const n = Number(localStorage.getItem(CLAVE_PASO) ?? '0');
    return Number.isInteger(n) && n >= 0 && n < PASOS.length ? n : 0;
  } catch {
    return null;
  }
}

function guardarPaso(n: number | 'hecho') {
  try {
    if (n === 'hecho') {
      localStorage.setItem(CLAVE_ESTADO, 'hecho');
      localStorage.removeItem(CLAVE_PASO);
    } else localStorage.setItem(CLAVE_PASO, String(n));
  } catch {}
}

function lugarActual(): Lugar {
  return { path: window.location.pathname, params: new URLSearchParams(window.location.search) };
}

function buscarObjetivo(selectores?: string[]): HTMLElement | null {
  for (const s of selectores ?? []) {
    const els = Array.from(document.querySelectorAll<HTMLElement>(s));
    const visible = els.find(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
    if (visible) return visible;
  }
  return null;
}

export function Recorrido() {
  const pathname = usePathname();
  const [paso, setPaso] = useState<number | null>(null);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const ultimaUrl = useRef('');

  // Paso guardado + dónde está la persona (cambia de página, o la URL con ?q=).
  // La URL vista se guarda en una ref: guardarla en el estado volvía a disparar el efecto sin fin.
  const sincronizar = useCallback(() => {
    const l = lugarActual();
    const url = l.path + '?' + l.params.toString();
    if (url !== ultimaUrl.current) {
      ultimaUrl.current = url;
      setLugar(l);
    }
    let n = leerPaso();
    // Avanza solo los pasos que la acción de la persona ya cumplió.
    while (n !== null && n < PASOS.length && PASOS[n].avanzaCuando?.(l)) n++;
    if (n !== null && n >= PASOS.length) {
      guardarPaso('hecho');
      pedirEncuesta();
      n = null;
    } else if (n !== null) guardarPaso(n);
    setPaso(p => (p === n ? p : n));
  }, []);

  useEffect(() => {
    sincronizar();
    // La búsqueda cambia ?q= sin cambiar la ruta: se revisa también cada medio segundo.
    const t = setInterval(() => {
      const l = lugarActual();
      if (l.path + '?' + l.params.toString() !== ultimaUrl.current) sincronizar();
    }, 500);
    window.addEventListener('wm-recorrido', sincronizar);
    window.addEventListener('popstate', sincronizar);
    return () => {
      clearInterval(t);
      window.removeEventListener('wm-recorrido', sincronizar);
      window.removeEventListener('popstate', sincronizar);
    };
  }, [pathname, sincronizar]);

  const actual = paso !== null ? PASOS[paso] : null;
  const aqui = !!(actual && lugar && actual.donde(lugar));

  // Brillo suave sobre el elemento del que habla el paso: una clase en el propio elemento
  // (se mueve con él), sin oscurecer la página ni desplazarla. Si aparece tarde, se busca otra vez.
  useEffect(() => {
    if (!actual || !aqui || !actual.objetivo) return;
    let marcado: HTMLElement | null = null;
    const marcar = () => {
      const el = buscarObjetivo(actual.objetivo);
      if (el === marcado) return;
      marcado?.classList.remove('recorrido-brillo');
      marcado = el;
      el?.classList.add('recorrido-brillo');
    };
    marcar();
    const t = setInterval(marcar, 700);
    return () => {
      clearInterval(t);
      marcado?.classList.remove('recorrido-brillo');
    };
  }, [actual, aqui, paso, lugar?.path]);

  // Mientras crea la cuenta o inicia sesión, el recorrido espera (arranca al volver al inicio).
  if (!actual || !lugar || lugar.path === '/register' || lugar.path === '/login') return null;

  const avanzar = () => {
    const n = (paso ?? 0) + 1;
    if (n >= PASOS.length) {
      guardarPaso('hecho');
      setPaso(null);
      pedirEncuesta();
    } else {
      guardarPaso(n);
      setPaso(n);
    }
  };
  const saltar = () => {
    guardarPaso('hecho');
    setPaso(null);
  };

  const numero = `Paso ${paso! + 1} de ${PASOS.length}`;

  // Fuera de su página: un aviso pequeño con la pista.
  if (!aqui) {
    return (
      <div className="fixed bottom-4 left-1/2 z-[95] flex w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 items-center gap-3 rounded-full bg-tinta px-5 py-3 text-[13.5px] text-white shadow-2xl">
        <span className="t-meta shrink-0 text-wise-lila">{numero}</span>
        <span className="min-w-0 flex-1 truncate">{actual.pista}</span>
        <button onClick={saltar} className="shrink-0 text-white/60 hover:text-white">
          Saltar
        </button>
      </div>
    );
  }

  // Un mensaje emergente en la esquina: la persona sigue usando la página con libertad.
  return (
    <div
      key={paso}
      role="dialog"
      aria-label={actual.titulo}
      className="sube fixed bottom-4 left-4 right-4 z-[95] mx-auto max-w-[400px] rounded-[24px] bg-blanco p-5 shadow-[0_24px_60px_-20px_rgba(14,12,17,0.55)] ring-1 ring-black/5 sm:left-auto sm:right-6 sm:mx-0 sm:w-[380px]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="t-meta text-wise">{numero}</p>
        <button onClick={saltar} aria-label="Salir del recorrido" className="-m-1 rounded-full p-1 text-tinta-2 hover:text-tinta">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-[19px] font-semibold leading-tight tracking-[-0.03em]">{actual.titulo}</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-tinta-2">{actual.texto}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button onClick={saltar} className="text-[13px] text-tinta-2 hover:text-tinta">
          Saltar recorrido
        </button>
        {/* Siempre se puede seguir: si la persona hace la acción, avanza solo. */}
        <button onClick={avanzar} className="pastilla pastilla--wise h-10 px-5 text-[14px]">
          {actual.boton ?? 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

/** Enlace para repetir el recorrido (pie de página). */
export function RepetirRecorrido({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        iniciarRecorrido(true);
        if (window.location.pathname !== '/') window.location.href = '/';
      }}
    >
      Hacer el recorrido guiado
    </button>
  );
}
