import { describe, expect, it } from "vitest";
import { COMPRA_POR_DEFECTO, fechasDelCiclo, movimientosDeCompra, tributos, validarCompra, type CompraImportacion } from "../ciclo";
import { validarMovimiento } from "../validacion";

const compra: CompraImportacion = {
  ...COMPRA_POR_DEFECTO,
  proveedor: "Ningbo Security",
  mercaderia: "Cámaras IP",
  fob: 50_000,
  fechaPedido: "2026-12-01",
  ventaArs: 120_000_000,
};

describe("ciclo de importación", () => {
  it("encadena las fechas: pedido, embarque, llegada y cobro", () => {
    expect(fechasDelCiclo(compra)).toEqual({
      pedido: "2026-12-01",
      embarque: "2026-12-31",
      llegada: "2027-02-14",
      cobro: "2027-04-15",
    });
  });

  it("calcula los tributos sobre el CIF", () => {
    const t = tributos(compra);
    expect(t.cif).toBe(54_000);
    expect(t.derechos).toBe(8_640);
    expect(t.estadistica).toBe(1_620);
    // Base IVA = 54.000 + 8.640 + 1.620 = 64.260
    expect(t.iva).toBeCloseTo(13_494.6, 2);
    expect(t.percepciones).toBeCloseTo(18_314.1, 2);
    expect(t.total).toBeCloseTo(8_640 + 1_620 + 13_494.6 + 18_314.1, 2);
  });

  it("genera anticipo, saldo, flete, tributos y cobro, todos válidos", () => {
    const movs = movimientosDeCompra(compra);
    expect(movs.map((m) => m.concepto.split(" · ").at(-1))).toEqual([
      "anticipo 30%",
      "saldo contra embarque",
      "flete y seguro",
      "tributos del despacho",
      "cobro de la venta",
    ]);
    const usd = movs.filter((m) => m.moneda === "USD" && m.tipo === "pago").reduce((a, m) => a + m.monto, 0);
    expect(usd).toBeCloseTo(50_000 + 4_000, 2);
    for (const m of movs) {
      expect(validarMovimiento({ ...m, id: "00000000-0000-4000-8000-000000000001" }).ok).toBe(true);
    }
  });

  it("sin venta cargada no proyecta el cobro, y sin anticipo no lo genera", () => {
    const movs = movimientosDeCompra({ ...compra, ventaArs: 0, anticipoPct: 0 });
    expect(movs.some((m) => m.tipo === "cobro")).toBe(false);
    expect(movs.some((m) => m.concepto.includes("anticipo"))).toBe(false);
  });

  it("rechaza datos imposibles", () => {
    const e = validarCompra({ ...compra, proveedor: " ", fob: 0, derechosPct: 50 });
    expect(Object.keys(e).sort()).toEqual(["derechosPct", "fob", "proveedor"]);
    expect(validarCompra(compra)).toEqual({});
  });
});
