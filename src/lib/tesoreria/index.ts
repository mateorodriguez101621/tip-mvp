import { generarAlertas, type Alerta } from "./alertas";
import { diaDelMovimiento, estaVencido, HORIZONTE, proyectar } from "./proyeccion";
import type { DatosTesoreria, Movimiento } from "./tipos";

export * from "./tipos";

export interface Analisis {
  saldos: number[];
  alertas: Alerta[];
  kpis: {
    cajaHoyUsd: number;
    saldoMinimo: number;
    diaSaldoMinimo: number;
    pagosUsdComprometidos: number;
    impuestosArs: number;
  };
  proximos: (Movimiento & { dia: number; vencido: boolean })[];
}

/** Todo lo que muestra el panel, a partir de los datos de la empresa. */
export function analizar({ empresa, movimientos }: DatosTesoreria, hoy: string): Analisis {
  const saldos = proyectar(empresa, movimientos, hoy);
  const saldoMinimo = Math.min(...saldos);
  const conDia = movimientos
    .map((m) => ({ ...m, dia: diaDelMovimiento(m, hoy), vencido: estaVencido(m, hoy) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    saldos,
    alertas: generarAlertas(empresa, movimientos, saldos, hoy),
    kpis: {
      cajaHoyUsd: empresa.cajaUsd + empresa.cajaArs / empresa.tipoCambio,
      saldoMinimo,
      diaSaldoMinimo: saldos.indexOf(saldoMinimo),
      pagosUsdComprometidos: conDia
        .filter((m) => m.tipo === "pago" && m.moneda === "USD")
        .reduce((a, m) => a + m.monto, 0),
      impuestosArs: conDia
        .filter((m) => m.tipo === "impuesto" && m.dia <= HORIZONTE)
        .reduce((a, m) => a + (m.moneda === "USD" ? m.monto * empresa.tipoCambio : m.monto), 0),
    },
    proximos: conDia.filter((m) => m.dia <= HORIZONTE),
  };
}
