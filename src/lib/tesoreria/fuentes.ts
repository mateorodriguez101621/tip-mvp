import type { Movimiento } from "./tipos";

/**
 * Una fuente de movimientos: hoy la carga manual y la planilla; en la v1, ARCA
 * (vencimientos de IVA e Ingresos Brutos), los bancos (saldos y acreditaciones)
 * o Tango/Xubio (facturas emitidas y recibidas). Cada fuente devuelve movimientos
 * con el mismo formato y la proyección no cambia.
 */
export interface FuenteDeMovimientos {
  nombre: string;
  obtenerMovimientos(desde: string, hasta: string): Promise<Movimiento[]>;
}

/** Combina varias fuentes en una sola lista ordenada por fecha. */
export async function juntarFuentes(
  fuentes: FuenteDeMovimientos[],
  desde: string,
  hasta: string,
): Promise<Movimiento[]> {
  const listas = await Promise.all(fuentes.map((f) => f.obtenerMovimientos(desde, hasta)));
  return listas.flat().sort((a, b) => a.fecha.localeCompare(b.fecha));
}
