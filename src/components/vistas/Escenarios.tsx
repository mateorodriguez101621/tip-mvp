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
  max,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  texto: string;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-4 block">
      <span className="flex justify-between text-[13px]">
        <span>{etiqueta}</span>
        <b className="text-violeta">{texto}</b>
      </span>
      <input type="range" min={0} max={max} value={valor} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={texto} />
    </label>
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
    if (!datos) return null;
    const saldos = proyectar(datos.empresa, datos.movimientos, hoy, escenario);
    return { saldos, sim: simular(datos.empresa, datos.movimientos, hoy, escenario) };
  }, [datos, hoy, escenario]);

  if (!datos || !analisis || !resultado) return <Cargando />;
  const { saldos, sim } = resultado;
  const p = sim.probabilidadFaltante;
  const t0 = primerDiaBajo(saldos);
  const color = p > 0.5 ? "text-rojo" : p > 0.2 ? "text-ambar" : "text-verde";
  const cambio = Math.min(...saldos) - Math.min(...analisis.saldos);

  return (
    <section className="grid gap-3.5 lg:grid-cols-[1.6fr_1fr]">
      <div className="tarjeta min-w-0">
        <h2 className="subtitulo">Escenario vs. base</h2>
        <GraficoEscenario hoy={hoy} base={analisis.saldos} escenario={saldos} p10={sim.p10} p90={sim.p90} />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-apagado">
          <span><i className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed border-[#A79EF0] align-middle" />Base</span>
          <span><i className="mr-1 inline-block h-0.5 w-4 bg-violeta-oscuro align-middle" />Escenario</span>
          <span><i className="mr-1 inline-block h-2.5 w-4 rounded-sm bg-violeta/15 align-middle" />80% de las 1.000 simulaciones</span>
        </div>
      </div>

      <div className="tarjeta">
        <h2 className="subtitulo">¿Y si…?</h2>
        <Deslizador etiqueta="El dólar salta hoy" valor={salto} texto={`+${salto}%`} max={50} onChange={setSalto} />
        <Deslizador etiqueta="Los clientes pagan tarde" valor={demora} texto={`${demora} días`} max={60} onChange={setDemora} />
        <Deslizador etiqueta="Cae la cobranza" valor={caida} texto={`−${caida}%`} max={50} onChange={setCaida} />
        <hr className="my-3 border-linea" />
        <div className="text-xs text-apagado">Probabilidad de quedarte sin caja en los próximos 90 días</div>
        <div className={`text-4xl font-bold ${color}`} data-testid="probabilidad">
          {Math.round(p * 100)}%
        </div>
        <p className="mt-1 text-[13px]">
          {t0 >= 0
            ? `En este escenario, el primer faltante aparece ${enDias(t0)}.`
            : "En este escenario no hay faltantes en la proyección central."}
        </p>
        {(salto || demora || caida) > 0 && (
          <p className="mt-1 text-[13px] text-apagado">
            Tu peor saldo {cambio < 0 ? "empeora" : "mejora"} {fmtARS(Math.abs(cambio))} contra la base.
          </p>
        )}
        <p className="mt-3 text-xs text-apagado">
          Calculado con 1.000 simulaciones: el dólar se mueve al azar alrededor de la devaluación esperada, y cada cliente
          se atrasa según su puntualidad histórica.
        </p>
      </div>
    </section>
  );
}
