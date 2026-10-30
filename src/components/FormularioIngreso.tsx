"use client";

import { useActionState, useState } from "react";
import { ingresar, type EstadoIngreso } from "@/app/acciones";

export function FormularioIngreso() {
  const [modo, setModo] = useState<"ingreso" | "registro">("ingreso");
  const [estado, accion, pendiente] = useActionState<EstadoIngreso, FormData>(ingresar, {});

  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 rounded-full bg-lavanda p-1" role="tablist">
        {(["ingreso", "registro"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => setModo(m)}
            className={`rounded-full py-1.5 font-semibold transition-colors ${modo === m ? "bg-violeta text-white" : "text-apagado"}`}
          >
            {m === "ingreso" ? "Ingresar" : "Crear cuenta"}
          </button>
        ))}
      </div>
      <input type="hidden" name="modo" value={modo} />
      <label className="etiqueta">
        Email
        <input className="campo" name="email" type="email" autoComplete="email" required defaultValue={estado.email} />
      </label>
      <label className="etiqueta">
        Contraseña
        <input
          className="campo"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={modo === "ingreso" ? "current-password" : "new-password"}
        />
        {modo === "registro" && <span className="mt-0.5 block text-[11px]">Mínimo 6 caracteres.</span>}
      </label>
      {estado.error && <p role="alert" className="text-[13px] text-rojo">{estado.error}</p>}
      {estado.aviso && <p role="status" className="text-[13px] text-verde">{estado.aviso}</p>}
      <button className="btn mt-1 py-2.5" type="submit" disabled={pendiente}>
        {pendiente ? "Un momento…" : modo === "ingreso" ? "Ingresar" : "Crear cuenta"}
      </button>
    </form>
  );
}
