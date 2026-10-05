// Cronómetro de la ingesta: con INGESTA_TIEMPOS=1 imprime cuánto tarda cada
// etapa (para saber dónde se van los segundos antes de optimizar a ciegas).
// Sin la variable no hace nada.
const activo = () => !!process.env.INGESTA_TIEMPOS;
let cero = Date.now();

export function reiniciarTiempos() {
  cero = Date.now();
}

/** Mide una promesa: "[t] 12.3s → 18.9s (6.6s) etiqueta". */
export async function medir<T>(etiqueta: string, p: Promise<T> | (() => Promise<T>)): Promise<T> {
  if (!activo()) return typeof p === 'function' ? p() : p;
  const ini = Date.now();
  try {
    return await (typeof p === 'function' ? p() : p);
  } finally {
    const fin = Date.now();
    console.log(`[t] ${((ini - cero) / 1000).toFixed(1)}s → ${((fin - cero) / 1000).toFixed(1)}s (${((fin - ini) / 1000).toFixed(1)}s) ${etiqueta}`);
  }
}
