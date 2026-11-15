import { describe, expect, it } from "vitest";
import { CONECTORES, claveMovimiento, movimientosDeFuente, movimientosNuevos } from "../conectores";
import { validarMovimiento } from "../validacion";

const hoy = "2026-11-15";
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("registro automático", () => {
  it("cada fuente trae movimientos válidos y futuros", () => {
    for (const c of CONECTORES) {
      const movs = movimientosDeFuente(c.id, hoy);
      expect(movs.length).toBeGreaterThan(0);
      for (const m of movs) {
        expect(validarMovimiento({ ...m, id: id() }).ok).toBe(true);
        expect(m.fecha > hoy).toBe(true);
      }
    }
  });

  it("los cobros traen la puntualidad del cliente y los pagos no", () => {
    const movs = movimientosDeFuente("gestion", hoy);
    expect(movs.filter((m) => m.tipo === "cobro").every((m) => m.puntualidad !== null)).toBe(true);
    expect(movs.filter((m) => m.tipo !== "cobro").every((m) => m.puntualidad === null)).toBe(true);
  });

  it("sincronizar dos veces no duplica", () => {
    const primera = movimientosNuevos("arca", hoy, [], "Tango", id);
    expect(primera.length).toBeGreaterThan(0);
    expect(movimientosNuevos("arca", hoy, primera, "Tango", id)).toEqual([]);
  });

  it("el sistema de gestión elegido queda en el concepto", () => {
    expect(movimientosDeFuente("gestion", hoy, "Xubio").every((m) => m.concepto.includes("Xubio"))).toBe(true);
    const a = movimientosDeFuente("gestion", hoy, "Tango")[0];
    const b = movimientosDeFuente("gestion", hoy, "Colppy")[0];
    expect(claveMovimiento(a)).not.toBe(claveMovimiento(b));
  });
});
