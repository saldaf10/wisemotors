// ============================================================================
// Parte el campo viejo "Suspensión" (chassis.suspensionSetup, retirado del
// registro) en Suspensión delantera y trasera. El texto casi siempre trae las
// dos: "Independiente McPherson adelante / eje torsional atrás".
//   - Si un tramo dice adelante/delantera o atrás/trasera, va a ese lado.
//   - "en las cuatro ruedas" / "4 ruedas" / "ambos ejes" → el mismo valor a los dos.
//   - Dos tramos con "/" y sin marcas → primero delantera, luego trasera
//     (así se escriben las fichas); se marca como `porOrden` para revisarlo.
//   - Lo demás no se adivina: queda sin partir.
// ============================================================================

export interface SuspensionPartida {
  delantera?: string;
  trasera?: string;
  porOrden?: boolean;
}

const DELANTE = /\b(adelante|delanter[ao]s?|frontal(es)?|front|eje delantero)\b/i;
const ATRAS = /\b(atr[aá]s|traser[ao]s?|posterior(es)?|rear|eje trasero)\b/i;
const AMBOS = /\b(en (?:las|sus) (?:cuatro|4) ruedas|(?:las )?(?:cuatro|4) ruedas|(?:en )?ambos ejes)\b/i;

function limpiar(t: string): string {
  const s = t
    .replace(DELANTE, ' ')
    .replace(ATRAS, ' ')
    .replace(/\bsuspensi[oó]n\b/gi, ' ')
    .replace(/(\S):\s+/g, '$1 ')
    .replace(/\b(en el|en la|eje)\s*$/i, ' ')
    .replace(/^\s*(en el|en la|de|:)\s*/i, ' ')
    .replace(/[:;,.\-–]+\s*$/g, ' ')
    .replace(/^\s*[:;,.\-–]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

export function partirSuspension(texto: string): SuspensionPartida {
  const t = texto.trim();
  if (!t) return {};
  const tramos = t
    .split(/\s*(?:\/|;|\||,|\s+y\s+(?=\S*\s*(?:atr|tras|post|rear|del|adel|front)))\s*/i)
    .map(x => x.trim())
    .filter(Boolean);

  const r: SuspensionPartida = {};
  for (const tramo of tramos) {
    const d = DELANTE.test(tramo), a = ATRAS.test(tramo);
    if (d && !a && !r.delantera) r.delantera = limpiar(tramo) || undefined;
    else if (a && !d && !r.trasera) r.trasera = limpiar(tramo) || undefined;
  }
  if (r.delantera || r.trasera) return r;

  if (AMBOS.test(t)) {
    const v = limpiar(t.replace(AMBOS, ' ').replace(/\ben\s*$/i, ''));
    return v ? { delantera: v, trasera: v } : {};
  }
  const porBarra = t.split(/\s*\/\s*/).filter(Boolean);
  if (porBarra.length === 2) {
    const [d, a] = porBarra.map(limpiar);
    if (d && a) return { delantera: d, trasera: a, porOrden: true };
  }
  return {};
}
