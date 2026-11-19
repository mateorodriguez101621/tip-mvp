"use client";

import { useMemo, useRef, useState } from "react";
import { Campo } from "@/components/Campo";
import { useDatos } from "@/components/DatosProvider";
import {
  COMPRA_POR_DEFECTO,
  fechasDelCiclo,
  movimientosDeCompra,
  tributos,
  validarCompra,
  type CompraImportacion,
  type ErroresCompra,
} from "@/lib/tesoreria/ciclo";
import { fechaCorta, sumarDias } from "@/lib/tesoreria/fechas";
import { fmtMonto, fmtUSD } from "@/lib/tesoreria/formato";
import { nuevoId } from "@/lib/tesoreria/id";

type Texto = Record<keyof CompraImportacion, string>;
const NUMERICOS: (keyof CompraImportacion)[] = [
  "fob", "anticipoPct", "diasProduccion", "diasTransito", "fletePct", "derechosPct", "ventaArs", "diasCobro",
];

const inicial = (hoy: string): Texto => ({
  proveedor: "",
  mercaderia: "",
  fob: "",
  fechaPedido: sumarDias(hoy, 7),
  ventaArs: "",
  ...Object.fromEntries(Object.entries(COMPRA_POR_DEFECTO).map(([k, v]) => [k, String(v)])),
}) as Texto;

function aCompra(t: Texto): CompraImportacion {
  const c = { ...t } as unknown as CompraImportacion;
  for (const k of NUMERICOS) {
    const v = t[k].trim().replace(",", ".");
    (c as unknown as Record<string, number>)[k] = v === "" ? (k === "ventaArs" ? 0 : NaN) : Number(v);
  }
  return c;
}

/**
 * Carga de una compra al exterior: TIP arma solo el anticipo, el saldo contra embarque,
 * el flete, los tributos del despacho y el cobro de la venta, cada uno en su fecha.
 */
