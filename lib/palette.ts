// ============================================================================
// Paleta de series de WiseMotors: morado → rojo → lila → amarillo.
//
// Una sola fuente para todo lo que pinta "un carro por color" (duelo, matriz,
// radar). El morado de marca es siempre el primero; el resto son acentos cálidos.
// El amarillo reemplazó al magenta: junto al rojo no se distinguían en el radar.
// Sin verdes ni azules: no son de la marca.
// ============================================================================

export const SERIES = [
  '#881cb7', // morado Wise
  '#e11d48', // rojo carmesí
  '#c084fc', // lila
  '#eab308', // amarillo
  '#6d28d9', // violeta profundo
] as const;

export const serie = (i: number) => SERIES[((i % SERIES.length) + SERIES.length) % SERIES.length];
