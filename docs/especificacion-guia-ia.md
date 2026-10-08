# Especificación de la guía de subida de WiseMotors (para una IA que la llena)

Tu trabajo: a partir de la ficha técnica de UN carro (una versión, un año), producir un texto
que el sistema de WiseMotors lee automáticamente, sin IA. El sistema es estricto con los
nombres de los campos y con el formato de los valores. Sigue estas reglas al pie de la letra.

## 1. Formato de salida

- Devuelve SOLO el texto de la guía. Nada antes ni después: sin saludos, sin explicaciones, sin
  bloques de código, sin negritas, sin viñetas, sin numeración.
- Una línea por campo, con esta forma exacta: `Nombre del campo: valor`
  - El nombre del campo, copiado EXACTO de la lista de la sección 6 (con sus tildes, mayúsculas,
    signos y la unidad entre paréntesis, por ejemplo `Largo (mm)`).
  - Luego dos puntos `:`, un espacio y el valor.
  - Sin punto final.
- Respeta el ORDEN de la lista de la sección 6. No repitas campos. No inventes campos.
- Puedes poner líneas de sección que empiecen con `#` (por ejemplo `# Motor`); el sistema las ignora.
- Las líneas en blanco se ignoran.
- Incluye SOLO los campos que aplican al carro según su tren motriz y carrocería (sección 5).
  Si incluyes uno que no aplica, el sistema lo ignora y avisa.

## 2. Campos vacíos (lo más importante)

- Si un dato NO está en la ficha técnica, deja el campo vacío: `Torque máximo (Nm):` (nada
  después de los dos puntos). El sistema lo salta y no lo guarda.
- NUNCA adivines, estimes, redondees a ojo ni copies un dato de otra versión, otro año u otro
  mercado. Un campo vacío es correcto; un dato inventado es un error grave.
- NUNCA escribas `No` en un campo de TEXTO para decir que no lo tiene: déjalo vacío.
  `No` solo se usa en los campos SÍ/NO.
- Valores que el sistema también trata como vacíos (mejor no usarlos, deja vacío):
  `-`, `--`, `N/A`, `n/a`, `no aplica`, `sin dato`, `ND`, `?`.
- Cada valor va en su propia línea. Nunca pongas dos datos en la misma línea ni dejes que un
  valor se corra a la línea de otro campo.

## 3. Cómo escribir cada tipo de valor

**NÚMERO**
- Solo el número, sin la unidad: la unidad ya está en el nombre del campo. `Largo (mm): 4270`
- Sin separador de miles: `113000000`, `4270`, `1199`.
- Decimales con punto y como máximo 2 decimales: `10.9`, `1.6`, `0.85`.
  (Ojo: el sistema lee un punto seguido de exactamente 3 cifras como separador de miles:
  `1.250` = 1250. Por eso nunca escribas 3 decimales.)
- Un solo número por campo. Nada de rangos (`150-160`) ni de textos (`aprox. 150`).
- Si la ficha trae el dato en otra unidad, conviértelo (sección 4) y escribe el resultado
  redondeado a máximo 1 decimal.
- Cada número tiene un rango válido (sección 6). Si el valor queda fuera, el sistema NO lo
  guarda: casi siempre es un error de unidad. Revisa la conversión.
- Un número que vale cero solo se escribe donde el rango empieza en 0 (por ejemplo
  `Airbags: 0`, `Capacidad de remolque (kg): 0`). En los demás, si no tiene, deja vacío.

**SÍ/NO**
- Escribe exactamente `Sí` o `No`.
- `Sí` solo si la ficha dice que esa versión lo trae de serie. Si es opcional o es de otra
  versión, `No`. Si la ficha no menciona el equipo para nada, deja vacío (no asumas `No`).

**OPCIÓN**
- Escribe exactamente una de las opciones listadas, copiada tal cual (con tildes y
  mayúsculas). Ejemplo: `Tracción: Integral (AWD)`.
- Nunca escribas una opción que no está en la lista. Si ninguna encaja, deja vacío.

**TEXTO libre**
- Texto corto (máximo 200 caracteres), en español, como lo diría la ficha. Ver ejemplos de la sección 7.

