"use client";
import { useRouter } from "next/navigation";
import ConSesion from "@/components/proyectos/ConSesion";
import FormularioKYC from "@/components/cuenta/FormularioKYC";

/** Verificar identidad. Al terminar se vuelve a la puerta de proponer. */
export default function PaginaVerificacion() {
  const router = useRouter();
  return (
    <ConSesion mensaje="Para verificar tu identidad hace falta entrar a tu cuenta.">
      <FormularioKYC
        onListo={() => router.push("/proyectos/nuevo")}
        onCancelar={() => router.push("/proyectos/nuevo")}
      />
    </ConSesion>
  );
}
