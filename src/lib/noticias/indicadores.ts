// Lectura defensiva de las APIs públicas de indicadores: si cambia el formato, el
// indicador se omite en lugar de romper la página.

import type { Cotizaciones, Indicadores } from "./tipos";

type Objeto = Record<string, unknown>;
const esObjeto = (x: unknown): x is Objeto => typeof x === "object" && x !== null;
const positivo = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null);

/** dolarapi.com/v1/dolares → precio de venta de cada cotización. */
export function leerCotizaciones(json: unknown): Cotizaciones | null {
  if (!Array.isArray(json)) return null;
  const filas = json.filter(esObjeto);
  const venta = (casa: string) => positivo(filas.find((f) => f.casa === casa)?.venta);
  const c: Cotizaciones = {
    oficial: venta("oficial"),
    mayorista: venta("mayorista"),
    mep: venta("bolsa"),
    ccl: venta("contadoconliqui"),
    actualizado: null,
  };
  if (!c.oficial && !c.mayorista && !c.mep && !c.ccl) return null;
  const fechas = filas
    .map((f) => f.fechaActualizacion)
    .filter((f): f is string => typeof f === "string" && !Number.isNaN(Date.parse(f)))
    .sort();
  c.actualizado = fechas.at(-1) ?? null;
  return c;
}

/** argentinadatos.com: riesgo país, último valor. */
export function leerRiesgoPais(json: unknown): Indicadores["riesgoPais"] {
  if (!esObjeto(json)) return null;
  const valor = positivo(json.valor);
  return valor && typeof json.fecha === "string" ? { valor, fecha: json.fecha } : null;
}

/** argentinadatos.com: inflación mensual (serie completa) → último mes e interanual. */
export function leerInflacion(json: unknown): Indicadores["inflacion"] {
  if (!Array.isArray(json)) return null;
  const serie = json
    .filter(esObjeto)
    .filter((f): f is { fecha: string; valor: number } => typeof f.fecha === "string" && typeof f.valor === "number")
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimo = serie.at(-1);
  if (!ultimo) return null;
  const doce = serie.slice(-12);
  const interanual = doce.length === 12 ? (doce.reduce((a, f) => a * (1 + f.valor / 100), 1) - 1) * 100 : null;
  return { mes: ultimo.fecha.slice(0, 7), mensual: ultimo.valor, interanual };
}

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "e"]);

/** "BANCO DE LA NACION ARGENTINA S.A." → "Banco de la Nacion Argentina S.A.". */
export function nombrePropio(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => {
      if (/^([a-z]\.)+$/.test(p)) return p.toUpperCase(); // siglas como "S.A."
      return i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

/** argentinadatos.com: plazo fijo por banco → la mejor TNA para clientes. */
export function leerPlazoFijo(json: unknown): Indicadores["plazoFijo"] {
  if (!Array.isArray(json)) return null;
  let mejor: Indicadores["plazoFijo"] = null;
  for (const f of json.filter(esObjeto)) {
    const tna = positivo(f.tnaClientes);
    if (tna && tna < 5 && typeof f.entidad === "string" && (!mejor || tna * 100 > mejor.tna)) {
      mejor = { tna: tna * 100, banco: nombrePropio(f.entidad) };
    }
  }
  return mejor;
}

/** Cuánto más caro (positivo) o más barato (negativo) está `real` respecto de `referencia`, como fracción. */
export function diferencia(real: number, referencia: number): number {
  return real / referencia - 1;
}
