# Formato de subida de vehículos (8-oct-2026)

Reemplaza la subida con IA (que gastaba tokens por carro). Se llena un texto con
este formato, siempre en el mismo orden, y WiseMotors lo lee sin IA. La lista
completa está abajo; en **Panel → Subir carro** se saca ya personalizada para cada
carro (solo los campos de su tren motriz y carrocería). Cómo llenarla:
`docs/como-llenar-la-guia.md`. El código de la lista es `lib/subida/formato.ts`.

## Reglas

- Una línea por campo: `Campo: valor`. Siempre el mismo orden.
- El estado (Disponible) se pone solo al subir y se cambia en el editor.
- Si no se sabe o no aplica, se deja vacío después de los dos puntos (`Turbo:`).
- La unidad ya está en el nombre del campo: se escribe solo el número (`Largo (mm): 4270`).
- Decimales con coma o punto (`10,9` o `10.9`). Miles sin separador o con punto (`113000000` o `113.000.000`).
- Sí/No para lo que es de sí o no.
- Donde hay opciones, se escribe una de esas opciones tal cual.
- Los campos marcados [solo …] se dejan vacíos en los demás trenes motrices.
- En un híbrido, "Potencia máxima" y "Torque máximo" son los combinados del sistema.
- La relación potencia/peso no se escribe: se calcula con la potencia y el peso.

## Plantilla

