import { redirect } from "next/navigation";
import { AltaEmpresa } from "@/components/AltaEmpresa";
import { Marca } from "@/components/Encabezado";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { leerDatos, usuarioActual } from "@/lib/supabase/datos";

export const metadata = { title: "Tu empresa · TIP" };

/** Primer paso después de crear la cuenta: los supuestos de la empresa (una por usuario). */
export default async function Empresa() {
  if (!supabaseConfigurado) redirect("/panel");
  if (!(await usuarioActual())) redirect("/ingresar");
  if (await leerDatos()) redirect("/panel");
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-5">
        <Marca />
      </div>
      <div className="tarjeta p-5">
        <h1 className="titulo mb-1 text-xl">Contanos de tu empresa</h1>
        <p className="mb-4 text-[13px] text-apagado">
          Con esto arranca la proyección. Lo podés cambiar cuando quieras desde Datos.
        </p>
        <AltaEmpresa />
      </div>
    </main>
  );
}
