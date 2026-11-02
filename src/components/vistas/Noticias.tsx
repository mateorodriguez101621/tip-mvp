"use client";

import { useState, type ReactNode } from "react";
import { useDatos } from "@/components/DatosProvider";
import { CATEGORIAS, ORDEN, VENTANA_HORAS } from "@/lib/noticias/clasificacion";
import { diferencia } from "@/lib/noticias/indicadores";
import type { Categoria, ContextoDelDia, Indicadores, NoticiaClasificada } from "@/lib/noticias/tipos";
import { fechaCorta } from "@/lib/tesoreria/fechas";
import { fmtARS, fmtUSD } from "@/lib/tesoreria/formato";

/** Por debajo de esta diferencia con el mayorista, el tipo de cambio de la empresa se considera al día. */
const UMBRAL_TIPO_CAMBIO = 0.01;
const SUBA_DOLAR = 0.1;

const fmtPct = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

const nombreMes = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" });
function mesEnLetras(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return nombreMes.format(Date.UTC(a, m - 1, 15));
}

/** "hace 3 h", contado desde que se armó la página para que servidor y navegador muestren lo mismo. */
function hace(fecha: string, generado: string): string {
  const min = Math.max(0, Math.round((Date.parse(generado) - Date.parse(fecha)) / 60_000));
  if (min < 2) return "recién";
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

function Indicador({ valor, etiqueta, detalle }: { valor: string; etiqueta: string; detalle?: string | null }) {
  return (
    <div className="tarjeta">
      <div className="text-lg font-bold tabular-nums text-violeta sm:text-2xl">{valor}</div>
      <div className="text-xs text-apagado">{etiqueta}</div>
      {detalle && <div className="mt-0.5 text-xs text-apagado">{detalle}</div>}
    </div>
  );
}

function ListaIndicadores({ indicadores: { dolar, riesgoPais, inflacion, plazoFijo } }: { indicadores: Indicadores }) {
  const tarjetas: ReactNode[] = [];
  if (dolar?.mayorista)
    tarjetas.push(<Indicador key="may" valor={fmtARS(dolar.mayorista)} etiqueta="Dólar mayorista" detalle="El que pagan las importaciones" />);
  if (dolar?.mep)
    tarjetas.push(
      <Indicador
        key="mep"
        valor={fmtARS(dolar.mep)}
        etiqueta="Dólar MEP"
        detalle={dolar.mayorista ? `Brecha de ${fmtPct(diferencia(dolar.mep, dolar.mayorista) * 100)} con el mayorista` : null}
      />,
    );
  if (riesgoPais)
    tarjetas.push(
      <Indicador
        key="riesgo"
        valor={`${riesgoPais.valor.toLocaleString("es-AR")} pb`}
        etiqueta="Riesgo país"
        detalle={`Cierre del ${fechaCorta(riesgoPais.fecha)}`}
      />,
    );
  if (inflacion)
    tarjetas.push(
      <Indicador
        key="ipc"
        valor={fmtPct(inflacion.mensual)}
        etiqueta={`Inflación de ${mesEnLetras(inflacion.mes)}`}
        detalle={inflacion.interanual === null ? null : `${fmtPct(inflacion.interanual)} en 12 meses`}
      />,
    );
  if (plazoFijo)
    tarjetas.push(
      <Indicador key="pf" valor={`${fmtPct(plazoFijo.tna)} TNA`} etiqueta="Mejor plazo fijo a 30 días" detalle={plazoFijo.banco} />,
    );

  if (tarjetas.length === 0)
    return <p className="tarjeta text-apagado">No pudimos traer los indicadores en este momento. Probá de nuevo en unos minutos.</p>;
  return <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">{tarjetas}</div>;
}

/** Cruza los indicadores del día con la proyección de la empresa. */
function ParaTuEmpresa({ indicadores }: { indicadores: Indicadores }) {
  const { datos, analisis, guardarEmpresa } = useDatos();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!datos || !analisis) return null;

  const { empresa } = datos;
  const mayorista = indicadores.dolar?.mayorista ?? null;
  const items: ReactNode[] = [];

  async function usarMayorista(valor: number) {
    setGuardando(true);
    setError(null);
    const r = await guardarEmpresa({ ...empresa, tipoCambio: Math.round(valor * 100) / 100 });
    setGuardando(false);
    if (!r.ok) setError(r.error);
  }

  if (mayorista) {
    const dif = diferencia(mayorista, empresa.tipoCambio);
    items.push(
      Math.abs(dif) < UMBRAL_TIPO_CAMBIO ? (
        <li key="tc">Tu proyección usa el tipo de cambio del día ({fmtARS(mayorista)}).</li>
      ) : (
        <li key="tc" data-testid="tc-desactualizado">
          Tu proyección usa {fmtARS(empresa.tipoCambio)} por dólar y el mayorista hoy está en <b>{fmtARS(mayorista)}</b> (
          {fmtPct(Math.abs(dif) * 100)} {dif > 0 ? "más alto" : "más bajo"}).
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-sec px-3 py-1.5 text-xs" disabled={guardando} onClick={() => usarMayorista(mayorista)}>
              {guardando ? "Guardando…" : `Usar ${fmtARS(mayorista)} en mi proyección`}
            </button>
            {error && <span className="error-campo mt-0">{error}</span>}
          </span>
        </li>
      ),
    );
  }

  const pagosUsd = analisis.kpis.pagosUsdComprometidos;
  if (pagosUsd > 0)
    items.push(
      <li key="usd">
        Tenés {fmtUSD(pagosUsd)} en pagos en dólares: si el dólar sube {SUBA_DOLAR * 100}%, vas a necesitar{" "}
        <b>{fmtARS(pagosUsd * (mayorista ?? empresa.tipoCambio) * SUBA_DOLAR)}</b> más para cubrirlos.
      </li>,
    );

  const excedente = analisis.alertas.find((a) => a.tipo === "excedente");
  if (excedente?.tipo === "excedente" && indicadores.plazoFijo)
    items.push(
      <li key="pf">
        Tenés un excedente de {fmtARS(excedente.montoArs)}: hoy el mejor plazo fijo a 30 días paga{" "}
        <b>{fmtPct(indicadores.plazoFijo.tna)} TNA</b> ({indicadores.plazoFijo.banco}).
      </li>,
    );

  const faltante = analisis.alertas.find((a) => a.tipo === "faltante");
  if (faltante)
    items.push(
      <li key="faltante">
        Tenés un faltante proyectado: mirá las noticias de <b>{CATEGORIAS.tasas.nombre}</b> antes de pedir un crédito.
      </li>,
    );

  if (items.length === 0) return null;
  return (
    <div className="tarjeta mt-3.5" data-testid="para-tu-empresa">
      <h2 className="subtitulo">Qué significa para {empresa.nombre}</h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px]">{items}</ul>
    </div>
  );
}

