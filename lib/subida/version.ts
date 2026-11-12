// ============================================================================
// "Subir versión nueva" (nov-2026): la guía de la versión nueva solo necesita
// lo que cambia. Lo que no traiga se toma de la versión base, ya leído con el
// mismo lector (lib/subida/guia-de-vehiculo.ts → leerGuia), con su letra de
// trazabilidad y su nota. Quien sube puede quitar cualquier dato heredado.
// ============================================================================

import { FORMATO, aplica, defDe, keyDe } from './formato';
import type { DatoLeido, Lectura } from './leer';

const tipoOk = (dataType: string, valor: unknown) =>
  dataType === 'numeric' ? typeof valor === 'number' : dataType === 'boolean' ? typeof valor === 'boolean' : typeof valor === 'string';

/**
 * La lectura nueva + los datos de la base que no trae (ni trae con error).
 * `excluir`: keys que quien sube decidió no heredar.
 */
export function completarConBase(nueva: Lectura, base: Lectura, excluir: Set<string>): Lectura {
  const { tren, carroceria } = nueva.identidad;
  if (!tren || !carroceria) return nueva;
  const conDato = new Set(nueva.datos.map(d => d.campo));
  // Un campo que la guía nueva trae mal se corrige ahí: no se tapa con el de la base.
  const conError = new Set(nueva.avisos.filter(a => a.tipo === 'error' && a.campo).map(a => a.campo));
  const heredados: DatoLeido[] = [];
  for (const d of base.datos) {
    if (conDato.has(d.campo) || conError.has(d.campo)) continue;
    const campo = FORMATO.find(c => c.nombre === d.campo);
    // Si la versión nueva cambia de tren motriz o carrocería, solo pasan los campos que le aplican.
    if (!campo || !aplica(campo, tren, carroceria)) continue;
    const key = keyDe(campo, tren);
    const def = defDe(campo, tren);
    if (!key || !def || excluir.has(key) || !tipoOk(def.dataType, d.valor)) continue;
    heredados.push({ ...d, key, linea: 0, deBase: true });
  }
  const heredadosCampos = new Set(heredados.map(d => d.campo));
  return { ...nueva, datos: [...nueva.datos, ...heredados], vacios: nueva.vacios.filter(n => !heredadosCampos.has(n)) };
}

/** Los datos de la base que se podrían heredar pero quien sube quitó (para volver a ponerlos). */
export function quitadosDeBase(nueva: Lectura, base: Lectura, excluir: Set<string>): DatoLeido[] {
  if (!excluir.size) return [];
  const todos = completarConBase(nueva, base, new Set());
  return todos.datos.filter(d => d.deBase && excluir.has(d.key));
}
