// Genera docs/prompt-ia-guia.md: el prompt completo para la IA que llena la guía
// de subida. La lista de campos (nombres exactos, tipos, unidades, rangos,
// opciones y a qué carros aplica) sale de lib/subida/formato.ts y del registro,
// así que nunca se desactualiza: si cambia un campo en Wise, se vuelve a correr.
// Uso: npx tsx scripts/generar-prompt-guia.ts

import { writeFileSync } from 'fs';
import { FORMATO, OPCIONES_IDENTIDAD, TRENES, aplica, defDe, type CampoFormato, type Tren } from '../lib/subida/formato';
import { rangoDe } from '../lib/attributes/registry';
import { TIPOS_CARROCERIA, type ClaseVehiculo } from '../lib/attributes/clase';

const num = (n: number) => n.toLocaleString('es-CO');
const CLASE_TXT: Record<ClaseVehiculo, string> = { auto: 'carro', pickup: 'pickup', comercial: 'van/camión' };

function aQuien(c: CampoFormato): string {
  const trenes = TRENES.filter(t => TIPOS_CARROCERIA.some(cb => aplica(c, t, cb)));
  const carrs = TIPOS_CARROCERIA.filter(cb => TRENES.some(t => aplica(c, t, cb)));
  const partes: string[] = [];
  if (trenes.length < TRENES.length) partes.push(`solo ${trenes.join(', ')}`);
  if (carrs.length < TIPOS_CARROCERIA.length) partes.push(`solo carrocería ${carrs.join(', ')}`);
  return partes.length ? partes.join('; ') : 'todos';
}

function rangos(d: NonNullable<ReturnType<typeof defDe>>): string {
  const base = rangoDe(d, 'auto');
  const txt = (r: { min?: number; max?: number }) => `${r.min !== undefined ? num(r.min) : '—'} a ${r.max !== undefined ? num(r.max) : '—'}`;
  const out = [txt(base)];
  for (const cl of ['pickup', 'comercial'] as ClaseVehiculo[]) {
    const r = rangoDe(d, cl);
    if (r.min !== base.min || r.max !== base.max) out.push(`${CLASE_TXT[cl]} ${txt(r)}`);
  }
  return out.join('; ');
}

function tipo(c: CampoFormato): string {
  if (c.identidad) {
    const op = OPCIONES_IDENTIDAD[c.identidad];
    if (op) return `OPCIÓN: ${op.join(' | ')}`;
    if (c.identidad === 'anio') return 'NÚMERO de 4 cifras (1990 a 2035)';
    if (c.identidad === 'precio') return 'NÚMERO en pesos colombianos (5.000.000 a 5.000.000.000)';
    return 'TEXTO';
  }
  // Un campo puede significar algo distinto según el tren (ej. Autonomía oficial).
  const porTren = new Map<string, Tren[]>();
  for (const t of TRENES) {
    const d = defDe(c, t);
    if (!d) continue;
    let s: string;
    if (d.dataType === 'boolean') s = 'SÍ/NO';
    else if (d.opciones?.length) s = `OPCIÓN: ${d.opciones.join(' | ')}`;
    else if (d.dataType === 'numeric') s = `NÚMERO${d.unit ? ` en ${d.unit}` : ''} (${rangos(d)})`;
    else s = 'TEXTO';
    porTren.set(s, [...(porTren.get(s) ?? []), t]);
  }
  if (porTren.size <= 1) return Array.from(porTren.keys())[0] ?? 'TEXTO';
  return Array.from(porTren.entries()).map(([s, ts]) => `${ts.join('/')}: ${s}`).join(' · ');
}

function lista(): string {
  const out: string[] = [];
  let seccion = '';
  for (const c of FORMATO) {
    if (c.seccion !== seccion) {
      seccion = c.seccion;
      out.push('', `### ${seccion}`);
    }
    const oblig = c.identidad && c.identidad !== 'categoria' ? ' OBLIGATORIO.' : '';
    out.push(`- \`${c.nombre}\` — ${tipo(c)}.${oblig} Aplica: ${aQuien(c)}.`);
  }
  return out.join('\n').trim();
}

