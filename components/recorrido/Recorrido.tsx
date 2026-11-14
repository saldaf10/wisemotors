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
// entre páginas. El mensaje sale pegado a lo que señala (con una flecha) y lo
// señalado se marca con un aro morado que late; si no hay nada que señalar o
// no cabe al lado, va en la esquina. No oscurece la página. Al empezar un paso,
// si lo señalado está fuera de la pantalla, la lleva hasta allá una sola vez.
// Además de la URL, un paso avanza con una acción (`accion`: el afinador avisa
// con avisarRecorrido) o al llegar a una parte de la página (`alVer`). Al
// terminarlo (no al saltarlo) sale la encuesta (Encuesta.tsx).
//
// Sentido común (nov-2026): un paso que necesita una acción (buscar, entrar a
// un carro, ir a otra página, dar 2 me gusta) NO tiene "Siguiente": dice qué
// hacer (`requiere`) y se puede saltar el recorrido. Mientras la búsqueda carga,
// si no salió nada o las respuestas dejaron la lista vacía, el paso cambia de
// mensaje (`alternos`). Un paso que no aplica (sin pregunta para afinar, carro
// sin similares) se salta solo (`saltarSi`).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useFavorites } from '@/hooks/useFavorites';
import { X } from 'lucide-react';
import { pedirEncuesta } from './Encuesta';

const CLAVE_ESTADO = 'wm_recorrido'; // 'activo' | 'hecho'
const CLAVE_PASO = 'wm_recorrido_paso';

type Lugar = { path: string; params: URLSearchParams };
/** Lo que el recorrido mira de la página para decidir (se revisa cada medio segundo). */
interface Contexto {
  favoritos: number;
}
interface Alterno {
  si: (c: Contexto) => boolean;
  titulo: string;
  texto: string;
  objetivo?: string[];
  requiere?: string;
}
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
  /** Avanza cuando la página avisa esta acción (avisarRecorrido). */
  accion?: string;
  /** Avanza cuando este elemento aparece en pantalla (la persona bajó hasta allá). */
  alVer?: string;
  /** Botón para avanzar (si no avanza solo). */
  boton?: string;
  /** Sin esta acción no se puede seguir: en vez de "Siguiente" se dice qué hacer. */
  requiere?: string;
  /** Con `requiere`: cuándo ya se puede seguir (entonces sí sale el botón). */
  listo?: (c: Contexto) => boolean;
  /** Mensajes para cuando la página no está como el paso espera (cargando, sin resultados…). */
  alternos?: Alterno[];
  /** El paso no aplica aquí (ej. el carro no tiene similares): se salta solo. */
  saltarSi?: (c: Contexto) => boolean;
  /** A qué paso salta (por defecto, al siguiente). */
  saltarA?: number;
}

const enInicio = (l: Lugar) => l.path === '/';
const conBusqueda = (l: Lugar) => l.path === '/' && !!l.params.get('q');
const enFicha = (l: Lugar) => /^\/vehicles\/[^/]+$/.test(l.path);
const enComparacionDirecta = (l: Lugar) => l.path === '/compare' && l.params.has('ids');
const enComparar = (l: Lugar) => l.path === '/compare';
const enCatalogo = (l: Lugar) => l.path === '/vehicles';
const NAV = (href: string) => [`[data-recorrido="nav-${href}"]`, '[data-recorrido="menu"]'];
const hay = (selector: string) => typeof document !== 'undefined' && !!document.querySelector(selector);

