"use client";

import { useRef, useState, type FormEvent } from "react";
import { Campo, Selector } from "@/components/Campo";
import type { Resultado } from "@/lib/persistencia/tipos";
import { sumarDias } from "@/lib/tesoreria/fechas";
import { nuevoId } from "@/lib/tesoreria/id";
import type { Movimiento } from "@/lib/tesoreria/tipos";
import { validarMovimiento, type Errores } from "@/lib/tesoreria/validacion";

type Valores = Record<keyof Movimiento, string>;

const vacio = (hoy: string): Valores => ({
  id: nuevoId(),
  tipo: "cobro",
  concepto: "",
  monto: "",
  moneda: "ARS",
  fecha: sumarDias(hoy, 7),
  puntualidad: "",
});

const aTexto = (m: Movimiento): Valores => ({
  ...m,
  monto: String(m.monto),
  puntualidad: m.puntualidad === null ? "" : String(m.puntualidad),
});

/**
 * Alta o edición de un movimiento. El id se genera al abrir el formulario y la
 * base hace upsert por id: un doble clic no puede crear dos movimientos.
 */
export function FormularioMovimiento({
  hoy,
  editando,
  onGuardar,
  onCerrar,
}: {
  hoy: string;
  editando: Movimiento | null;
  onGuardar: (m: Movimiento) => Promise<Resultado>;
  onCerrar?: () => void;
}) {
  const [v, setV] = useState<Valores>(() => (editando ? aTexto(editando) : vacio(hoy)));
  const [errores, setErrores] = useState<Errores<Movimiento>>({});
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enviando = useRef(false);

  const cambiar = (k: keyof Movimiento) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setErrores((x) => ({ ...x, [k]: undefined }));
    setMensaje(null);
  };

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (enviando.current) return;
    const r = validarMovimiento(v);
    if (!r.ok) {
      setErrores(r.errores);
      setMensaje({ ok: false, texto: "Revisá los campos marcados." });
      return;
    }
    enviando.current = true;
    setGuardando(true);
    const res = await onGuardar(r.valor);
    enviando.current = false;
    setGuardando(false);
    if (!res.ok) {
      setErrores((res.errores ?? {}) as Errores<Movimiento>);
      setMensaje({ ok: false, texto: res.error });
      return;
    }
    if (editando) onCerrar?.();
    else {
      setV({ ...vacio(hoy), tipo: v.tipo, moneda: v.moneda, fecha: v.fecha });
      setMensaje({ ok: true, texto: `Guardamos "${r.valor.concepto}".` });
    }
  }

  const esCobro = v.tipo === "cobro";
  return (
    <form onSubmit={enviar} noValidate aria-label={editando ? "Editar movimiento" : "Nuevo movimiento"}>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-6">
        <Selector etiqueta="Tipo" value={v.tipo} onChange={cambiar("tipo")} error={errores.tipo}>
          <option value="cobro">Cobro</option>
          <option value="pago">Pago</option>
          <option value="impuesto">Impuesto</option>
        </Selector>
        <div className="col-span-2 md:col-span-2 md:order-none">
          <Campo
            id="concepto"
            etiqueta={esCobro ? "Cliente / concepto" : v.tipo === "pago" ? "Proveedor / concepto" : "Impuesto"}
            value={v.concepto}
            onChange={cambiar("concepto")}
            error={errores.concepto}
            placeholder={esCobro ? "Cliente Alarmas Norte" : v.tipo === "pago" ? "Proveedor Shenzhen" : "IVA"}
          />
        </div>
        <Campo id="monto" etiqueta="Monto" type="number" inputMode="decimal" step="any" min={0} value={v.monto} onChange={cambiar("monto")} error={errores.monto} />
        <Selector etiqueta="Moneda" value={v.moneda} onChange={cambiar("moneda")} error={errores.moneda}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </Selector>
        <Campo id="fecha" etiqueta="Fecha" type="date" value={v.fecha} onChange={cambiar("fecha")} error={errores.fecha} />
        {esCobro && (
          <div className="col-span-2 md:col-span-2">
            <Campo
              id="puntualidad"
              etiqueta="Puntualidad del cliente (%)"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={v.puntualidad}
              onChange={cambiar("puntualidad")}
              error={errores.puntualidad}
              ayuda="% de veces que pagó a tiempo. Si no lo sabés, dejalo vacío."
            />
          </div>
        )}
      </div>
      {v.fecha && v.fecha < hoy && !errores.fecha && (
        <p className="mt-2 text-xs text-[#a5650c]">Esta fecha ya pasó: lo vamos a tomar como vencido y proyectarlo para hoy.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn" type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar movimiento"}
        </button>
        {onCerrar && (
          <button className="btn btn-sec" type="button" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
        )}
        {mensaje && (
          <span role="status" className={mensaje.ok ? "text-verde" : "text-rojo"}>
            {mensaje.texto}
          </span>
        )}
      </div>
    </form>
  );
}
