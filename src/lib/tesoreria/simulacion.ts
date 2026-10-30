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
}

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

/**
 * Monte Carlo: en cada corrida el tipo de cambio sigue un camino aleatorio
 * (tendencia = devaluación esperada, con volatilidad) y cada cobro se atrasa
 * 10 a 40 días con probabilidad (1 − puntualidad del cliente).
 */
export function simular(
  s: Supuestos,
  movimientos: Movimiento[],
  hoy: string,
  escenario: Pick<OpcionesProyeccion, "saltoDolar" | "demoraDias" | "caidaCobranza"> = {},
  { corridas = 1000, volatilidadAnual = 0.12, semilla = 7 }: OpcionesSimulacion = {},
): ResultadoSimulacion {
  const rnd = generador(semilla);
  const deriva = Math.log(1 + s.devaluacionMensual / 100) / 30;
  const sigma = volatilidadAnual * Math.sqrt(1 / 365);
  const atrasoCobro = (m: Movimiento) => {
    const p = (m.puntualidad ?? PUNTUALIDAD_POR_DEFECTO) / 100;
    return rnd() > p ? Math.round(10 + rnd() * 30) : 0;
  };

  const resultados: number[][] = [];
  let faltantes = 0;
  for (let i = 0; i < corridas; i++) {
    const tcPorDia: number[] = [];
    let x = s.tipoCambio * (1 + (escenario.saltoDolar ?? 0));
    for (let t = 0; t <= HORIZONTE; t++) {
      tcPorDia.push(x);
      const z = Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
      x *= Math.exp(deriva + sigma * z);
    }
    const saldos = proyectar(s, movimientos, hoy, { ...escenario, tcPorDia, atrasoCobro });
    resultados.push(saldos);
    if (primerDiaBajo(saldos) >= 0) faltantes++;
  }

  const p10: number[] = [];
  const p90: number[] = [];
  const columna = new Array<number>(corridas);
  for (let t = 0; t <= HORIZONTE; t++) {
    for (let i = 0; i < corridas; i++) columna[i] = resultados[i][t];
    columna.sort((a, b) => a - b);
    p10.push(columna[Math.floor(corridas * 0.1)]);
    p90.push(columna[Math.floor(corridas * 0.9)]);
  }
  return { probabilidadFaltante: corridas ? faltantes / corridas : 0, p10, p90 };
}
