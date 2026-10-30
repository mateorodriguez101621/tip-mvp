import { describe, expect, it } from "vitest";
import {
  parsearCSV,
  parsearFecha,
  parsearMonto,
  plantillaCSV,
  validarFilas,
} from "../importacion";
import { validarEmpresa, validarMovimiento } from "../validacion";

const ID = "3f6c2a10-1b2c-4d5e-8f90-123456789abc";

describe("lectura de CSV", () => {
  it("detecta punto y coma, comillas y saltos de línea de Windows", () => {
    const filas = parsearCSV('﻿tipo;concepto;monto\r\ncobro;"Cliente ""A""; SA";1.500,50\r\n');
    expect(filas).toEqual([["tipo", "concepto", "monto"], ["cobro", 'Cliente "A"; SA', "1.500,50"]]);
  });

  it("acepta comas como separador", () => {
    expect(parsearCSV("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("la plantilla descargable se puede volver a importar sin errores", () => {
    const r = validarFilas(parsearCSV(plantillaCSV("2026-10-30")));
    expect(r.errores).toEqual([]);
    expect(r.movimientos).toHaveLength(3);
    expect(r.movimientos[0]).toMatchObject({ tipo: "cobro", fecha: "2026-11-11", puntualidad: 95 });
  });
});

describe("montos y fechas", () => {
  it.each([
    ["1.234.567,89", 1234567.89],
    ["1234567.89", 1234567.89],
    ["$ 18.000.000", 18000000],
    ["1.500", 1500],
    ["22000", 22000],
    [22000, 22000],
  ])("monto %s → %s", (entrada, esperado) => expect(parsearMonto(entrada)).toBe(esperado));

  it.each(["", "abc", "12a"])("monto inválido: %s", (v) => expect(parsearMonto(v)).toBeNaN());

  it.each([
    ["2026-11-15", "2026-11-15"],
    ["15/11/2026", "2026-11-15"],
    ["5/1/2027", "2027-01-05"],
    ["15-11-2026", "2026-11-15"],
    [46341, "2026-11-15"],
  ])("fecha %s → %s", (entrada, esperado) => expect(parsearFecha(entrada)).toBe(esperado));

  it.each(["31/02/2026", "2026-13-01", "mañana", ""])("fecha inválida: %s", (v) => expect(parsearFecha(v)).toBeNull());
});

describe("CSV mal armado", () => {
  it("archivo vacío", () => {
    expect(validarFilas(parsearCSV("")).errores[0].mensaje).toMatch(/vacío/);
  });

  it("solo encabezado", () => {
    expect(validarFilas(parsearCSV("tipo,concepto,monto,moneda,fecha")).errores[0].mensaje).toMatch(/no tiene movimientos/);
  });

  it("faltan columnas obligatorias", () => {
    const r = validarFilas(parsearCSV("tipo,concepto\ncobro,A"));
    expect(r.movimientos).toEqual([]);
    expect(r.errores[0].mensaje).toBe("Faltan columnas: monto, fecha. Usá la plantilla.");
  });

  it("informa cada fila con error y conserva las válidas", () => {
    const csv = [
      "Tipo;Concepto;Monto;Moneda;Fecha;Puntualidad (%)",
      "cobro;Cliente A;1000;ARS;15/11/2026;95",
      "transferencia;Algo;1000;ARS;15/11/2026;",
      "pago;Proveedor;-50;USD;15/11/2026;",
      "pago;Proveedor;100;EUR;31/02/2026;",
      ";;;;;",
      "impuesto;;100;ARS;2026-11-20;",
      "cobro;Cliente B;1000;ARS;2026-11-20;150",
      "Pago;Flete;2.000,50;;2026-11-21;",
    ].join("\n");
    const r = validarFilas(parsearCSV(csv));
    expect(r.movimientos.map((m) => m.concepto)).toEqual(["Cliente A", "Flete"]);
    expect(r.movimientos[1]).toMatchObject({ tipo: "pago", monto: 2000.5, moneda: "ARS", puntualidad: null });
    expect(r.errores.map((e) => e.fila)).toEqual([3, 4, 5, 7, 8]);
    expect(r.errores[0].mensaje).toBe('Fila 3: El tipo "transferencia" no es cobro, pago ni impuesto.');
    expect(r.errores[1].mensaje).toBe("Fila 4: El monto tiene que ser mayor a cero.");
    expect(r.errores[2].mensaje).toContain('moneda "EUR" no es ARS ni USD');
    expect(r.errores[2].mensaje).toContain('la fecha "31/02/2026" no es válida');
    expect(r.errores[3].mensaje).toBe("Fila 7: Falta el concepto.");
    expect(r.errores[4].mensaje).toBe("Fila 8: La puntualidad va de 0 a 100.");
  });

  it("acepta filas de Excel con números y fechas reales", () => {
    const r = validarFilas([
      ["tipo", "concepto", "monto", "moneda", "fecha", "puntualidad"],
      ["cobro", "Cliente", 1500, "ARS", new Date(2026, 10, 15), 90],
    ]);
    expect(r.errores).toEqual([]);
    expect(r.movimientos[0]).toMatchObject({ monto: 1500, fecha: "2026-11-15", puntualidad: 90 });
  });
});

describe("validación de formularios", () => {
  it("formulario de movimiento vacío: un error por campo obligatorio", () => {
    const v = validarMovimiento({ id: ID, tipo: "cobro", concepto: "", monto: "", moneda: "ARS", fecha: "", puntualidad: "" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(Object.keys(v.errores).sort()).toEqual(["concepto", "fecha", "monto"]);
  });

  it("movimiento válido; la puntualidad se descarta en pagos", () => {
    const v = validarMovimiento({ id: ID, tipo: "pago", concepto: " Flete ", monto: "1500,5", moneda: "ARS", fecha: "2026-10-01", puntualidad: "80" });
    expect(v).toEqual({ ok: true, valor: { id: ID, tipo: "pago", concepto: "Flete", monto: 1500.5, moneda: "ARS", fecha: "2026-10-01", puntualidad: null } });
  });

  it("rechaza tipos, monedas e ids inventados", () => {
    const v = validarMovimiento({ id: "x", tipo: "robo", concepto: "a", monto: 1, moneda: "EUR", fecha: "2026-10-01" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(Object.keys(v.errores).sort()).toEqual(["id", "moneda", "tipo"]);
  });

  it("formulario de empresa vacío", () => {
    const v = validarEmpresa({});
    expect(v.ok).toBe(false);
    if (!v.ok) expect(Object.keys(v.errores).sort()).toEqual(["cajaArs", "cajaUsd", "devaluacionMensual", "nombre", "saldoMinimo", "tipoCambio"]);
  });

  it("empresa válida con caja en cero", () => {
    const v = validarEmpresa({ nombre: "Delta", cajaArs: "0", cajaUsd: 0, tipoCambio: "1450", devaluacionMensual: "2,5", saldoMinimo: 0 });
    expect(v).toEqual({ ok: true, valor: { nombre: "Delta", cajaArs: 0, cajaUsd: 0, tipoCambio: 1450, devaluacionMensual: 2.5, saldoMinimo: 0 } });
  });
});