## 4. Conversiones de unidades

| La ficha dice | El campo pide | Operación | Ejemplo |
|---|---|---|---|
| km/l | km/gal | × 3.785 | 15 km/l → 56.8 |
| l/100 km | km/gal | 378.5 ÷ valor | 6.5 l/100 km → 58.2 |
| mpg (EE. UU.) | km/gal | × 1.609 | 35 mpg → 56.3 |
| kW (potencia) | hp | × 1.341 | 110 kW → 147.5 |
| CV o PS | hp | × 0.986 | 150 CV → 147.9 |
| kgm o kgf·m (torque) | Nm | × 9.807 | 25.5 kgm → 250.1 |
| lb-ft (torque) | Nm | × 1.356 | 180 lb-ft → 244.1 |
| litros (tanque) | gal | ÷ 3.785 | 48 L → 12.7 |
| m (medidas) | mm | × 1000 | 4.27 m → 4270 |
| cm (medidas) | mm | × 10 | 18 cm → 180 |
| m³ (volumen de carga) | L | × 1000 | 12 m³ → 12000 |
| toneladas | kg | × 1000 | 1.2 t → 1200 |
| Wh/km (consumo eléctrico) | kWh/100 km | ÷ 10 | 150 Wh/km → 15 |
| "1.5 L" o "1.5T" (motor) | cc | usa el cilindraje exacto de la ficha (ej. 1498); si solo dice 1.5 L, escribe 1500 | |

## 5. Qué campos van según el carro

Primero se definen dos datos de identidad: `Tren motriz` y `Carrocería`. Ellos deciden qué
campos van:

- **Clase** según la carrocería:
  - carro = Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible
  - Pickup = Pickup
  - Van/Camión = Van, Camión
- Cada campo de la sección 6 dice a qué trenes motrices, clases o carrocerías aplica.
  "Todos" significa que va en cualquier carro.
- **Campos "por motor":** potencia, torque, cilindraje, consumo, tanque, transmisión, batería,
  autonomía, etc. Son UN solo campo aunque el carro sea a gasolina, híbrido o eléctrico; el
  sistema lo guarda en el lugar correcto según el tren motriz.
- **Híbrido e Híbrido Enchufable:** `Potencia máxima (hp)` y `Torque máximo (Nm)` son los
  COMBINADOS del sistema. La potencia de cada motor va en `Potencia del motor a gasolina (hp)`
  y `Potencia del motor eléctrico (hp)`.
- **Tren motriz:**
  - Un híbrido suave (mild hybrid, MHEV, 48 V) es `Híbrido`.
  - Un híbrido que se enchufa (PHEV) es `Híbrido Enchufable`.
  - El diésel se escribe `Diesel`, sin tilde (es la opción exacta).
- **Carrocería:**
  - Una "camioneta" sin platón es `SUV`.
  - Con platón es `Pickup`.
  - Furgón o van de pasajeros o de carga es `Van`.

## 6. Lista de campos, en orden

Cada línea: `nombre exacto` — tipo (rango válido u opciones) — a qué carros aplica.

### Identidad
- `Marca` — TEXTO. OBLIGATORIO. Va en todos los carros.
- `Modelo` — TEXTO. OBLIGATORIO. Va en todos los carros.
- `Año` — NÚMERO entero de 4 cifras (1990 a 2035). OBLIGATORIO. Va en todos los carros.
- `Tren motriz` — OPCIÓN: Gasolina | Diesel | Eléctrico | Híbrido | Híbrido Enchufable. OBLIGATORIO. Va en todos los carros.
- `Carrocería` — OPCIÓN: Sedán | Hatchback | SUV | Wagon | Deportivo | Convertible | Pickup | Van | Camión. OBLIGATORIO. Va en todos los carros.
- `Categoría` — OPCIÓN: Automóvil | Deportivo | Todoterreno | Lujo | Económico | Comercial. Recomendado (si va vacío: Comercial para Van/Camión, Automóvil para el resto). Va en todos los carros.
- `Precio de lista (COP)` — NÚMERO en pesos colombianos (5.000.000 a 5.000.000.000). OBLIGATORIO. Va en todos los carros.

