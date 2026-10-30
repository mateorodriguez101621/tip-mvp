import { redirect } from "next/navigation";
import { Marca } from "@/components/Encabezado";
import { FormularioIngreso } from "@/components/FormularioIngreso";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { usuarioActual } from "@/lib/supabase/datos";

export const metadata = { title: "Ingresar · TIP" };

export default async function Ingresar() {
  if (!supabaseConfigurado || (await usuarioActual())) redirect("/panel");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center">
        <Marca />
      </div>
      <div className="tarjeta p-6">
        <h1 className="titulo mb-1 text-xl">Tu tesorería, semanas antes</h1>
        <p className="mb-5 text-[13px] text-apagado">
          TIP proyecta tu caja de forma continua y te avisa con semanas de anticipación si te va a faltar o sobrar plata,
          con recomendaciones concretas. Además, probá escenarios y mirá la probabilidad de quedarte sin caja.
        </p>
        <FormularioIngreso />
      </div>
    </main>
  );
}