// Estados de la búsqueda (app/(sitio)/page.tsx y ResultadosIA) que cambian lo que se puede hacer.
const BUSCANDO: Alterno = {
  si: () => hay('[data-recorrido="cargando"]'),
  titulo: 'Buscando tus carros…',
  texto: 'La IA está revisando el catálogo para lo que escribiste. Un momento.',
  requiere: 'Espera los resultados.',
};
const SIN_RESULTADOS: Alterno = {
  si: () => hay('[data-recorrido="sin-resultados"]'),
  titulo: 'No salió ningún carro',
  texto: 'Con esas palabras no encontramos carros. Prueba otra búsqueda arriba o toca una de las opciones que te proponemos.',
  objetivo: ['[data-recorrido="sin-resultados"]'],
  requiere: 'Busca otra vez para seguir.',
};
const SIN_COINCIDENCIAS: Alterno = {
  si: () => hay('[data-recorrido="sin-coincidencias"]'),
  titulo: 'No quedó ningún carro',
  texto: 'Con esas respuestas no queda ninguno. Quita una de arriba (la ×) y seguimos.',
  objetivo: ['[data-recorrido="afinador"]'],
  requiere: 'Quita una respuesta para seguir.',
};

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
    requiere: 'Escribe lo que buscas y toca la flecha (o una de las opciones).',
  },
  {
    titulo: 'Afina los resultados',
    texto: 'Responde la pregunta (por ejemplo, cuánto quieres gastar) y seguimos solos.',
    donde: conBusqueda,
    pista: 'Vuelve a tus resultados de búsqueda.',
    objetivo: ['[data-recorrido="afinador"]'],
    accion: 'afinador',
    avanzaCuando: enFicha,
    alternos: [BUSCANDO, SIN_RESULTADOS, SIN_COINCIDENCIAS],
    // Con pocos resultados no hay nada que afinar: directo a entrar a un carro.
    saltarSi: () => hay('[data-recorrido="resultados"]') && !hay('[data-recorrido="afinador"]'),
  },
  {
    titulo: 'Entra al panel dinámico',
    texto: '¡Listo! Ahora toca «Ir al panel dinámico» de tu mejor opción: ahí está toda su información.',
    donde: conBusqueda,
    pista: 'Vuelve a tus resultados y entra a un carro.',
    objetivo: ['[data-recorrido="panel-dinamico"]', '[data-recorrido="resultados"]'],
    avanzaCuando: enFicha,
    requiere: 'Toca «Ir al panel dinámico» para seguir.',
    alternos: [
      BUSCANDO,
      SIN_RESULTADOS,
      SIN_COINCIDENCIAS,
      {
        // Búsquedas como "con turbo": lista sin "mejor opción".
        si: () => hay('[data-recorrido="resultados"]') && !hay('[data-recorrido="panel-dinamico"]'),
        titulo: 'Entra a un carro',
        texto: 'Toca cualquiera de los carros de la lista para ver su panel dinámico: toda su información.',
        objetivo: ['[data-recorrido="resultados"]'],
        requiere: 'Toca un carro para seguir.',
      },
    ],
  },
  {
    titulo: 'Explora el carro a tu ritmo',
    texto: 'Baja por la ficha: fotos, desempeño, consumo, espacio, seguridad y tecnología. Cuando llegues a «Habla con quien lo vende», seguimos.',
    donde: enFicha,
    pista: 'Entra al panel dinámico de un carro.',
    alVer: '[data-recorrido="contacto"]',
    avanzaCuando: enComparacionDirecta,
  },
  {
    titulo: 'Compáralo con sus parecidos',
    texto: 'Toca «Comparar los 4 a la vez»: lo pones frente a sus 3 similares y ves en qué gana cada uno.',
    donde: enFicha,
    pista: 'Entra a un carro y baja hasta «Si te gusta este».',
    objetivo: ['[data-recorrido="comparar-todos"]', '[data-recorrido="similares"]'],
    avanzaCuando: enComparacionDirecta,
    requiere: 'Toca «Comparar los 4 a la vez» para seguir.',
    // Un carro sin similares no tiene esa comparación: se salta hasta ir al catálogo.
    saltarSi: () => hay('[data-recorrido="contacto"]') && !hay('[data-recorrido="comparar-todos"]'),
    saltarA: 7,
  },
  {
    titulo: 'Los 4, frente a frente',
    texto: 'Baja y mira en qué gana cada uno, pregunta por pregunta. Si quieres, toca un carro de aquí arriba para sacarlo o volverlo a meter.',
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
    requiere: 'Toca «Catálogo» para seguir.',
  },
  {
    titulo: 'Dale me gusta a tus favoritos',
    texto: 'Toca el corazón de al menos 2 carros que te llamen la atención: así luego los comparas. Si un carro viene en varias versiones, cámbiala con el selector amarillo: el me gusta es de la versión que estés viendo.',
    donde: enCatalogo,
    pista: 'Ve al catálogo y toca el corazón de los que te gusten.',
    objetivo: ['button[aria-label*="avoritos"]'],
    boton: 'Ya les di me gusta',
    // Con menos de 2 no hay nada que comparar en el paso siguiente.
    requiere: 'Dale corazón a al menos 2 carros para seguir.',
    listo: c => c.favoritos >= 2,
  },
  {
    titulo: 'Tus me gusta quedan en Comparar',
    texto: 'Todo lo que marques con el corazón se guarda en Comparar. Entra ahí para ponerlos frente a frente.',
    donde: l => !(enComparar(l) && !l.params.has('ids')),
    pista: 'Ve a Comparar.',
    objetivo: NAV('/compare'),
    avanzaCuando: l => enComparar(l) && !l.params.has('ids'),
    requiere: 'Toca «Comparar» para seguir.',
  },
  {
    titulo: 'Arma tu comparación',
    texto: 'Selecciona o deselecciona tus carros para personalizar la comparación: de 2 a 4 a la vez.',
    donde: l => enComparar(l) && !l.params.has('ids'),
    pista: 'Ve a Comparar.',
    objetivo: ['[data-recorrido="seleccion"]'],
    boton: 'Siguiente',
    alternos: [
      {
        si: c => c.favoritos < 2,
        titulo: 'Te falta un me gusta',
        texto: 'Para comparar necesitas al menos 2 carros con corazón. Ve al catálogo y dale corazón a otro.',
        objetivo: NAV('/vehicles'),
        requiere: 'Dale corazón a otro carro.',
      },
    ],
  },
  {
    titulo: 'Separa tu prueba de ruta',
    texto: 'Por último, escríbele al concesionario desde aquí abajo para agendar la prueba de ruta del que más te gustó.',
    donde: enComparar,
    pista: 'Ve a Comparar y baja hasta el final.',
    objetivo: ['[data-recorrido="prueba-ruta"]'],
    boton: 'Terminar',
    alternos: [
      {
        si: c => c.favoritos < 2,
        titulo: 'Te falta un me gusta',
        texto: 'Para comparar necesitas al menos 2 carros con corazón. Ve al catálogo y dale corazón a otro.',
        objetivo: NAV('/vehicles'),
        requiere: 'Dale corazón a otro carro.',
      },
    ],
  },
];