### Motor
- `Potencia máxima (hp)` — NÚMERO en HP (rango válido 40 a 1.600). Todos.
- `Torque máximo (Nm)` — NÚMERO en Nm (rango válido 60 a 1.500; van/camión 60 a 3.000). Todos.
- `Cilindraje (cc)` — NÚMERO en cc (rango válido 600 a 8.500; van/camión 600 a 16.000). solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Número de cilindros` — NÚMERO (rango válido 2 a 12). solo Gasolina, Diesel.
- `Configuración del motor` — TEXTO libre. solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Tipo de inducción` — OPCIÓN: Atmosférico | Turbo | Supercargado | Turbo y supercargado. solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Ciclo del motor` — OPCIÓN: Otto | Atkinson | Miller | Diésel. solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Potencia del motor a gasolina (hp)` — NÚMERO en HP (rango válido 40 a 600). solo Híbrido, Híbrido Enchufable.
- `Potencia del motor eléctrico (hp)` — NÚMERO en HP (rango válido 10 a 400). solo Híbrido, Híbrido Enchufable.
- `Motores eléctricos` — NÚMERO (rango válido 1 a 4). solo Eléctrico.
- `Potencia a qué rpm (rpm)` — NÚMERO en rpm (rango válido 1.000 a 9.000). solo Gasolina, Diesel.
- `Corte de rpm (rpm)` — NÚMERO en rpm (rango válido 4.000 a 10.000). solo Gasolina, Diesel.
- `Relación de compresión` — NÚMERO (rango válido 7 a 16). solo Gasolina, Diesel.
- `Octanaje recomendado` — TEXTO libre. solo Gasolina, Diesel.
- `Norma de emisiones` — TEXTO libre. solo Gasolina, Diesel.
- `Transmisión` — TEXTO libre. solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Marchas` — NÚMERO (rango válido 1 a 10). solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.

### Consumo y autonomía
- `Consumo ciudad (km/gal)` — NÚMERO en km/gal (rango válido 10 a 90; van/camión 3 a 90). solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Consumo carretera (km/gal)` — NÚMERO en km/gal (rango válido 15 a 110; van/camión 4 a 110). solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Consumo mixto (km/gal)` — NÚMERO en km/gal (rango válido 12 a 100; van/camión 3 a 100). solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Tanque de combustible (gal)` — NÚMERO en gal (rango válido 5 a 40; pickup 5 a 45; van/camión 5 a 200). solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.
- `Consumo eléctrico ciudad (kWh/100 km)` — NÚMERO en kWh/100km (rango válido 8 a 35; van/camión 8 a 150). solo Eléctrico.
- `Consumo eléctrico carretera (kWh/100 km)` — NÚMERO en kWh/100km (rango válido 10 a 40; van/camión 10 a 150). solo Eléctrico.
- `Autonomía oficial (km)` — NÚMERO en km (rango válido 80 a 900). solo Eléctrico, Híbrido Enchufable.

### Batería y carga
- `Capacidad de batería (kWh)` — NÚMERO en kWh (rango válido 10 a 200; van/camión 10 a 600). solo Eléctrico, Híbrido, Híbrido Enchufable.
- `Peso de la batería (kg)` — NÚMERO en kg (rango válido 50 a 500). solo Híbrido Enchufable.
- `Tiempo de carga en casa AC (h)` — NÚMERO en h (rango válido 1 a 40). solo Eléctrico, Híbrido Enchufable.
- `Potencia de carga en casa AC (kW)` — NÚMERO en kW (rango válido 2 a 22). solo Eléctrico, Híbrido Enchufable.
- `Carga rápida DC 10–80 % (min)` — NÚMERO en min (rango válido 10 a 240). solo Eléctrico, Híbrido Enchufable.
- `Potencia máxima de carga rápida DC (kW)` — NÚMERO en kW (rango válido 10 a 400). solo Eléctrico, Híbrido Enchufable.
- `Conector de carga` — TEXTO libre. solo Eléctrico, Híbrido Enchufable.
- `Frenado regenerativo` — SÍ/NO. solo Eléctrico, Híbrido, Híbrido Enchufable.
- `Niveles de regeneración` — NÚMERO (rango válido 1 a 6). solo Eléctrico, Híbrido Enchufable.
- `Manejo con un solo pedal` — SÍ/NO. solo Eléctrico.
- `Garantía de la batería (años)` — NÚMERO en años (rango válido 1 a 12). solo Eléctrico, Híbrido, Híbrido Enchufable.
- `Garantía de la batería (km)` — NÚMERO en km (rango válido 20.000 a 1.500.000). solo Eléctrico, Híbrido, Híbrido Enchufable.

