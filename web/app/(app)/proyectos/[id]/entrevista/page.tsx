"use client";
import { useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ConSesion from "@/components/proyectos/ConSesion";
import CabeceraProyecto from "@/components/proyectos/CabeceraProyecto";
import IntakeConversacional from "@/components/cuenta/IntakeConversacional";
import { useProyectoPropio } from "@/components/proyectos/datos";

/** Retomar la entrevista de un borrador donde quedó. */
function Entrevista({ id }: { id: string }) {
  const router = useRouter();
  const { p, cargando, error } = useProyectoPropio(id);

  const alTerminar = useCallback(
    (pid: string) => router.push(`/proyectos/${pid}`),
    [router],
  );

  if (cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!p) return <p className="mono text-xs text-[var(--solar)]">{error}</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <CabeceraProyecto p={p} pestana="entrevista" />
      {p.estado === "borrador" ? (
        <IntakeConversacional proyectoId={p.id} alTerminar={alTerminar} />
      ) : (
        <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
          Este proyecto ya salió de borrador y la entrevista no se puede seguir
          editando.{" "}
          <Link href={`/proyectos/${p.id}`} className="underline underline-offset-4">
            volver al resumen
          </Link>
        </p>
      )}
    </div>
  );
}

export default function PaginaEntrevista() {
  const { id } = useParams<{ id: string }>();
  return (
    <ConSesion mensaje="Para seguir tu entrevista hace falta entrar a tu cuenta.">
      <Entrevista id={id} />
    </ConSesion>
  );
}
