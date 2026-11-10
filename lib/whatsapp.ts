/** Celular colombiano en formato wa.me (57 + 10 dígitos que empiezan por 3), o null si es fijo / no se entiende. */
export function whatsappDe(telefono?: string | null): string | null {
  const d = (telefono ?? '').replace(/\D/g, '');
  if (/^3\d{9}$/.test(d)) return `57${d}`;
  if (/^573\d{9}$/.test(d)) return d;
  return null;
}