### Desempeño
- `0–100 km/h (s)` — NÚMERO en s (rango válido 1,8 a 25; van/camión 3 a 60). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Velocidad máxima (km/h)` — NÚMERO en km/h (rango válido 90 a 420; van/camión 60 a 220). Todos.
- `Recuperación 50–80 km/h (s)` — NÚMERO en s (rango válido 1,5 a 15). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Adelantamiento 80–120 km/h (s)` — NÚMERO en s (rango válido 2 a 20). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `0–200 km/h (s)` — NÚMERO en s (rango válido 5 a 60). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).
- `Cuarto de milla (s)` — NÚMERO en s (rango válido 7 a 25). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).
- `Launch control` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).

### Tracción
- `Tracción` — OPCIÓN: Delantera | Trasera | Integral (AWD) | 4x4. Todos.
- `Tracción integral que se activa sola` — SÍ/NO. Todos.
- `Caja reductora 4L` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Reparto de torque entre ruedas` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Modos de manejo` — TEXTO libre. Todos.
- `Modo remolque` — SÍ/NO. Todos.
- `Levas de cambio en el volante` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.

### Dimensiones y peso
- `Largo (mm)` — NÚMERO en mm (rango válido 2.500 a 6.500; van/camión 3.500 a 14.000). Todos.
- `Ancho (mm)` — NÚMERO en mm (rango válido 1.400 a 2.300; van/camión 1.400 a 2.600). Todos.
- `Alto (mm)` — NÚMERO en mm (rango válido 1.100 a 2.200; pickup 1.100 a 2.300; van/camión 1.100 a 4.300). Todos.
- `Distancia entre ejes (mm)` — NÚMERO en mm (rango válido 1.800 a 4.000; van/camión 1.800 a 7.500). Todos.
- `Despeje al piso (mm)` — NÚMERO en mm (rango válido 80 a 350; pickup 80 a 400; van/camión 80 a 450). Todos.
- `Radio de giro (m)` — NÚMERO en m (rango válido 4 a 8). Todos.
- `Peso en vacío (kg)` — NÚMERO en kg (rango válido 600 a 3.500; pickup 900 a 4.000; van/camión 900 a 20.000). Todos.
- `Carga en el techo (kg)` — NÚMERO en kg (rango válido 20 a 200). Todos.

### Espacio
- `Pasajeros` — NÚMERO (rango válido 2 a 9; pickup 2 a 6; van/camión 1 a 25). Todos.
- `Filas de asientos` — NÚMERO (rango válido 1 a 4; van/camión 1 a 7). Todos.
- `Puertas` — NÚMERO (rango válido 2 a 5; van/camión 2 a 6). Todos.
- `Baúl (L)` — NÚMERO en L (rango válido 50 a 1.200; pickup 50 a 3.000; van/camión 100 a 80.000). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).
- `Baúl con sillas abatidas (L)` — NÚMERO en L (rango válido 100 a 3.500; van/camión 100 a 80.000). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).

