import { diaDelMovimiento, valorEnPesos } from "./proyeccion";
import type { Movimiento } from "./tipos";

/** Puntualidad mínima para sugerir adelantar un cobro. */
export const PUNTUALIDAD_MINIMA = 80;
/** Se buscan cobros que venzan hasta esta cantidad de días después del faltante. */
export const VENTANA_ADELANTO = 45;
export const PLAZO_INVERSION = 30;

export type Recomendacion =
  | {
      tipo: "adelantar-cobro";
      movimientoId: string;
      concepto: string;
      /** Lo que conviene adelantar, en ARS. */
      montoArs: number;
      /** El cobro completo, en ARS. */
      totalArs: number;
      parcial: boolean;
      diasHastaVencimiento: number;
      puntualidad: number;
    }
  | { tipo: "credito"; montoArs: number }
  | { tipo: "inversion"; montoArs: number; plazoDias: number };

/**
 * Cómo cubrir un faltante: primero adelantando cobros de clientes puntuales
 * (los que vencen más cerca del faltante primero, porque es más fácil pedir
 * unos días de adelanto) y, por lo que falte, un crédito planificado.
 */
export function recomendarParaFaltante(
  movimientos: Movimiento[],
  hoy: string,
  diaFaltante: number,
  deficitArs: number,
  tc: number,
): Recomendacion[] {
  const candidatos = movimientos
    .filter((m) => m.tipo === "cobro" && (m.puntualidad ?? 0) >= PUNTUALIDAD_MINIMA)
    .map((m) => ({ m, dia: diaDelMovimiento(m, hoy) }))
    .filter(({ dia }) => dia > diaFaltante && dia <= diaFaltante + VENTANA_ADELANTO)
    .sort((a, b) => a.dia - b.dia || (b.m.puntualidad ?? 0) - (a.m.puntualidad ?? 0));

  const recs: Recomendacion[] = [];
  let cubierto = 0;
  for (const { m, dia } of candidatos) {
    if (cubierto >= deficitArs) break;
    const total = valorEnPesos(m, tc);
    const parte = Math.min(total, deficitArs - cubierto);
    cubierto += parte;
    recs.push({
      tipo: "adelantar-cobro",
      movimientoId: m.id,
      concepto: m.concepto,
      montoArs: parte,
      totalArs: total,
      parcial: parte < total,
      diasHastaVencimiento: dia,
      puntualidad: m.puntualidad ?? 0,
    });
  }
  if (cubierto < deficitArs) recs.push({ tipo: "credito", montoArs: deficitArs - cubierto });
  return recs;
}

export function recomendarParaExcedente(montoArs: number): Recomendacion[] {
  return [{ tipo: "inversion", montoArs, plazoDias: PLAZO_INVERSION }];
}
