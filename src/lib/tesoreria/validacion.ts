// Validación compartida por los formularios (cliente) y las Server Actions (servidor).

import { esFechaISO } from "./fechas";
import { MONEDAS, TIPOS, type Empresa, type Movimiento } from "./tipos";

export type Errores<T> = Partial<Record<keyof T, string>>;
export type Validado<T> = { ok: true; valor: T } | { ok: false; errores: Errores<T> };

const MAX_MONTO = 1e13;
const MAX_CONCEPTO = 120;

/** Convierte lo que vino de un input (texto o número) en número, o NaN si está vacío o no es número. */
export function aNumero(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || v.trim() === "") return NaN;
  return Number(v.trim().replace(",", "."));
}

export function validarMovimiento(entrada: Record<string, unknown>): Validado<Movimiento> {
  const errores: Errores<Movimiento> = {};
  const tipo = String(entrada.tipo ?? "");
  const concepto = String(entrada.concepto ?? "").trim();
  const monto = aNumero(entrada.monto);
  const moneda = String(entrada.moneda ?? "");
  const fecha = String(entrada.fecha ?? "");
  const id = String(entrada.id ?? "");
  const puntualidadCruda = entrada.puntualidad;
  const sinPuntualidad = puntualidadCruda === null || puntualidadCruda === undefined || puntualidadCruda === "";
  const puntualidad = sinPuntualidad ? null : aNumero(puntualidadCruda);

  if (!TIPOS.includes(tipo as Movimiento["tipo"])) errores.tipo = "Elegí cobro, pago o impuesto.";
  if (!concepto) errores.concepto = "Escribí un concepto (por ejemplo, el nombre del cliente o proveedor).";
  else if (concepto.length > MAX_CONCEPTO) errores.concepto = `Máximo ${MAX_CONCEPTO} caracteres.`;
  if (Number.isNaN(monto)) errores.monto = "Ingresá un monto.";
  else if (!(monto > 0)) errores.monto = "El monto tiene que ser mayor a cero.";
  else if (monto > MAX_MONTO) errores.monto = "El monto es demasiado grande.";
  if (!MONEDAS.includes(moneda as Movimiento["moneda"])) errores.moneda = "Elegí ARS o USD.";
  if (!fecha) errores.fecha = "Elegí una fecha.";
  else if (!esFechaISO(fecha)) errores.fecha = "La fecha no es válida.";
  if (tipo === "cobro" && puntualidad !== null && (Number.isNaN(puntualidad) || puntualidad < 0 || puntualidad > 100)) {
    errores.puntualidad = "La puntualidad va de 0 a 100.";
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) errores.id = "Identificador inválido.";

  if (Object.keys(errores).length) return { ok: false, errores };
  return {
    ok: true,
    valor: {
      id,
      tipo: tipo as Movimiento["tipo"],
      concepto,
      monto,
      moneda: moneda as Movimiento["moneda"],
      fecha,
      puntualidad: tipo === "cobro" && puntualidad !== null ? Math.round(puntualidad) : null,
    },
  };
}

export function validarEmpresa(entrada: Record<string, unknown>): Validado<Empresa> {
  const errores: Errores<Empresa> = {};
  const nombre = String(entrada.nombre ?? "").trim();
  const n = (k: keyof Empresa) => aNumero(entrada[k]);
  const cajaArs = n("cajaArs");
  const cajaUsd = n("cajaUsd");
  const tipoCambio = n("tipoCambio");
  const devaluacionMensual = n("devaluacionMensual");
  const saldoMinimo = n("saldoMinimo");

  if (!nombre) errores.nombre = "Escribí el nombre de la empresa.";
  else if (nombre.length > 80) errores.nombre = "Máximo 80 caracteres.";
  const noNegativo = (k: keyof Empresa, v: number, etiqueta: string) => {
    if (Number.isNaN(v)) errores[k] = `Ingresá ${etiqueta}.`;
    else if (v < 0) errores[k] = "No puede ser negativo.";
    else if (v > MAX_MONTO) errores[k] = "El valor es demasiado grande.";
  };
  noNegativo("cajaArs", cajaArs, "la caja en pesos (puede ser 0)");
  noNegativo("cajaUsd", cajaUsd, "la caja en dólares (puede ser 0)");
  noNegativo("saldoMinimo", saldoMinimo, "el saldo mínimo (puede ser 0)");
  if (Number.isNaN(tipoCambio)) errores.tipoCambio = "Ingresá el tipo de cambio.";
  else if (!(tipoCambio > 0)) errores.tipoCambio = "Tiene que ser mayor a cero.";
  if (Number.isNaN(devaluacionMensual)) errores.devaluacionMensual = "Ingresá la devaluación esperada (puede ser 0).";
  else if (devaluacionMensual < -50 || devaluacionMensual > 100) errores.devaluacionMensual = "Usá un valor entre −50% y 100%.";

  if (Object.keys(errores).length) return { ok: false, errores };
  return { ok: true, valor: { nombre, cajaArs, cajaUsd, tipoCambio, devaluacionMensual, saldoMinimo } };
}