function Nota({ n, generado }: { n: NoticiaClasificada; generado: string }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-apagado">
        <span className="tag">{CATEGORIAS[n.categoria].nombre}</span>
        <span>
          {n.fuente} · {hace(n.fecha, generado)}
        </span>
      </div>
      <a
        href={n.enlace}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block font-semibold leading-snug hover:text-violeta hover:underline"
      >
        {n.titulo}
      </a>
      {n.resumen && <p className="mt-0.5 line-clamp-2 text-[13px] text-apagado">{n.resumen}</p>}
      {n.tambienEn.length > 0 && <p className="mt-0.5 text-xs text-apagado">También en {n.tambienEn.join(", ")}</p>}
    </li>
  );
}

function ListaNoticias({ noticias, generado }: { noticias: NoticiaClasificada[]; generado: string }) {
  const [filtro, setFiltro] = useState<Categoria | "todas">("todas");
  const visibles = filtro === "todas" ? noticias : noticias.filter((n) => n.categoria === filtro);
  const chips = [
    { id: "todas" as const, nombre: "Todas", cantidad: noticias.length },
    ...ORDEN.map((c) => ({ id: c, nombre: CATEGORIAS[c].nombre, cantidad: noticias.filter((n) => n.categoria === c).length })),
  ].filter((c) => c.cantidad > 0);

  return (
    <div className="tarjeta mt-3.5">
      <h2 className="subtitulo">Noticias de las últimas {VENTANA_HORAS} horas</h2>
      {noticias.length === 0 ? (
        <p className="text-apagado" data-testid="sin-noticias">
          No encontramos noticias sobre importaciones, dólar, impuestos o tasas en las últimas {VENTANA_HORAS} horas.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tema">
            {chips.map((c) => {
              const activo = filtro === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setFiltro(c.id)}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    activo ? "bg-violeta text-white" : "bg-lavanda text-violeta-oscuro hover:bg-linea"
                  }`}
                >
                  {c.nombre} <span className="font-normal opacity-75">{c.cantidad}</span>
                </button>
              );
            })}
          </div>
          {filtro !== "todas" && (
            <p className="mt-2.5 rounded-lg bg-lavanda/60 px-2.5 py-1.5 text-[13px]">
              <b className="font-semibold text-violeta-oscuro">Por qué mirarlo: </b>
              {CATEGORIAS[filtro].porque}
            </p>
          )}
          <ul className="mt-1 divide-y divide-linea" data-testid="noticias">
            {visibles.map((n) => (
              <Nota key={n.enlace} n={n} generado={generado} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function VistaNoticias({ noticias, indicadores, sinRespuesta, generado }: ContextoDelDia) {
  return (
    <section>
      <h1 className="titulo text-xl">Noticias del día</h1>
      <p className="mb-3 text-apagado">Lo que pasa con el dólar, las importaciones, los impuestos y las tasas, y qué significa para tu caja.</p>

      <ListaIndicadores indicadores={indicadores} />
      <ParaTuEmpresa indicadores={indicadores} />
      <ListaNoticias noticias={noticias} generado={generado} />

      <p className="mt-3 text-xs text-apagado">
        Titulares de Ámbito, Infobae, La Nación, iProfesional y Clarín, filtrados por tema; cada nota se abre en el sitio del
        medio. Cotizaciones de DolarApi; riesgo país, inflación y tasas de ArgentinaDatos. Se actualiza cada 30 minutos.
        {sinRespuesta.length > 0 && ` Ahora no pudimos leer: ${sinRespuesta.join(", ")}.`}
      </p>
    </section>
  );
}