export function NuevaImportacion() {
  const { datos, hoy, importarMovimientos } = useDatos();
  const [t, setT] = useState<Texto>(() => inicial(hoy));
  const [errores, setErrores] = useState<ErroresCompra>({});
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enviando = useRef(false);

  const compra = useMemo(() => aCompra(t), [t]);
  const valida = Object.keys(validarCompra(compra)).length === 0;
  const todos = useMemo(() => (valida ? movimientosDeCompra(compra) : []), [compra, valida]);
  // Lo que tiene fecha pasada ya se pagó (o cobró) y está en la caja: si se cargara, la
  // proyección lo tomaría como vencido y lo descontaría otra vez hoy.
  const movs = todos.filter((m) => m.fecha >= hoy);
  const pasados = todos.length - movs.length;
  const trib = valida ? tributos(compra) : null;
  const fechas = valida ? fechasDelCiclo(compra) : null;

  if (!datos) return null;
  const tc = datos.empresa.tipoCambio;

  const cambiar = (k: keyof CompraImportacion) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setT((x) => ({ ...x, [k]: e.target.value }));
    setErrores((x) => ({ ...x, [k]: undefined }));
    setAviso(null);
  };

  async function agregar() {
    if (enviando.current) return;
    const e = validarCompra(compra);
    if (Object.keys(e).length) {
      setErrores(e);
      setAviso({ ok: false, texto: "Revisá los campos marcados." });
      return;
    }
    if (movs.length === 0) {
      setAviso({ ok: false, texto: "Todas las etapas de esta compra ya pasaron: no queda nada por proyectar." });
      return;
    }
    enviando.current = true;
    setGuardando(true);
    const r = await importarMovimientos(movs.map((m) => ({ ...m, id: nuevoId() })), false);
    enviando.current = false;
    setGuardando(false);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.error });
      return;
    }
    setAviso({ ok: true, texto: `Agregamos ${movs.length} movimientos de "${compra.mercaderia || compra.proveedor}". La proyección ya los incluye.` });
    setT(inicial(hoy));
  }

  const num = (k: keyof CompraImportacion, etiqueta: string, ayuda?: string) => (
    <Campo id={`compra-${k}`} etiqueta={etiqueta} type="number" inputMode="decimal" step="any" min={0} value={t[k]} onChange={cambiar(k)} error={errores[k]} ayuda={ayuda} />
  );

  return (
    <div className="tarjeta" data-testid="nueva-importacion">
      <h2 className="subtitulo mb-0">Nueva importación</h2>
      <p className="mt-1 mb-3 text-[13px] text-apagado">
        Cargá la compra una sola vez y TIP arma solo el anticipo, el saldo contra embarque, el flete, los tributos del despacho y el
        cobro de la venta, cada uno en su fecha. Los montos en dólares se pasan a pesos con el dólar proyectado de cada fecha.
      </p>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Campo id="compra-proveedor" etiqueta="Proveedor" value={t.proveedor} onChange={cambiar("proveedor")} error={errores.proveedor} placeholder="Ningbo Security" />
        <Campo id="compra-mercaderia" etiqueta="Mercadería" value={t.mercaderia} onChange={cambiar("mercaderia")} placeholder="Cámaras IP" />
        {num("fob", "Valor FOB (USD)")}
        <Campo id="compra-fechaPedido" etiqueta="Fecha del pedido" type="date" value={t.fechaPedido} onChange={cambiar("fechaPedido")} error={errores.fechaPedido} />
        {num("anticipoPct", "Anticipo (%)", "Se paga al hacer el pedido.")}
        {num("diasProduccion", "Días hasta el embarque", "Ahí se paga el saldo.")}
        {num("diasTransito", "Días de tránsito", "Hasta el despacho.")}
        {num("fletePct", "Flete y seguro (% del FOB)")}
        {num("derechosPct", "Derecho de importación (%)", "Según la posición arancelaria.")}
        {num("ventaArs", "Venta esperada (ARS)", "Opcional: lo que vas a cobrar al vender.")}
        {num("diasCobro", "Días hasta cobrar la venta", "Desde que llega la mercadería.")}
      </div>

      {valida && fechas && trib && (
        <div className="mt-4 rounded-xl border border-linea bg-white/70 p-3" data-testid="ciclo-preview">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-[14px]">Así queda el ciclo de esta compra</b>
            <span className="text-xs text-apagado">
              Pedido {fechaCorta(fechas.pedido)} → embarque {fechaCorta(fechas.embarque)} → despacho {fechaCorta(fechas.llegada)}
              {compra.ventaArs > 0 && <> → cobro {fechaCorta(fechas.cobro)}</>}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-linea text-[13px]">
            {todos.map((m) => (
              <li key={m.concepto} className={`flex items-center justify-between gap-3 py-1.5 ${m.fecha < hoy ? "opacity-50" : ""}`}>
                <span className="min-w-0">
                  <span className="mr-2 tabular-nums text-apagado">{fechaCorta(m.fecha)}</span>
                  {m.concepto.split(" · ").at(-1)}
                  {m.fecha < hoy && <span className="tag ml-2">ya pasó · no se carga</span>}
                </span>
                <span className={`shrink-0 tabular-nums font-semibold ${m.tipo === "cobro" ? "text-verde" : ""} ${m.fecha < hoy ? "line-through" : ""}`}>
                  {m.tipo === "cobro" ? "+" : "−"} {fmtMonto(m.monto, m.moneda)}
                  {m.moneda === "USD" && <span className="ml-1 font-normal text-apagado">(≈ {fmtMonto(m.monto * tc, "ARS")} hoy)</span>}
                </span>
              </li>
            ))}
          </ul>
          {pasados > 0 && (
            <p className="mt-2 rounded-lg bg-[#fdf6ea] px-2.5 py-1.5 text-xs text-[#a5650c]">
              {pasados === 1 ? "Una etapa tiene" : `${pasados} etapas tienen`} fecha pasada: suponemos que ya
              {pasados === 1 ? " se pagó" : " se pagaron"} y {pasados === 1 ? "está reflejada" : "están reflejadas"} en tu caja,
              así que no se carga{pasados === 1 ? "" : "n"}. Si todavía las debés, cargalas a mano en Nuevo movimiento.
            </p>
          )}
          <p className="mt-2 text-[11px] text-apagado">
            Tributos sobre un CIF de {fmtUSD(trib.cif)}: derecho {fmtUSD(trib.derechos)}, tasa de estadística {fmtUSD(trib.estadistica)}, IVA{" "}
            {fmtUSD(trib.iva)} y percepciones de IVA, Ganancias e Ingresos Brutos {fmtUSD(trib.percepciones)}. Las percepciones se recuperan
            después como crédito fiscal, pero salen de la caja al despachar. Son tasas aproximadas: validalas con tu despachante.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn" type="button" onClick={agregar} disabled={guardando}>
          {guardando ? "Agregando…" : "Agregar a mi proyección"}
        </button>
        {aviso && (
          <span role="status" className={`text-[13px] ${aviso.ok ? "text-verde" : "text-rojo"}`}>
            {aviso.texto}
          </span>
        )}
      </div>
    </div>
  );
}
