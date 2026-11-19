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
  type Plugin,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { fechaCorta, sumarDias } from "@/lib/tesoreria/fechas";
import { fmtARS, fmtMillones } from "@/lib/tesoreria/formato";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const VIOLETA = "#5449DD";
const APAGADO = "#7A7398";
const AMBAR = "#D98B1F";
const ROJO = "#D64545";

const etiquetas = (hoy: string, n: number) => Array.from({ length: n }, (_, t) => fechaCorta(sumarDias(hoy, t)));

function tituloDia(hoy: string, t: number): string {
  const f = fechaCorta(sumarDias(hoy, t));
  if (t === 0) return `Hoy · ${f}`;
  if (t === 1) return `Mañana · ${f}`;
  return `En ${t} días · ${f}`;
}

/**
 * Sombrea el tramo después del último movimiento: ahí el saldo no cambia porque no hay nada
 * cargado, y sin esta marca parece que la proyección "se trabó".
 */
function sinMovimientosDesde(dia: number | undefined): Plugin<"line"> {
  return {
    id: "sinMovimientos",
    beforeDatasetsDraw(chart) {
      const total = chart.data.labels?.length ?? 0;
      if (dia === undefined || dia < 0 || dia >= total - 4) return;
      const { ctx, chartArea: a, scales } = chart;
      const x = Math.max(a.left, scales.x.getPixelForValue(dia));
      ctx.save();
      ctx.fillStyle = "rgba(111,104,144,.07)";
      ctx.fillRect(x, a.top, a.right - x, a.bottom - a.top);
      ctx.strokeStyle = "rgba(111,104,144,.45)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, a.top);
      ctx.lineTo(x, a.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#6F6890";
      ctx.font = "500 11px var(--font-poppins), system-ui, sans-serif";
      ctx.textAlign = "right";
      const texto = a.right - x > 150 ? "Sin movimientos cargados" : "Sin movimientos";
      ctx.fillText(texto, a.right - 6, a.top + 14);
      ctx.restore();
    },
  };
}

function opciones(hoy: string, filtrarTooltip?: (i: number) => boolean): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    layout: { padding: { top: 6, right: 4 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#2B2470",
        titleColor: "#fff",
        bodyColor: "#E9E6FA",
        padding: 10,
        cornerRadius: 10,
        boxPadding: 4,
        usePointStyle: true,
        filter: filtrarTooltip ? (i) => filtrarTooltip(i.datasetIndex) : undefined,
        callbacks: {
          title: (items) => tituloDia(hoy, items[0]?.dataIndex ?? 0),
          label: (c) => ` ${c.dataset.label}: ${fmtARS(c.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 7, color: APAGADO, maxRotation: 0, font: { size: 11 } },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        // Siempre se ve el cero: si no, un saldo todo negativo parece una montaña rusa.
        beginAtZero: true,
        ticks: { color: APAGADO, callback: (v) => fmtMillones(Number(v)), maxTicksLimit: 6, font: { size: 11 } },
        // La línea del cero, más marcada que el resto de la grilla.
        grid: { color: (c) => (c.tick?.value === 0 ? "rgba(43,36,112,.35)" : "#EFECF8"), lineWidth: (c) => (c.tick?.value === 0 ? 1.5 : 1) },
        border: { display: false },
      },
    },
  };
}

/** Saldo proyectado; la zona por debajo de cero se pinta de rojo y se marca el peor día. */
export function GraficoProyeccion({
  hoy,
  saldos,
  saldoMinimo,
  ultimoDia,
}: {
  hoy: string;
  saldos: number[];
  saldoMinimo?: number;
  ultimoDia?: number;
}) {
  const peor = saldos.indexOf(Math.min(...saldos));
  const radios = saldos.map((_, t) => (t === peor ? 5 : 0));
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
              backgroundColor: VIOLETA,
              fill: { target: { value: 0 }, above: "rgba(84,73,221,.10)", below: "rgba(214,69,69,.22)" },
              cubicInterpolationMode: "monotone",
              pointRadius: radios,
              pointHoverRadius: 5,
              pointBackgroundColor: saldos[peor] < 0 ? ROJO : VIOLETA,
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              borderWidth: 2.5,
              segment: { borderColor: (c) => ((c.p1.parsed.y ?? 0) < 0 ? ROJO : VIOLETA) },
            },
            ...(saldoMinimo && saldoMinimo > 0
              ? [
                  {
                    label: "Mínimo de seguridad",
                    data: saldos.map(() => saldoMinimo),
                    borderColor: AMBAR,
                    backgroundColor: AMBAR,
                    borderDash: [6, 5],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                  },
                ]
              : []),
          ],
        }}
        options={opciones(hoy)}
        plugins={[sinMovimientosDesde(ultimoDia)]}
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
  ultimoDia,
}: {
  hoy: string;
  base: number[];
  escenario: number[];
  p10: number[];
  p90: number[];
  ultimoDia?: number;
}) {
  return (
    <div className="relative h-64 sm:h-80 lg:h-[26rem]" role="img" aria-label="Gráfico del escenario contra la proyección base">
      <Line
        data={{
          labels: etiquetas(hoy, base.length),
          datasets: [
            { order: 3, label: "Simulaciones (90%)", data: p90, borderWidth: 0, pointRadius: 0, backgroundColor: "rgba(84,73,221,.12)", fill: "+1", cubicInterpolationMode: "monotone" },
            { order: 3, label: "Simulaciones (10%)", data: p10, borderWidth: 0, pointRadius: 0, cubicInterpolationMode: "monotone" },
            { order: 1, label: "Base", data: base, borderColor: "#A79EF0", backgroundColor: "#A79EF0", borderDash: [5, 4], pointRadius: 0, borderWidth: 2, cubicInterpolationMode: "monotone" },
            {
              order: 0,
              label: "Escenario",
              data: escenario,
              borderColor: "#3B2FC9",
              backgroundColor: "#3B2FC9",
              pointRadius: 0,
              pointHoverRadius: 5,
              borderWidth: 2.5,
              cubicInterpolationMode: "monotone",
              segment: { borderColor: (c) => ((c.p1.parsed.y ?? 0) < 0 ? ROJO : "#3B2FC9") },
              fill: { target: { value: 0 }, above: "rgba(0,0,0,0)", below: "rgba(214,69,69,.2)" },
            },
          ],
        }}
        options={opciones(hoy, (i) => i > 1)}
        plugins={[sinMovimientosDesde(ultimoDia)]}
      />
    </div>
  );
}
