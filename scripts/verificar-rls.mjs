// Verifica las políticas RLS con dos usuarios de prueba: cada uno ve y modifica solo su empresa.
// Uso: node --env-file=.env.local scripts/verificar-rls.mjs
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sello = Date.now().toString(36);
let fallas = 0;
const chequear = (ok, texto) => { console.log(`${ok ? "✓" : "✗"} ${texto}`); if (!ok) fallas++; };

async function usuario(nombre) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const email = `tip.prueba.${nombre}.${sello}@example.com`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await c.auth.signUp({ email, password });
  if (error || !data.session) throw new Error(`No se pudo crear ${nombre}: ${error?.message ?? "sin sesión (¿Confirm email activado?)"}`);
  return { c, email, password, id: data.user.id };
}
const empresa = (nombre) => ({ nombre, caja_ars: 1000, caja_usd: 0, tipo_cambio: 1450, devaluacion_mensual: 2, saldo_minimo: 0 });

const A = await usuario("a");
const B = await usuario("b");
writeFileSync(".usuarios-prueba.local.json", JSON.stringify([A, B].map(({ email, password }) => ({ email, password })), null, 2));

const { data: eA, error: e1 } = await A.c.from("empresas").insert(empresa("Empresa A")).select().single();
chequear(!e1 && eA, "A crea su empresa");
const { error: e2 } = await A.c.from("empresas").insert(empresa("Segunda de A"));
chequear(e2?.code === "23505", "A no puede crear una segunda empresa");
const { error: e2b } = await A.c.from("empresas").insert({ ...empresa("Empresa ajena"), user_id: B.id });
chequear(!!e2b, "A no puede crear una empresa a nombre de B");

const idMov = randomUUID();
const mov = { id: idMov, empresa_id: eA.id, tipo: "cobro", concepto: "Cliente X", monto: 100, moneda: "ARS", fecha: "2026-12-01", puntualidad: 90 };
await A.c.from("movimientos").upsert(mov, { onConflict: "id" });
await A.c.from("movimientos").upsert(mov, { onConflict: "id" });
const { data: movsA } = await A.c.from("movimientos").select("id");
chequear(movsA?.length === 1, "Guardar dos veces el mismo movimiento deja uno solo (doble clic)");

const { data: eB } = await B.c.from("empresas").insert(empresa("Empresa B")).select().single();
const { data: verEmp } = await B.c.from("empresas").select("id, nombre");
chequear(verEmp?.length === 1 && verEmp[0].id === eB.id, "B ve solo su empresa");
const { data: verMov } = await B.c.from("movimientos").select("id");
chequear(verMov?.length === 0, "B no ve los movimientos de A");
const { error: e3 } = await B.c.from("movimientos").insert({ ...mov, id: randomUUID() });
chequear(!!e3, "B no puede cargar movimientos en la empresa de A");
const { error: e4 } = await B.c.from("movimientos").upsert({ ...mov, concepto: "hackeado" }, { onConflict: "id" });
const { data: movA } = await A.c.from("movimientos").select("concepto").eq("id", idMov).single();
chequear(!!e4 && movA?.concepto === "Cliente X", "B no puede pisar un movimiento de A");
const { data: upd } = await B.c.from("empresas").update({ nombre: "hackeada" }).eq("id", eA.id).select();
chequear(upd?.length === 0, "B no puede editar la empresa de A");
const { data: del } = await B.c.from("movimientos").delete().eq("id", idMov).select();
chequear(del?.length === 0, "B no puede borrar movimientos de A");
const { error: e5 } = await B.c.rpc("importar_movimientos", { p_movimientos: [], p_reemplazar: true });
const { data: movsA2 } = await A.c.from("movimientos").select("id");
chequear(!e5 && movsA2?.length === 1, "Reemplazar todo desde B no afecta a A");
const anon = createClient(URL, KEY, { auth: { persistSession: false } });
const { data: anonData, error: e6 } = await anon.from("empresas").select("id");
chequear(!!e6 || anonData?.length === 0, "Sin sesión no se ve nada");

// Limpieza: cada usuario borra su empresa (y sus movimientos, en cascada).
await A.c.from("empresas").delete().eq("id", eA.id);
await B.c.from("empresas").delete().eq("id", eB.id);
console.log(fallas ? `\n${fallas} chequeos fallaron` : "\nRLS OK: todos los chequeos pasaron");
process.exit(fallas ? 1 : 0);
