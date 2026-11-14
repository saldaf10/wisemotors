// Formato de los códigos de invitación para mostrar (sin dependencias de Node: sirve en el navegador).

/** "482913" → "482 913". */
export function formatearCodigo(codigo: string): string {
  const d = codigo.replace(/\D/g, '');
  return d.length === 6 ? `${d.slice(0, 3)} ${d.slice(3)}` : codigo;
}
