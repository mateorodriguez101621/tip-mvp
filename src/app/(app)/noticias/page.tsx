import { Suspense } from "react";
import { Cargando } from "@/components/Cargando";
import { VistaNoticias } from "@/components/vistas/Noticias";
import { obtenerContextoDelDia } from "@/lib/noticias/obtener";

export const metadata = { title: "Noticias · TIP" };

async function Contenido() {
  return <VistaNoticias {...await obtenerContextoDelDia()} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Cargando texto="Buscando las noticias del día…" />}>
      <Contenido />
    </Suspense>
  );
}
