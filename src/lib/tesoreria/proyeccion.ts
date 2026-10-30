import { diasEntre } from "./fechas";
import type { Movimiento, Supuestos } from "./tipos";

/** Horizonte de la proyección, en días. */
export const HORIZONTE = 90;

export interface OpcionesProyeccion {
  /** Salto del dólar hoy, como fracción (0.2 = +20%). */
  saltoDolar?: number;
  /** Días de demora de todos los cobros. */
  demoraDias?: number;
  /** Caída de la cobranza, como fracción (0.1 = −10%). */
  caidaCobranza?: number;
  /** Tipo de cambio por día (simulación). Reemplaza al tipo de cambio proyectado. */
  tcPorDia?: number[];
  /** Atraso extra por cobro, en días (simulación). */
  atrasoCobro?: (m: Movimiento) => number;
}

/** Tipo de cambio proyectado para el día t: el de hoy, con el salto, devaluándose cada mes. */
export function tipoDeCambioProyectado(s: Supuestos, t: number, saltoDolar = 0): number {
  return s.tipoCambio * (1 + saltoDolar) * Math.pow(1 + s.devaluacionMensual / 100, t / 30);
}

/** Día de la proyección en que cae el movimiento. Los vencidos se proyectan hoy (día 0). */
export function diaDelMovimiento(m: Pick<Movimiento, "fecha">, hoy: string): number {
  return Math.max(0, diasEntre(hoy, m.fecha));
}

export function estaVencido(m: Pick<Movimiento, "fecha">, hoy: string): boolean {
  return diasEntre(hoy, m.fecha) < 0;
}

/** Valor en pesos de un movimiento en el día t. */
export function valorEnPesos(m: Movimiento, tc: number): number {
  return m.moneda === "USD" ? m.monto * tc : m.monto;
}

/**
 * Saldo diario en pesos para los días 0..HORIZONTE.
 * Los pagos e impuestos en dólares se convierten al tipo de cambio proyectado de su fecha,
 * y la caja en dólares se revaloriza con el tipo de cambio de cada día.
 */
export function proyectar(
  s: Supuestos,
  movimientos: Movimiento[],
  hoy: string,
  o: OpcionesProyeccion = {},
): number[] {
  const tc = (t: number) => o.tcPorDia?.[t] ?? tipoDeCambioProyectado(s, t, o.saltoDolar ?? 0);
  const flujos = new Array<number>(HORIZONTE + 1).fill(0);

  for (const m of movimientos) {
    let t = diaDelMovimiento(m, hoy);
    if (m.tipo === "cobro") t += (o.demoraDias ?? 0) + (o.atrasoCobro?.(m) ?? 0);
    if (t > HORIZONTE) continue;
    const v = valorEnPesos(m, tc(t));
    if (m.tipo === "cobro") flujos[t] += v * (1 - (o.caidaCobranza ?? 0));
    else flujos[t] -= v;
  }

  const saldos = new Array<number>(HORIZONTE + 1);
  let acumulado = s.cajaArs + s.cajaUsd * s.tipoCambio;
  for (let t = 0; t <= HORIZONTE; t++) {
    acumulado += flujos[t];
    saldos[t] = acumulado + s.cajaUsd * (tc(t) - s.tipoCambio);
  }
  return saldos;
}

/** Primer día en que el saldo queda por debajo del umbral, o −1 si nunca pasa. */
export function primerDiaBajo(saldos: number[], umbral = 0): number {
  return saldos.findIndex((v) => v < umbral);
}
