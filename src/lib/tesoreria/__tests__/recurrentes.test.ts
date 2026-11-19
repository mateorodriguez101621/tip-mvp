import { describe, expect, it } from "vitest";
import { datosDeEjemplo } from "../demo";
import { sumarDias, sumarMeses } from "../fechas";
import { analizar } from "../index";
import { HORIZONTE } from "../proyeccion";
import { esEstimado, estimarRecurrentes } from "../recurrentes";
import type { Movimiento } from "../tipos";

const HOY = "2026-10-30";
let n = 0;
const mov = (p: Partial<Movimiento>): Movimiento => ({
  id: `r-${++n}`,
  tipo: "pago",
  concepto: "Proveedor X",
  monto: 100,
  moneda: "ARS",
  fecha: sumarDias(HOY, 10),
  puntualidad: null,
  ...p,
});

describe("sumarMeses", () => {
  it("mantiene el día y cae al último día en meses cortos", () => {
    expect(sumarMeses("2026-01-15", 1)).toBe("2026-02-15");
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2026-01-31", 2)).toBe("2026-03-31");
    expect(sumarMeses("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("movimientos recurrentes", () => {
  it("un sueldo cargado una sola vez se repite cada mes hasta el horizonte", () => {
    const e = estimarRecurrentes([mov({ concepto: "Sueldos", fecha: "2026-11-05" })], HOY);
    expect(e.map((m) => m.fecha)).toEqual(["2026-12-05", "2027-01-05"]);
    expect(e.every(esEstimado)).toBe(true);
  });

  it("detecta la cadencia de lo que se cargó más de una vez", () => {
    const e = estimarRecurrentes(
      [mov({ concepto: "Flete local", fecha: sumarDias(HOY, 1) }), mov({ concepto: "flete  LOCAL", fecha: sumarDias(HOY, 15) })],
      HOY,
    );
    expect(e.map((m) => m.fecha)).toEqual([29, 43, 57, 71, 85].map((d) => sumarDias(HOY, d)));
  });

  it("no repite pagos únicos ni compras del ciclo de importación", () => {
    expect(estimarRecurrentes([mov({ concepto: "Proveedor Shenzhen" })], HOY)).toEqual([]);
    expect(estimarRecurrentes([mov({ concepto: "Cámaras · Shenzhen · IVA del despacho" })], HOY)).toEqual([]);
  });

  it("si todo lo cargado ya venció, sigue proyectando las próximas repeticiones (no las pasadas)", () => {
    const e = estimarRecurrentes([mov({ concepto: "Alquiler", monto: 500, fecha: sumarDias(HOY, -70) })], HOY);
    expect(e.length).toBe(3);
    expect(e[0].fecha >= HOY).toBe(true);
    expect(e.every((m) => m.monto === 500)).toBe(true);
  });
});

describe("la proyección no se estanca", () => {
  it("con los datos de ejemplo cargados hace meses, el saldo sigue moviéndose", () => {
    const datos = datosDeEjemplo("2026-08-01");
    const a = analizar(datos, "2026-11-15");
    expect(a.estimados).toBeGreaterThan(0);
    expect(new Set(a.saldos.map((v) => Math.round(v / 1e5))).size).toBeGreaterThan(3);
  });

  it("los estimados no se recomiendan para adelantar cobros", () => {
    const datos = datosDeEjemplo(HOY);
    const a = analizar(datos, HOY);
    const ids = new Set(a.movimientosProyectados.filter(esEstimado).map((m) => m.id));
    for (const al of a.alertas)
      if ("recomendaciones" in al)
        for (const r of al.recomendaciones) if (r.tipo === "adelantar-cobro") expect(ids.has(r.movimientoId)).toBe(false);
    expect(a.saldos).toHaveLength(HORIZONTE + 1);
  });
});
