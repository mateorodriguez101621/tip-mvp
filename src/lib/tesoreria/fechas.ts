// Fechas como texto aaaa-mm-dd. Se calculan en UTC para no depender del huso del servidor.

const DIA_MS = 86_400_000;
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const formatoIso = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Argentina, como aaaa-mm-dd. */
export function hoyISO(ahora: Date = new Date()): string {
  return formatoIso.format(ahora);
}

function aUTC(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

export function esFechaISO(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Días entre dos fechas (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / DIA_MS);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(aUTC(iso) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** "d/m", para ejes y tablas. */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}/${m}`;
}