### Carga y trabajo
- `Capacidad de carga (kg)` — NÚMERO en kg (rango válido 100 a 2.500; van/camión 200 a 40.000). solo clase Pickup y Van/Camión.
- `Capacidad de remolque (kg)` — NÚMERO en kg (rango válido 0 a 5.000; van/camión 0 a 50.000). Todos.
- `Peso bruto vehicular PBV (kg)` — NÚMERO en kg (rango válido 900 a 4.500; pickup 1.500 a 6.000; van/camión 1.500 a 45.000). solo clase Pickup y Van/Camión.
- `Peso bruto combinado (kg)` — NÚMERO en kg (rango válido 1.000 a 10.000; pickup 2.000 a 12.000; van/camión 2.000 a 80.000). solo clase Pickup y Van/Camión.
- `Volumen de carga del platón o furgón (L)` — NÚMERO en L (rango válido 100 a 5.000; van/camión 100 a 80.000). solo clase Pickup y Van/Camión.
- `Largo de la zona de carga (mm)` — NÚMERO en mm (rango válido 300 a 3.000; pickup 1.000 a 3.000; van/camión 1.000 a 14.000). solo clase Pickup y Van/Camión.
- `Ancho de la zona de carga (mm)` — NÚMERO en mm (rango válido 300 a 2.000; van/camión 300 a 2.600). solo clase Pickup y Van/Camión.
- `Alto de la zona de carga (mm)` — NÚMERO en mm (rango válido 200 a 1.500; van/camión 200 a 3.200). solo clase Pickup y Van/Camión.

### Llantas
- `Medida de llanta` — TEXTO libre. Todos.
- `Rin (pulgadas)` — NÚMERO en pulgadas (rango válido 13 a 23; van/camión 13 a 24,5). Todos.
- `Llanta de repuesto` — OPCIÓN: Tamaño completo | Temporal | Kit de reparación | No trae. Todos.

