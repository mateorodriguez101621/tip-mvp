// Registro automático de movimientos: cada conector trae los movimientos de una fuente
// (sistema de gestión, ARCA o banco) con el mismo formato que la carga manual.
//
// En el MVP las fuentes son simuladas: generan comprobantes verosímiles a partir de la
// fecha de hoy. En la v1 cada conector se reemplaza por la API real (Tango Delta, Xubio,
// Colppy, los web services de ARCA o el home banking) sin tocar la proyección.

import { sumarDias } from "./fechas";
import type { FuenteDeMovimientos } from "./fuentes";
import { nuevoId as nuevoIdPorDefecto } from "./id";
import type { Movimiento } from "./tipos";

export type IdConector = "gestion" | "arca" | "banco";
export type SistemaGestion = "Tango" | "Xubio" | "Colppy";
export const SISTEMAS: SistemaGestion[] = ["Tango", "Xubio", "Colppy"];

export interface Conector {
  id: IdConector;
  nombre: string;
  descripcion: string;
  /** Qué tipo de movimientos registra solo. */
  trae: string;
}

export const CONECTORES: Conector[] = [
  {
    id: "gestion",
    nombre: "Sistema de gestión",
    descripcion: "Tango, Xubio o Colppy, en modo solo lectura.",
    trae: "Facturas de venta pendientes de cobro y facturas de proveedores a pagar.",
  },
  {
    id: "arca",
    nombre: "ARCA",
    descripcion: "Con clave fiscal delegada.",
    trae: "Despachos de importación aprobados y vencimientos de IVA e Ingresos Brutos.",
  },
  {
    id: "banco",
    nombre: "Banco",
    descripcion: "Saldos y débitos automáticos.",
    trae: "Sueldos, servicios y débitos que se repiten todos los meses.",
  },
];

type SinId = Omit<Movimiento, "id">;

const cobro = (concepto: string, monto: number, fecha: string, puntualidad: number): SinId => ({
  tipo: "cobro", concepto, monto, moneda: "ARS", fecha, puntualidad,
});
const egreso = (tipo: "pago" | "impuesto", concepto: string, monto: number, moneda: "ARS" | "USD", fecha: string): SinId => ({
  tipo, concepto, monto, moneda, fecha, puntualidad: null,
});

/** Los movimientos que trae cada fuente simulada, con fechas relativas a hoy. */
export function movimientosDeFuente(id: IdConector, hoy: string, sistema: SistemaGestion = "Tango"): SinId[] {
  const d = (n: number) => sumarDias(hoy, n);
  switch (id) {
    case "gestion":
      return [
        cobro(`Fact. A 0003-00002114 · Cliente Domótica Rosario (${sistema})`, 9_400_000, d(9), 90),
        cobro(`Fact. A 0003-00002121 · Cliente Seguridad Andina (${sistema})`, 16_800_000, d(28), 97),
        cobro(`Fact. A 0003-00002130 · Cliente Constructora Lago (${sistema})`, 11_200_000, d(52), 70),
        egreso("pago", `Fact. B 0007-00000981 · Transporte Ruta 9 (${sistema})`, 2_150_000, "ARS", d(14)),
        egreso("pago", `Fact. A 0012-00004410 · Insumos Electrónicos SRL (${sistema})`, 4_300_000, "ARS", d(35)),
      ];
    case "arca":
      return [
        egreso("pago", "Despacho 26 001 IC04 · Proveedor Ningbo (sensores)", 18_500, "USD", d(55)),
        egreso("impuesto", "IVA · vencimiento estimado (ARCA)", 8_700_000, "ARS", d(23)),
        egreso("impuesto", "Ingresos Brutos · vencimiento estimado (ARCA)", 2_900_000, "ARS", d(19)),
      ];
    case "banco":
      return [
        egreso("pago", "Débito automático · Servicios y alquiler (banco)", 3_600_000, "ARS", d(6)),
        egreso("pago", "Débito automático · Servicios y alquiler (banco)", 3_600_000, "ARS", d(36)),
        egreso("pago", "Débito automático · Servicios y alquiler (banco)", 3_600_000, "ARS", d(66)),
      ];
  }
}

/** Clave para reconocer el mismo comprobante si la fuente se sincroniza dos veces. */
export const claveMovimiento = (m: Pick<Movimiento, "tipo" | "concepto" | "monto" | "moneda" | "fecha">) =>
  [m.tipo, m.concepto.trim().toLowerCase(), m.monto, m.moneda, m.fecha].join("|");

/** Lo que trae la fuente menos lo que ya está cargado, con id nuevo. */
export function movimientosNuevos(
  id: IdConector,
  hoy: string,
  existentes: Movimiento[],
  sistema: SistemaGestion = "Tango",
  nuevoId: () => string = nuevoIdPorDefecto,
): Movimiento[] {
  const ya = new Set(existentes.map(claveMovimiento));
  return movimientosDeFuente(id, hoy, sistema)
    .filter((m) => !ya.has(claveMovimiento(m)))
    .map((m) => ({ ...m, id: nuevoId() }));
}

/** Cada conector como FuenteDeMovimientos, la misma interfaz que usarán las integraciones reales. */
export function fuenteSimulada(id: IdConector, hoy: string, sistema: SistemaGestion = "Tango"): FuenteDeMovimientos {
  const c = CONECTORES.find((x) => x.id === id)!;
  return {
    nombre: id === "gestion" ? sistema : c.nombre,
    async obtenerMovimientos(desde, hasta) {
      return movimientosDeFuente(id, hoy, sistema)
        .filter((m) => m.fecha >= desde && m.fecha <= hasta)
        .map((m) => ({ ...m, id: nuevoIdPorDefecto() }));
    },
  };
}