/** Avisa una acción de la página (ej. 'afinador'): si el paso actual la espera, avanza. */
export function avisarRecorrido(accion: string) {
  try {
    window.dispatchEvent(new CustomEvent('wm-recorrido-accion', { detail: accion }));
  } catch {}
}

/** ¿Se ve casi todo el elemento? (debajo del menú fijo y encima del borde de abajo). */
function enPantalla(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const alto = Math.min(r.height, window.innerHeight - 140);
  const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 80);
  return visible >= alto * 0.7;
}

/** Lleva la pantalla hasta el elemento (centrado). Si el desplazamiento suave no arranca, salta. */
function llevarA(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const y = Math.max(0, window.scrollY + r.top - Math.max(90, (window.innerHeight - r.height) / 2));
  window.scrollTo({ top: y, behavior: 'smooth' });
  // Si no llegó (o la página se desplazó por su cuenta justo después, como al cargar resultados), insiste.
  for (const ms of [1000, 2200]) {
    setTimeout(() => {
      if (el.isConnected && !enPantalla(el)) {
        const r2 = el.getBoundingClientRect();
        window.scrollTo({ top: Math.max(0, window.scrollY + r2.top - Math.max(90, (window.innerHeight - r2.height) / 2)) });
      }
    }, ms);
  }
}

/**
 * Al iniciar sesión: las cuentas de prueba (`recorridoSiempre`) arrancan el recorrido desde el
 * paso 1 y con la encuesta otra vez pendiente. Devuelve true si lo arrancó (hay que ir al inicio).
 */
