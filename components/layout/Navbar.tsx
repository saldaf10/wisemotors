'use client';

// ============================================================================
// Navegación en Liquid Glass.
//
// Tres cápsulas de vidrio flotando: logo, pestañas y acciones. El vidrio
// refracta lo que pasa por detrás (filtro SVG en Chromium, desenfoque en el
// resto). La pestaña activa es un lente líquido que viaja con rebote y se
// estira en el camino; al pasar el mouse sobre otra pestaña, el lente la
// visita. Sobre el showroom oscuro de la home el vidrio es oscuro.
// ============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Heart, LogOut, Menu, Search, Sparkles, User, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Logo } from '@/components/brand/Logo';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { isFullyAuthorized } = useAdmin();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [bajo, setBajo] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLElement>(null);
  const pestanas = useRef<(HTMLAnchorElement | null)[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [lente, setLente] = useState<{ x: number; w: number } | null>(null);
  const [viaje, setViaje] = useState(0);

  // Cerrar el menú de usuario al hacer clic afuera o con Escape
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        // En la home, el hero ocupa ~una pantalla: la barra se aclara al salir de él.
        setBajo(window.scrollY > (pathname === '/' ? window.innerHeight * 0.82 : 8));
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    setAbierto(false);
    setMenu(false);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierto]);

  const oscuro = pathname === '/' && !bajo;

  const enlaces = [
    { href: '/', texto: 'Inicio' },
    { href: '/vehicles', texto: 'Catálogo' },
    { href: '/compare', texto: 'Comparar' },
    { href: '/concesionarios', texto: 'Concesionarios' },
  ];

  const activo = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const indiceActivo = enlaces.findIndex(e => activo(e.href));
  const destino = hover ?? (indiceActivo >= 0 ? indiceActivo : null);

  // El lente se mide contra la pestaña destino (hover o activa) y viaja hasta ella.
  useEffect(() => {
    const medir = () => {
      const el = destino !== null ? pestanas.current[destino] : null;
      if (!el) return setLente(null);
      setLente({ x: el.offsetLeft, w: el.offsetWidth });
    };
    medir();
    setViaje(v => v + 1);
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [destino]);

  const salir = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <>
      {/* Filtros de refracción del vidrio: ruido suave que desplaza lo que hay detrás */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <filter id="vidrio-liquido" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="7" result="ruido" />
          <feGaussianBlur in="ruido" stdDeviation="2.5" result="suave" />
          <feDisplacementMap in="SourceGraphic" in2="suave" scale="55" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="lente-liquido" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="1" seed="3" result="ruido" />
          <feGaussianBlur in="ruido" stdDeviation="1.5" result="suave" />
          <feDisplacementMap in="SourceGraphic" in2="suave" scale="28" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-3 md:pt-4">
        <div className="relative mx-auto flex max-w-[1440px] items-center gap-3 px-3 md:px-8">
          {/* Cápsula 1: logo */}
          <Link
            href="/"
            aria-label="WiseMotors, inicio"
            className={`vidrio pointer-events-auto flex h-[52px] shrink-0 items-center px-5 ${oscuro ? 'vidrio--oscuro' : ''}`}
          >
            <Logo oscuro={oscuro} />
          </Link>

          {/* Cápsula 2: pestañas con lente líquido */}
          <nav
            ref={barra}
            aria-label="Principal"
            onMouseLeave={() => setHover(null)}
            className={`vidrio pointer-events-auto !absolute left-1/2 hidden h-[52px] -translate-x-1/2 items-center p-[6px] lg:flex ${oscuro ? 'vidrio--oscuro' : ''}`}
          >
            {lente && (
              <span
                key={viaje}
                aria-hidden
                className="lente lente--viaje"
                style={{ width: lente.w, transform: `translateX(${lente.x}px)` }}
              />
            )}
            {enlaces.map((e, i) => {
              const on = activo(e.href);
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  ref={el => {
                    pestanas.current[i] = el;
                  }}
                  onMouseEnter={() => setHover(i)}
                  aria-current={on ? 'page' : undefined}
                  className="pestana"
                  data-on={on}
                >
                  <span className="pestana__punto" aria-hidden />
                  {e.texto}
                </Link>
              );
            })}
          </nav>

          {/* Cápsula 3: acciones */}
          <div
            className={`vidrio pointer-events-auto ml-auto hidden h-[52px] items-center gap-1 p-[6px] lg:flex ${oscuro ? 'vidrio--oscuro' : ''}`}
          >
            <Link href="/vehicles" aria-label="Buscar en el catálogo" className="boton-vidrio w-10">
              <Search className="h-4 w-4" />
            </Link>

            {isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-haspopup="menu" className="boton-vidrio pl-1 pr-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wise text-[12px] font-semibold uppercase text-white">
                    {user?.username?.charAt(0) ?? <User className="h-4 w-4" />}
                  </span>
                  {user?.username}
                </button>
                {menu && (
                  <div role="menu" className="menu-usuario vidrio absolute right-0 top-[calc(100%+12px)] w-56 !rounded-[22px] p-2 text-tinta">
                    {[
                      { href: '/favorites', texto: 'Favoritos', icono: Heart },
                      ...(isFullyAuthorized
                        ? [
                            { href: '/admin/ingest', texto: 'Subir carro', icono: Sparkles },
                            { href: '/admin', texto: 'Panel', icono: User },
                          ]
                        : []),
                    ].map(o => (
                      <Link key={o.href} href={o.href} role="menuitem" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] hover:bg-white/70">
                        <o.icono className="h-4 w-4 text-tinta-2" /> {o.texto}
                      </Link>
                    ))}
                    <button role="menuitem" onClick={salir} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[14px] hover:bg-white/70">
                      <LogOut className="h-4 w-4 text-tinta-2" /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="boton-vidrio px-4">
                  Ingresar
                </Link>
                <Link href="/register" className="boton-vidrio bg-wise px-4 text-white hover:!bg-wise-profundo">
                  Crear cuenta <ArrowUpRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setAbierto(true)}
            className={`vidrio pointer-events-auto ml-auto flex h-[52px] w-[52px] items-center justify-center lg:hidden ${oscuro ? 'vidrio--oscuro' : ''}`}
            aria-label="Abrir menú"
            aria-expanded={abierto}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Menú móvil: pantalla completa, destinos grandes */}
      {abierto && (
        <div className="menu-movil fixed inset-0 z-[60] flex flex-col bg-showroom px-5 pb-8 pt-5 text-white lg:hidden">
          <div className="flex items-center justify-between">
            <Logo oscuro />
            <button onClick={() => setAbierto(false)} className="flecha h-11 w-11 !border-white/20 !bg-white/5 !text-white" aria-label="Cerrar menú">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-14 flex flex-col" aria-label="Principal">
            {[
              ...enlaces,
              ...(isAuthenticated ? [{ href: '/favorites', texto: 'Favoritos' }] : []),
              ...(isFullyAuthorized ? [{ href: '/admin/ingest', texto: 'Subir carro' }, { href: '/admin', texto: 'Panel' }] : []),
            ].map(
              (e, i) => (
                <Link
                  key={e.href}
                  href={e.href}
                  className="sube flex items-center justify-between border-b border-white/10 py-4 text-[40px] font-semibold tracking-[-0.04em]"
                  style={{ '--d': `${60 + i * 50}ms` } as React.CSSProperties}
                >
                  <span className={activo(e.href) ? 'text-wise-lila' : ''}>{e.texto}</span>
                  <ArrowUpRight className="h-7 w-7 text-white/40" />
                </Link>
              )
            )}
          </nav>

          <div className="mt-auto flex gap-3">
            {isAuthenticated ? (
              <button onClick={salir} className="pastilla pastilla--oscura h-12 flex-1 justify-center">
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            ) : (
              <>
                <Link href="/login" className="pastilla pastilla--oscura h-12 flex-1 justify-center">
                  Ingresar
                </Link>
                <Link href="/register" className="pastilla pastilla--wise h-12 flex-1 justify-center">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* La home arranca debajo de la barra (su hero la rellena); el resto necesita el espacio */}
      {pathname !== '/' && <div className="h-[84px] md:h-[92px]" aria-hidden />}
    </>
  );
}
