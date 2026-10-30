import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

const PUBLICAS = ["/ingresar"];

/** Refresca la sesión en cada pedido y manda a /ingresar a quien no inició sesión. */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(aGuardar, encabezados) {
        aGuardar.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        aGuardar.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        Object.entries(encabezados).forEach(([k, v]) => respuesta.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const ruta = request.nextUrl.pathname;
  if (!data?.claims && !PUBLICAS.some((p) => ruta.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return respuesta;
}
