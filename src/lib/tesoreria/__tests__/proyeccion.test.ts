import { describe, expect, it } from "vitest";
import { datosDeEjemplo } from "../demo";
import { diasEntre, sumarDias } from "../fechas";
import { analizar } from "../index";
import {
  diaDelMovimiento,
  HORIZONTE,
  primerDiaBajo,
  proyectar,
  tipoDeCambioProyectado,
} from "../proyeccion";
import type { Movimiento, Supuestos } from "../tipos";

const HOY = "2026-10-30";
const base: Supuestos = { cajaArs: 1_000_000, cajaUsd: 0, tipoCambio: 1000, devaluacionMensual: 0, saldoMinimo: 0 };
let n = 0;
const mov = (p: Partial<Movimiento>): Movimiento => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`,
  tipo: "pago",
  concepto: "X",
  monto: 100,
  moneda: "ARS",
  fecha: sumarDias(HOY, 10),
  puntualidad: null,
  ...p,
});

describe("proyección", () => {
  it("sin movimientos, el saldo queda plano en la caja inicial", () => {
    const saldos = proyectar(base, [], HOY);
    expect(saldos).toHaveLength(HORIZONTE + 1);
    expect(new Set(saldos)).toEqual(new Set([1_000_000]));
    expect(primerDiaBajo(saldos)).toBe(-1);
  });

  it("suma la caja en dólares al tipo de cambio de hoy", () => {
    const saldos = proyectar({ ...base, cajaArs: 0, cajaUsd: 10 }, [], HOY);
    expect(saldos[0]).toBe(10_000);
  });

  it("descuenta pagos y suma cobros el día que vencen", () => {
    const saldos = proyectar(base, [
      mov({ tipo: "pago", monto: 300_000, fecha: sumarDias(HOY, 5) }),
      mov({ tipo: "cobro", monto: 50_000, fecha: sumarDias(HOY, 7), puntualidad: 90 }),
    ], HOY);
    expect(saldos[4]).toBe(1_000_000);
    expect(saldos[5]).toBe(700_000);
    expect(saldos[7]).toBe(750_000);
    expect(saldos[HORIZONTE]).toBe(750_000);
  });

  it("convierte un pago en USD al tipo de cambio proyectado de su fecha", () => {
    const s = { ...base, devaluacionMensual: 2 };
    const saldos = proyectar(s, [mov({ monto: 100, moneda: "USD", fecha: sumarDias(HOY, 30) })], HOY);
    expect(tipoDeCambioProyectado(s, 30)).toBeCloseTo(1020);
    expect(saldos[30]).toBeCloseTo(1_000_000 - 100 * 1020);
  });

  it("revaloriza la caja en dólares con la devaluación", () => {
    const s = { ...base, cajaArs: 0, cajaUsd: 1000, devaluacionMensual: 2 };
    const saldos = proyectar(s, [], HOY);
    expect(saldos[30]).toBeCloseTo(1000 * 1020);
  });

  it("los movimientos vencidos se proyectan hoy (día 0)", () => {
    const vencido = mov({ monto: 400_000, fecha: sumarDias(HOY, -5) });
    expect(diaDelMovimiento(vencido, HOY)).toBe(0);
    expect(proyectar(base, [vencido], HOY)[0]).toBe(600_000);
  });

  it("ignora movimientos más allá del horizonte", () => {
    const saldos = proyectar(base, [mov({ monto: 999, fecha: sumarDias(HOY, HORIZONTE + 1) })], HOY);
    expect(saldos[HORIZONTE]).toBe(1_000_000);
  });

  it("aplica salto del dólar, demora y caída de la cobranza", () => {
    const movs = [
      mov({ tipo: "cobro", monto: 100_000, fecha: sumarDias(HOY, 10), puntualidad: 90 }),
      mov({ tipo: "pago", monto: 100, moneda: "USD", fecha: sumarDias(HOY, 20) }),
    ];
    const esc = proyectar(base, movs, HOY, { saltoDolar: 0.5, demoraDias: 5, caidaCobranza: 0.2 });
    expect(esc[10]).toBe(1_000_000);
    expect(esc[15]).toBe(1_080_000);
    expect(esc[20]).toBe(1_080_000 - 100 * 1500);
  });
});

/** El algoritmo del index.html original, tal cual, para comparar resultados. */
function proyeccionOriginal(S: Supuestos & { mov: Movimiento[] }, hoy: string) {
  const H = 90;
  const bal = new Array(H + 1).fill(0);
  let b = S.cajaArs + S.cajaUsd * S.tipoCambio;
  const flows = new Array(H + 1).fill(0);
  const tcAt = (t: number) => S.tipoCambio * Math.pow(1 + S.devaluacionMensual / 100, t / 30);
  for (const m of S.mov) {
    const t = diasEntre(hoy, m.fecha);
    if (t < 0 || t > H) continue;
    const v = m.moneda === "USD" ? m.monto * tcAt(t) : m.monto;
    if (m.tipo === "cobro") flows[t] += v;
    else flows[t] -= v;
  }
  for (let t = 0; t <= H; t++) {
    b += flows[t];
    bal[t] = b + S.cajaUsd * (tcAt(t) - S.tipoCambio);
  }
  return bal;
}

describe("datos de ejemplo", () => {
  const datos = datosDeEjemplo(HOY);

  it("dan la misma proyección que el MVP original", () => {
    const original = proyeccionOriginal({ ...datos.empresa, mov: datos.movimientos }, HOY);
    const nueva = proyectar(datos.empresa, datos.movimientos, HOY);
    nueva.forEach((v, t) => expect(v).toBeCloseTo(original[t], 6));
  });

  it("muestran un faltante para la demo", () => {
    const a = analizar(datos, HOY);
    expect(a.alertas[0].tipo).toBe("faltante");
    expect(a.kpis.saldoMinimo).toBeLessThan(0);
    expect(a.kpis.pagosUsdComprometidos).toBe(72_000);
    expect(a.kpis.impuestosArs).toBe(23_200_000);
  });

  it("sin movimientos, el análisis no falla y no hay faltante", () => {
    const a = analizar({ empresa: datos.empresa, movimientos: [] }, HOY);
    expect(a.alertas.map((x) => x.tipo)).not.toContain("faltante");
    expect(a.proximos).toEqual([]);
    expect(a.kpis.pagosUsdComprometidos).toBe(0);
  });
});
