// Lectura y validación de planillas de movimientos (CSV o Excel ya convertido a filas).

import { esFechaISO, sumarDias } from "./fechas";
import type { Movimiento } from "./tipos";
import { validarMovimiento } from "./validacion";

export type MovimientoNuevo = Omit<Movimiento, "id">;
export interface ErrorFila {
  /** Número de fila como lo ve el usuario en Excel (la 1 es el encabezado). */
  fila: number;
  mensaje: string;
}
export interface ResultadoImportacion {
  movimientos: MovimientoNuevo[];
  errores: ErrorFila[];
}

export const COLUMNAS = ["tipo", "concepto", "monto", "moneda", "fecha", "puntualidad"] as const;
const OBLIGATORIAS = ["tipo", "concepto", "monto", "fecha"] as const;
export const MAX_FILAS = 2000;

/** CSV con comillas, separador ",", ";" o tabulación (se detecta en el encabezado). */
export function parsearCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const cuenta = (c: string) => primera.split(c).length - 1;
  const sep = [";", "\t", ","].reduce((a, b) => (cuenta(b) > cuenta(a) ? b : a), ",");

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

const normalizar = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

/** Monto en formato argentino ("1.234.567,89") o internacional ("1234567.89"). */
export function parsearMonto(v: unknown): number {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim().replace(/\$|usd|ars|\s/gi, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/** Fecha "aaaa-mm-dd", "dd/mm/aaaa", "dd-mm-aaaa" o fecha de Excel. Devuelve aaaa-mm-dd o null. */
export function parsearFecha(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // Las fechas de Excel llegan a medianoche local: se suma medio día para no correrse de día.
    const d = new Date(v.getTime() + 12 * 3600_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Número de serie de Excel (días desde 1899-12-30).
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  let iso = s;
  const dma = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dma) iso = `${dma[3]}-${dma[2].padStart(2, "0")}-${dma[1].padStart(2, "0")}`;
  return esFechaISO(iso) ? iso : null;
}

/** Valida filas (la primera es el encabezado) y devuelve los movimientos válidos y un error por fila inválida. */
export function validarFilas(filas: unknown[][]): ResultadoImportacion {
  const errores: ErrorFila[] = [];
  const movimientos: MovimientoNuevo[] = [];
  const conDatos = (f: unknown[]) => f.some((c) => String(c ?? "").trim() !== "");

  const encabezado = (filas[0] ?? []).map(normalizar);
  if (!filas.length || !conDatos(filas[0])) {
    return { movimientos, errores: [{ fila: 1, mensaje: "El archivo está vacío. Usá la plantilla." }] };
  }
  const indice = Object.fromEntries(COLUMNAS.map((c) => [c, encabezado.indexOf(c)])) as Record<(typeof COLUMNAS)[number], number>;
  const faltan = OBLIGATORIAS.filter((c) => indice[c] < 0);
  if (faltan.length) {
    return {
      movimientos,
      errores: [{ fila: 1, mensaje: `Faltan columnas: ${faltan.join(", ")}. Usá la plantilla.` }],
    };
  }

  const cuerpo = filas.slice(1);
  if (!cuerpo.some(conDatos)) {
    return { movimientos, errores: [{ fila: 2, mensaje: "La planilla no tiene movimientos debajo del encabezado." }] };
  }
  if (cuerpo.length > MAX_FILAS) {
    return { movimientos, errores: [{ fila: MAX_FILAS + 2, mensaje: `El archivo tiene más de ${MAX_FILAS} filas.` }] };
  }

  cuerpo.forEach((f, i) => {
    if (!conDatos(f)) return;
    const fila = i + 2;
    const celda = (c: (typeof COLUMNAS)[number]) => (indice[c] >= 0 ? f[indice[c]] : "");
    const tipoTexto = normalizar(celda("tipo"));
    const fechaCruda = celda("fecha");
    const fecha = parsearFecha(fechaCruda);
    const montoCrudo = celda("monto");
    const monto = parsearMonto(montoCrudo);
    const monedaTexto = String(celda("moneda") ?? "").trim().toUpperCase();
    const puntualidadCruda = String(celda("puntualidad") ?? "").replace("%", "").trim();

    const problemas: string[] = [];
    if (!["cobro", "pago", "impuesto"].includes(tipoTexto)) {
      problemas.push(`el tipo "${String(celda("tipo") ?? "").trim()}" no es cobro, pago ni impuesto`);
    }
    if (!String(celda("concepto") ?? "").trim()) problemas.push("falta el concepto");
    if (Number.isNaN(monto)) problemas.push(`el monto "${String(montoCrudo ?? "").trim()}" no es un número`);
    else if (!(monto > 0)) problemas.push("el monto tiene que ser mayor a cero");
    if (monedaTexto && !["ARS", "USD"].includes(monedaTexto)) problemas.push(`la moneda "${monedaTexto}" no es ARS ni USD`);
    if (!fecha) problemas.push(`la fecha "${String(fechaCruda ?? "").trim()}" no es válida (usá dd/mm/aaaa)`);

    const candidato = {
      id: "00000000-0000-0000-0000-000000000000",
      tipo: tipoTexto,
      concepto: celda("concepto"),
      monto,
      moneda: monedaTexto || "ARS",
      fecha: fecha ?? "",
      puntualidad: tipoTexto === "cobro" && puntualidadCruda ? parsearMonto(puntualidadCruda) : null,
    };
    if (!problemas.length) {
      const v = validarMovimiento(candidato);
      if (!v.ok) problemas.push(...Object.values(v.errores).map((e) => String(e).replace(/\.$/, "").toLowerCase()));
      else {
        const { tipo, concepto, monto, moneda, fecha, puntualidad } = v.valor;
        movimientos.push({ tipo, concepto, monto, moneda, fecha, puntualidad });
      }
    }
    if (problemas.length) {
      const texto = problemas.join("; ");
      errores.push({ fila, mensaje: `Fila ${fila}: ${texto.charAt(0).toUpperCase()}${texto.slice(1)}.` });
    }
  });

  return { movimientos, errores };
}

/** Plantilla con tres filas de ejemplo, con fechas a partir de hoy en formato dd/mm/aaaa. */
export function plantillaFilas(hoy: string): (string | number)[][] {
  const fecha = (dias: number) => sumarDias(hoy, dias).split("-").reverse().join("/");
  return [
    [...COLUMNAS],
    ["cobro", "Cliente Alarmas Norte", 18000000, "ARS", fecha(12), 95],
    ["pago", "Proveedor Shenzhen (cámaras)", 22000, "USD", fecha(18), ""],
    ["impuesto", "IVA", 9500000, "ARS", fecha(20), ""],
  ];
}

export function plantillaCSV(hoy: string): string {
  return plantillaFilas(hoy)
    .map((f) => f.map((c) => (/[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(";"))
    .join("\r\n");
}
