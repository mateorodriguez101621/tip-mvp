// Lectura de planillas y descarga de plantillas en el navegador.

import { parsearCSV, plantillaCSV, plantillaFilas } from "@/lib/tesoreria/importacion";

export const TAMANIO_MAXIMO = 5 * 1024 * 1024;

export class ErrorArchivo extends Error {}

/** Devuelve las filas de la primera hoja (Excel) o del CSV. */
export async function leerPlanilla(archivo: File): Promise<unknown[][]> {
  if (archivo.size > TAMANIO_MAXIMO) throw new ErrorArchivo("El archivo pesa más de 5 MB.");
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) return parsearCSV(await archivo.text());
  if (nombre.endsWith(".xlsx") || nombre.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { cellDates: true });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      return XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: "" });
    } catch {
      throw new ErrorArchivo("No pudimos abrir el Excel. ¿Está dañado o protegido con contraseña?");
    }
  }
  throw new ErrorArchivo("Formato no soportado. Subí un .csv, .xlsx o .xls.");
}

function descargar(blob: Blob, nombre: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function descargarPlantillaCSV(hoy: string) {
  descargar(new Blob(["﻿" + plantillaCSV(hoy)], { type: "text/csv;charset=utf-8" }), "plantilla-tip.csv");
}

export async function descargarPlantillaExcel(hoy: string) {
  const XLSX = await import("xlsx");
  const hoja = XLSX.utils.aoa_to_sheet(plantillaFilas(hoy));
  hoja["!cols"] = [{ wch: 10 }, { wch: 32 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Movimientos");
  const datos = XLSX.write(libro, { type: "array", bookType: "xlsx" });
  descargar(new Blob([datos], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "plantilla-tip.xlsx");
}
