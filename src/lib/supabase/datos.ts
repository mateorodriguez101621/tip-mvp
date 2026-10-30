import "server-only";
import type { DatosTesoreria, Movimiento } from "@/lib/tesoreria/tipos";
import { crearClienteServidor } from "./server";

export async function usuarioActual() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Lee la empresa y los movimientos del usuario. null si todavía no creó la empresa. */
export async function leerDatos(): Promise<DatosTesoreria | null> {
  const supabase = await crearClienteServidor();
  const { data: e } = await supabase.from("empresas").select("*").maybeSingle();
  if (!e) return null;
  const { data: movs, error } = await supabase
    .from("movimientos")
    .select("id, tipo, concepto, monto, moneda, fecha, puntualidad")
    .order("fecha");
  if (error) throw new Error("No pudimos leer los movimientos.");
  return {
    empresa: {
      nombre: e.nombre,
      cajaArs: Number(e.caja_ars),
      cajaUsd: Number(e.caja_usd),
      tipoCambio: Number(e.tipo_cambio),
      devaluacionMensual: Number(e.devaluacion_mensual),
      saldoMinimo: Number(e.saldo_minimo),
    },
    movimientos: (movs ?? []).map((m) => ({ ...m, monto: Number(m.monto) }) as Movimiento),
  };
}
