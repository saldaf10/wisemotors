'use client';

// ============================================================================
// Mientras el sitio está cerrado (se entra con el código de acceso), tener
// cuenta es obligatorio: sin sesión, cualquier página del sitio manda a crear
// la cuenta (o a ingresar, si la persona acaba de cerrar sesión) y vuelve a
// donde iba. Solo /register y /login quedan libres. Con SITIO_ABIERTO=1 no
// aplica: el sitio abierto se puede ver sin cuenta.
// La sesión vive en el navegador (AuthContext), así que el control es aquí y
// no en el middleware.
// ============================================================================

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const LIBRES = ['/register', '/login'];

export function ExigirCuenta({ activo, children }: { activo: boolean; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const tuvoSesion = useRef(false);
  if (user) tuvoSesion.current = true;

  const falta = activo && !loading && !user && !LIBRES.includes(pathname);

  useEffect(() => {
    if (!falta) return;
    const destino = encodeURIComponent(window.location.pathname + window.location.search);
    // Quien cerró sesión ya tiene cuenta: va a ingresar. Los demás, a crearla.
    window.location.replace(`${tuvoSesion.current ? '/login' : '/register'}?next=${destino}`);
  }, [falta]);

  // Mientras redirige no se muestra la página.
  if (falta) return <div className="min-h-screen bg-papel" aria-hidden />;
  return <>{children}</>;
}
