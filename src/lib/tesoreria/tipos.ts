// Tipos del dominio de TIP. Este módulo no depende de React ni de Supabase.

export type TipoMovimiento = "cobro" | "pago" | "impuesto";
export type Moneda = "ARS" | "USD";

export const TIPOS: TipoMovimiento[] = ["cobro", "pago", "impuesto"];
export const MONEDAS: Moneda[] = ["ARS", "USD"];

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
  moneda: Moneda;
  /** Fecha en formato aaaa-mm-dd. */
  fecha: string;
  /** % de veces que el cliente pagó a tiempo. Solo para cobros; null en pagos e impuestos. */
  puntualidad: number | null;
}

export interface Supuestos {
  cajaArs: number;
  cajaUsd: number;
  /** ARS por USD hoy. */
  tipoCambio: number;
  /** Devaluación mensual esperada, en % (2 = 2% por mes). */
  devaluacionMensual: number;
  /** Saldo mínimo de seguridad en ARS. */
  saldoMinimo: number;
}

export interface Empresa extends Supuestos {
  nombre: string;
}

export interface DatosTesoreria {
  empresa: Empresa;
  movimientos: Movimiento[];
}
