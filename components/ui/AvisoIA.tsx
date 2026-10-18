import { Sparkles } from 'lucide-react';

// Aviso pequeño de que WiseMotors usa IA y que hay datos de fuentes no oficiales.
// Va en el pie, en la ficha (junto a hablar con el concesionario), en los
// resultados de búsqueda y en el comparador.
export const TEXTO_AVISO_IA =
  'WiseMotors funciona con un motor de IA y puede cometer errores. Algunos datos vienen de fuentes no oficiales: confírmalos con el concesionario antes de comprar.';

export function AvisoIA({ claro = false, className = '' }: { claro?: boolean; className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-[12.5px] leading-snug ${claro ? 'text-white/55' : 'text-tinta-2'} ${className}`}>
      <Sparkles className="mt-[2px] h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{TEXTO_AVISO_IA}</span>
    </p>
  );
}
