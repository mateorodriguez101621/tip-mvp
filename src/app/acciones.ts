"use server";

import { redirect } from "next/navigation";
import type { Resultado } from "@/lib/persistencia/tipos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { datosDeEjemplo } from "@/lib/tesoreria/demo";
import { hoyISO } from "@/lib/tesoreria/fechas";
import { MAX_FILAS } from "@/lib/tesoreria/importacion";
import type { DatosTesoreria, Empresa, Movimiento } from "@/lib/tesoreria/tipos";
import { validarEmpresa, validarMovimiento } from "@/lib/tesoreria/validacion";

// Cada acción valida de nuevo en el servidor: no se confía en lo que manda el navegador.
// La base aplica además las políticas RLS: cada usuario solo puede tocar su empresa.

const ERROR_GENERICO = "No pudimos guardar. Probá de nuevo en un momento.";
const listo = { ok: true, valor: undefined } as const;
const falla = (error: string, errores?: Record<string, string>) => ({ ok: false as const, error, errores });

async function sesion() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  return { supabase, usuario: data.user };
}

function aFilaEmpresa(e: Empresa) {
  return {
    nombre: e.nombre,
    caja_ars: e.cajaArs,
    caja_usd: e.cajaUsd,
    tipo_cambio: e.tipoCambio,
    devaluacion_mensual: e.devaluacionMensual,
    saldo_minimo: e.saldoMinimo,
    actualizado_en: new Date().toISOString(),
  };
}

/** Crea la empresa del usuario o actualiza sus supuestos (hay una sola por usuario). */
export async function guardarEmpresa(entrada: Empresa): Promise<Resultado> {
  const v = validarEmpresa({ ...entrada });
  if (!v.ok) return falla("Revisá los datos de la empresa.", v.errores as Record<string, string>);
  const { supabase, usuario } = await sesion();
  if (!usuario) return falla("Tu sesión expiró. Volvé a ingresar.");
  const { error } = await supabase
    .from("empresas")
    .upsert({ user_id: usuario.id, ...aFilaEmpresa(v.valor) }, { onConflict: "user_id" });
  return error ? falla(ERROR_GENERICO) : listo;
}

async function idEmpresa(supabase: Awaited<ReturnType<typeof crearClienteServidor>>) {
  const { data } = await supabase.from("empresas").select("id").maybeSingle();
  return data?.id as string | undefined;
}

export async function guardarMovimiento(entrada: Movimiento): Promise<Resultado> {
  const v = validarMovimiento({ ...entrada });
  if (!v.ok) return falla("Revisá el movimiento.", v.errores as Record<string, string>);
  const { supabase, usuario } = await sesion();
  if (!usuario) return falla("Tu sesión expiró. Volvé a ingresar.");
  const empresaId = await idEmpresa(supabase);
  if (!empresaId) return falla("Primero cargá los datos de tu empresa.");
  // upsert por id: si el mismo formulario se envía dos veces, queda un solo movimiento.
  const { error } = await supabase.from("movimientos").upsert({ ...v.valor, empresa_id: empresaId }, { onConflict: "id" });
  return error ? falla(ERROR_GENERICO) : listo;
}

export async function borrarMovimiento(id: string): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return falla("Movimiento inválido.");
  const { supabase, usuario } = await sesion();
  if (!usuario) return falla("Tu sesión expiró. Volvé a ingresar.");
  const { error } = await supabase.from("movimientos").delete().eq("id", id);
  return error ? falla("No pudimos borrar el movimiento.") : listo;
}

export async function importarMovimientos(movs: Movimiento[], reemplazar: boolean): Promise<Resultado> {
  if (!Array.isArray(movs) || movs.length > MAX_FILAS) return falla(`Podés importar hasta ${MAX_FILAS} movimientos por vez.`);
  const validos: Movimiento[] = [];
  for (const m of movs) {
    const v = validarMovimiento({ ...m });
    if (!v.ok) return falla("El archivo tiene movimientos inválidos. Volvé a subirlo.");
    validos.push(v.valor);
  }
  const { supabase, usuario } = await sesion();
  if (!usuario) return falla("Tu sesión expiró. Volvé a ingresar.");
  const { error } = await supabase.rpc("importar_movimientos", { p_movimientos: validos, p_reemplazar: reemplazar === true });
  return error ? falla("No pudimos importar los movimientos.") : listo;
}

/** Reemplaza la empresa y los movimientos por la importadora de ejemplo. */
export async function cargarEjemplo(): Promise<Resultado<DatosTesoreria>> {
  const datos = datosDeEjemplo(hoyISO());
  const r = await guardarEmpresa(datos.empresa);
  if (!r.ok) return r;
  const i = await importarMovimientos(datos.movimientos, true);
  if (!i.ok) return i;
  return { ok: true, valor: datos };
}

// Autenticación ----------------------------------------------------------------

export type EstadoIngreso = { error?: string; aviso?: string; email?: string };

function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login")) return "El email o la contraseña no son correctos.";
  if (m.includes("already registered") || m.includes("already exists")) return "Ya existe una cuenta con ese email. Ingresá con tu contraseña.";
  if (m.includes("password") && (m.includes("at least") || m.includes("short"))) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste tu email. Revisá tu casilla.";
  if (m.includes("invalid") && m.includes("email")) return "El email no es válido.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Esperá un minuto y probá de nuevo.";
  return "No pudimos completar el ingreso. Probá de nuevo.";
}

export async function ingresar(_: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const modo = form.get("modo") === "registro" ? "registro" : "ingreso";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Escribí un email válido.", email };
  if (password.length < 6) return { error: "La contraseña tiene que tener al menos 6 caracteres.", email };

  const supabase = await crearClienteServidor();
  if (modo === "registro") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: traducirError(error.message), email };
    // Si el proyecto pide confirmar el email, todavía no hay sesión.
    if (!data.session) return { aviso: "Te mandamos un mail para confirmar la cuenta. Después ingresá desde acá.", email };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: traducirError(error.message), email };
  }
  redirect("/panel");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
