# Cómo llenar la guía de un carro

La guía es el texto que se pega en **Panel → Subir carro**. WiseMotors la lee sin IA,
así que subir un carro no gasta nada.

## 1. Saca la plantilla del carro

1. Entra a **Subir carro**.
2. Elige el **tren motriz** (Gasolina, Diesel, Eléctrico, Híbrido o Híbrido Enchufable) y la **carrocería**.
3. Toca **Copiar plantilla**. Ya viene solo con los campos que aplican a ese carro.
   Por ejemplo, un eléctrico no trae cilindraje y un sedán no trae todoterreno.

## 2. Consigue la ficha técnica

Usa, en este orden:

1. La ficha técnica oficial **de Colombia** de esa versión: el PDF de la marca o del concesionario.
2. La página oficial de la marca en Colombia.
3. Una revista o portal colombiano serio, solo para lo que no traiga la oficial.

Usa siempre la misma versión y el mismo año que vas a subir, por ejemplo "Tracker RS 2026".
Si la ficha trae varias versiones en columnas, copia solo la columna de esa versión.

## 3. Llénala

- Escribe después de los dos puntos: `Largo (mm): 4270`.
- **Si un dato no está en la ficha, déjalo vacío.** No lo adivines ni lo copies de otra versión.
- **Solo el número.** La unidad ya está en el nombre del campo.
  - Decimales con coma o punto: `10,9` o `10.9`.
  - Miles con punto o sin nada: `113.000.000` o `113000000`.
- **Sí o No** en los campos de sí o no.
- **Campos con opciones:** escribe una de las que salen entre paréntesis. Puedes borrar el
  paréntesis o dejarlo. No importan las mayúsculas, las tildes ni un error de tipeo pequeño:
  "tambro" se entiende como Tambor.
- **No cambies los nombres de los campos** ni pongas dos datos en una línea.

### Conversiones que más se necesitan

| La ficha dice | El campo pide | Cómo pasarlo |
|---|---|---|
| km/l | km/gal | multiplica por 3,785 (15 km/l → 56,8 km/gal) |
| l/100 km | km/gal | 378,5 ÷ el número (6,5 l/100 km → 58,2 km/gal) |
| kW (potencia) | hp | multiplica por 1,341 (110 kW → 147,5 hp) |
| CV o PS | hp | multiplica por 0,986 |
| kgm (torque) | Nm | multiplica por 9,807 |
| litros (tanque) | gal | divide por 3,785 (48 L → 12,7 gal) |
| m o cm (medidas) | mm | m × 1000, cm × 10 |
| "1.5 L" (motor) | cc | usa el cilindraje exacto de la ficha (1498); si no está, 1500 |

En los **híbridos**, "Potencia máxima" y "Torque máximo" son los **combinados del sistema**.
La potencia de cada motor va en sus propios campos.

## 4. Pégala y revisa

1. Pega la guía en **Pega la guía llena**. Se lee al instante.
2. **En rojo** sale lo que no se entendió: un número fuera de lo normal, una opción que no
   existe o un campo con el nombre mal escrito. Corrígelo en el texto; mientras haya algo en
   rojo no se puede publicar.
3. **En amarillo** salen los avisos, por ejemplo un dato que no aplica a este carro. Se ignoran solos.
4. En la tabla revisa la columna **Se guarda**: es lo que va a quedar en WiseMotors.
5. Sube las fotos por vista (la lateral es la portada), marca quién lo vende y toca **Publicar**.

## Opcional: llenarla con un chat de IA

Si quieres ahorrar tiempo, puedes usar tu suscripción de Claude o ChatGPT. Ese chat no gasta la
API de WiseMotors. Pega la plantilla, adjunta la ficha técnica en PDF y usa este mensaje:

> Llena esta plantilla con la ficha técnica adjunta, **solo para la versión [VERSIÓN AÑO]**.
> Reglas: escribe solo el número después de los dos puntos (la unidad ya está en el nombre);
> convierte unidades si hace falta (km/l × 3,785 = km/gal, kW × 1,341 = hp, litros ÷ 3,785 = gal);
> Sí o No en los campos de sí o no; en los campos con opciones usa una de las opciones exactas;
> **si un dato no está en la ficha, deja el campo vacío, nunca lo adivines ni lo saques de otra
> versión**; no cambies ni reordenes los nombres de los campos; devuelve solo la plantilla llena.

Antes de publicar, revisa siempre la tabla **Se guarda** contra la ficha. La IA de un chat
también se equivoca de versión o de unidad.