```
# Identidad
Marca:
Modelo:
Año:
Tren motriz (Gasolina / Diesel / Eléctrico / Híbrido / Híbrido Enchufable):
Carrocería (Sedán / Hatchback / SUV / Wagon / Deportivo / Convertible / Pickup / Van / Camión):
Categoría (Automóvil / Deportivo / Todoterreno / Lujo / Económico / Comercial):
Precio de lista (COP):

# Motor
Potencia máxima (hp):
Torque máximo (Nm):
Cilindraje (cc): [solo con motor a gasolina o diésel]
Número de cilindros: [solo gasolina/diésel]
Configuración del motor:
Tipo de inducción (Atmosférico / Turbo / Supercargado / Turbo y supercargado):
Ciclo del motor (Otto / Atkinson / Miller / Diésel):
Potencia del motor a gasolina (hp): [solo híbridos]
Potencia del motor eléctrico (hp): [solo híbridos]
Motores eléctricos: [solo eléctrico]
Potencia a qué rpm (rpm): [solo gasolina/diésel]
Corte de rpm (rpm): [solo gasolina/diésel]
Relación de compresión: [solo gasolina/diésel]
Octanaje recomendado: [solo gasolina/diésel]
Norma de emisiones: [solo gasolina/diésel]
Transmisión:
Marchas:

# Consumo y autonomía
Consumo ciudad (km/gal):
Consumo carretera (km/gal):
Consumo mixto (km/gal):
Tanque de combustible (gal):
Consumo eléctrico ciudad (kWh/100 km): [solo eléctrico]
Consumo eléctrico carretera (kWh/100 km): [solo eléctrico]
Autonomía oficial (km): [solo eléctrico y enchufable]

# Batería y carga
Capacidad de batería (kWh): [eléctrico, híbrido y enchufable]
Peso de la batería (kg): [solo enchufable]
Tiempo de carga en casa AC (h): [eléctrico y enchufable]
Potencia de carga en casa AC (kW): [eléctrico y enchufable]
Carga rápida DC 10–80 % (min): [eléctrico y enchufable]
Potencia máxima de carga rápida DC (kW): [eléctrico y enchufable]
Conector de carga: [eléctrico y enchufable]
Frenado regenerativo (Sí/No): [eléctrico, híbrido y enchufable]
Niveles de regeneración: [eléctrico y enchufable]
Manejo con un solo pedal (Sí/No): [solo eléctrico]
Garantía de la batería (años): [eléctrico, híbrido y enchufable]
Garantía de la batería (km): [eléctrico, híbrido y enchufable]

# Desempeño
0–100 km/h (s):
Velocidad máxima (km/h):
Recuperación 50–80 km/h (s):
Adelantamiento 80–120 km/h (s):
0–200 km/h (s):
Cuarto de milla (s):
Launch control (Sí/No):

# Tracción
Tracción (Delantera / Trasera / Integral (AWD) / 4x4):
Tracción integral que se activa sola (Sí/No):
Caja reductora 4L (Sí/No):
Reparto de torque entre ruedas (Sí/No):
Modos de manejo:
Modo remolque (Sí/No):
Levas de cambio en el volante (Sí/No):

# Dimensiones y peso
Largo (mm):
Ancho (mm):
Alto (mm):
Distancia entre ejes (mm):
Despeje al piso (mm):
Radio de giro (m):
Peso en vacío (kg):
Carga en el techo (kg):

# Espacio
Pasajeros:
Filas de asientos:
Puertas:
Baúl (L):
Baúl con sillas abatidas (L):

# Carga y trabajo (pickups, vans y camiones)
Capacidad de carga (kg):
Capacidad de remolque (kg):
Peso bruto vehicular PBV (kg):
Peso bruto combinado (kg):
Volumen de carga del platón o furgón (L):
Largo de la zona de carga (mm):
Ancho de la zona de carga (mm):
Alto de la zona de carga (mm):

# Llantas
Medida de llanta:
Rin (pulgadas):
Llanta de repuesto (Tamaño completo / Temporal / Kit de reparación / No trae):

# Chasis y frenos
Suspensión delantera:
Suspensión trasera:
Amortiguación adaptativa (Sí/No):
Frenos delanteros (Disco / Tambor):
Frenos traseros (Disco / Tambor):
Material de los discos:
Pinzas de freno:
Frenado 100–0 km/h (m):
Aceleración lateral máxima (g):
Aceleración longitudinal máxima (g):

# Todoterreno
Ángulo de ataque (°):
Ángulo de salida (°):
Ángulo ventral (°):
Vadeo (mm):
Pendiente máxima (%):
Control de descenso (Sí/No):
Control de tracción para trocha (Sí/No):
Modos de terreno:

# Seguridad
Airbags:
Anclajes ISOFIX (Sí/No):
Control de estabilidad (Sí/No):
Control de tracción (Sí/No):
Monitoreo de presión de llantas (Sí/No):
Calificación NCAP (estrellas):
Quién hizo la prueba de choque (Latin NCAP / Euro NCAP / ANCAP / ASEAN NCAP / C-NCAP / IIHS / NHTSA / Global NCAP):
Año de la prueba de choque:
Asistencias NCAP (%):

# Asistencias de manejo
Frenado autónomo de emergencia (Sí/No):
Alerta de colisión frontal (Sí/No):
Asistente de carril (Sí/No):
Punto ciego (Sí/No):
Crucero adaptativo (Sí/No):
Monitor de fatiga (Sí/No):
Asistente de frenado (Sí/No):
Asistente de arranque en pendiente (Sí/No):
Cámara de reversa (Sí/No):
Cámaras 360° (Sí/No):
Sensores de parqueo traseros (Sí/No):
Sensores de parqueo delanteros (Sí/No):
Se parquea solo (Sí/No):

# Luces
Tipo de faros:
Luces altas automáticas (Sí/No):
Exploradoras delanteras (Sí/No):
Direccionales secuenciales (Sí/No):
Lavafaros (Sí/No):
Sensor de lluvia (Sí/No):

# Confort
Aire acondicionado (Sí/No):
Climatizador automático (Sí/No):
Zonas de climatizador:
Salidas de aire para atrás (Sí/No):
Encendido sin llave (Sí/No):
Techo (Corredizo / Panorámico / Panorámico fijo):
Vidrios eléctricos (Solo adelante / Adelante y atrás):
Material de las sillas:
Silla del conductor eléctrica (Sí/No):
Silla del copiloto eléctrica (Sí/No):
Memoria de posición (Sí/No):
Asientos calefaccionados (Sí/No):
Asientos ventilados (Sí/No):
Asientos con masaje (Sí/No):
Segunda fila corrediza (Sí/No):
Volante:
Volante con calefacción (Sí/No):
Retrovisor que se oscurece solo (Sí/No):
Luz ambiental (Sí/No):
Vidrios acústicos (Sí/No):

# Tecnología
Pantalla central (pulgadas):
Pantalla táctil (Sí/No):
Tablero digital (pulgadas):
CarPlay / Android Auto:
CarPlay / Android Auto sin cable (Sí/No):
Bluetooth (Sí/No):
Cargador inalámbrico (Sí/No):
Puertos USB-A:
Puertos USB-C:
Marca del sonido:
Parlantes:
Start-Stop (Sí/No): [no eléctrico]

# Garantía y mantenimiento
Garantía (años):
Garantía (km):
Asistencia en carretera (años):
Mantenimiento cada (km):
Mantenimiento cada (meses):
Costo de los 3 primeros mantenimientos (COP):
País donde se fabrica:
```
