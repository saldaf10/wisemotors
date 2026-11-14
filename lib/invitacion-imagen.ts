// ============================================================================
// La invitación como imagen (nov-2026): PNG de 1080×1350 para mandar por
// WhatsApp, con el nombre de la persona, su código y "Invitación #037 de 100".
// Se dibuja en el navegador (canvas) con las fuentes del sitio: no hay servidor
// ni costo. Solo navegador: usa document.fonts y canvas.
// ============================================================================

import { formatearCodigo } from './invitaciones-formato';

export interface DatosInvitacion {
  nombre: string;
  codigo: string;
  numero: number;
  total: number;
}

export const ANCHO = 1080;
export const ALTO = 1350;
const MARGEN = 96;
const LILA = '#d8b4fe';
const WISE = '#881cb7';
const FONDO = '#0e0c11';

function familias() {
  const css = getComputedStyle(document.documentElement);
  return {
    sans: css.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif',
    mono: css.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace',
  };
}

/** Espera a que las fuentes del sitio estén listas: si no, el canvas dibuja con la del sistema. */
async function cargarFuentes() {
  const { sans, mono } = familias();
  await Promise.all(
    [`700 100px ${sans}`, `400 40px ${sans}`, `500 100px ${mono}`, `400 26px ${mono}`].map(f => document.fonts.load(f).catch(() => null))
  );
}

/** La W de la marca (mismo trazo que components/brand/Logo.tsx), de `ancho` px. */
function marca(ctx: CanvasRenderingContext2D, x: number, y: number, ancho: number, segundo: string, alfa = 1) {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(x, y);
  ctx.scale(ancho / 48, ancho / 48);
  ctx.transform(1, 0, Math.tan((-12 * Math.PI) / 180), 1, 0, 0);
  ctx.translate(4, 0);
  ctx.lineWidth = 6.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LILA;
  ctx.stroke(new Path2D('M4 5 L13 31 L22 13'));
  ctx.strokeStyle = segundo;
  ctx.stroke(new Path2D('M22 13 L31 31 L40 5'));
  ctx.restore();
}

/** Parte un texto en renglones que quepan en `ancho`. */
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && actual) {
      lineas.push(actual);
      actual = p;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Texto con espacio entre letras, centrado en `cx` (canvas.letterSpacing no está en todos los navegadores). */
function espaciado(ctx: CanvasRenderingContext2D, texto: string, cx: number, y: number, espacio: number) {
  const anchos = Array.from(texto, l => ctx.measureText(l).width);
  const total = anchos.reduce((a, b) => a + b, 0) + espacio * (texto.length - 1);
  let x = cx - total / 2;
  Array.from(texto).forEach((l, i) => {
    ctx.fillText(l, x, y);
    x += anchos[i] + espacio;
  });
}

function rectRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function dibujarInvitacion(canvas: HTMLCanvasElement, d: DatosInvitacion) {
  await cargarFuentes();
  const { sans, mono } = familias();
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d')!;
  const util = ANCHO - MARGEN * 2;

  // Fondo: negro de showroom, morado desde arriba y un halo detrás del código.
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  const arriba = ctx.createLinearGradient(0, 0, 0, ALTO * 0.75);
  arriba.addColorStop(0, 'rgba(82,22,114,0.85)');
  arriba.addColorStop(1, 'rgba(82,22,114,0)');
  ctx.fillStyle = arriba;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  const halo = ctx.createRadialGradient(ANCHO / 2, 930, 0, ANCHO / 2, 930, 620);
  halo.addColorStop(0, 'rgba(136,28,183,0.42)');
  halo.addColorStop(1, 'rgba(136,28,183,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  // La W gigante, casi invisible.
  marca(ctx, 430, 520, 900, '#ffffff', 0.06);

  // Encabezado: marca + "wisemotors" y la pastilla "Solo con invitación".
  ctx.textBaseline = 'alphabetic';
  marca(ctx, MARGEN, 88, 84, '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 46px ${sans}`;
  const xTexto = MARGEN + 100;
  ctx.fillText('wise', xTexto, 136);
  const anchoWise = ctx.measureText('wise').width;
  ctx.font = `400 46px ${sans}`;
  ctx.fillText('motors', xTexto + anchoWise, 136);

  ctx.font = `400 22px ${mono}`;
  const pastilla = 'SOLO CON INVITACIÓN';
  const anchoP = ctx.measureText(pastilla).width + pastilla.length * 2.5 + 48;
  rectRedondo(ctx, ANCHO - MARGEN - anchoP, 96, anchoP, 50, 25);
  ctx.fillStyle = 'rgba(136,28,183,0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(216,180,254,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = LILA;
  espaciado(ctx, pastilla, ANCHO - MARGEN - anchoP / 2, 129, 2.5);

  // "INVITACIÓN #037 DE 100"
  let y = 330;
  ctx.textAlign = 'left';
  ctx.fillStyle = LILA;
  ctx.font = `400 28px ${mono}`;
  const etiqueta = `INVITACIÓN #${String(d.numero).padStart(3, '0')} DE ${d.total}`;
  let x = MARGEN;
  for (const l of etiqueta) {
    ctx.fillText(l, x, y);
    x += ctx.measureText(l).width + 4;
  }

  // El nombre, grande: se achica hasta caber en un renglón.
  const nombre = `${d.nombre.trim()},`;
  let tam = 140;
  ctx.font = `700 ${tam}px ${sans}`;
  while (ctx.measureText(nombre).width > util && tam > 64) {
    tam -= 4;
    ctx.font = `700 ${tam}px ${sans}`;
  }
  y += 40 + tam * 0.92;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(nombre, MARGEN, y);

  // La frase.
  ctx.font = `400 46px ${sans}`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  const frase = `te guardamos un puesto entre las primeras ${d.total} personas en entrar a WiseMotors.`;
  y += 24;
  for (const linea of renglones(ctx, frase, util)) {
    y += 62;
    ctx.fillText(linea, MARGEN, y);
  }

  // El boleto con el código.
  const alto = 290;
  const yB = Math.max(y + 70, 760);
  rectRedondo(ctx, MARGEN, yB, util, alto, 40);
  ctx.fillStyle = 'rgba(136,28,183,0.2)';
  ctx.fill();
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(216,180,254,0.55)';
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = LILA;
  ctx.font = `400 26px ${mono}`;
  ctx.textAlign = 'left';
  espaciado(ctx, 'TU CÓDIGO', ANCHO / 2, yB + 68, 6);
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 132px ${mono}`;
  espaciado(ctx, formatearCodigo(d.codigo), ANCHO / 2, yB + 220, 14);

  // Cómo usarlo.
  let yF = yB + alto + 96;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 44px ${sans}`;
  const paso = 'Entra a wisemotors.co';
  ctx.fillText(paso, MARGEN, yF);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `400 38px ${sans}`;
  yF += 54;
  ctx.fillText('y escribe tu código para crear tu cuenta.', MARGEN, yF);

  // Pie.
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = `400 22px ${mono}`;
  ctx.fillText('WISEMOTORS · MEDELLÍN, COLOMBIA', MARGEN, ALTO - 64);
  ctx.textAlign = 'left';
}

export function pngDeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}
