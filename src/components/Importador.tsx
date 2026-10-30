"use client";

import { useRef, useState } from "react";
import { useDatos } from "@/components/DatosProvider";
import { descargarPlantillaCSV, descargarPlantillaExcel, ErrorArchivo, leerPlanilla } from "@/lib/archivos";
import { nuevoId } from "@/lib/tesoreria/id";
import { validarFilas, type ResultadoImportacion } from "@/lib/tesoreria/importacion";

const MAX_ERRORES_VISIBLES = 15;

export function Importador() {
  const { hoy, importarMovimientos, datos } = useDatos();
  const [resultado, setResultado] = useState<(ResultadoImportacion & { archivo: string }) | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setMensaje(null);
    setResultado(null);
    try {
      const filas = await leerPlanilla(archivo);
      setResultado({ ...validarFilas(filas), archivo: archivo.name });
    } catch (err) {
      setMensaje({ ok: false, texto: err instanceof ErrorArchivo ? err.message : "No pudimos leer el archivo." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function importar(reemplazar: boolean) {
    if (!resultado || ocupado) return;
    if (reemplazar && (datos?.movimientos.length ?? 0) > 0 && !confirm("Se van a borrar tus movimientos actuales y quedan solo los del archivo. ¿Seguimos?")) return;
    setOcupado(true);
    const movs = resultado.movimientos.map((m) => ({ ...m, id: nuevoId() }));
    const r = await importarMovimientos(movs, reemplazar);
    setOcupado(false);
    if (r.ok) {
      setMensaje({ ok: true, texto: `Importamos ${movs.length} movimientos${resultado.errores.length ? ` (salteamos ${resultado.errores.length} filas con errores)` : ""}.` });
      setResultado(null);
    } else setMensaje({ ok: false, texto: r.error });
  }

  return (
    <div>
      <p className="mb-2.5 text-xs text-apagado">
        Subí un CSV o un Excel con las columnas <b>tipo, concepto, monto, moneda, fecha, puntualidad</b>. Tipo: cobro, pago o
        impuesto. Fecha: dd/mm/aaaa. Puntualidad: % de veces que ese cliente pagó a tiempo (solo cobros).
      </p>
      <div className="flex flex-wrap gap-2">
        <label className="btn cursor-pointer">
          Subir archivo
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={elegir}
            data-testid="archivo"
          />
        </label>
        <button type="button" className="btn btn-sec" onClick={() => descargarPlantillaExcel(hoy)}>
          Plantilla Excel
        </button>
        <button type="button" className="btn btn-sec" onClick={() => descargarPlantillaCSV(hoy)}>
          Plantilla CSV
        </button>
      </div>

      {mensaje && (
        <p role="status" className={`mt-2.5 ${mensaje.ok ? "text-verde" : "text-rojo"}`}>
          {mensaje.texto}
        </p>
      )}

      {resultado && (
        <div className="mt-3 rounded-xl border border-linea bg-white p-3" data-testid="vista-previa">
          <p className="font-semibold">{resultado.archivo}</p>
          <p className="text-[13px]">
            <span className="text-verde">{resultado.movimientos.length} movimientos listos para importar</span>
            {resultado.errores.length > 0 && (
              <span className="text-rojo"> · {resultado.errores.length} {resultado.errores.length === 1 ? "fila con error" : "filas con errores"}</span>
            )}
          </p>
          {resultado.errores.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-rojo-claro/60 px-3 py-2 text-[13px] text-rojo" aria-label="Errores del archivo">
              {resultado.errores.slice(0, MAX_ERRORES_VISIBLES).map((e) => (
                <li key={e.fila}>{e.mensaje}</li>
              ))}
              {resultado.errores.length > MAX_ERRORES_VISIBLES && (
                <li>… y {resultado.errores.length - MAX_ERRORES_VISIBLES} errores más.</li>
              )}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {resultado.movimientos.length > 0 && (
              <>
                <button type="button" className="btn" disabled={ocupado} onClick={() => importar(false)}>
                  {ocupado ? "Importando…" : "Agregar a mis movimientos"}
                </button>
                <button type="button" className="btn btn-sec" disabled={ocupado} onClick={() => importar(true)}>
                  Reemplazar todos
                </button>
              </>
            )}
            <button type="button" className="btn btn-texto" disabled={ocupado} onClick={() => setResultado(null)}>
              {resultado.movimientos.length ? "Cancelar" : "Cerrar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
