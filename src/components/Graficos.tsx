"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { fechaCorta, sumarDias } from "@/lib/tesoreria/fechas";
import { fmtARS, fmtMillones } from "@/lib/tesoreria/formato";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const VIOLETA = "#5449DD";
const APAGADO = "#7A7398";

const etiquetas = (hoy: string, n: number) => Array.from({ length: n }, (_, t) => fechaCorta(sumarDias(hoy, t)));

function opciones(filtrarTooltip?: (i: number) => boolean): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: filtrarTooltip ? (i) => filtrarTooltip(i.datasetIndex) : undefined,
        callbacks: { label: (c) => `${c.dataset.label}: ${fmtARS(c.parsed.y ?? 0)}` },
      },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 8, color: APAGADO, maxRotation: 0 }, grid: { display: false } },
      y: { ticks: { color: APAGADO, callback: (v) => fmtMillones(Number(v)), maxTicksLimit: 6 }, grid: { color: "#ECE8F6" } },
    },
  };
}

/** Saldo proyectado; la zona por debajo de cero se pinta de rojo. */
export function GraficoProyeccion({ hoy, saldos }: { hoy: string; saldos: number[] }) {
  return (
    <div className="relative h-64 sm:h-80" role="img" aria-label="Gráfico del saldo proyectado a 90 días">
      <Line
        data={{
          labels: etiquetas(hoy, saldos.length),
          datasets: [
            {
              label: "Saldo proyectado",
              data: saldos,
              borderColor: VIOLETA,
              fill: { target: { value: 0 }, above: "rgba(84,73,221,.10)", below: "rgba(214,69,69,.25)" },
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 2.5,
            },
          ],
        }}
        options={opciones()}
      />
    </div>
  );
}

/** Escenario contra la base, con la banda p10–p90 de la simulación. */
export function GraficoEscenario({
  hoy,
  base,
  escenario,
  p10,
  p90,
}: {
  hoy: string;
  base: number[];
  escenario: number[];
  p10: number[];
  p90: number[];
}) {
  return (
    <div className="relative h-64 sm:h-80" role="img" aria-label="Gráfico del escenario contra la proyección base">
      <Line
        data={{
          labels: etiquetas(hoy, base.length),
          datasets: [
            { label: "Simulaciones (90%)", data: p90, borderWidth: 0, pointRadius: 0, backgroundColor: "rgba(84,73,221,.13)", fill: "+1" },
            { label: "Simulaciones (10%)", data: p10, borderWidth: 0, pointRadius: 0 },
            { label: "Base", data: base, borderColor: "#A79EF0", borderDash: [5, 4], pointRadius: 0, borderWidth: 2 },
            {
              label: "Escenario",
              data: escenario,
              borderColor: "#3B2FC9",
              pointRadius: 0,
              borderWidth: 2.5,
              fill: { target: { value: 0 }, above: "rgba(0,0,0,0)", below: "rgba(214,69,69,.22)" },
            },
          ],
        }}
        options={opciones((i) => i > 1)}
      />
    </div>
  );
}
