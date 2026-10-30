import { describe, expect, it } from "vitest";

// Los montos usan espacio duro; en los tests se comparan con espacio común.
const plano = (s: string) => s.replace(/\u00a0/g, " ");
import { generarAlertas, textoRecomendacion, tituloAlerta, type Alerta } from "../alertas";
import { datosDeEjemplo } from "../demo";
import { sumarDias } from "../fechas";
import { proyectar } from "../proyeccion";
import { recomendarParaFaltante } from "../recomendaciones";
import type { Movimiento, Supuestos } from "../tipos";

const HOY = "2026-10-30";
const base: Supuestos = { cajaArs: 1_000_000, cajaUsd: 0, tipoCambio: 1000, devaluacionMensual: 0, saldoMinimo: 100_000 };
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
const alertasDe = (s: Supuestos, movs: Movimiento[]) => generarAlertas(s, movs, proyectar(s, movs, HOY), HOY);
const de = <T extends Alerta["tipo"]>(as: Alerta[], tipo: T) =>
  as.find((a) => a.tipo === tipo) as Extract<Alerta, { tipo: T }> | undefined;

describe("alerta de faltante", () => {
  const pagoChina = mov({ concepto: "Proveedor Shenzhen", monto: 1500, moneda: "USD", fecha: sumarDias(HOY, 18) });

  it("dice cuántos días faltan, cuántos USD y para qué pago", () => {
    const f = de(alertasDe(base, [pagoChina]), "faltante")!;
    expect(f.dia).toBe(18);
    expect(f.deficitArs).toBe(500_000);
    expect(f.deficitUsd).toBe(500);
    expect(plano(tituloAlerta(f))).toBe("En 18 días te van a faltar USD 500 ($ 500.000) para tu pago a Proveedor Shenzhen.");
  });

  it("si el faltante es por un impuesto, lo nombra", () => {
    const f = de(alertasDe(base, [mov({ tipo: "impuesto", concepto: "IVA", monto: 1_200_000 })]), "faltante")!;
    expect(plano(tituloAlerta(f))).toContain("para pagar IVA");
  });

  it("si el faltante es hoy por un pago vencido, dice 'Hoy'", () => {
    const f = de(alertasDe(base, [mov({ monto: 2_000_000, fecha: sumarDias(HOY, -3) })]), "faltante")!;
    expect(f.dia).toBe(0);
    expect(plano(tituloAlerta(f))).toMatch(/^Hoy te faltan USD 1\.000/);
  });

  it("no avisa excedente cuando hay faltante", () => {
    const as = alertasDe({ ...base, cajaArs: 100_000_000, saldoMinimo: 0 }, [mov({ monto: 200_000_000, fecha: sumarDias(HOY, 60) })]);
    expect(de(as, "faltante")).toBeDefined();
    expect(de(as, "excedente")).toBeUndefined();
  });
});

