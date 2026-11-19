// Movimientos recurrentes: sueldos, alquileres, IVA o un cliente que paga todos los meses
// se repiten aunque la empresa haya cargado solo los primeros. Sin esto, la proyección
// queda plana después del último movimiento cargado y, a medida que pasan los días y
// todo vence, termina siendo una línea recta en un mismo número.
//
// TIP detecta lo que se repite y lo proyecta hacia adelante como "estimado". Los estimados
// mueven el saldo, pero no se guardan ni se usan para recomendar adelantar cobros.

import { diasEntre, sumarDias, sumarMeses } from "./fechas";
import { HORIZONTE } from "./proyeccion";
import type { Movimiento } from "./tipos";

export interface MovimientoEstimado extends Movimiento {
  estimado: true;
  /** Id del último movimiento real del que sale la estimación. */
  origenId: string;
}

export type MovimientoProyectado = Movimiento | MovimientoEstimado;

export const esEstimado = (m: Movimiento): m is MovimientoEstimado => "estimado" in m && m.estimado === true;

/** Conceptos que, aunque estén cargados una sola vez, se pagan todos los meses. */
const MENSUALES = [
  /\bsueldos?\b/,
  /\bsalarios?\b/,
  /\bgastos fijos\b/,
  /\balquiler(es)?\b/,
  /\bexpensas\b/,
  /\bcargas sociales\b/,
  /\bf\.?\s?931\b/,
  /\baportes\b/,
  /\bhonorarios\b/,
  /\babono\b/,
  /\biva\b/,
  /\bingresos brutos\b/,
  /\biibb\b/,
  /\bmonotributo\b/,
];

/** Intervalos aceptados entre repeticiones, en días. Fuera de esto no se considera periódico. */
const INTERVALO_MIN = 7;
const INTERVALO_MAX = 95;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
}

type Cadencia = { tipo: "mensual" } | { tipo: "dias"; cada: number };

function cadenciaDe(grupo: Movimiento[], concepto: string): Cadencia | null {
  if (grupo.length >= 2) {
    const intervalos = grupo.slice(1).map((m, i) => diasEntre(grupo[i].fecha, m.fecha)).filter((d) => d > 0);
    if (intervalos.length) {
      const cada = Math.round(mediana(intervalos));
      if (cada >= 26 && cada <= 35) return { tipo: "mensual" };
      if (cada >= INTERVALO_MIN && cada <= INTERVALO_MAX) return { tipo: "dias", cada };
    }
  }
  // Las compras del ciclo de importación ("Cámaras · proveedor · anticipo") son de una sola vez.
  if (concepto.includes("·")) return null;
  return MENSUALES.some((r) => r.test(concepto)) ? { tipo: "mensual" } : null;
}

/**
 * Repeticiones futuras de los movimientos periódicos, desde hoy hasta el horizonte.
 * Se agrupan por tipo, moneda y concepto; el monto y la puntualidad son los del último cargado.
 */
export function estimarRecurrentes(movimientos: Movimiento[], hoy: string): MovimientoEstimado[] {
  const grupos = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    const clave = `${m.tipo}|${m.moneda}|${normalizar(m.concepto)}`;
    const g = grupos.get(clave);
    if (g) g.push(m);
    else grupos.set(clave, [m]);
  }

  const fin = sumarDias(hoy, HORIZONTE);
  const estimados: MovimientoEstimado[] = [];
  for (const g of grupos.values()) {
    g.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ultimo = g[g.length - 1];
    const cadencia = cadenciaDe(g, normalizar(ultimo.concepto));
    if (!cadencia) continue;

    for (let k = 1; ; k++) {
      const fecha = cadencia.tipo === "mensual" ? sumarMeses(ultimo.fecha, k) : sumarDias(ultimo.fecha, cadencia.cada * k);
      if (fecha > fin) break;
      // Lo que "tendría que haber pasado" y nadie cargó no se proyecta: no sabemos si ocurrió.
      if (fecha < hoy) continue;
      estimados.push({ ...ultimo, id: `${ultimo.id}~${k}`, fecha, estimado: true, origenId: ultimo.id });
    }
  }
  return estimados.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
