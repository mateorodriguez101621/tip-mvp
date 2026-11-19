import { generarAlertas, type Alerta } from "./alertas";
import { diaDelMovimiento, estaVencido, HORIZONTE, proyectar } from "./proyeccion";
import { esEstimado, estimarRecurrentes, type MovimientoProyectado } from "./recurrentes";
import type { DatosTesoreria } from "./tipos";

export * from "./tipos";

export interface Analisis {
  saldos: number[];
  alertas: Alerta[];
  /** Los movimientos cargados más las repeticiones estimadas: lo que usa la proyección. */
  movimientosProyectados: MovimientoProyectado[];
  /** Cuántas repeticiones estimó TIP dentro del horizonte. */
  estimados: number;
  kpis: {
    cajaHoyUsd: number;
    saldoMinimo: number;
    diaSaldoMinimo: number;
    saldoFinal: number;
    pagosUsdComprometidos: number;
    impuestosArs: number;
  };
  proximos: (MovimientoProyectado & { dia: number; vencido: boolean })[];
}

/** Todo lo que muestra el panel, a partir de los datos de la empresa. */
export function analizar({ empresa, movimientos }: DatosTesoreria, hoy: string): Analisis {
  const estimados = estimarRecurrentes(movimientos, hoy);
  const proyectados: MovimientoProyectado[] = [...movimientos, ...estimados];
  const saldos = proyectar(empresa, proyectados, hoy);
  const saldoMinimo = Math.min(...saldos);
  const conDia = proyectados
    .map((m) => ({ ...m, dia: diaDelMovimiento(m, hoy), vencido: estaVencido(m, hoy) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    saldos,
    alertas: generarAlertas(empresa, proyectados, saldos, hoy),
    movimientosProyectados: proyectados,
    estimados: estimados.length,
    kpis: {
      cajaHoyUsd: empresa.cajaUsd + empresa.cajaArs / empresa.tipoCambio,
      saldoMinimo,
      diaSaldoMinimo: saldos.indexOf(saldoMinimo),
      saldoFinal: saldos[saldos.length - 1],
      // Comprometidos: solo lo cargado, no lo estimado.
      pagosUsdComprometidos: conDia
        .filter((m) => m.tipo === "pago" && m.moneda === "USD" && !esEstimado(m))
        .reduce((a, m) => a + m.monto, 0),
      impuestosArs: conDia
        .filter((m) => m.tipo === "impuesto" && m.dia <= HORIZONTE)
        .reduce((a, m) => a + (m.moneda === "USD" ? m.monto * empresa.tipoCambio : m.monto), 0),
    },
    proximos: conDia.filter((m) => m.dia <= HORIZONTE),
  };
}