### Chasis y frenos
- `Suspensión delantera` — TEXTO libre. Todos.
- `Suspensión trasera` — TEXTO libre. Todos.
- `Amortiguación adaptativa` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Frenos delanteros` — OPCIÓN: Disco | Tambor. Todos.
- `Frenos traseros` — OPCIÓN: Disco | Tambor. Todos.
- `Material de los discos` — TEXTO libre. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).
- `Pinzas de freno` — TEXTO libre. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).
- `Frenado 100–0 km/h (m)` — NÚMERO en m (rango válido 28 a 60). Todos.
- `Aceleración lateral máxima (g)` — NÚMERO en g (rango válido 0,5 a 1,6). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).
- `Aceleración longitudinal máxima (g)` — NÚMERO en g (rango válido 0,3 a 1,8). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).

### Todoterreno
- `Ángulo de ataque (°)` — NÚMERO en ° (rango válido 5 a 55). solo carrocería SUV y Pickup.
- `Ángulo de salida (°)` — NÚMERO en ° (rango válido 5 a 55). solo carrocería SUV y Pickup.
- `Ángulo ventral (°)` — NÚMERO en ° (rango válido 5 a 45). solo carrocería SUV y Pickup.
- `Vadeo (mm)` — NÚMERO en mm (rango válido 100 a 1.000). solo carrocería SUV y Pickup.
- `Pendiente máxima (%)` — NÚMERO en % (rango válido 20 a 100). solo carrocería SUV y Pickup.
- `Control de descenso` — SÍ/NO. solo carrocería SUV y Pickup.
- `Control de tracción para trocha` — SÍ/NO. solo carrocería SUV y Pickup.
- `Modos de terreno` — TEXTO libre. solo carrocería SUV y Pickup.

### Seguridad
- `Airbags` — NÚMERO (rango válido 0 a 12). Todos.
- `Anclajes ISOFIX` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Control de estabilidad` — SÍ/NO. Todos.
- `Control de tracción` — SÍ/NO. Todos.
- `Monitoreo de presión de llantas` — SÍ/NO. Todos.
- `Calificación NCAP (estrellas)` — NÚMERO en ★ (rango válido 0 a 5). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Quién hizo la prueba de choque` — OPCIÓN: Latin NCAP | Euro NCAP | ANCAP | ASEAN NCAP | C-NCAP | IIHS | NHTSA | Global NCAP. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Año de la prueba de choque` — NÚMERO (rango válido 2010 a 2030). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Asistencias NCAP (%)` — NÚMERO en % (rango válido 0 a 100). solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.

### Asistencias de manejo
- `Frenado autónomo de emergencia` — SÍ/NO. Todos.
- `Alerta de colisión frontal` — SÍ/NO. Todos.
- `Asistente de carril` — SÍ/NO. Todos.
- `Punto ciego` — SÍ/NO. Todos.
- `Crucero adaptativo` — SÍ/NO. Todos.
- `Monitor de fatiga` — SÍ/NO. Todos.
- `Asistente de frenado` — SÍ/NO. Todos.
- `Asistente de arranque en pendiente` — SÍ/NO. Todos.
- `Cámara de reversa` — SÍ/NO. Todos.
- `Cámaras 360°` — SÍ/NO. Todos.
- `Sensores de parqueo traseros` — SÍ/NO. Todos.
- `Sensores de parqueo delanteros` — SÍ/NO. Todos.
- `Se parquea solo` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).

### Luces
- `Tipo de faros` — TEXTO libre. Todos.
- `Luces altas automáticas` — SÍ/NO. Todos.
- `Exploradoras delanteras` — SÍ/NO. Todos.
- `Direccionales secuenciales` — SÍ/NO. Todos.
- `Lavafaros` — SÍ/NO. Todos.
- `Sensor de lluvia` — SÍ/NO. Todos.

### Confort
- `Aire acondicionado` — SÍ/NO. Todos.
- `Climatizador automático` — SÍ/NO. Todos.
- `Zonas de climatizador` — NÚMERO (rango válido 1 a 4). Todos.
- `Salidas de aire para atrás` — SÍ/NO. Todos.
- `Encendido sin llave` — SÍ/NO. Todos.
- `Techo` — OPCIÓN: Corredizo | Panorámico | Panorámico fijo. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Vidrios eléctricos` — OPCIÓN: Solo adelante | Adelante y atrás. Todos.
- `Material de las sillas` — TEXTO libre. Todos.
- `Silla del conductor eléctrica` — SÍ/NO. Todos.
- `Silla del copiloto eléctrica` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Memoria de posición` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Asientos calefaccionados` — SÍ/NO. Todos.
- `Asientos ventilados` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Asientos con masaje` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible).
- `Segunda fila corrediza` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Volante` — TEXTO libre. Todos.
- `Volante con calefacción` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Retrovisor que se oscurece solo` — SÍ/NO. Todos.
- `Luz ambiental` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.
- `Vidrios acústicos` — SÍ/NO. solo clase carro (Sedán, Hatchback, SUV, Wagon, Deportivo, Convertible) y Pickup.

### Tecnología
- `Pantalla central (pulgadas)` — NÚMERO en pulgadas (rango válido 5 a 20). Todos.
- `Pantalla táctil` — SÍ/NO. Todos.
- `Tablero digital (pulgadas)` — NÚMERO en pulgadas (rango válido 3 a 16). Todos.
- `CarPlay / Android Auto` — TEXTO libre. Todos.
- `CarPlay / Android Auto sin cable` — SÍ/NO. Todos.
- `Bluetooth` — SÍ/NO. Todos.
- `Cargador inalámbrico` — SÍ/NO. Todos.
- `Puertos USB-A` — NÚMERO (rango válido 1 a 10). Todos.
- `Puertos USB-C` — NÚMERO (rango válido 1 a 10). Todos.
- `Marca del sonido` — TEXTO libre. Todos.
- `Parlantes` — NÚMERO (rango válido 2 a 30). Todos.
- `Start-Stop` — SÍ/NO. solo Gasolina, Diesel, Híbrido, Híbrido Enchufable.

### Garantía y mantenimiento
- `Garantía (años)` — NÚMERO en años (rango válido 1 a 10). Todos.
- `Garantía (km)` — NÚMERO en km (rango válido 20.000 a 1.000.000). Todos.
- `Asistencia en carretera (años)` — NÚMERO en años (rango válido 1 a 10). Todos.
- `Mantenimiento cada (km)` — NÚMERO en km (rango válido 5.000 a 40.000). Todos.
- `Mantenimiento cada (meses)` — NÚMERO en meses (rango válido 3 a 24). Todos.
- `Costo de los 3 primeros mantenimientos (COP)` — NÚMERO en COP (rango válido 300.000 a 20.000.000). Todos.
- `País donde se fabrica` — TEXTO libre. Todos.

## 7. Cómo escribir los campos de TEXTO libre

| Campo | Cómo escribirlo | Ejemplos |
|---|---|---|
| `Marca` | Marca comercial | `Chevrolet`, `Toyota`, `BYD` |
| `Modelo` | Modelo + versión, como se vende en Colombia | `Tracker RS`, `Corolla Cross SEG Hybrid` |
| `Configuración del motor` | Cilindros y disposición | `4 cilindros en línea`, `3 cilindros en línea`, `V6` |
| `Transmisión` | Empieza con `Automática` o `Manual`; el tipo entre paréntesis | `Automática (CVT)`, `Automática (6 velocidades)`, `Automática (doble embrague)`, `Manual` |
| `Octanaje recomendado` | Como lo diga la ficha | `Corriente`, `Extra`, `91 octanos` |
| `Norma de emisiones` | Norma | `Euro 6`, `Euro 5` |
| `Conector de carga` | Conector | `CCS2`, `Tipo 2`, `GB/T` |
| `Modos de manejo` | Lista separada por comas | `Eco, Normal, Sport` |
| `Medida de llanta` | Medida completa | `215/55 R17` |
| `Suspensión delantera` / `Suspensión trasera` | Tipo | `Independiente McPherson`, `Eje torsional`, `Multibrazo`, `Eje rígido con ballestas` |
| `Material de los discos` | Material | `Discos ventilados`, `Carbono-cerámica` |
| `Pinzas de freno` | Pinzas | `Brembo de 4 pistones` |
| `Modos de terreno` | Lista separada por comas | `Arena, Barro, Nieve` |
| `Tipo de faros` | Tecnología | `LED`, `Halógenos`, `Full LED matriciales` |
| `Material de las sillas` | Material | `Cuero`, `Tela`, `Cuero sintético`, `Tela y cuero` |
| `Volante` | Cómo es | `Forrado en cuero, multifunción` |
| `CarPlay / Android Auto` | Cuáles trae (vacío si no trae ninguno) | `Apple CarPlay y Android Auto`, `Solo Android Auto` |
| `Marca del sonido` | Marca (vacío si es el genérico) | `Bose`, `JBL`, `Harman Kardon` |
| `País donde se fabrica` | País | `México`, `Brasil`, `China` |

## 8. Ejemplo (SUV a gasolina, con datos ficticios)

```
# Identidad
Marca: Chevrolet
Modelo: Tracker RS
Año: 2026
Tren motriz: Gasolina
Carrocería: SUV
Categoría: Automóvil
Precio de lista (COP): 113000000

