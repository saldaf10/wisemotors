'use client';

// ============================================================================
// Bienvenida por invitación (nov-2026). Mientras el sitio está cerrado, es lo
// primero (y lo único) que ve quien entra a wisemotors.co sin acceso.
//
// Dos caminos: "Tengo una invitación" (crear cuenta con el código) y "Ya tengo
// cuenta" (ingresar). Al crear la cuenta hay un momento de bienvenida (sin género: "Ya estás adentro, Laura.")
// —"Invitación #037 de 100"— y de ahí arranca el recorrido guiado. Un enlace
// con ?codigo=WISE-XXXXXX llega con el código ya escrito.
// ============================================================================

import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Search, Scale, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CarRender } from '@/components/car/CarRender';
import { Logo, LogoMarca } from '@/components/brand/Logo';
import { iniciarRecorrido } from '@/components/recorrido/Recorrido';
import { destinoSeguro } from '@/lib/destino';

const CORREO_DATOS = 'hola@wisemotors.co';

// Los mismos carros dibujados del inicio, rotando detrás.
const VITRINA = [
  { id: 'b-suv', brand: 'Exhibicion', model: 'suv familiar', type: 'SUV', fuelType: 'Híbrido' },
  { id: 'b-sedan', brand: 'Exhibicion', model: 'sedan ejecutivo', type: 'Sedán', fuelType: 'Gasolina' },
  { id: 'b-hatch', brand: 'Exhibicion', model: 'hatch urbano', type: 'Hatchback', fuelType: 'Eléctrico' },
  { id: 'b-pickup', brand: 'Exhibicion', model: 'pickup finca', type: 'Pickup', fuelType: 'Diesel' },
];

type Modo = 'crear' | 'ingresar';
interface Bienvenido {
  nombre: string;
  invitacion: number | null;
  de: number | null;
}

const campo =
  'h-12 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-white/40 outline-none transition focus:border-wise-lila/70 focus:bg-white/[0.09]';

/** A dónde ir después de ingresar: ?next=, o la página que pidió (la URL se conserva), o el inicio. */
function destinoAlIngresar(): string {
  const q = new URLSearchParams(window.location.search);
  const next = q.get('next');
  if (next) return destinoSeguro(next);
  const ruta = window.location.pathname;
  if (ruta === '/bienvenida') return '/';
  q.delete('modo');
  q.delete('codigo');
  const resto = q.toString();
  return destinoSeguro(ruta + (resto ? `?${resto}` : ''));
}

