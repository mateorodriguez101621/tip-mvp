import { textoRecomendacion, tituloAlerta, type Alerta } from "@/lib/tesoreria/alertas";

const ESTILO: Record<Alerta["tipo"], { clase: string; tag: string; tagClase: string }> = {
  faltante: { clase: "alerta", tag: "Faltante", tagClase: "tag tag-rojo" },
  "sin-faltante": { clase: "alerta alerta-ok", tag: "Sin faltantes", tagClase: "tag tag-verde" },
  "bajo-minimo": { clase: "alerta alerta-info", tag: "Atención", tagClase: "tag tag-ambar" },
  excedente: { clase: "alerta alerta-info", tag: "Excedente", tagClase: "tag tag-verde" },
};

export function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  return (
    <div className="flex flex-col gap-2.5" aria-live="polite">
      {alertas.map((a, i) => {
        const e = ESTILO[a.tipo];
        const recs = "recomendaciones" in a ? a.recomendaciones : [];
        return (
          <article key={i} className={e.clase} data-alerta={a.tipo}>
            <span className={e.tagClase}>{e.tag}</span>
            <p className="mt-1.5 font-semibold">{tituloAlerta(a)}</p>
            {a.tipo === "bajo-minimo" && (
              <p className="mt-1.5 text-[13px]">Revisá si conviene renegociar algún vencimiento antes de esa fecha.</p>
            )}
            {recs.length > 0 && (
              <div className="mt-2 text-[13px]">
                <b>Qué te recomendamos:</b>
                <ol className="mt-1 flex flex-col gap-1.5">
                  {recs.map((r, j) => {
                    const t = textoRecomendacion(r);
                    return (
                      <li key={j} className="rounded-lg bg-lavanda/60 px-2.5 py-1.5">
                        <span>{t.accion}</span>
                        <span className="mt-0.5 block text-apagado">
                          <b className="font-semibold text-violeta-oscuro">Por qué: </b>
                          {t.porque}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
