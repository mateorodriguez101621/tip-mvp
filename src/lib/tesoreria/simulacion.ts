import { HORIZONTE, primerDiaBajo, proyectar, type OpcionesProyeccion } from "./proyeccion";
import type { Movimiento, Supuestos } from "./tipos";

export interface OpcionesSimulacion {
  corridas?: number;
  /** Volatilidad anual del tipo de cambio. */
  volatilidadAnual?: number;
  /** Semilla fija: el mismo escenario da siempre el mismo resultado. */
  semilla?: number;
}

export interface ResultadoSimulacion {
  /** Probabilidad (0 a 1) de que el saldo quede negativo algún día del horizonte. */
  probabilidadFaltante: number;
  p10: number[];
  p90: number[];
  /**
   * Peor saldo de cada corrida, por percentil. Aunque la probabilidad ya esté en 100%,
   * esto sigue mostrando cuánto empeora (o mejora) el escenario.
   */
  peorSaldo: { p10: number; p50: number; p90: number };
  /** Mediana de los días con saldo negativo en el horizonte. */
  diasEnRojo: number;
}

const percentil = (ordenados: number[], q: number) =>
  ordenados.length ? ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * q))] : 0;

/** Puntualidad que se asume para cobros sin dato. */
export const PUNTUALIDAD_POR_DEFECTO = 80;

/** Generador pseudoaleatorio de Park–Miller, reproducible. */
export function generador(semilla: number): () => number {
  let x = semilla % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
}

/** Desvío del monto final de cada cobro (ajustes, notas de crédito, pagos parciales). */
export const DESVIO_COBROS = 0.12;
/** Desvío del monto final de pagos e impuestos en pesos (los en dólares ya varían con el dólar). */
export const DESVIO_PAGOS = 0.04;

/**
 * Monte Carlo: en cada corrida el tipo de cambio sigue un camino aleatorio
 * (tendencia = devaluación esperada, con volatilidad), cada cobro se atrasa
 * 10 a 60 días con probabilidad (1 − puntualidad del cliente), y los montos
 * finales se desvían de lo cargado. Sin la incertidumbre en los montos, la
 * probabilidad salta de 0% a 100% casi sin valores intermedios.
 */
export function simular(
  s: Supuestos,
  movimientos: Movimiento[],
  hoy: string,
  escenario: Pick<OpcionesProyeccion, "saltoDolar" | "demoraDias" | "caidaCobranza"> = {},
  { corridas = 1000, volatilidadAnual = 0.25, semilla = 7 }: OpcionesSimulacion = {},
): ResultadoSimulacion {
  const rnd = generador(semilla);
  const deriva = Math.log(1 + s.devaluacionMensual / 100) / 30;
  const sigma = volatilidadAnual * Math.sqrt(1 / 365);
  const normal = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const atrasoCobro = (m: Movimiento) => {
    const p = (m.puntualidad ?? PUNTUALIDAD_POR_DEFECTO) / 100;
    return rnd() > p ? Math.round(10 + rnd() * 50) : 0;
  };
  const factorMonto = (m: Movimiento) => {
    if (m.tipo === "cobro") return Math.max(0, 1 + DESVIO_COBROS * normal());
    return m.moneda === "ARS" ? Math.max(0, 1 + DESVIO_PAGOS * normal()) : 1;
  };

  const resultados: number[][] = [];
  const peores: number[] = [];
  const rojos: number[] = [];
  let faltantes = 0;
  for (let i = 0; i < corridas; i++) {
    const tcPorDia: number[] = [];
    let x = s.tipoCambio * (1 + (escenario.saltoDolar ?? 0));
    for (let t = 0; t <= HORIZONTE; t++) {
      tcPorDia.push(x);
      x *= Math.exp(deriva + sigma * normal());
    }
    const saldos = proyectar(s, movimientos, hoy, { ...escenario, tcPorDia, atrasoCobro, factorMonto });
    resultados.push(saldos);
    peores.push(Math.min(...saldos));
    rojos.push(saldos.reduce((n, v) => n + (v < 0 ? 1 : 0), 0));
    if (primerDiaBajo(saldos) >= 0) faltantes++;
  }

  const p10: number[] = [];
  const p90: number[] = [];
  const columna = new Array<number>(corridas);
  for (let t = 0; t <= HORIZONTE; t++) {
    for (let i = 0; i < corridas; i++) columna[i] = resultados[i][t];
    columna.sort((a, b) => a - b);
    p10.push(percentil(columna, 0.1));
    p90.push(percentil(columna, 0.9));
  }
  peores.sort((a, b) => a - b);
  rojos.sort((a, b) => a - b);
  return {
    probabilidadFaltante: corridas ? faltantes / corridas : 0,
    p10,
    p90,
    peorSaldo: { p10: percentil(peores, 0.1), p50: percentil(peores, 0.5), p90: percentil(peores, 0.9) },
    diasEnRojo: percentil(rojos, 0.5),
  };
}
