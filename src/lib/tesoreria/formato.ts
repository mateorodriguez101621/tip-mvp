const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

// Espacio duro: "$ 10.531.891" nunca se corta en dos renglones.
export const fmtARS = (n: number) => "$\u00a0" + entero.format(Math.round(n));
export const fmtUSD = (n: number) => "USD\u00a0" + entero.format(Math.round(n));
export const fmtMonto = (n: number, moneda: "ARS" | "USD") =>
  moneda === "USD" ? fmtUSD(n) : fmtARS(n);

/** "$ 12,3 M" para ejes de gráficos. */
export function fmtMillones(n: number): string {
  const m = n / 1e6;
  return "$ " + m.toLocaleString("es-AR", { maximumFractionDigits: Math.abs(m) < 10 ? 1 : 0 }) + " M";
}

export function enDias(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}