describe("recomendaciones para el faltante", () => {
  it("adelanta solo cobros de clientes con puntualidad de 80% o más, los más cercanos primero", () => {
    const movs = [
      mov({ tipo: "pago", monto: 1_500_000, fecha: sumarDias(HOY, 10) }),
      mov({ tipo: "cobro", concepto: "Cliente impuntual", monto: 900_000, fecha: sumarDias(HOY, 12), puntualidad: 60 }),
      mov({ tipo: "cobro", concepto: "Cliente 95", monto: 300_000, fecha: sumarDias(HOY, 14), puntualidad: 95 }),
      mov({ tipo: "cobro", concepto: "Cliente 85", monto: 900_000, fecha: sumarDias(HOY, 30), puntualidad: 85 }),
    ];
    const f = de(alertasDe(base, movs), "faltante")!;
    expect(f.deficitArs).toBe(500_000);
    const recs = f.recomendaciones;
    expect(recs.map((r) => r.tipo)).toEqual(["adelantar-cobro", "adelantar-cobro"]);
    expect(recs[0]).toMatchObject({ concepto: "Cliente 95", montoArs: 300_000, parcial: false, puntualidad: 95 });
    expect(recs[1]).toMatchObject({ concepto: "Cliente 85", montoArs: 200_000, parcial: true });
    expect(plano(textoRecomendacion(recs[0]).porque)).toBe("Paga a tiempo el 95% de las veces.");
    expect(plano(textoRecomendacion(recs[1]).accion)).toContain("adelante $ 200.000 de su pago");
  });

  it("si los cobros no alcanzan, sugiere crédito planificado por el resto", () => {
    const movs = [mov({ tipo: "cobro", concepto: "C", monto: 100_000, fecha: sumarDias(HOY, 20), puntualidad: 90 })];
    const recs = recomendarParaFaltante(movs, HOY, 10, 400_000, 1000);
    expect(recs).toHaveLength(2);
    expect(recs[1]).toEqual({ tipo: "credito", montoArs: 300_000 });
  });

  it("sin cobros candidatos, sugiere solo crédito por todo el déficit", () => {
    const recs = recomendarParaFaltante([], HOY, 10, 400_000, 1000);
    expect(recs).toEqual([{ tipo: "credito", montoArs: 400_000 }]);
  });

  it("no considera cobros anteriores al faltante ni demasiado lejanos", () => {
    const movs = [
      mov({ tipo: "cobro", monto: 100_000, fecha: sumarDias(HOY, 5), puntualidad: 99 }),
      mov({ tipo: "cobro", monto: 100_000, fecha: sumarDias(HOY, 80), puntualidad: 99 }),
    ];
    expect(recomendarParaFaltante(movs, HOY, 10, 50_000, 1000)).toEqual([{ tipo: "credito", montoArs: 50_000 }]);
  });

  it("convierte cobros en USD al tipo de cambio del faltante", () => {
    const movs = [mov({ tipo: "cobro", monto: 100, moneda: "USD", fecha: sumarDias(HOY, 20), puntualidad: 90 })];
    const [r] = recomendarParaFaltante(movs, HOY, 10, 1_000_000, 1200);
    expect(r).toMatchObject({ tipo: "adelantar-cobro", totalArs: 120_000 });
  });
});

describe("saldo mínimo y excedente", () => {
  it("avisa cuando el saldo baja del mínimo de seguridad sin llegar a cero", () => {
    const as = alertasDe(base, [mov({ monto: 950_000, fecha: sumarDias(HOY, 7) })]);
    expect(de(as, "faltante")).toBeUndefined();
    const b = de(as, "bajo-minimo")!;
    expect(b.dia).toBe(7);
    expect(plano(tituloAlerta(b))).toBe("En 7 días tu saldo baja por debajo del mínimo de seguridad ($ 100.000).");
  });

  it("sugiere plazo fijo o LECAP si sobra plata a 30 días y no hay faltante", () => {
    const as = alertasDe(base, []);
    const e = de(as, "excedente")!;
    expect(e.montoArs).toBe(900_000);
    expect(plano(textoRecomendacion(e.recomendaciones[0]).accion)).toContain("plazo fijo o una LECAP");
  });

  it("no hay excedente si la caja no supera el doble del mínimo", () => {
    expect(de(alertasDe({ ...base, saldoMinimo: 600_000 }, []), "excedente")).toBeUndefined();
  });

  it("los datos de ejemplo dan faltante con recomendaciones de clientes puntuales", () => {
    const hoy = HOY;
    const d = datosDeEjemplo(hoy);
    const f = de(generarAlertas(d.empresa, d.movimientos, proyectar(d.empresa, d.movimientos, hoy), hoy), "faltante")!;
    expect(f.pago).not.toBeNull();
    const adelantos = f.recomendaciones.filter((r) => r.tipo === "adelantar-cobro");
    expect(adelantos.length).toBeGreaterThan(0);
    adelantos.forEach((r) => r.tipo === "adelantar-cobro" && expect(r.puntualidad).toBeGreaterThanOrEqual(80));
  });
});
