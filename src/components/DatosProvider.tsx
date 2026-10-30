"use client";

import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import { leerLocal, persistenciaLocal } from "@/lib/persistencia/local";
import type { Persistencia, Resultado } from "@/lib/persistencia/tipos";
import { persistenciaSupabase } from "@/lib/persistencia/supabase";
import { analizar, type Analisis } from "@/lib/tesoreria";
import type { DatosTesoreria, Empresa, Movimiento } from "@/lib/tesoreria/tipos";

export type Modo = "local" | "supabase";

interface ValorDatos {
  hoy: string;
  modo: Modo;
  datos: DatosTesoreria | null;
  analisis: Analisis | null;
  guardarEmpresa(e: Empresa): Promise<Resultado>;
  guardarMovimiento(m: Movimiento): Promise<Resultado>;
  borrarMovimiento(id: string): Promise<Resultado>;
  importarMovimientos(movs: Movimiento[], reemplazar: boolean): Promise<Resultado>;
  cargarEjemplo(): Promise<Resultado>;
}

const Contexto = createContext<ValorDatos | null>(null);

export function DatosProvider({
  hoy,
  modo,
  inicial,
  children,
}: {
  hoy: string;
  modo: Modo;
  /** Datos leídos en el servidor (modo Supabase). En modo local se leen del navegador. */
  inicial: DatosTesoreria | null;
  children: ReactNode;
}) {
  const [datos, setDatos] = useState<DatosTesoreria | null>(inicial);
  const p: Persistencia = modo === "local" ? persistenciaLocal : persistenciaSupabase;

  useEffect(() => {
    // localStorage solo existe en el navegador: se lee después del primer render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (modo === "local") setDatos(leerLocal(hoy));
  }, [modo, hoy]);

  const analisis = useMemo(() => (datos ? analizar(datos, hoy) : null), [datos, hoy]);

  const valor: ValorDatos = {
    hoy,
    modo,
    datos,
    analisis,
    async guardarEmpresa(e) {
      const r = await p.guardarEmpresa(e);
      if (r.ok) setDatos((d) => (d ? { ...d, empresa: e } : d));
      return r;
    },
    async guardarMovimiento(m) {
      const r = await p.guardarMovimiento(m);
      if (r.ok)
        setDatos((d) => {
          if (!d) return d;
          const existe = d.movimientos.some((x) => x.id === m.id);
          return {
            ...d,
            movimientos: existe ? d.movimientos.map((x) => (x.id === m.id ? m : x)) : [...d.movimientos, m],
          };
        });
      return r;
    },
    async borrarMovimiento(id) {
      const r = await p.borrarMovimiento(id);
      if (r.ok) setDatos((d) => (d ? { ...d, movimientos: d.movimientos.filter((x) => x.id !== id) } : d));
      return r;
    },
    async importarMovimientos(movs, reemplazar) {
      const r = await p.importarMovimientos(movs, reemplazar);
      if (r.ok) setDatos((d) => (d ? { ...d, movimientos: reemplazar ? movs : [...d.movimientos, ...movs] } : d));
      return r;
    },
    async cargarEjemplo() {
      const r = await p.cargarEjemplo(hoy);
      if (!r.ok) return r;
      setDatos(r.valor);
      return { ok: true, valor: undefined };
    },
  };

  return <Contexto value={valor}>{children}</Contexto>;
}

export function useDatos(): ValorDatos {
  const v = use(Contexto);
  if (!v) throw new Error("useDatos tiene que usarse dentro de <DatosProvider>");
  return v;
}
