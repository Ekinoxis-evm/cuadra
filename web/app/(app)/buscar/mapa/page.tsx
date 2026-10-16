import { Suspense } from "react";
import VistaBusqueda from "@/components/buscar/VistaBusqueda";

export default function BuscarMapa() {
  return (
    <Suspense>
      <VistaBusqueda modo="mapa" />
    </Suspense>
  );
}