# Motor
Potencia máxima (hp): 153
Torque máximo (Nm): 240
Cilindraje (cc): 1199
Número de cilindros: 3
Configuración del motor: 3 cilindros en línea
Tipo de inducción: Turbo
Ciclo del motor:
Potencia a qué rpm (rpm): 5500
Corte de rpm (rpm):
Relación de compresión:
Octanaje recomendado: Corriente
Norma de emisiones: Euro 6
Transmisión: Automática (6 velocidades)
Marchas: 6

# Tracción
Tracción: Delantera

# Dimensiones y peso
Largo (mm): 4270
Despeje al piso (mm): 175

# Seguridad
Airbags: 6
Control de estabilidad: Sí

# Asistencias de manejo
Cámara de reversa: Sí
Cámaras 360°: No
```

En el ejemplo se omitieron campos solo para acortar. En la respuesta real van TODOS los campos
que aplican al carro, en el orden de la sección 6, vacíos los que no estén en la ficha.

## 9. Lista de chequeo antes de entregar

1. Los 7 campos de identidad están al inicio. `Marca`, `Modelo`, `Año`, `Tren motriz`,
   `Carrocería` y `Precio de lista (COP)` tienen valor.
2. Todos los nombres están copiados exactos de la sección 6, en ese orden, sin repetir.
3. Solo están los campos que aplican a ese tren motriz y esa carrocería.
4. Cada número está sin unidad, sin separador de miles, con punto decimal y dentro de su rango.
5. Los SÍ/NO dicen exactamente `Sí` o `No`, y las OPCIONES son una opción exacta de la lista.
6. Nada está inventado: lo que no está en la ficha quedó vacío.
7. Todos los datos son de ESA versión y ESE año, no de otra versión ni de otro país.
8. La respuesta es solo el texto de la guía, sin nada más.
