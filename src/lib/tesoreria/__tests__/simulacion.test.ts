import { describe, expect, it } from "vitest";
import { datosDeEjemplo } from "../demo";
import { sumarDias } from "../fechas";
import { HORIZONTE } from "../proyeccion";
import { generador, simular } from "../simulacion";
import type { Supuestos } from "../tipos";

const HOY = "2026-10-30";
const base: Supuestos = { cajaArs: 1_000_000, cajaUsd: 0, tipoCambio: 1000, devaluacionMensual: 2, saldoMinimo: 0 };

describe("simulación Monte Carlo", () => {
  it("el generador es reproducible y está entre 0 y 1", () => {
    const a = generador(7), b = generador(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("sin movimientos no hay riesgo de quedarse sin caja", () => {
    const r = simular(base, [], HOY);
    expect(r.probabilidadFaltante).toBe(0);
    expect(r.p10).toHaveLength(HORIZONTE + 1);
  });

  it("con un pago imposible de cubrir, la probabilidad es 100%", () => {
    const pago = { id: "1", tipo: "pago" as const, concepto: "X", monto: 5_000_000, moneda: "ARS" as const, fecha: sumarDias(HOY, 10), puntualidad: null };
    expect(simular(base, [pago], HOY).probabilidadFaltante).toBe(1);
  });

  it("la banda p10 queda por debajo de la p90", () => {
    const d = datosDeEjemplo(HOY);
    const r = simular(d.empresa, d.movimientos, HOY);
    r.p10.forEach((v, t) => expect(v).toBeLessThanOrEqual(r.p90[t]));
  });

  it("un escenario peor aumenta la probabilidad de faltante", () => {
    const d = datosDeEjemplo(HOY);
    const sinShock = simular(d.empresa, d.movimientos, HOY).probabilidadFaltante;
    const conShock = simular(d.empresa, d.movimientos, HOY, { saltoDolar: 0.4, demoraDias: 20, caidaCobranza: 0.3 }).probabilidadFaltante;
    expect(conShock).toBeGreaterThanOrEqual(sinShock);
    expect(conShock).toBeGreaterThan(0.9);
  });

  it("con la misma semilla da siempre el mismo resultado", () => {
    const d = datosDeEjemplo(HOY);
    expect(simular(d.empresa, d.movimientos, HOY)).toEqual(simular(d.empresa, d.movimientos, HOY));
  });
});
