"use client";
import { useRouter } from "next/navigation";
import ConSesion from "@/components/proyectos/ConSesion";
import FormularioProyecto from "@/components/cuenta/FormularioProyecto";

export default function PaginaFormularioNuevo() {
  const router = useRouter();
  return (
    <ConSesion mensaje="Para proponer un proyecto hace falta entrar a tu cuenta.">
      <FormularioProyecto
        onListo={(id) => router.push(`/proyectos/${id}`)}
        onCancelar={() => router.push("/proyectos/nuevo")}
      />
    </ConSesion>
  );
}
