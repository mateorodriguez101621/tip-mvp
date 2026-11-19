"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ListaAlertas } from "@/components/Alertas";
import { useDatos } from "@/components/DatosProvider";
import { GraficoProyeccion } from "@/components/Graficos";
import { BotonEjemplo } from "@/components/BotonEjemplo";
import { Cargando } from "@/components/Cargando";
import { IconoBaja, IconoCaja, IconoDolar, IconoEntra, IconoRecibo, IconoRepite, IconoSale, IconoSube } from "@/components/Iconos";
import { HORIZONTE } from "@/lib/tesoreria/proyeccion";
import { esEstimado } from "@/lib/tesoreria/recurrentes";
import { enDias, fmtARS, fmtMonto, fmtUSD } from "@/lib/tesoreria/formato";
import { fechaCorta, sumarDias } from "@/lib/tesoreria/fechas";

type Tono = "mal" | "bien" | "neutro";

const TONO: Record<Tono, { valor: string; chip: string }> = {
  mal: { valor: "text-rojo", chip: "bg-rojo-claro text-rojo" },
  bien: { valor: "text-verde", chip: "bg-verde-claro text-verde" },
  neutro: { valor: "text-tinta", chip: "bg-lavanda text-violeta" },
};

function Kpi({
  valor,
  etiqueta,
  detalle,
  icono,
  tono = "neutro",
  className = "",
}: {
  valor: string;
  etiqueta: string;
  detalle?: ReactNode;
  icono: ReactNode;
  tono?: Tono;
  className?: string;
}) {
  const t = TONO[tono];
  return (
    <div className={`tarjeta flex min-w-0 flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-apagado">{etiqueta}</span>
        <span className={`icono-chip h-7 w-7 rounded-lg ${t.chip}`}>{icono}</span>
      </div>
      <div className={`truncate text-lg font-bold tracking-tight tabular-nums sm:text-xl ${t.valor}`} title={valor}>
        {valor}
      </div>
      {detalle && <div className="text-xs text-apagado">{detalle}</div>}
    </div>
  );
}

export function TagTipo({ tipo }: { tipo: string }) {
  return <span className={`tag ${tipo === "cobro" ? "tag-verde" : "tag-rojo"}`}>{tipo}</span>;
}

function Leyenda({ color, texto, punteada }: { color: string; texto: string; punteada?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i
        className="inline-block w-4 align-middle"
        style={punteada ? { borderTop: `2px dashed ${color}` } : { height: 3, borderRadius: 2, background: color }}
      />
      {texto}
    </span>
  );
}

export function VistaPanel() {
  const { datos, analisis, hoy } = useDatos();
  if (!datos || !analisis) return <Cargando />;
  const { kpis, saldos, alertas, proximos, estimados } = analisis;
  const { empresa } = datos;
  const sinMovimientos = datos.movimientos.length === 0;
  const cajaHoyArs = empresa.cajaArs + empresa.cajaUsd * empresa.tipoCambio;
  const variacion = kpis.saldoFinal - cajaHoyArs;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="sobretitulo">Panel de tesorería</p>
          <h1 className="titulo truncate text-xl sm:text-2xl">{empresa.nombre}</h1>
        </div>
        <p className="text-xs text-apagado">
          Proyección hasta el {fechaCorta(sumarDias(hoy, HORIZONTE))} · dólar a {fmtARS(empresa.tipoCambio)}
        </p>
      </div>

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6 xl:grid-cols-5">
        <Kpi
          className="col-span-2 md:col-span-3 xl:col-span-1"
          icono={<IconoCaja />}
          etiqueta="Caja hoy"
          valor={fmtUSD(kpis.cajaHoyUsd)}
          detalle={`≈ ${fmtARS(cajaHoyArs)}`}
        />
        <Kpi
          className="md:col-span-3 xl:col-span-1"
          icono={<IconoBaja />}
          etiqueta="Saldo mínimo proyectado"
          valor={fmtARS(kpis.saldoMinimo)}
          detalle={enDias(kpis.diaSaldoMinimo)}
          tono={kpis.saldoMinimo < 0 ? "mal" : "bien"}
        />
        <Kpi
          className="md:col-span-2 xl:col-span-1"
          icono={variacion < 0 ? <IconoBaja /> : <IconoSube />}
          etiqueta={`Saldo en ${HORIZONTE} días`}
          valor={fmtARS(kpis.saldoFinal)}
          detalle={`${variacion < 0 ? "−" : "+"}${fmtARS(Math.abs(variacion))} vs. hoy`}
          tono={kpis.saldoFinal < 0 ? "mal" : "neutro"}
        />
        <Kpi className="md:col-span-2 xl:col-span-1" icono={<IconoDolar />} etiqueta="Pagos en USD comprometidos" valor={fmtUSD(kpis.pagosUsdComprometidos)} />
        <Kpi
          className="md:col-span-2 xl:col-span-1"
          icono={<IconoRecibo />}
          etiqueta={`Impuestos a pagar (${HORIZONTE} días)`}
          valor={fmtARS(kpis.impuestosArs)}
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <div className="tarjeta min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="subtitulo mb-0">Flujo de caja proyectado · próximos {HORIZONTE} días</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-apagado">
              <Leyenda color="#5449DD" texto="Saldo" />
              {empresa.saldoMinimo > 0 && <Leyenda color="#D98B1F" texto="Mínimo de seguridad" punteada />}
              {kpis.saldoMinimo < 0 && <Leyenda color="#D64545" texto="Sin caja" />}
            </div>
          </div>
          <GraficoProyeccion hoy={hoy} saldos={saldos} saldoMinimo={empresa.saldoMinimo} />
          <p className="mt-3 text-xs text-apagado">
            Saldo en pesos. Los pagos en dólares se convierten al tipo de cambio proyectado de cada fecha.
            {estimados > 0 && (
              <>
                {" "}
                <span className="inline-flex items-center gap-1 text-violeta-oscuro">
                  <IconoRepite width={12} height={12} />
                  Incluye {estimados} {estimados === 1 ? "repetición estimada" : "repeticiones estimadas"}
                </span>{" "}
                de movimientos que se repiten (sueldos, impuestos, alquileres…), para que la proyección no quede plana
                después del último movimiento cargado.
              </>
            )}
          </p>
        </div>
        <div className="min-w-0">
          <h2 className="subtitulo">Alertas y recomendaciones</h2>
          <ListaAlertas alertas={alertas} />
        </div>
      </div>

      <div className="tarjeta mt-3.5">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h2 className="subtitulo mb-0">Próximos movimientos</h2>
          <Link href="/datos" className="text-xs font-semibold text-violeta hover:underline">Ver todos</Link>
        </div>
        {proximos.length === 0 ? (
          <p className="text-apagado">No hay movimientos en los próximos {HORIZONTE} días.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {proximos.slice(0, 8).map((m) => {
              const entra = m.tipo === "cobro";
              const estimado = esEstimado(m);
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className={`icono-chip ${entra ? "bg-verde-claro text-verde" : "bg-rojo-claro text-rojo"}`}>
                    {entra ? <IconoEntra width={16} height={16} /> : <IconoSale width={16} height={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.concepto}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-apagado">
                      <span>{fechaCorta(m.fecha)}</span>
                      <span aria-hidden>·</span>
                      {m.vencido ? <span className="tag tag-ambar">vencido</span> : <span>{enDias(m.dia)}</span>}
                      <span className="capitalize">· {m.tipo}</span>
                      {estimado && (
                        <span className="tag tag-gris" title="TIP lo estima porque se repite; no está cargado">
                          estimado
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 font-semibold tabular-nums ${entra ? "text-verde" : "text-tinta"} ${estimado ? "opacity-70" : ""}`}>
                    {entra ? "+" : "−"}
                    {fmtMonto(m.monto, m.moneda)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
