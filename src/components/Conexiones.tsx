"use client";

import { useEffect, useState } from "react";
import { useDatos } from "@/components/DatosProvider";
import { CONECTORES, movimientosNuevos, SISTEMAS, type IdConector, type SistemaGestion } from "@/lib/tesoreria/conectores";

const CLAVE = "tip-conexiones-v1";

interface Estado {
  conectado: boolean;
  /** ISO 8601 de la última sincronización. */
  ultima: string | null;
  traidos: number;
}
type Estados = Partial<Record<IdConector, Estado>>;

function leer(): { estados: Estados; sistema: SistemaGestion } {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (g && typeof g === "object") return { estados: g.estados ?? {}, sistema: SISTEMAS.includes(g.sistema) ? g.sistema : "Tango" };
  } catch {}
  return { estados: {}, sistema: "Tango" };
}

function escribir(estados: Estados, sistema: SistemaGestion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ estados, sistema }));
  } catch {}
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

const INICIALES: Record<IdConector, string> = { gestion: "G", arca: "A", banco: "B" };

/** Conecta las fuentes y registra los movimientos solos, sin carga manual. */
export function Conexiones() {
  const { datos, hoy, importarMovimientos } = useDatos();
  const [estados, setEstados] = useState<Estados>({});
  const [sistema, setSistema] = useState<SistemaGestion>("Tango");
  const [trabajando, setTrabajando] = useState<IdConector | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    // localStorage solo existe en el navegador: se lee después del primer render.
    const g = leer();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstados(g.estados);
    setSistema(g.sistema);
  }, []);

  if (!datos) return null;

  async function sincronizar(id: IdConector) {
    if (trabajando || !datos) return;
    setTrabajando(id);
    setAviso(null);
    // Pausa breve para que se vea que la fuente responde; en la v1 es la llamada a la API real.
    await new Promise((r) => setTimeout(r, 900));
    const nuevos = movimientosNuevos(id, hoy, datos.movimientos, sistema);
    const r = nuevos.length ? await importarMovimientos(nuevos, false) : ({ ok: true } as const);
    setTrabajando(null);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.error });
      return;
    }
    const nombre = id === "gestion" ? sistema : CONECTORES.find((c) => c.id === id)!.nombre;
    const previo = estados[id];
    const siguiente: Estados = {
      ...estados,
      [id]: { conectado: true, ultima: new Date().toISOString(), traidos: (previo?.traidos ?? 0) + nuevos.length },
    };
    setEstados(siguiente);
    escribir(siguiente, sistema);
    setAviso({
      ok: true,
      texto: nuevos.length
        ? `${nombre}: se registraron ${nuevos.length} movimientos nuevos. La proyección ya los incluye.`
        : `${nombre}: está todo al día, no hay movimientos nuevos.`,
    });
  }

  function cambiarSistema(s: SistemaGestion) {
    setSistema(s);
    escribir(estados, s);
  }

  const conectados = CONECTORES.filter((c) => estados[c.id]?.conectado).length;

  return (
    <div className="tarjeta" data-testid="conexiones">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="subtitulo mb-0">Registro automático</h2>
        <span className="text-xs text-apagado">
          {conectados} de {CONECTORES.length} fuentes conectadas
        </span>
      </div>
      <p className="mt-1 mb-3 text-[13px] text-apagado">
        Conectá tus fuentes y TIP registra solo los cobros, pagos e impuestos. Cada vez que sincronizás, trae lo nuevo y no
        repite lo que ya está cargado.
      </p>

      <div className="grid gap-2.5 md:grid-cols-3">
        {CONECTORES.map((c) => {
          const e = estados[c.id];
          const ocupado = trabajando === c.id;
          return (
            <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-linea bg-white/70 p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violeta font-bold text-white">{INICIALES[c.id]}</span>
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{c.id === "gestion" ? `${c.nombre} · ${sistema}` : c.nombre}</div>
                  <div className="text-xs text-apagado">{c.descripcion}</div>
                </div>
              </div>
              {c.id === "gestion" && (
                <div className="flex gap-1" role="group" aria-label="Sistema de gestión">
                  {SISTEMAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={sistema === s}
                      onClick={() => cambiarSistema(s)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sistema === s ? "bg-violeta text-white" : "bg-lavanda text-violeta-oscuro"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs">{c.trae}</p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                {e?.conectado ? (
                  <span className="tag tag-verde" data-testid={`conectado-${c.id}`}>
                    Conectado{e.ultima ? ` · ${hora(e.ultima)}` : ""}
                  </span>
                ) : (
                  <span className="text-xs text-apagado">Sin conectar</span>
                )}
                <button
                  type="button"
                  className={e?.conectado ? "btn btn-sec px-3 py-1.5 text-xs" : "btn px-3 py-1.5 text-xs"}
                  disabled={!!trabajando}
                  onClick={() => sincronizar(c.id)}
                >
                  {ocupado ? "Sincronizando…" : e?.conectado ? "Sincronizar" : "Conectar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {aviso && (
        <p role="status" className={`mt-2.5 text-[13px] ${aviso.ok ? "text-verde" : "text-rojo"}`}>
          {aviso.texto}
        </p>
      )}
      <p className="mt-2 text-[11px] text-apagado">
        En el MVP las fuentes están simuladas con comprobantes de ejemplo. En la versión 1 se conectan a las APIs de Tango, Xubio,
        Colppy, ARCA y los bancos.
      </p>
    </div>
  );
}
