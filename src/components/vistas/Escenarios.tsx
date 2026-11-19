"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Cargando } from "@/components/Cargando";
import { useDatos } from "@/components/DatosProvider";
import { GraficoEscenario } from "@/components/Graficos";
import { enDias, fmtARS } from "@/lib/tesoreria/formato";
import { primerDiaBajo, proyectar } from "@/lib/tesoreria/proyeccion";
import { simular } from "@/lib/tesoreria/simulacion";

function Deslizador({
  etiqueta,
  valor,
  texto,
  min = 0,
  max,
  extremos,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  texto: string;
  min?: number;
  max: number;
  extremos: [string, string];
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-4 block">
      <span className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium">{etiqueta}</span>
        <b className={`rounded-md px-1.5 tabular-nums ${valor === 0 ? "text-apagado" : "bg-lavanda text-violeta-oscuro"}`}>{texto}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={texto}
      />
      <span className="flex justify-between text-[11px] text-apagado">
        <span>{extremos[0]}</span>
        <span>{extremos[1]}</span>
      </span>
    </label>
  );
}

function Dato({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle: string; tono: string }) {
  return (
    <div className="rounded-xl border border-linea bg-white/70 p-3">
      <div className="text-[11px] font-medium text-apagado">{titulo}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${tono}`}>{valor}</div>
      <div className="text-[11px] text-apagado">{detalle}</div>
    </div>
  );
}

export function VistaEscenarios() {
  const { datos, analisis, hoy } = useDatos();
  const [salto, setSalto] = useState(0);
  const [demora, setDemora] = useState(0);
  const [caida, setCaida] = useState(0);
  // La simulación corre con el último valor estable: el deslizador no se traba mientras se mueve.
  const escenario = useDeferredValue({ saltoDolar: salto / 100, demoraDias: demora, caidaCobranza: caida / 100 });

  const resultado = useMemo(() => {
    if (!datos || !analisis) return null;
    // Los mismos movimientos que la proyección del panel, con las repeticiones estimadas.
    const movs = analisis.movimientosProyectados;
    const saldos = proyectar(datos.empresa, movs, hoy, escenario);
    return { saldos, sim: simular(datos.empresa, movs, hoy, escenario) };
  }, [datos, analisis, hoy, escenario]);

  if (!datos || !analisis || !resultado) return <Cargando />;
  const { saldos, sim } = resultado;
  const p = sim.probabilidadFaltante;
  const t0 = primerDiaBajo(saldos);
  const color = p > 0.5 ? "text-rojo" : p > 0.2 ? "text-ambar" : "text-verde";
  const barra = p > 0.5 ? "bg-rojo" : p > 0.2 ? "bg-ambar" : "bg-verde";
  const cambio = Math.min(...saldos) - Math.min(...analisis.saldos);
  const movido = salto !== 0 || demora > 0 || caida > 0;
  const aCubrir = Math.max(0, -sim.peorSaldo.p10);
  const baseConFaltante = primerDiaBajo(analisis.saldos) >= 0;

  return (
    <section className="grid gap-3.5 lg:grid-cols-[1.6fr_1fr]">
      <div className="tarjeta min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="subtitulo mb-0">Escenario vs. base</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-apagado">
            <span><i className="mr-1 inline-block w-4 border-t-2 border-dashed border-[#A79EF0] align-middle" />Base</span>
            <span><i className="mr-1 inline-block h-[3px] w-4 rounded bg-violeta-oscuro align-middle" />Escenario</span>
            <span><i className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-violeta/15 align-middle" />80% de las simulaciones</span>
          </div>
        </div>
        <GraficoEscenario hoy={hoy} base={analisis.saldos} escenario={saldos} p10={sim.p10} p90={sim.p90} />
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="tarjeta">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="subtitulo mb-0">¿Y si…?</h2>
            {movido && (
              <button
                type="button"
                className="btn btn-texto text-xs"
                onClick={() => {
                  setSalto(0);
                  setDemora(0);
                  setCaida(0);
                }}
              >
                Volver a la base
              </button>
            )}
          </div>
          <Deslizador
            etiqueta="El dólar salta hoy"
            valor={salto}
            texto={`${salto > 0 ? "+" : ""}${salto}%`}
            min={-20}
            max={50}
            extremos={["baja 20%", "sube 50%"]}
            onChange={setSalto}
          />
          <Deslizador
            etiqueta="Los clientes pagan tarde"
            valor={demora}
            texto={`${demora} días`}
            max={60}
            extremos={["a tiempo", "60 días"]}
            onChange={setDemora}
          />
          <Deslizador
            etiqueta="Cae la cobranza"
            valor={caida}
            texto={caida ? `−${caida}%` : "0%"}
            max={50}
            extremos={["sin caída", "−50%"]}
            onChange={setCaida}
          />
        </div>

        <div className="tarjeta">
          <div className="text-xs text-apagado">Probabilidad de quedarte sin caja en los próximos 90 días</div>
          <div className="mt-1 flex items-end gap-3">
            <div className={`text-4xl font-bold tabular-nums ${color}`} data-testid="probabilidad">
              {Math.round(p * 100)}%
            </div>
            <div className="mb-2 h-2 flex-1 overflow-hidden rounded-full bg-lavanda" aria-hidden>
              <div className={`h-full rounded-full transition-[width] ${barra}`} style={{ width: `${Math.round(p * 100)}%` }} />
            </div>
          </div>
          <p className="mt-1.5 text-[13px]">
            {t0 >= 0
              ? `En este escenario, el primer faltante aparece ${enDias(t0)}.`
              : "En este escenario no hay faltantes en la proyección central."}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Dato
              titulo="Plata a cubrir"
              valor={aCubrir > 0 ? fmtARS(aCubrir) : "—"}
              detalle={aCubrir > 0 ? "en 9 de cada 10 casos alcanza" : "no hace falta"}
              tono={aCubrir > 0 ? "text-rojo" : "text-verde"}
            />
            <Dato
              titulo="Días sin caja"
              valor={String(sim.diasEnRojo)}
              detalle="en un caso típico"
              tono={sim.diasEnRojo > 0 ? "text-rojo" : "text-verde"}
            />
          </div>

          {movido && (
            <p className="mt-3 text-[13px] text-apagado">
              Tu peor saldo {cambio < 0 ? "empeora" : "mejora"} <b className={cambio < 0 ? "text-rojo" : "text-verde"}>{fmtARS(Math.abs(cambio))}</b> contra la base.
            </p>
          )}
          {baseConFaltante && p >= 0.99 && (
            <p className="mt-2 rounded-lg bg-lavanda/70 px-2.5 py-1.5 text-xs text-violeta-oscuro">
              Tu proyección base ya tiene un faltante, por eso la probabilidad queda en 100%. Mirá cómo cambia la plata a
              cubrir y los días sin caja.
            </p>
          )}
          <p className="mt-3 text-xs text-apagado">
            Calculado con 1.000 simulaciones: el dólar se mueve al azar alrededor de la devaluación esperada, y cada cliente
            se atrasa según su puntualidad histórica.
          </p>
        </div>
      </div>
    </section>
  );
}
