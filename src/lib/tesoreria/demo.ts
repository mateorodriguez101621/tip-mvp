import { sumarDias } from "./fechas";
import { nuevoId as nuevoIdPorDefecto } from "./id";
import type { DatosTesoreria, Movimiento } from "./tipos";

type SinId = Omit<Movimiento, "id">;

/** Importadora de seguridad electrónica ficticia, con fechas relativas a hoy. */
export function datosDeEjemplo(hoy: string, nuevoId: () => string = nuevoIdPorDefecto): DatosTesoreria {
  const d = (n: number) => sumarDias(hoy, n);
  const cobro = (concepto: string, monto: number, dias: number, puntualidad: number): SinId => ({
    tipo: "cobro", concepto, monto, moneda: "ARS", fecha: d(dias), puntualidad,
  });
  const egreso = (tipo: "pago" | "impuesto", concepto: string, monto: number, moneda: "ARS" | "USD", dias: number): SinId => ({
    tipo, concepto, monto, moneda, fecha: d(dias), puntualidad: null,
  });

  const movimientos: SinId[] = [
    cobro("Cliente Alarmas Norte", 18_000_000, 12, 95),
    egreso("pago", "Proveedor Shenzhen (cámaras)", 22_000, "USD", 18),
    cobro("Cliente Integradora Sur", 25_000_000, 25, 60),
    egreso("impuesto", "IVA", 9_500_000, "ARS", 20),
    egreso("impuesto", "Ingresos Brutos", 3_200_000, "ARS", 16),
    egreso("pago", "Sueldos y gastos fijos", 14_000_000, "ARS", 30),
    egreso("pago", "Proveedor Hangzhou (grabadores)", 50_000, "USD", 40),
    cobro("Cliente Seguridad Total", 30_000_000, 46, 88),
    cobro("Cliente Edificios Palermo", 12_000_000, 33, 92),
    egreso("impuesto", "IVA", 10_500_000, "ARS", 48),
    egreso("pago", "Sueldos y gastos fijos", 14_000_000, "ARS", 60),
    cobro("Cliente Alarmas Norte", 20_000_000, 70, 95),
    egreso("pago", "Despachante y flete", 6_000_000, "ARS", 42),
    egreso("pago", "Sueldos y gastos fijos", 14_000_000, "ARS", 90),
  ];

  return {
    empresa: {
      nombre: "Importadora Delta (ejemplo)",
      cajaArs: 56_000_000,
      cajaUsd: 12_000,
      tipoCambio: 1450,
      devaluacionMensual: 2,
      saldoMinimo: 5_000_000,
    },
    movimientos: movimientos.map((m) => ({ ...m, id: nuevoId() })),
  };
}
