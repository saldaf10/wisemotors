// Genera docs/prompt-ia-guia.md: el prompt completo para la IA que llena la guía
// de subida. La lista de campos (nombres exactos, tipos, unidades, rangos,
// opciones y a qué carros aplica) sale de lib/subida/formato.ts y del registro,
// así que nunca se desactualiza: si cambia un campo en Wise, se vuelve a correr.
// Uso: npx tsx scripts/generar-prompt-guia.ts

import { writeFileSync } from 'fs';
import { FORMATO, OPCIONES_IDENTIDAD, TRENES, aplica, defDe, type CampoFormato, type Tren } from '../lib/subida/formato';
import { rangoDe } from '../lib/attributes/registry';
import { TIPOS_CARROCERIA, type ClaseVehiculo } from '../lib/attributes/clase';

// Sin separador de miles y con punto decimal, igual a como se pide escribir los números.
const num = (n: number) => String(n);
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
    if (c.identidad === 'precio') return 'NÚMERO en pesos colombianos (5000000 a 5000000000)';
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
- Devuelve SOLO la guía: sin saludos ni explicaciones fuera de ella, sin bloques de código,
  sin negritas.
- Dos partes, en este orden:
  1. **La lista de datos:** una línea por campo, \`Nombre del campo: valor LETRA\`. El nombre va
     copiado EXACTO de la sección 9 (tildes, mayúsculas, signos y unidad entre paréntesis).
  2. **Las notas al pie:** una línea que diga exactamente \`# Notas\` y debajo una línea por
     cada dato que necesite explicación (ver sección 4).
- Respeta el orden de la sección 9. No repitas ni inventes campos. Puedes poner líneas de
  sección que empiecen con \`#\` (\`# Motor\`); el sistema las ignora.
- Incluye solo los campos que aplican a ese tren motriz y esa carrocería ("Aplica" en la
  sección 9). Si no hay dato, la línea va igual pero vacía y SIN letra: \`Torque máximo (Nm):\`

## 2. Una sola versión y un solo año
- La guía es de UNA versión exacta y UN año exacto (por ejemplo "Captiva Híbrida Premier
  2026"). En \`Modelo\` va el modelo con la versión: \`Captiva Híbrida Premier\`.
- Cada dato es de ESA versión y ESE año. Si una fuente trae varias versiones en columnas,
  usa solo la columna de esa versión.
- Prohibido escribir "según versión", "en versiones superiores", "disponible en N Line" o
  parecidos. Si el equipo no viene de serie en ESA versión, es \`No\`. Si no sabes si viene,
  deja el campo vacío.
- Prohibido dar dos valores (\`17 o 18\`, \`75 – 85\`, dos precios). Escoge el de esa versión.
  Si no puedes saber cuál es, deja el campo vacío.

## 3. Solo el dato y su letra, sin explicación
- Después de los dos puntos va SOLO el valor, un espacio y su letra de trazabilidad
  (sección 4). Nada de paréntesis ni aclaraciones en la línea: las explicaciones van en las
  notas al pie.
  - Mal: \`Potencia máxima (hp): 139 hp (combinada)\`. Bien: \`Potencia máxima (hp): 139 O\`
  - Mal: \`Airbags: 6 (Frontales, laterales y de cortina)\`. Bien: \`Airbags: 6 O\`
  - Mal: \`Tracción: Delantera (FWD)\`. Bien: \`Tracción: Delantera O\`
  - Mal: \`Tren motriz: Híbrido (HEV)\`. Bien: \`Tren motriz: Híbrido\`
- En los NÚMEROS no va la unidad, ni \`~\`, \`aprox.\`, \`$\`, \`%\`, \`"\`, \`°\`, \`@\` ni otro número.
- "No aplica" NO se escribe: el campo se deja vacío.
- \`Marca\`, \`Modelo\`, \`Tren motriz\`, \`Carrocería\` y \`Categoría\` van SIN letra (un modelo como
  "Clase C" o "Clase E" se confundiría con la letra).

## 4. Trazabilidad: la letra de cada dato (O, C, X, E) y las notas al pie
Cada dato con valor lleva al final, separada por un espacio, UNA letra en MAYÚSCULA que dice
de dónde salió: \`232 O\`, \`320 C\`, \`38.5 X\`, \`3.8 E\`, \`Sí O\`, \`Delantera C\`.

**\`O\` — Oficial.** De la ficha técnica comercial del fabricante, el manual del propietario o
documentos de homologación oficiales, para esa misma versión y año. Lo ideal es la ficha
oficial de Colombia; la oficial de otro mercado vale como \`O\` solo si es la misma versión
y el mismo motor.

**\`C\` — Sitio confiable.** De revistas especializadas de prestigio, pruebas instrumentadas de
medios reconocidos (con equipo de medición o en pista) o comunicados de concesionarios y
aliados autorizados de la marca. Por ejemplo: Motor (motor.com.co), El Carro Colombiano,
Car and Driver, Motor Trend, Autobild, km77, Edmunds.

**\`X\` — Calculado.** Sale de una fórmula o conversión a partir de otros datos conocidos:
km/l × 3.785, kW × 1.341, litros ÷ 3.785, promedio de ciudad y carretera, etc.
OBLIGATORIO: explicar en las notas al pie con qué datos exactos y qué operación.

**\`E\` — Estimado.** No está en fuentes oficiales ni confiables, pero se infiere de un sitio
menos confiable, de un valor que se repite de forma consistente en internet, de una
plataforma hermana o de un estimado técnico coherente. OBLIGATORIO: explicar en las notas al
pie dónde se encontró o por qué se adoptó. En la página de WiseMotors los \`E\` se muestran en
amarillo como "estimados".

**Vacío.** Si no hay información oficial, confiable, calculable o estimable de forma lógica y
coherente, prohibido inventar: el campo queda VACÍO.

Criterio para \`C\`, \`X\` y \`E\`:
- El dato tiene que ser de ese carro (misma generación y mismo motor).
- Tiene que ser coherente con el resto de la guía y con carros parecidos: un SUV de 139 hp no
  hace 0–100 en 6 s; un híbrido no consume como un deportivo.
- Si dos fuentes no coinciden, usa la más confiable (oficial > medición con equipo > revista >
  video > resto) y menciónalo en la nota.
- No vale: inventar, "lo típico del segmento" sin ninguna base, ni datos de otra generación o
  de otro modelo.

**Consumo: siempre pensado para Colombia.** Los consumos (\`km/gal\` y \`kWh/100 km\`):
1. El dato oficial colombiano, si la marca lo publica → \`O\`.
2. Pruebas reales hechas en Colombia por medios confiables → \`C\`.
3. El ciclo oficial de otro mercado convertido a km/gal → \`X\` (en la nota: el valor original,
   el ciclo y la operación). Prefiere EPA o WLTP; NEDC y CLTC son muy optimistas.
4. Ajustes a condiciones colombianas (tráfico, altura, gasolina de aquí), o ciudad y carretera
   sacados del combinado → \`E\`, explicando el ajuste.
Coherencia: en un gasolina, carretera rinde más que ciudad; en un híbrido suele ser al revés.

**Las notas al pie** (después de la lista, bajo la línea \`# Notas\`):
- Una línea por dato, con el nombre EXACTO del campo, dos puntos y la explicación:
  \`Consumo mixto (km/gal): 10.2 km/l de la ficha oficial de México (WLTP) × 3.785 = 38.6\`
  \`0–100 km/h (s): prueba instrumentada de Motor, https://www.motor.com.co/…\`
- Obligatorias para cada \`X\` y cada \`E\`. Para \`O\` y \`C\` son opcionales pero útiles: pon la
  fuente (nombre y enlace).
- Si una fuente sirve para muchos datos, una línea sin nombre de campo:
  \`Ficha técnica oficial Chevrolet Colombia 2026: https://www.chevrolet.com.co/…\`
- El precio también puede llevar nota: \`Precio de lista (COP): lista oficial de Chevrolet, octubre 2026\`.

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
Los campos SÍ/NO llevan solo \`Sí\` o \`No\` y su letra (\`Sí O\`). Si el equipo no viene en esa versión, \`No\`.

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
- **Letras:** O, C y X siempre en MAYÚSCULA y separadas por un espacio (\`139 O\`), nunca entre
  paréntesis ni pegadas a una palabra.
- **Estrellas en prueba de choque:** solo el número (\`5\`), de ese modelo y generación. Si
  hay varias pruebas, la de Latin NCAP; si no hay, la más reciente.
- **CarPlay / Android Auto:** es TEXTO: \`Apple CarPlay y Android Auto\`, \`Solo Android Auto\`.
- **Medida de llanta:** una sola (\`215/55 R18\`) y que coincida con \`Rin (pulgadas)\` (\`18\`).
- **Precio de lista:** el de Colombia de esa versión, en pesos. Si no hay precio oficial pero
  sí uno confiable (concesionario, revista colombiana), va con \` C\`.

## 8. Lista de chequeo antes de entregar
1. Identidad completa: Marca, Modelo (con versión), Año, Tren motriz, Carrocería y Precio.
2. Nombres exactos, en orden, sin repetir y solo los que aplican.
3. Solo el dato y su letra: sin unidades, sin paréntesis, sin rangos, sin "según versión".
4. Opciones y Sí/No escritos exactamente.
5. Números en la unidad del campo y dentro de su rango.
6. Cada dato con su letra (O, C, X o E); lo que no se pudo sacar de forma coherente, vacío.
7. Cada \`X\` y cada \`E\` explicado en \`# Notas\`, con el nombre exacto del campo.
8. Consumos pensados para Colombia.
9. La respuesta es solo la guía y sus notas.

## 9. Lista de campos, en orden
Cada línea: \`nombre exacto\` — tipo (unidad y rango válido, u opciones) — a qué carros aplica.
Clases: carro = Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible; pickup = Pickup;
van/camión = Van, Camión.

${lista()}
`;

writeFileSync('docs/prompt-ia-guia.md', PROMPT);
console.log(`docs/prompt-ia-guia.md: ${PROMPT.split('\n').length} líneas, ${FORMATO.length} campos`);
