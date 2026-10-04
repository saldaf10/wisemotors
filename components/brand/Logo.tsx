// ============================================================================
// Logo WiseMotors.
//
// Marca: una "W" de trazo grueso inclinada hacia adelante. La primera mitad
// en lila y la segunda en morado: se lee como una estela que acelera.
// Palabra: "wise" en 700, "motors" en 400, minúsculas y apretada.
// ============================================================================

export function LogoMarca({ className = 'h-7 w-auto', tono = 'wise' }: { className?: string; tono?: 'wise' | 'blanco' }) {
  const claro = '#d8b4fe';
  const fuerte = tono === 'wise' ? '#881cb7' : '#ffffff';
  return (
    <svg viewBox="0 0 48 36" className={className} aria-hidden>
      <g transform="skewX(-12) translate(4 0)">
        <path d="M4 5 L13 31 L22 13" fill="none" stroke={claro} strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 13 L31 31 L40 5" fill="none" stroke={fuerte} strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function Logo({
  className = '',
  oscuro = false,
  soloMarca = false,
}: {
  className?: string;
  oscuro?: boolean;
  soloMarca?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMarca tono={oscuro ? 'blanco' : 'wise'} />
      {!soloMarca && (
        <span className={`text-[21px] leading-none tracking-[-0.05em] ${oscuro ? 'text-white' : 'text-tinta'}`}>
          <span className="font-bold">wise</span>
          <span className="font-normal">motors</span>
        </span>
      )}
    </span>
  );
}
