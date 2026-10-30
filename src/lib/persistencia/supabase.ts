import {
  borrarMovimiento,
  cargarEjemplo,
  guardarEmpresa,
  guardarMovimiento,
  importarMovimientos,
} from "@/app/acciones";
import type { Persistencia } from "./tipos";

const sinConexion = { ok: false as const, error: "No hay conexión. Revisá internet y probá de nuevo." };

/** Envuelve las Server Actions: si se corta la red, devuelve un error en vez de romper la pantalla. */
function seguro<A extends unknown[], R>(f: (...a: A) => Promise<R>) {
  return async (...a: A) => {
    try {
      return await f(...a);
    } catch {
      return sinConexion;
    }
  };
}

export const persistenciaSupabase: Persistencia = {
  guardarEmpresa: seguro(guardarEmpresa),
  guardarMovimiento: seguro(guardarMovimiento),
  borrarMovimiento: seguro(borrarMovimiento),
  importarMovimientos: seguro(importarMovimientos),
  cargarEjemplo: seguro(() => cargarEjemplo()),
};
