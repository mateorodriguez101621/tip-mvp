// Ciclo de importación: una compra al exterior se convierte en los movimientos que dispara,
// cada uno en su fecha. Este módulo no depende de React ni de Supabase.
//
//   pedido ──► embarque ──────► llegada (despacho) ──────► cobro de la venta
//   anticipo   saldo + flete    tributos de importación    cobranza en pesos
//
// Los pagos y tributos quedan en USD: la proyección los pasa a pesos con el tipo de cambio
// proyectado de cada fecha, así un salto del dólar en Escenarios también los mueve.

import { sumarDias } from "./fechas";
import type { Movimiento } from "./tipos";

export interface CompraImportacion {
  proveedor: string;
  /** Qué se importa, para el concepto ("Cámaras IP"). */
  mercaderia: string;
  /** Valor FOB de la mercadería, en USD. */
  fob: number;
  /** % del FOB que se paga como anticipo al hacer el pedido. */
  anticipoPct: number;
  /** aaaa-mm-dd. */
  fechaPedido: string;
  /** Días desde el pedido hasta el embarque (producción). */
  diasProduccion: number;
  /** Días de tránsito del embarque hasta el despacho en Argentina. */
  diasTransito: number;
  /** Flete y seguro internacional, en % del FOB. */
  fletePct: number;
  /** Derecho de importación de la posición arancelaria, en %. */
  derechosPct: number;
  /** Lo que se espera cobrar al vender la mercadería, en ARS. 0 = no se proyecta el cobro. */
  ventaArs: number;
  /** Días desde la llegada hasta cobrar la venta. */
  diasCobro: number;
}

/** Tasas del régimen general que no dependen de la posición arancelaria (aproximadas, en %). */
export const TASAS = {
  estadistica: 3,
  iva: 21,
  percepcionIva: 20,
  percepcionGanancias: 6,
  percepcionIibb: 2.5,
} as const;

export const COMPRA_POR_DEFECTO: Omit<CompraImportacion, "proveedor" | "mercaderia" | "fob" | "fechaPedido" | "ventaArs"> = {
  anticipoPct: 30,
  diasProduccion: 30,
  diasTransito: 45,
  fletePct: 8,
  derechosPct: 16,
  diasCobro: 60,
};

export interface DetalleTributos {
  cif: number;
  derechos: number;
  estadistica: number;
  iva: number;
  percepciones: number;
  total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Tributos que se pagan al despachar, en USD. Base: CIF = FOB + flete y seguro. */
export function tributos(c: Pick<CompraImportacion, "fob" | "fletePct" | "derechosPct">): DetalleTributos {
  const cif = c.fob * (1 + c.fletePct / 100);
  const derechos = (cif * c.derechosPct) / 100;
  const estadistica = (cif * TASAS.estadistica) / 100;
  const baseIva = cif + derechos + estadistica;
  const iva = (baseIva * TASAS.iva) / 100;
  const percepciones = (baseIva * (TASAS.percepcionIva + TASAS.percepcionGanancias + TASAS.percepcionIibb)) / 100;
  return {
    cif: r2(cif),
    derechos: r2(derechos),
    estadistica: r2(estadistica),
    iva: r2(iva),
    percepciones: r2(percepciones),
    total: r2(derechos + estadistica + iva + percepciones),
  };
}

export interface FechasCiclo {
  pedido: string;
  embarque: string;
  llegada: string;
  cobro: string;
}

export function fechasDelCiclo(c: Pick<CompraImportacion, "fechaPedido" | "diasProduccion" | "diasTransito" | "diasCobro">): FechasCiclo {
  const embarque = sumarDias(c.fechaPedido, c.diasProduccion);
  const llegada = sumarDias(embarque, c.diasTransito);
  return { pedido: c.fechaPedido, embarque, llegada, cobro: sumarDias(llegada, c.diasCobro) };
}

type SinId = Omit<Movimiento, "id">;

/** Los movimientos que dispara la compra, en orden de fecha. */
export function movimientosDeCompra(c: CompraImportacion): SinId[] {
  const f = fechasDelCiclo(c);
  const t = tributos(c);
  const nombre = `${c.mercaderia.trim() || "Importación"} · ${c.proveedor.trim() || "proveedor del exterior"}`;
  const anticipo = r2((c.fob * c.anticipoPct) / 100);
  const saldo = r2(c.fob - anticipo);
  const flete = r2((c.fob * c.fletePct) / 100);
  const pago = (concepto: string, monto: number, fecha: string, tipo: "pago" | "impuesto" = "pago"): SinId => ({
    tipo,
    concepto: `${nombre} · ${concepto}`.slice(0, 120),
    monto,
    moneda: "USD",
    fecha,
    puntualidad: null,
  });

  const movs: SinId[] = [];
  if (anticipo > 0) movs.push(pago(`anticipo ${c.anticipoPct}%`, anticipo, f.pedido));
  if (saldo > 0) movs.push(pago("saldo contra embarque", saldo, f.embarque));
  if (flete > 0) movs.push(pago("flete y seguro", flete, f.embarque));
  if (t.total > 0) movs.push(pago("tributos del despacho", t.total, f.llegada, "impuesto"));
  if (c.ventaArs > 0) {
    movs.push({
      tipo: "cobro",
      concepto: `${nombre} · cobro de la venta`.slice(0, 120),
      monto: r2(c.ventaArs),
      moneda: "ARS",
      fecha: f.cobro,
      puntualidad: 80,
    });
  }
  return movs;
}

export type ErroresCompra = Partial<Record<keyof CompraImportacion, string>>;

/** Controles mínimos antes de generar el ciclo. */
export function validarCompra(c: CompraImportacion): ErroresCompra {
  const e: ErroresCompra = {};
  const entre = (k: keyof CompraImportacion, v: number, min: number, max: number, texto: string) => {
    if (!Number.isFinite(v) || v < min || v > max) e[k] = texto;
  };
  if (!c.proveedor.trim()) e.proveedor = "Escribí el proveedor.";
  if (!(c.fob > 0)) e.fob = "Ingresá el valor FOB en USD.";
  entre("anticipoPct", c.anticipoPct, 0, 100, "Va de 0 a 100.");
  entre("diasProduccion", c.diasProduccion, 0, 365, "Entre 0 y 365 días.");
  entre("diasTransito", c.diasTransito, 0, 180, "Entre 0 y 180 días.");
  entre("fletePct", c.fletePct, 0, 100, "Va de 0 a 100.");
  entre("derechosPct", c.derechosPct, 0, 35, "Entre 0 y 35% (el máximo del arancel externo común).");
  entre("ventaArs", c.ventaArs, 0, 1e13, "No puede ser negativo.");
  entre("diasCobro", c.diasCobro, 0, 365, "Entre 0 y 365 días.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.fechaPedido)) e.fechaPedido = "Elegí la fecha del pedido.";
  return e;
}
