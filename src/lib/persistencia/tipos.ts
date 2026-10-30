import type { DatosTesoreria, Empresa, Movimiento } from "@/lib/tesoreria/tipos";

export type Resultado<T = undefined> =
  | { ok: true; valor: T }
  | { ok: false; error: string; errores?: Record<string, string> };

/**
 * Dónde se guardan los datos. En modo local, en el navegador;
 * con Supabase, en la base a través de Server Actions.
 */
export interface Persistencia {
  guardarEmpresa(e: Empresa): Promise<Resultado>;
  guardarMovimiento(m: Movimiento): Promise<Resultado>;
  borrarMovimiento(id: string): Promise<Resultado>;
  importarMovimientos(movs: Movimiento[], reemplazar: boolean): Promise<Resultado>;
  /** Reemplaza todo por la importadora de ejemplo y devuelve los datos nuevos. */
  cargarEjemplo(hoy: string): Promise<Resultado<DatosTesoreria>>;
}
