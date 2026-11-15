"use client";

import { useRef, useState, type FormEvent } from "react";
import { Campo } from "@/components/Campo";
import type { Resultado } from "@/lib/persistencia/tipos";
import type { Empresa } from "@/lib/tesoreria/tipos";
import { DEVALUACION_POR_DEFECTO, validarEmpresa, type Errores } from "@/lib/tesoreria/validacion";

type Valores = Record<keyof Empresa, string>;

const aTexto = (e: Empresa | null): Valores => ({
  nombre: e?.nombre ?? "",
  cajaArs: e ? String(e.cajaArs) : "",
  cajaUsd: e ? String(e.cajaUsd) : "",
  tipoCambio: e ? String(e.tipoCambio) : "",
  devaluacionMensual: e ? String(e.devaluacionMensual) : "",
  saldoMinimo: e ? String(e.saldoMinimo) : "",
});

export function FormularioEmpresa({
  inicial,
  textoBoton = "Guardar supuestos",
  conAjustes = false,
  onGuardar,
}: {
  inicial: Empresa | null;
  textoBoton?: string;
  /** Muestra los ajustes avanzados (suba del dólar). En el alta no se piden: TIP usa su estimación. */
  conAjustes?: boolean;
  onGuardar: (e: Empresa) => Promise<Resultado>;
}) {
  const [v, setV] = useState<Valores>(() => aTexto(inicial));
  const [errores, setErrores] = useState<Errores<Empresa>>({});
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enviando = useRef(false);

  const cambiar = (k: keyof Empresa) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setMensaje(null);
  };

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (enviando.current) return;
    const r = validarEmpresa(v);
    if (!r.ok) {
      setErrores(r.errores);
      setMensaje({ ok: false, texto: "Revisá los campos marcados." });
      return;
    }
    setErrores({});
    enviando.current = true;
    setGuardando(true);
    const res = await onGuardar(r.valor);
    enviando.current = false;
    setGuardando(false);
    if (res.ok) setMensaje({ ok: true, texto: "Guardado." });
    else {
      setErrores((res.errores ?? {}) as Errores<Empresa>);
      setMensaje({ ok: false, texto: res.error });
    }
  }

  const num = { type: "number", inputMode: "decimal" as const, step: "any" };
  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-2.5" aria-label="Empresa y supuestos">
      <Campo id="nombre" etiqueta="Empresa" value={v.nombre} onChange={cambiar("nombre")} error={errores.nombre} autoComplete="organization" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Campo id="cajaArs" etiqueta="Caja hoy en pesos (ARS)" {...num} min={0} value={v.cajaArs} onChange={cambiar("cajaArs")} error={errores.cajaArs} />
        <Campo id="cajaUsd" etiqueta="Caja hoy en dólares (USD)" {...num} min={0} value={v.cajaUsd} onChange={cambiar("cajaUsd")} error={errores.cajaUsd} />
        <Campo id="tipoCambio" etiqueta="Tipo de cambio hoy (ARS por USD)" {...num} min={0} value={v.tipoCambio} onChange={cambiar("tipoCambio")} error={errores.tipoCambio} />
        <Campo
          id="saldoMinimo"
          etiqueta="Saldo mínimo de seguridad (ARS)"
          {...num}
          min={0}
          value={v.saldoMinimo}
          onChange={cambiar("saldoMinimo")}
          error={errores.saldoMinimo}
          ayuda="Por debajo de este saldo te avisamos."
        />
      </div>
      {conAjustes && (
        <details className="rounded-lg border border-linea px-3 py-2" open={!!errores.devaluacionMensual}>
          <summary className="cursor-pointer text-[13px] font-semibold text-violeta-oscuro">Ajustes avanzados</summary>
          <div className="mt-2.5">
            <Campo
              id="devaluacionMensual"
              etiqueta="Suba del dólar por mes (%)"
              {...num}
              value={v.devaluacionMensual}
              onChange={cambiar("devaluacionMensual")}
              error={errores.devaluacionMensual}
              ayuda={`TIP la estima sola (${DEVALUACION_POR_DEFECTO}% por mes). Cambiala solo si querés proyectar con otro supuesto.`}
            />
          </div>
        </details>
      )}
      <div className="flex items-center gap-3">
        <button className="btn" type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : textoBoton}
        </button>
        {mensaje && (
          <span role="status" className={mensaje.ok ? "text-verde" : "text-rojo"}>
            {mensaje.texto}
          </span>
        )}
      </div>
    </form>
  );
}
