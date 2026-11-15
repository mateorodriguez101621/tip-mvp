import { Suspense } from "react";
import { Cargando } from "@/components/Cargando";
import { VistaNoticias } from "@/components/vistas/Noticias";
import { obtenerContextoDelDia } from "@/lib/noticias/obtener";
import { esRubro, type IdRubro } from "@/lib/noticias/rubros";

export const metadata = { title: "Noticias · TIP" };

async function Contenido({ rubro }: { rubro: IdRubro | null }) {
  return <VistaNoticias {...await obtenerContextoDelDia(rubro)} />;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ rubro?: string | string[] }> }) {
  const { rubro } = await searchParams;
  const id = esRubro(rubro) ? rubro : null;
  return (
    <Suspense key={id ?? "general"} fallback={<Cargando texto="Buscando las noticias del día…" />}>
      <Contenido rubro={id} />
    </Suspense>
  );
}
