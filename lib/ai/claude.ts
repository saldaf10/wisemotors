// ============================================================================
// Cliente de Claude para la ingesta.
//
// Una sola puerta: pedirJson() manda un prompt y devuelve un objeto validado
// contra un esquema Zod (salida estructurada: el modelo no puede devolver JSON
// roto ni campos fuera del esquema). La validación de NEGOCIO — keys del
// registro, rangos físicos, citas — sigue en lib/ingest; esto solo garantiza
// la forma.
//
// Variables de entorno:
//   ANTHROPIC_API_KEY       obligatoria
//   ANTHROPIC_WORKSPACE_ID  solo si la clave no está atada a un workspace
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod/v4';

// Costo: NUNCA Opus. Sonnet SOLO en la ingesta, donde un error publica datos
// falsos (extracción, fuentes, identidad, precio). Todo lo demás del producto
// va en Haiku (veredicto del comparador, leer páginas, datos DEMO).
export const MODELOS = {
  sonnet: 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5',
} as const;
export type Modelo = keyof typeof MODELOS;

let cliente: Anthropic | null = null;

export function claude(): Anthropic {
  if (cliente) return cliente;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no está definida: la ingesta necesita a Claude.');
  }
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  cliente = new Anthropic({
    defaultHeaders: workspace ? { 'anthropic-workspace-id': workspace } : undefined,
    // Por defecto el SDK espera hasta 10 min y reintenta 2 veces: una sola
    // llamada pegada se comería los 300 s de la función. 2 min y un reintento.
    timeout: 120_000,
    maxRetries: 1,
  });
  return cliente;
}

/**
 * Mensaje en español para los errores de la API que un admin puede resolver
 * (saldo, clave, sobrecarga). El resto pasa tal cual.
 */
export function explicarErrorClaude(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/credit balance is too low/i.test(msg)) {
    return 'La cuenta de Anthropic se quedó sin saldo. Recarga en console.anthropic.com → Plans & Billing y vuelve a intentar.';
  }
  if (/invalid x-api-key|authentication_error/i.test(msg))
    return 'La clave ANTHROPIC_API_KEY no es válida. Revísala en Vercel.';
  if (/overloaded|529/i.test(msg)) return 'Claude está saturado en este momento. Intenta de nuevo en unos minutos.';
  if (/rate_limit|429/i.test(msg))
    return 'Demasiadas solicitudes a Claude seguidas. Espera un minuto y vuelve a intentar.';
  return msg;
}

/** Errores que no se arreglan reintentando con otra fuente: hay que avisar y parar. */
export function esErrorDeCuenta(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /credit balance is too low|invalid x-api-key|authentication_error/i.test(msg);
}

export async function pedirJson<T extends z.ZodType>(opts: {
  schema: T;
  /** Texto, o bloques de contenido (p. ej. un PDF + instrucciones). */
  prompt: string | Anthropic.Beta.Messages.BetaContentBlockParam[];
  system?: string;
  maxTokens?: number;
  /** Sonnet por defecto; Haiku solo para tareas no críticas. */
  modelo?: Modelo;
  /** Para cancelar la llamada (y dejar de pagarla) si se acaba el tiempo. */
  signal?: AbortSignal;
  /** Tope de esta llamada (por defecto el del cliente: 120 s) y reintentos (1). */
  timeoutMs?: number;
  reintentos?: number;
}): Promise<z.infer<T>> {
  let res;
  try {
    res = await claude().beta.messages.parse({
      model: MODELOS[opts.modelo ?? 'sonnet'],
      max_tokens: opts.maxTokens ?? 8000,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: 'user', content: opts.prompt }],
      output_config: { format: betaZodOutputFormat(opts.schema) },
    }, {
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.timeoutMs ? { timeout: opts.timeoutMs } : {}),
      ...(opts.reintentos !== undefined ? { maxRetries: opts.reintentos } : {}),
    });
  } catch (err) {
    throw new Error(explicarErrorClaude(err));
  }

  if (res.stop_reason === 'refusal') {
    throw new Error('Claude declinó la solicitud; revisar el texto de la fuente.');
  }
  if (res.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de Claude se cortó por longitud (max_tokens).');
  }
  if (res.parsed_output == null) {
    throw new Error('Claude no devolvió un JSON válido para el esquema pedido.');
  }
  return res.parsed_output as z.infer<T>;
}
