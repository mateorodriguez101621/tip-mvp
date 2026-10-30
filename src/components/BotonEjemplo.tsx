"use client";

import { useState } from "react";
import { useDatos } from "@/components/DatosProvider";

/** Reemplaza todo por la importadora de ejemplo, previa confirmación. */
export function BotonEjemplo({ alTerminar }: { alTerminar?: (mensaje: string) => void }) {
  const { cargarEjemplo, datos } = useDatos();
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    const hayDatos = (datos?.movimientos.length ?? 0) > 0;
    if (hayDatos && !confirm("Esto reemplaza tu empresa y tus movimientos por los de una importadora de ejemplo. ¿Seguimos?")) return;
    setCargando(true);
    const r = await cargarEjemplo();
    setCargando(false);
    alTerminar?.(r.ok ? "Listo: cargamos los datos de ejemplo." : r.error);
  }

  return (
    <button type="button" className="btn btn-sec" onClick={cargar} disabled={cargando}>
      {cargando ? "Cargando…" : "Cargar datos de ejemplo"}
    </button>
  );
}
