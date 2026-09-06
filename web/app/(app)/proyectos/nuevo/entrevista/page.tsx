"use client";
import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConSesion from "@/components/proyectos/ConSesion";
import IntakeConversacional from "@/components/cuenta/IntakeConversacional";

/**
 * Entrevista nueva. Apenas existe el borrador, la URL pasa a ser la de ESE
 * proyecto sin recargar: si la persona cierra la pestaña y vuelve, cae en su
 * entrevista y no en una nueva. Sin esto, cada recarga a medias dejaba otro
 * "Propuesta sin título" en la lista.
 */
function Entrevista() {
  const router = useRouter();

  const alCrear = useCallback((id: string) => {
    window.history.replaceState(null, "", `/proyectos/${id}/entrevista`);
  }, []);

  const alTerminar = useCallback(
    (id: string) => router.push(`/proyectos/${id}`),
    [router],
  );

  return (
    <div className="space-y-4">
      <Link
        href="/proyectos/nuevo"
        className="mono text-[11px] text-[var(--muted)] hover:text-[var(--bone)] inline-block"
      >
        ← proponer
      </Link>
      <IntakeConversacional alCrear={alCrear} alTerminar={alTerminar} />
    </div>
  );
}

export default function PaginaEntrevistaNueva() {
  return (
    <ConSesion mensaje="Para proponer un proyecto hace falta entrar a tu cuenta.">
      <Entrevista />
    </ConSesion>
  );
}