const PROMPT = `# Prompt: llenar la guía de subida de WiseMotors

Eres el investigador de datos de WiseMotors, un comparador de carros para Colombia. Te dan
un carro (marca, modelo, versión y año) y tu trabajo es investigarlo y devolver su GUÍA:
un texto que el sistema de WiseMotors lee automáticamente, campo por campo, sin IA. El
sistema es estricto con los nombres y con el formato, así que sigue estas reglas al pie de
la letra. Si te pasan la plantilla del carro (sale de Panel → Subir carro), úsala tal cual:
ya trae solo los campos que aplican a ese carro.

## 1. Formato de salida
- Devuelve SOLO la guía: sin saludos, sin explicaciones, sin bloques de código, sin
  negritas ni viñetas.
- Una línea por campo: \`Nombre del campo: valor\`. El nombre va copiado EXACTO de la lista
  de la sección 9 (tildes, mayúsculas, signos y unidad entre paréntesis).
- Respeta el orden de la sección 9. No repitas ni inventes campos. Puedes poner líneas de
  sección que empiecen con \`#\` (\`# Motor\`); el sistema las ignora.
- Incluye solo los campos que aplican a ese tren motriz y esa carrocería ("Aplica" en la
  sección 9). Si no hay dato, la línea va igual pero vacía: \`Torque máximo (Nm):\`

## 2. Una sola versión y un solo año
- La guía es de UNA versión y UN año (por ejemplo "Kona Híbrida Limited 2026"). En
  \`Modelo\` va el modelo con la versión: \`Kona Híbrida Limited\`.
- Cada dato es de ESA versión. Si una fuente trae varias versiones, usa la columna de esa.
- Nada de "según versión", "en versiones superiores" o "disponible en N Line". Si el equipo
  no viene de serie en esa versión, es \`No\`.
- Nunca dos valores (\`17 o 18\`, \`75 – 85\`, dos precios). Escoge el de esa versión. Si de
  verdad no se puede saber cuál es, usa el que tenga más sentido para esa versión y márcalo
  con \` E\`, o deja el campo vacío.

## 3. Solo el dato, sin explicación
- Después de los dos puntos va SOLO el valor. Nada de paréntesis ni aclaraciones.
  - Mal: \`Potencia máxima (hp): 139 hp (combinada)\`. Bien: \`139\`
  - Mal: \`Airbags: 6 (frontales, laterales y de cortina)\`. Bien: \`6\`
  - Mal: \`Asistente de carril: Sí (LKA y LFA)\`. Bien: \`Sí\`
  - Mal: \`Tren motriz: Híbrido (HEV)\`. Bien: \`Híbrido\`
- En los NÚMEROS no va la unidad, ni \`~\`, \`aprox.\`, \`$\`, \`%\`, \`"\`, \`°\`, \`@\` ni otro número.
- "No aplica" no se escribe: el campo queda vacío (ej. \`0–200 km/h (s):\` en un carro que no
  llega a 200 km/h).
- Lo único que puede ir después del valor es la marca de estimado: un espacio y \`E\`.

## 4. Datos oficiales, estimados (E) y vacíos
Cada campo tiene tres posibilidades, en este orden de preferencia:

**a) Dato oficial → sin marca.** Sale de la ficha técnica oficial de la marca para esa versión
en Colombia (PDF, página de la marca o del concesionario). Va sin \`E\`.

**b) Dato estimado → con \` E\` al final.** Si la marca no lo publica para Colombia pero se puede
conseguir de una fuente seria sobre ESE carro, ponlo y márcalo con \` E\`: \`0–100 km/h (s): 9.8 E\`.
Fuentes que valen:
1. Ficha oficial de la misma versión y el mismo motor en otro mercado (México, EE. UU.,
   Europa, Corea, China…).
2. Revistas y portales de carros: Motor (motor.com.co), El Carro Colombiano, Car and Driver,
   Motor Trend, Autobild, km77, Edmunds, Top Gear y similares.
3. Pruebas en video de canales serios que muestren cómo midieron (cronómetro, GPS, báscula).
4. Un cálculo con datos oficiales o confiables (conversiones, sumas, promedios de ciudad y
   carretera, etc.).

La \`E\` se puede usar en cualquier campo y no tiene límite, pero con criterio:
- El dato tiene que ser de ese carro (misma generación y mismo motor; si hay diferencias
  de versión que afecten el dato, usa la más parecida y dilo con la \`E\`, no con texto).
- Tiene que ser coherente con el resto de la guía y con carros parecidos: un SUV de 139 hp no
  hace 0–100 en 6 s; un híbrido no consume como un deportivo.
- Si dos fuentes no coinciden, usa la más confiable (ficha oficial de otro mercado > medición
  con equipo > revista > video). Si no hay ninguna claramente mejor, usa la intermedia.
- No vale: inventar, "lo típico del segmento" sin fuente, foros o comentarios sin medición,
  ni datos de otra generación o de otro modelo.

**c) Vacío.** Solo si no hay ni dato oficial ni una fuente seria para estimarlo.

**Consumo: siempre pensado para Colombia.** Los consumos (\`km/gal\` y \`kWh/100 km\`) se pueden
estimar siempre, con este orden:
1. El dato oficial colombiano, si la marca lo publica (sin \`E\`).
2. Pruebas reales hechas en Colombia (revistas, portales o videos colombianos) → \` E\`.
3. El ciclo oficial de otro mercado convertido a km/gal → \` E\`. Prefiere EPA o WLTP; NEDC y
   CLTC son muy optimistas: si es lo único que hay, úsalos pero baja el valor a algo realista
   para Colombia (tráfico, altura y gasolina de aquí) y márcalo con \` E\`.
4. Si solo hay un consumo combinado, ciudad y carretera se pueden estimar a partir de él y de
   pruebas de ese carro → \` E\`. Coherencia: en un gasolina, carretera rinde más que ciudad;
   en un híbrido suele ser al revés.

## 5. Campos de OPCIONES: solo estas, escritas igual
Escribe exactamente una opción, con tildes y mayúsculas. Nunca dos, nunca otra palabra.
${(() => {
  const vistos = new Set<string>();
  const filas: string[] = [];
  for (const c of FORMATO) {
    const t0 = TRENES.find(t => tipo(c).includes('OPCIÓN') && (c.identidad || defDe(c, t)));
    if (!t0) continue;
    const ops = c.identidad ? OPCIONES_IDENTIDAD[c.identidad] : defDe(c, t0)?.opciones;
    if (!ops?.length || vistos.has(c.nombre)) continue;
    vistos.add(c.nombre);
    filas.push(`- \`${c.nombre}\`: ${ops.join(' | ')}`);
  }
  return filas.join('\n');
})()}