function Ceremonia({ b }: { b: Bienvenido }) {
  const empezar = () => {
    iniciarRecorrido(true);
    window.location.href = '/';
  };
  const numero = b.invitacion !== null ? String(b.invitacion).padStart(3, '0') : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-clip bg-showroom px-5 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bienvenida-halo absolute left-1/2 top-1/2 h-[80vmax] w-[80vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(136,28,183,0.45),transparent)]" />
      </div>
      <div className="relative w-full max-w-[560px] text-center">
        <div className="sube mx-auto w-[88px]" style={{ '--d': '0ms' } as React.CSSProperties}>
          <LogoMarca className="h-auto w-full" tono="blanco" />
        </div>
        <p className="sube mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-wise-lila" style={{ '--d': '250ms' } as React.CSSProperties}>
          {numero ? `Invitación #${numero}${b.de ? ` de ${b.de}` : ''}` : 'Equipo WiseMotors'}
        </p>
        <h1 className="t-titulo mt-4 text-[44px] leading-[0.95] md:text-[68px]">
          {`Ya estás adentro${b.nombre ? `, ${b.nombre}` : ''}.`.split(' ').map((palabra, i) => (
            <span key={i} className="letra-sube mr-[0.25em] inline-block">
              <span style={{ '--i': i * 2 + 4 } as React.CSSProperties}>{palabra}</span>
            </span>
          ))}
        </h1>
        <p className="sube mx-auto mt-6 max-w-[42ch] text-[16px] leading-relaxed text-white/65" style={{ '--d': '700ms' } as React.CSSProperties}>
          {numero
            ? 'Eres de las primeras personas en entrar a WiseMotors. Te mostramos en un minuto cómo encontrar tu carro, y al final nos cuentas qué te pareció.'
            : 'Te mostramos en un minuto cómo encontrar tu carro.'}
        </p>
        <button
          onClick={empezar}
          className="sube pastilla pastilla--wise mx-auto mt-9 h-[52px] px-7 text-[16px]"
          style={{ '--d': '950ms' } as React.CSSProperties}
          autoFocus
        >
          Empezar el recorrido <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Bienvenida() {
  const { login } = useAuth();
  const [modo, setModo] = useState<Modo>('crear');
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [autoriza, setAutoriza] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [bienvenido, setBienvenido] = useState<Bienvenido | null>(null);
  const [carro, setCarro] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('modo') === 'ingresar') setModo('ingresar');
    const c = q.get('codigo');
    if (c) setCodigo(c.toUpperCase().slice(0, 20));
    const t = setInterval(() => {
      if (!document.hidden) setCarro(x => (x + 1) % VITRINA.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setError('');
  };

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!codigo.trim()) return setError('Escribe tu código de invitación.');
    if (nombre.trim().length < 2) return setError('Escribe tu nombre.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Escribe un correo válido.');
    if (clave.length < 6) return setError('La contraseña necesita al menos 6 caracteres.');
    if (!autoriza) return setError('Necesitamos tu autorización para guardar tus datos.');
    setEnviando(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: nombre.trim(),
          email: email.trim().toLowerCase(),
          password: clave,
          confirmPassword: clave,
          codigoInvitacion: codigo.trim(),
          autoriza: true,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error ?? 'No pudimos crear tu cuenta. Intenta de nuevo.');
      login(d.user, d.token);
      setBienvenido({ nombre: nombre.trim().split(/\s+/)[0], invitacion: d.invitacion ?? null, de: d.invitaciones ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear tu cuenta. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !clave) return setError('Escribe tu correo y tu contraseña.');
    setEnviando(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: email.trim(), password: clave }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(r.status === 401 ? 'El correo o la contraseña no coinciden.' : d?.error ?? 'No pudimos ingresar.');
      login(d.user, d.token);
      window.location.href = destinoAlIngresar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos ingresar.');
      setEnviando(false);
    }
  }

  if (bienvenido) return <Ceremonia b={bienvenido} />;

  const ojo = (
    <button
      type="button"
      onClick={() => setVerClave(v => !v)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white"
      aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      {verClave ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );

  return (
    <div className="relative isolate flex min-h-[100svh] flex-col overflow-clip bg-showroom text-white">
      {/* Luz morada y la W casi invisible de fondo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-[18vw] top-1/2 w-[95vw] max-w-[1100px] -translate-y-1/2 opacity-[0.06] md:-right-[8vw] md:w-[70vw]">
          <LogoMarca className="h-auto w-full" tono="blanco" />
        </div>
        <div className="absolute left-[30%] top-[40%] h-[70vh] w-[80vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(136,28,183,0.35),transparent)] blur-2xl" />
      </div>

      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 pt-6 md:px-8 md:pt-8">
        <Logo oscuro />
        <span className="rounded-full border border-wise-lila/30 bg-wise/15 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-wise-lila">
          Solo con invitación
        </span>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-10 px-4 py-10 md:grid-cols-12 md:gap-12 md:px-8 md:py-16">
        <div className="md:col-span-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-wise-lila">Acceso anticipado · 100 personas</p>
          <h1 className="t-titulo mt-5 text-[42px] sm:text-[56px] md:text-[72px]">
            Te guardamos <span className="text-wise-lila">un puesto.</span>
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-white/65">
            WiseMotors te ayuda a escoger carro sin saber de carros: nos cuentas cómo vives y te decimos cuál. Antes de abrirlo a todo
            el mundo, queremos que tú lo pruebes.
          </p>
          <ul className="mt-7 grid max-w-[520px] gap-2.5 text-[14.5px] text-white/75 sm:grid-cols-3 sm:gap-3">
            {[
              { icono: Search, texto: 'Busca con tus palabras' },
              { icono: Scale, texto: 'Compara frente a frente' },
              { icono: CalendarCheck, texto: 'Agenda la prueba de ruta' },
            ].map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-2.5 sm:flex-col sm:items-start">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-wise-lila">
                  <Icono className="h-4 w-4" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
          {/* Los carros dibujados del inicio, de a uno */}
          <div className="relative mt-8 hidden h-[150px] max-w-[460px] md:block" aria-hidden>
            <div key={VITRINA[carro].id} className="carro-entra absolute inset-0">
              <CarRender car={VITRINA[carro]} abajo className="h-full w-full" />
            </div>
          </div>
        </div>

        <div className="md:col-span-5">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl md:p-7">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-white/[0.06] p-1" role="tablist">
              {(
                [
                  ['crear', 'Tengo una invitación'],
                  ['ingresar', 'Ya tengo cuenta'],
                ] as [Modo, string][]
              ).map(([m, t]) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={modo === m}
                  onClick={() => cambiarModo(m)}
                  className={`h-10 rounded-full text-[13.5px] font-medium transition-colors ${modo === m ? 'bg-white text-tinta' : 'text-white/60 hover:text-white'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {modo === 'crear' ? (
              <form onSubmit={crear} noValidate className="mt-6">
                {/* El código, como un boleto */}
                <label className="boleto block rounded-[20px] border border-dashed border-wise-lila/45 bg-wise/[0.12] px-4 pb-4 pt-3">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-wise-lila">Tu código de invitación</span>
                  <input
                    value={codigo}
                    onChange={e => setCodigo(e.target.value.toUpperCase().slice(0, 20))}
                    placeholder="WISE-XXXXXX"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1 w-full bg-transparent font-mono text-[26px] font-medium tracking-[0.12em] text-white outline-none placeholder:text-white/25"
                  />
                </label>

                <div className="mt-4 space-y-3">
                  <input className={campo} placeholder="Tu nombre" autoComplete="given-name" value={nombre} onChange={e => setNombre(e.target.value)} aria-label="Nombre" />
                  <input
                    className={campo}
                    type="email"
                    inputMode="email"
                    placeholder="Tu correo"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    aria-label="Correo"
                  />
                  <div className="relative">
                    <input
                      className={`${campo} pr-11`}
                      type={verClave ? 'text' : 'password'}
                      placeholder="Crea una contraseña (mínimo 6)"
                      autoComplete="new-password"
                      value={clave}
                      onChange={e => setClave(e.target.value)}
                      aria-label="Contraseña"
                    />
                    {ojo}
                  </div>
                </div>

                <label className="mt-4 flex cursor-pointer gap-3 text-[12.5px] leading-snug text-white/60">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#881cb7]" checked={autoriza} onChange={e => setAutoriza(e.target.checked)} />
                  <span>
                    Autorizo a WiseMotors a guardar mis datos para darme acceso y contarme novedades (Ley 1581 de 2012). Puedo pedir que los
                    borren escribiendo a {CORREO_DATOS}.
                  </span>
                </label>

                {error && (
                  <p role="alert" className="mt-4 text-[13px] text-rose-300">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={enviando} className="pastilla pastilla--wise mt-5 h-12 w-full justify-center text-[15px] disabled:opacity-70">
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar a WiseMotors <ArrowRight className="h-4 w-4" /></>}
                </button>
                <p className="mt-3 text-center text-[12.5px] text-white/45">¿No tienes código? Pídeselo a quien te habló de WiseMotors.</p>
              </form>
            ) : (
              <form onSubmit={ingresar} noValidate className="mt-6 space-y-3">
                <input
                  className={campo}
                  placeholder="Tu correo"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  aria-label="Correo"
                />
                <div className="relative">
                  <input
                    className={`${campo} pr-11`}
                    type={verClave ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                    value={clave}
                    onChange={e => setClave(e.target.value)}
                    aria-label="Contraseña"
                  />
                  {ojo}
                </div>
                {error && (
                  <p role="alert" className="pt-1 text-[13px] text-rose-300">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={enviando} className="pastilla pastilla--wise mt-2 h-12 w-full justify-center text-[15px] disabled:opacity-70">
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Ingresar <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1200px] px-4 pb-6 font-mono text-[11px] text-white/35 md:px-8">
        © {new Date().getFullYear()} WiseMotors · Medellín, Colombia
      </footer>
    </div>
  );
}
