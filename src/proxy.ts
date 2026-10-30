import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { actualizarSesion } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (!supabaseConfigurado) return NextResponse.next();
  return actualizarSesion(request);
}

export const config = {
  // Todo menos archivos estáticos e imágenes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
