# Especificación de la guía de subida para una IA

Reemplazada por **[prompt-ia-guia.md](prompt-ia-guia.md)**: el prompt completo para la IA que
llena la guía (reglas + lista de campos con nombres exactos, unidades, rangos y opciones).

Ese archivo se genera desde el código de Wise, así que siempre coincide con lo que el sistema
acepta. Si cambia un campo en `lib/subida/formato.ts` o en el registro, vuelve a generarlo:

    npx tsx scripts/generar-prompt-guia.ts
