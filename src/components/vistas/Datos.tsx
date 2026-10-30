"use client";

import { useState } from "react";
import { BotonEjemplo } from "@/components/BotonEjemplo";
import { Cargando } from "@/components/Cargando";
import { useDatos } from "@/components/DatosProvider";
import { FormularioEmpresa } from "@/components/FormularioEmpresa";
import { FormularioMovimiento } from "@/components/FormularioMovimiento";
import { Importador } from "@/components/Importador";
import { TagTipo } from "@/components/vistas/Panel";
import { fechaCorta } from "@/lib/tesoreria/fechas";
import { fmtMonto } from "@/lib/tesoreria/formato";
import type { Movimiento } from "@/lib/tesoreria/tipos";

export function VistaDatos() {
  const { datos, hoy, guardarEmpresa, guardarMovimiento, borrarMovimiento } = useDatos();
  const [editando, setEditando] = useState<Movimiento | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  if (!datos) return <Cargando />;

  const movimientos = [...datos.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  async function borrar(m: Movimiento) {
    if (borrando || !confirm(`¿Borrar "${m.concepto}"?`)) return;
    setBorrando(m.id);
    const r = await borrarMovimiento(m.id);
    setBorrando(null);
    if (!r.ok) setAviso(r.error);
  }

  return (
    <section className="flex flex-col gap-3.5">
      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="tarjeta">
          <h2 className="subtitulo">Empresa y supuestos</h2>
          {/* key: si se cargan los datos de ejemplo, el formulario se reinicia con los valores nuevos */}
          <FormularioEmpresa key={JSON.stringify(datos.empresa)} inicial={datos.empresa} onGuardar={guardarEmpresa} />
        </div>
        <div className="tarjeta flex flex-col gap-4">
          <div>
            <h2 className="subtitulo">Importar desde Excel o CSV</h2>
            <Importador />
          </div>
          <div className="border-t border-linea pt-3">
            <h2 className="subtitulo">¿Querés probar con una empresa de ejemplo?</h2>
            <p className="mb-2.5 text-xs text-apagado">
              Una importadora de seguridad electrónica ficticia, con cobros, pagos a proveedores de China e impuestos.
            </p>
            <BotonEjemplo alTerminar={setAviso} />
            {aviso && <p role="status" className="mt-2 text-[13px]">{aviso}</p>}
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <h2 className="subtitulo">{editando ? `Editar: ${editando.concepto}` : "Nuevo movimiento"}</h2>
        <FormularioMovimiento
          key={editando?.id ?? "nuevo"}
          hoy={hoy}
          editando={editando}
          onGuardar={guardarMovimiento}
          onCerrar={editando ? () => setEditando(null) : undefined}
        />
      </div>

      <div className="tarjeta">
        <h2 className="subtitulo">Movimientos ({movimientos.length})</h2>
        {movimientos.length === 0 ? (
          <p className="text-apagado" data-testid="sin-movimientos">
            Todavía no hay movimientos. Cargalos con el formulario, subí una planilla o probá con los datos de ejemplo.
          </p>
        ) : (
          <>
            {/* Escritorio: tabla */}
            <table className="hidden w-full border-collapse text-[13px] md:table">
              <thead>
                <tr className="text-left text-apagado">
                  {["Fecha", "Tipo", "Concepto", "Monto", "Puntualidad", ""].map((t) => (
                    <th key={t} className={`border-b-[1.5px] border-violeta px-1.5 py-1.5 font-semibold ${t === "Monto" ? "text-right" : ""}`}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-b border-linea" data-testid="fila-movimiento">
                    <td className="px-1.5 py-1.5 whitespace-nowrap">
                      {fechaCorta(m.fecha)}/{m.fecha.slice(2, 4)} {m.fecha < hoy && <span className="tag tag-ambar ml-1">vencido</span>}
                    </td>
                    <td className="px-1.5"><TagTipo tipo={m.tipo} /></td>
                    <td className="px-1.5">{m.concepto}</td>
                    <td className="px-1.5 text-right tabular-nums whitespace-nowrap">{fmtMonto(m.monto, m.moneda)}</td>
                    <td className="px-1.5">{m.puntualidad !== null ? `${m.puntualidad}%` : "—"}</td>
                    <td className="px-1.5 text-right whitespace-nowrap">
                      <button className="btn btn-texto" onClick={() => setEditando(m)}>Editar</button>
                      <button className="btn btn-texto" onClick={() => borrar(m)} disabled={borrando === m.id} aria-label={`Borrar ${m.concepto}`}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Celular: tarjetas */}
            <ul className="flex flex-col divide-y divide-linea md:hidden">
              {movimientos.map((m) => (
                <li key={m.id} className="py-2.5" data-testid="tarjeta-movimiento">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium break-words">{m.concepto}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-apagado">
                        <TagTipo tipo={m.tipo} />
                        <span>{fechaCorta(m.fecha)}/{m.fecha.slice(2, 4)}</span>
                        {m.fecha < hoy && <span className="tag tag-ambar">vencido</span>}
                        {m.puntualidad !== null && <span>· paga a tiempo {m.puntualidad}%</span>}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{fmtMonto(m.monto, m.moneda)}</span>
                  </div>
                  <div className="mt-1 flex justify-end gap-1">
                    <button className="btn btn-texto" onClick={() => { setEditando(m); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
                    <button className="btn btn-texto" onClick={() => borrar(m)} disabled={borrando === m.id}>Borrar</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