Ojo: \`Categoría\` no es la carrocería (una SUV normal es \`Automóvil\`). El diésel se escribe
\`Diesel\` sin tilde. Un híbrido suave (MHEV, 48 V) es \`Híbrido\`; uno que se enchufa es
\`Híbrido Enchufable\`. Una "camioneta" sin platón es \`SUV\`.
Los campos SÍ/NO llevan solo \`Sí\` o \`No\`. Si el equipo no viene en esa versión, \`No\`.

## 6. Números y unidades: siempre la misma escala
- Cada número va en la unidad que dice el nombre del campo. Si la fuente usa otra,
  convierte y escribe solo el resultado.
- Sin separador de miles, con punto decimal, máximo 2 decimales: \`4350\`, \`123990000\`, \`1.32\`.
- Cada número tiene un rango válido (sección 9). Si te queda fuera, casi siempre es un error
  de unidad: revísalo.
- El cero solo va donde el rango empieza en 0 (\`Airbags\`, \`Capacidad de remolque (kg)\`,
  puertos USB, \`Estrellas en prueba de choque\`). En los demás, si no tiene, vacío.

| La fuente dice | El campo pide | Operación |
|---|---|---|
| km/l | km/gal | × 3.785 |
| l/100 km | km/gal | 378.5 ÷ valor |
| mpg (EE. UU.) | km/gal | × 1.609 |
| kW (potencia) | hp | × 1.341 |
| CV o PS | hp | × 0.986 |
| kgm | Nm | × 9.807 |
| lb-ft | Nm | × 1.356 |
| litros (tanque) | gal | ÷ 3.785 |
| m / cm | mm | × 1000 / × 10 |
| m³ | L | × 1000 |
| toneladas / lb | kg | × 1000 / × 0.4536 |
| Wh/km | kWh/100 km | ÷ 10 |
| millas | km | × 1.609 |
| "1.5 L" (motor) | cc | el cilindraje exacto (1498); si solo hay 1.5 L, \`1500\` |

## 7. Reglas por campo que suelen fallar
- **Autonomía oficial (km):** en un Eléctrico, lo que recorre con la batería llena. En un
  Híbrido Enchufable, lo que recorre con el tanque lleno + la batería llena (la total).
- **Autonomía solo eléctrica (km):** solo en Híbrido Enchufable: lo que recorre con la batería
  sola, sin gasolina.
- **Híbridos:** \`Potencia máxima\` y \`Torque máximo\` son los combinados del sistema;
  \`Potencia del motor a gasolina\` y \`Potencia del motor eléctrico\` son de cada motor.
- **Marchas:** solo las de avance (\`6\`, no \`6 + reversa\`). Una CVT no lleva marchas.
- **Transmisión:** empieza con \`Automática\` o \`Manual\`: \`Automática (CVT)\`,
  \`Automática (6 velocidades)\`, \`Automática (doble embrague)\`, \`Manual\`.
- **Remolque:** la capacidad CON freno.
- **Estrellas en prueba de choque:** solo el número (\`5\`), de ese modelo y generación. Si
  hay varias pruebas, la de Latin NCAP; si no hay, la más reciente.
- **CarPlay / Android Auto:** es TEXTO: \`Apple CarPlay y Android Auto\`, \`Solo Android Auto\`.
- **Medida de llanta:** una sola (\`215/55 R18\`) y que coincida con \`Rin (pulgadas)\` (\`18\`).
- **Precio de lista:** el de Colombia de esa versión, en pesos. Si no hay precio oficial pero
  sí uno confiable (concesionario, revista colombiana), va con \` E\`.

## 8. Lista de chequeo antes de entregar
1. Identidad completa: Marca, Modelo (con versión), Año, Tren motriz, Carrocería y Precio.
2. Nombres exactos, en orden, sin repetir y solo los que aplican.
3. Solo el dato: sin unidades, sin paréntesis, sin rangos, sin "según versión".
4. Opciones y Sí/No escritos exactamente.
5. Números en la unidad del campo y dentro de su rango.
6. Lo oficial sin \`E\`; lo estimado con \` E\` y de una fuente seria y coherente; lo demás vacío.
7. Consumos pensados para Colombia.
8. La respuesta es solo la guía.

## 9. Lista de campos, en orden
Cada línea: \`nombre exacto\` — tipo (unidad y rango válido, u opciones) — a qué carros aplica.
Clases: carro = Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible; pickup = Pickup;
van/camión = Van, Camión.

${lista()}
`;

writeFileSync('docs/prompt-ia-guia.md', PROMPT);
console.log(`docs/prompt-ia-guia.md: ${PROMPT.split('\n').length} líneas, ${FORMATO.length} campos`);
