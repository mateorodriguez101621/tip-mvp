"use client";

import Link from "next/link";
import { ListaAlertas } from "@/components/Alertas";
import { useDatos } from "@/components/DatosProvider";
import { GraficoProyeccion } from "@/components/Graficos";
import { BotonEjemplo } from "@/components/BotonEjemplo";
import { Cargando } from "@/components/Cargando";
import { HORIZONTE } from "@/lib/tesoreria/proyeccion";
import { enDias, fmtARS, fmtMonto, fmtUSD } from "@/lib/tesoreria/formato";
import { fechaCorta } from "@/lib/tesoreria/fechas";

function Kpi({ valor, etiqueta, tono }: { valor: string; etiqueta: string; tono?: "mal" | "bien" }) {
  const color = tono === "mal" ? "text-rojo" : tono === "bien" ? "text-verde" : "text-violeta";
  return (
    <div className="tarjeta">
      <div className={`text-lg font-bold sm:text-2xl ${color}`}>{valor}</div>
      <div className="text-xs text-apagado">{etiqueta}</div>
    </div>
  );
}

export function TagTipo({ tipo }: { tipo: string }) {
  return <span className={`tag ${tipo === "cobro" ? "tag-verde" : "tag-rojo"}`}>{tipo}</span>;
}

export function VistaPanel() {
  const { datos, analisis, hoy } = useDatos();
  if (!datos || !analisis) return <Cargando />;
  const { kpis, saldos, alertas, proximos } = analisis;
  const sinMovimientos = datos.movimientos.length === 0;

  return (
    <section>
      <h1 className="titulo mb-3 text-xl">{datos.empresa.nombre}</h1>

      {sinMovimientos && (
        <div className="tarjeta mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="vacio">
          <div>
            <p className="font-semibold">Todavía no cargaste movimientos.</p>
            <p className="text-apagado">Cargá tus cobros, pagos e impuestos para ver la proyección y las alertas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/datos" className="btn">Cargar movimientos</Link>
            <BotonEjemplo />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi valor={fmtUSD(kpis.cajaHoyUsd)} etiqueta="Caja hoy (USD equivalente)" />
        <Kpi
          valor={fmtARS(kpis.saldoMinimo)}
          etiqueta={`Saldo mínimo proyectado (${enDias(kpis.diaSaldoMinimo)})`}
          tono={kpis.saldoMinimo < 0 ? "mal" : "bien"}
        />
        <Kpi valor={fmtUSD(kpis.pagosUsdComprometidos)} etiqueta="Pagos en USD comprometidos" />
        <Kpi valor={fmtARS(kpis.impuestosArs)} etiqueta={`Impuestos a pagar (${HORIZONTE} días)`} />
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <div className="tarjeta min-w-0">
          <h2 className="subtitulo">Flujo de caja proyectado · próximos {HORIZONTE} días</h2>
          <GraficoProyeccion hoy={hoy} saldos={saldos} />
          <p className="mt-2 text-xs text-apagado">
            Saldo en pesos. Los pagos en dólares se convierten al tipo de cambio proyectado de cada fecha.
          </p>
        </div>
        <div className="min-w-0">
          <h2 className="subtitulo">Alertas y recomendaciones</h2>
          <ListaAlertas alertas={alertas} />
        </div>
      </div>

      <div className="tarjeta mt-3.5">
        <h2 className="subtitulo">Próximos movimientos</h2>
        {proximos.length === 0 ? (
          <p className="text-apagado">No hay movimientos en los próximos {HORIZONTE} días.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {proximos.slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.concepto}</div>
                  <div className="text-xs text-apagado">
                    {fechaCorta(m.fecha)} · {m.vencido ? <span className="tag tag-ambar">vencido</span> : enDias(m.dia)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-semibold tabular-nums">{fmtMonto(m.monto, m.moneda)}</span>
                  <TagTipo tipo={m.tipo} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
