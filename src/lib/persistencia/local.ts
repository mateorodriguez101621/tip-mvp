// Modo local: sin Supabase configurado, los datos viven en el navegador (útil para desarrollar y para los tests).

import { datosDeEjemplo } from "@/lib/tesoreria/demo";
import type { DatosTesoreria } from "@/lib/tesoreria/tipos";
import { validarEmpresa, validarMovimiento } from "@/lib/tesoreria/validacion";
import type { Persistencia, Resultado } from "./tipos";

const CLAVE = "tip-datos-v2";
const ok = { ok: true, valor: undefined } as const;

export function leerLocal(hoy: string): DatosTesoreria {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as DatosTesoreria | null;
    if (guardado?.empresa && Array.isArray(guardado.movimientos)) return guardado;
  } catch {}
  const ejemplo = datosDeEjemplo(hoy);
  escribir(ejemplo);
  return ejemplo;
}

function escribir(d: DatosTesoreria) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(d));
  } catch {}
}

function cambiar(f: (d: DatosTesoreria) => DatosTesoreria): Resultado {
  const actual = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as DatosTesoreria;
  escribir(f(actual));
  return ok;
}

const pausa = () => new Promise((r) => setTimeout(r, 150));

export const persistenciaLocal: Persistencia = {
  async guardarEmpresa(e) {
    await pausa();
    const v = validarEmpresa({ ...e });
    if (!v.ok) return { ok: false, error: "Revisá los datos de la empresa.", errores: v.errores as Record<string, string> };
    return cambiar((d) => ({ ...d, empresa: v.valor }));
  },
  async guardarMovimiento(m) {
    await pausa();
    const v = validarMovimiento({ ...m });
    if (!v.ok) return { ok: false, error: "Revisá el movimiento.", errores: v.errores as Record<string, string> };
    return cambiar((d) => {
      const existe = d.movimientos.some((x) => x.id === m.id);
      return {
        ...d,
        movimientos: existe ? d.movimientos.map((x) => (x.id === m.id ? v.valor : x)) : [...d.movimientos, v.valor],
      };
    });
  },
  async borrarMovimiento(id) {
    await pausa();
    return cambiar((d) => ({ ...d, movimientos: d.movimientos.filter((x) => x.id !== id) }));
  },
  async importarMovimientos(movs, reemplazar) {
    await pausa();
    return cambiar((d) => ({ ...d, movimientos: reemplazar ? movs : [...d.movimientos, ...movs] }));
  },
  async cargarEjemplo(hoy) {
    await pausa();
    const datos = datosDeEjemplo(hoy);
    escribir(datos);
    return { ok: true, valor: datos };
  },
};