export function recorridoAlIngresar(user: { recorridoSiempre?: boolean } | null | undefined): boolean {
  if (!user?.recorridoSiempre) return false;
  try {
    localStorage.removeItem('wm_encuesta');
  } catch {}
  iniciarRecorrido(true);
  return true;
}

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
  const tarjeta = useRef<HTMLDivElement>(null);
  const flecha = useRef<HTMLSpanElement>(null);
  const llevado = useRef<number | null>(null);

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

  /** Pasa al siguiente paso desde `desde` (si sigue siendo el actual). */
  const avanzarDesde = useCallback((desde: number) => {
    setPaso(p => {
      if (p !== desde) return p;
      const n = desde + 1;
      if (n >= PASOS.length) {
        guardarPaso('hecho');
        pedirEncuesta();
        return null;
      }
      guardarPaso(n);
      return n;
    });
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

  // La página cambia sin cambiar de URL (carga la búsqueda, se da un me gusta…): se revisa seguido.
  const { favorites } = useFavorites();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!actual || !aqui) return;
    const t = setInterval(() => setTick(x => x + 1), 500);
    return () => clearInterval(t);
  }, [actual, aqui]);
  const contexto: Contexto = { favoritos: favorites.length };
  // Lo que se muestra: el paso, o su mensaje alterno si la página no está como el paso espera.
  const alterno = actual && aqui ? actual.alternos?.find(a => a.si(contexto)) : undefined;
  const vista = actual ? { ...actual, ...(alterno ?? {}), requiere: alterno ? alterno.requiere : actual.requiere } : null;
  const objetivo = alterno ? alterno.objetivo : actual?.objetivo;
  const claveObjetivo = (objetivo ?? []).join('|');
  const puedeSeguir = !vista?.requiere || (!alterno && !!actual?.listo?.(contexto));

  // Un paso que no aplica aquí se salta solo.
  const debeSaltar = !!(actual && aqui && paso !== null && actual.saltarSi?.(contexto));
  // Espera un momento y vuelve a mirar: la página puede estar armándose (resultados que llegan por partes).
  const contextoRef = useRef(contexto);
  contextoRef.current = contexto;
  useEffect(() => {
    if (!debeSaltar || paso === null || !actual) return;
    const t = setTimeout(() => {
      if (!actual.saltarSi?.(contextoRef.current)) return;
      const destino = actual.saltarA ?? paso + 1;
      setPaso(p => {
        if (p !== paso) return p;
        guardarPaso(destino);
        return destino;
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [debeSaltar, paso, actual]);

  // Una acción de la página (el afinador) cumple el paso que la espera.
  useEffect(() => {
    if (paso === null || !actual?.accion || !aqui) return;
    const escuchar = (e: Event) => {
      if ((e as CustomEvent).detail === actual.accion) avanzarDesde(paso);
    };
    window.addEventListener('wm-recorrido-accion', escuchar);
    return () => window.removeEventListener('wm-recorrido-accion', escuchar);
  }, [paso, actual, aqui, avanzarDesde]);

  // Llegar a una parte de la página (bajar hasta el concesionario) cumple el paso.
  useEffect(() => {
    if (paso === null || !actual?.alVer || !aqui) return;
    const t = setInterval(() => {
      const el = document.querySelector<HTMLElement>(actual.alVer!);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.75 && r.bottom > 0) avanzarDesde(paso);
    }, 300);
    return () => clearInterval(t);
  }, [paso, actual, aqui, avanzarDesde]);

  // Aro sobre lo que señala el paso (una clase en el propio elemento: se mueve con él). Al empezar
  // el paso, si está fuera de la pantalla, la lleva hasta allá una vez. Si aparece tarde, se busca otra vez.
  useEffect(() => {
    if (!actual || !aqui || !objetivo) return;
    let marcado: HTMLElement | null = null;
    let vistoEn = 0;
    const marcar = () => {
      const el = buscarObjetivo(objetivo);
      // Espera un momento desde que aparece: la página puede estar desplazándose sola (los resultados).
      if (el && llevado.current !== paso) {
        if (!vistoEn) vistoEn = Date.now();
        else if (Date.now() - vistoEn > 500) {
          llevado.current = paso;
          if (!enPantalla(el)) llevarA(el);
        }
      }
      if (el === marcado) return;
      marcado?.classList.remove('recorrido-brillo');
      marcado = el;
      el?.classList.add('recorrido-brillo');
    };
    marcar();
    const t = setInterval(marcar, 350);
    return () => {
      clearInterval(t);
      marcado?.classList.remove('recorrido-brillo');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, aqui, paso, lugar?.path, claveObjetivo]);

  // El mensaje se pega a lo que señala: debajo si cabe, si no encima, con la flecha apuntándole.
  // Se mueve con la página (cada cuadro, sin animación: se siente pegado, no persiguiendo).
  // Si no hay qué señalar, no se ve o no cabe al lado, va en la esquina.
  useEffect(() => {
    if (!actual || !aqui) return;
    let cuadro = 0;
    const ubicar = () => {
      const c = tarjeta.current;
      const f = flecha.current;
      const el = objetivo ? buscarObjetivo(objetivo) : null;
      let anclado = false;
      if (c && el) {
        const r = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const ancho = Math.min(380, vw - 24);
        c.style.width = `${ancho}px`;
        const alto = c.offsetHeight;
        const gap = 16;
        const arriba = 76; // debajo del menú fijo
        const visible = r.bottom > arriba && r.top < vh - 24;
        let top: number | null = null;
        let lado: 'abajo' | 'arriba' = 'abajo';
        if (visible && r.bottom + gap + alto <= vh - 12) top = r.bottom + gap;
        else if (visible && r.top - gap - alto >= arriba) {
          top = r.top - gap - alto;
          lado = 'arriba';
        }
        if (top !== null) {
          const centro = r.left + r.width / 2;
          const left = Math.max(12, Math.min(centro - ancho / 2, vw - ancho - 12));
          Object.assign(c.style, { top: `${top}px`, left: `${left}px`, right: 'auto', bottom: 'auto' });
          c.dataset.anclado = lado;
          if (f) f.style.left = `${Math.max(22, Math.min(centro - left, ancho - 22)) - 8}px`;
          anclado = true;
        }
      }
      if (c && !anclado) {
        Object.assign(c.style, { top: '', left: '', right: '', bottom: '', width: '' });
        delete c.dataset.anclado;
      }
      cuadro = requestAnimationFrame(ubicar);
    };
    cuadro = requestAnimationFrame(ubicar);
    return () => cancelAnimationFrame(cuadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, aqui, paso, claveObjetivo]);

  // Mientras crea la cuenta o inicia sesión, el recorrido espera (arranca al volver al inicio).
  if (!actual || !lugar || lugar.path === '/register' || lugar.path === '/login') return null;

  const avanzar = () => avanzarDesde(paso!);
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

  return (
    <div
      ref={tarjeta}
      key={paso}
      role="dialog"
      aria-label={vista!.titulo}
      className="recorrido-tarjeta sube fixed bottom-4 left-4 right-4 z-[95] mx-auto max-w-[400px] rounded-[24px] bg-tinta p-5 text-white shadow-[0_24px_60px_-16px_rgba(14,12,17,0.6)] sm:left-auto sm:right-6 sm:mx-0 sm:w-[380px]"
    >
      {/* Flecha hacia lo señalado (solo cuando el mensaje está pegado a algo). */}
      <span ref={flecha} aria-hidden className="recorrido-flecha absolute hidden h-4 w-4 rotate-45 bg-tinta" />
      <div className="flex items-start justify-between gap-3">
        <p className="t-meta text-wise-lila">{numero}</p>
        <button onClick={saltar} aria-label="Salir del recorrido" className="-m-1 rounded-full p-1 text-white/50 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-[19px] font-semibold leading-tight tracking-[-0.03em]">{vista!.titulo}</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-white/75">{vista!.texto}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button onClick={saltar} className="text-[13px] text-white/55 hover:text-white">
          Saltar recorrido
        </button>
        {/* Si el paso necesita una acción, no hay "Siguiente": se dice qué hacer (o se salta el recorrido). */}
        {puedeSeguir ? (
          <button onClick={avanzar} className="pastilla pastilla--wise h-10 px-5 text-[14px]">
            {actual.boton ?? 'Siguiente'}
          </button>
        ) : (
          <p className="max-w-[58%] text-right text-[13px] font-medium leading-snug text-wise-lila">{vista!.requiere}</p>
        )}
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
