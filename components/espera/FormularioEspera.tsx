'use client';

// Registro de la lista de espera. Si en el campo del correo se escribe el
// código del equipo (no lleva @), se pide acceso en vez de inscribir y, si es
// correcto, se recarga con el sitio normal (lib/acceso.ts).

import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Loader2, Share2 } from 'lucide-react';

const CORREO_DATOS = 'hola@wisemotors.co';
const GUARDADO = 'wm_espera';
const PUESTOS_POR_INVITADO = 10;

type Inscrito = { puesto: number; invitados: number; codigo: string; nombre: string };

function leerGuardado(): Inscrito | null {
  try {
    const v = localStorage.getItem(GUARDADO);
    return v ? (JSON.parse(v) as Inscrito) : null;
  } catch {
    return null;
  }
}

export function FormularioEspera({ ciudades }: { ciudades: string[] }) {
  const [inscrito, setInscrito] = useState<Inscrito | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const [trampa, setTrampa] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [origen, setOrigen] = useState<{ ref: string; utm: string }>({ ref: '', utm: '' });

  useEffect(() => {
    const guardado = leerGuardado();
    setInscrito(guardado);
    if (guardado?.codigo) {
      fetch(`/api/espera?codigo=${encodeURIComponent(guardado.codigo)}`)
        .then(r => (r.ok ? r.json() : null))
        .then((d: Inscrito | null) => {
          if (!d) return;
          setInscrito(d);
          try {
            localStorage.setItem(GUARDADO, JSON.stringify(d));
          } catch {}
        })
        .catch(() => {});
    }
    const q = new URLSearchParams(window.location.search);
    setOrigen({ ref: q.get('ref') ?? '', utm: q.get('utm_source') ?? '' });
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const valor = email.trim();

    if (valor && !valor.includes('@')) {
      setEnviando(true);
      const r = await fetch('/api/espera/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: valor }),
      }).catch(() => null);
      if (r?.ok) {
        window.location.reload();
        return;
      }
      setEnviando(false);
      setError('Escribe un correo válido.');
      return;
    }

    if (nombre.trim().length < 2) return setError('Escribe tu nombre.');
    if (!valor) return setError('Escribe tu correo.');
    if (!ciudad) return setError('Elige tu ciudad.');
    if (!autoriza) return setError('Necesitamos tu autorización para guardar tus datos.');

    setEnviando(true);
    try {
      const r = await fetch('/api/espera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email: valor, ciudad, autoriza, ref: origen.ref, utm: origen.utm, sitio: trampa }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No pudimos guardarte. Intenta de nuevo.');
      setInscrito(datos);
      try {
        localStorage.setItem(GUARDADO, JSON.stringify(datos));
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardarte. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (inscrito?.codigo) return <EnLaFila inscrito={inscrito} />;

  const campo =
    'h-12 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-white/40 outline-none transition focus:border-wise-lila/70 focus:bg-white/[0.09]';

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl md:p-7"
    >
      <h2 className="text-[22px] font-semibold tracking-[-0.03em]">Sé de los primeros.</h2>
      <p className="mt-1 text-[14px] text-white/55">Los primeros de la fila entran antes que nadie.</p>

      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="sr-only">Nombre</span>
          <input className={campo} placeholder="Tu nombre" autoComplete="given-name" value={nombre} onChange={e => setNombre(e.target.value)} />
        </label>
        <label className="block">
          <span className="sr-only">Correo</span>
          <input
            className={campo}
            type="email"
            inputMode="email"
            placeholder="Tu correo"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="sr-only">Ciudad</span>
          <select className={`${campo} appearance-none ${ciudad ? '' : 'text-white/40'}`} value={ciudad} onChange={e => setCiudad(e.target.value)}>
            <option value="" disabled>
              Tu ciudad
            </option>
            {ciudades.map(c => (
              <option key={c} value={c} className="text-tinta">
                {c}
              </option>
            ))}
          </select>
        </label>
        {/* Trampa para bots: fuera de la vista y del teclado. */}
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0" value={trampa} onChange={e => setTrampa(e.target.value)} />
      </div>

      <label className="mt-4 flex cursor-pointer gap-3 text-[13px] leading-snug text-white/60">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#881cb7]" checked={autoriza} onChange={e => setAutoriza(e.target.checked)} />
        <span>Autorizo a WiseMotors a guardar mis datos para avisarme del lanzamiento y contarme novedades (Ley 1581 de 2012).</span>
      </label>
      <details className="mt-2 pl-7 text-[12px] text-white/45">
        <summary className="cursor-pointer select-none hover:text-white/70">Cómo usamos tus datos</summary>
        <p className="mt-2 leading-relaxed">
          WiseMotors (Medellín) usa tu nombre, correo y ciudad solo para avisarte del lanzamiento, contarte novedades y medir esta
          campaña. No los vendemos ni los compartimos. Puedes conocerlos, corregirlos, pedir que los borremos o retirar tu
          autorización cuando quieras escribiendo a {CORREO_DATOS}.
        </p>
      </details>

      {error && (
        <p role="alert" className="mt-4 text-[13px] text-rose-300">
          {error}
        </p>
      )}

      <button type="submit" disabled={enviando} className="pastilla pastilla--wise mt-5 h-12 w-full justify-center text-[15px] disabled:opacity-70">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Quiero saber primero <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  );
}

function EnLaFila({ inscrito }: { inscrito: Inscrito }) {
  const [copiado, setCopiado] = useState(false);
  const enlace = `https://wisemotors.co/?ref=${inscrito.codigo}`;
  const mensaje = 'Algo viene para los que no sabemos de carros. Inscríbete conmigo:';

  async function compartir() {
    if (navigator.share) {
      await navigator.share({ title: 'WiseMotors', text: mensaje, url: enlace }).catch(() => {});
      return;
    }
    copiar();
  }
  function copiar() {
    navigator.clipboard?.writeText(enlace).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl md:p-7" aria-live="polite">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-wise-lila">Estás en la fila</p>
      <p className="mt-3 text-[22px] font-semibold tracking-[-0.03em]">Listo{inscrito.nombre ? `, ${inscrito.nombre}` : ''}.</p>
      <p className="mt-4 text-[13px] text-white/55">Tu puesto</p>
      <p className="font-mono text-[64px] font-light leading-none tracking-[-0.04em]">#{inscrito.puesto.toLocaleString('es-CO')}</p>

      <p className="mt-6 text-[14px] leading-relaxed text-white/65">
        Cada amigo que se inscriba con tu enlace te adelanta {PUESTOS_POR_INVITADO} puestos.
        {inscrito.invitados > 0 && ` Ya invitaste a ${inscrito.invitados}.`}
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] py-1.5 pl-4 pr-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/80">{enlace.replace('https://', '')}</span>
        <button type="button" onClick={copiar} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/10" aria-label="Copiar enlace">
          {copiado ? <Check className="h-4 w-4 text-wise-lila" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <button type="button" onClick={compartir} className="pastilla pastilla--wise mt-3 h-12 w-full justify-center text-[15px]">
        <Share2 className="h-4 w-4" /> Compartir mi enlace
      </button>
    </div>
  );
}
