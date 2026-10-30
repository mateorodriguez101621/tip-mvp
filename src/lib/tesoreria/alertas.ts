import { fmtARS, fmtUSD } from "./formato";
import { diaDelMovimiento, HORIZONTE, primerDiaBajo, tipoDeCambioProyectado } from "./proyeccion";
import {
  recomendarParaExcedente,
  recomendarParaFaltante,
  type Recomendacion,
} from "./recomendaciones";
import type { Movimiento, Supuestos, TipoMovimiento } from "./tipos";

/** El déficit es el peor saldo en esta cantidad de días desde el primer faltante. */
export const VENTANA_DEFICIT = 15;
/** Hay excedente si el saldo mínimo a 30 días supera este múltiplo del saldo de seguridad. */
export const FACTOR_EXCEDENTE = 2;
export const DIAS_EXCEDENTE = 30;

export type Alerta =
  | {
      tipo: "faltante";
      dia: number;
      deficitArs: number;
      deficitUsd: number;
      pago: { concepto: string; tipo: TipoMovimiento } | null;
      recomendaciones: Recomendacion[];
    }
  | { tipo: "sin-faltante" }
  | { tipo: "bajo-minimo"; dia: number; saldoMinimo: number }
  | { tipo: "excedente"; montoArs: number; recomendaciones: Recomendacion[] };

export function generarAlertas(
  s: Supuestos,
  movimientos: Movimiento[],
  saldos: number[],
  hoy: string,
): Alerta[] {
  const alertas: Alerta[] = [];
  const t0 = primerDiaBajo(saldos, 0);

  if (t0 >= 0) {
    const deficitArs = -Math.min(...saldos.slice(t0, Math.min(HORIZONTE, t0 + VENTANA_DEFICIT) + 1));
    const tc = tipoDeCambioProyectado(s, t0);
    const egresos = movimientos
      .filter((m) => m.tipo !== "cobro")
      .map((m) => ({ m, dia: diaDelMovimiento(m, hoy) }))
      .filter(({ dia }) => dia >= t0)
      .sort((a, b) => a.dia - b.dia || b.m.monto - a.m.monto);
    // El pago que dispara el faltante: el del mismo día o, si no hay, el siguiente.
    const pago = egresos[0]?.m ?? null;
    alertas.push({
      tipo: "faltante",
      dia: t0,
      deficitArs,
      deficitUsd: deficitArs / tc,
      pago: pago && { concepto: pago.concepto, tipo: pago.tipo },
      recomendaciones: recomendarParaFaltante(movimientos, hoy, t0, deficitArs, tc),
    });
  } else {
    alertas.push({ tipo: "sin-faltante" });
  }

  const tMin = primerDiaBajo(saldos, s.saldoMinimo);
  if (tMin >= 0 && (t0 < 0 || tMin < t0)) {
    alertas.push({ tipo: "bajo-minimo", dia: tMin, saldoMinimo: s.saldoMinimo });
  }

  if (t0 < 0) {
    const minimo30 = Math.min(...saldos.slice(0, DIAS_EXCEDENTE + 1));
    if (minimo30 > s.saldoMinimo * FACTOR_EXCEDENTE) {
      const montoArs = minimo30 - s.saldoMinimo;
      alertas.push({ tipo: "excedente", montoArs, recomendaciones: recomendarParaExcedente(montoArs) });
    }
  }
  return alertas;
}

function cuando(dia: number, futuro: string, presente: string): string {
  if (dia === 0) return `Hoy ${presente}`;
  if (dia === 1) return `Mañana ${futuro}`;
  return `En ${dia} días ${futuro}`;
}

/** Título de la alerta, en lenguaje del dueño de la PyME. */
export function tituloAlerta(a: Alerta): string {
  switch (a.tipo) {
    case "faltante": {
      const destino = !a.pago
        ? ""
        : a.pago.tipo === "impuesto"
          ? ` para pagar ${a.pago.concepto}`
          : ` para tu pago a ${a.pago.concepto}`;
      return `${cuando(a.dia, "te van a faltar", "te faltan")} ${fmtUSD(a.deficitUsd)} (${fmtARS(a.deficitArs)})${destino}.`;
    }
    case "sin-faltante":
      return `Tu caja cubre todos los compromisos de los próximos ${HORIZONTE} días.`;
    case "bajo-minimo":
      return `${cuando(a.dia, "tu saldo baja", "tu saldo está")} por debajo del mínimo de seguridad (${fmtARS(a.saldoMinimo)}).`;
    case "excedente":
      return `Vas a tener ${fmtARS(a.montoArs)} ociosos durante los próximos ${DIAS_EXCEDENTE} días.`;
  }
}

/** Texto de cada recomendación, con el porqué. */
export function textoRecomendacion(r: Recomendacion): { accion: string; porque: string } {
  switch (r.tipo) {
    case "adelantar-cobro":
      return {
        accion: r.parcial
          ? `Pedile a ${r.concepto} que adelante ${fmtARS(r.montoArs)} de su pago (de ${fmtARS(r.totalArs)}), que vence en ${r.diasHastaVencimiento} días.`
          : `Pedile a ${r.concepto} que adelante su pago de ${fmtARS(r.totalArs)}, que vence en ${r.diasHastaVencimiento} días.`,
        porque: `Paga a tiempo el ${r.puntualidad}% de las veces.`,
      };
    case "credito":
      return {
        accion: `Tomá hoy una línea de crédito planificada por ${fmtARS(r.montoArs)}.`,
        porque: "Con anticipación conseguís mejor tasa que con un financiamiento de urgencia el día del pago.",
      };
    case "inversion":
      return {
        accion: `Colocá ${fmtARS(r.montoArs)} en un plazo fijo o una LECAP a ${r.plazoDias} días.`,
        porque: "Así no pierden valor mientras no los necesitás, y quedás por encima de tu saldo de seguridad.",
      };
  }
}
