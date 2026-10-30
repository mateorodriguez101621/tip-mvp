// Solo la URL y la clave pública (publishable/anon). Son públicas por diseño:
// lo que protege los datos son las políticas RLS de la base. No se usa la service role key.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Sin las variables de entorno, la app corre en modo local (datos en el navegador).
 * TIP_MODO_LOCAL=1 lo fuerza aunque estén (lo usan los tests de punta a punta).
 */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_KEY) && process.env.TIP_MODO_LOCAL !== "1";
