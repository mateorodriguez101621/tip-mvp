"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cargarEjemplo, guardarEmpresa } from "@/app/acciones";
import { FormularioEmpresa } from "@/components/FormularioEmpresa";
import type { Empresa } from "@/lib/tesoreria/tipos";

export function AltaEmpresa() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(e: Empresa) {
    const r = await guardarEmpresa(e);
    if (r.ok) router.replace("/datos");
    return r;
  }

  async function ejemplo() {
    setCargando(true);
    setError(null);
    const r = await cargarEjemplo().catch(() => ({ ok: false as const, error: "No hay conexión. Probá de nuevo." }));
    if (r.ok) router.replace("/panel");
    else {
      setError(r.error);
      setCargando(false);
    }
  }

  return (
    <>
      <FormularioEmpresa inicial={null} textoBoton="Crear empresa" onGuardar={crear} />
      <div className="mt-5 border-t border-linea pt-4">
        <p className="mb-2 text-[13px] text-apagado">¿Solo querés ver cómo funciona?</p>
        <button type="button" className="btn btn-sec" onClick={ejemplo} disabled={cargando}>
          {cargando ? "Cargando…" : "Cargar datos de ejemplo"}
        </button>
        {error && <p role="alert" className="mt-2 text-[13px] text-rojo">{error}</p>}
      </div>
    </>
  );
}
