import { Suspense } from "react";
import VistaBusqueda from "@/components/buscar/VistaBusqueda";

// useSearchParams necesita un Suspense para que Next pueda prerenderizar la
// ruta; sin él el build falla con "missing suspense boundary".
export default function Buscar() {
  return (
    <Suspense>
      <VistaBusqueda modo="lista" />
    </Suspense>
  );
}
