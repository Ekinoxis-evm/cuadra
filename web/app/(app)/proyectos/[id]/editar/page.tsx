"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ConSesion from "@/components/proyectos/ConSesion";
import CabeceraProyecto from "@/components/proyectos/CabeceraProyecto";
import FormularioProyecto from "@/components/cuenta/FormularioProyecto";
import { useProyectoPropio } from "@/components/proyectos/datos";
import { EDITABLES } from "@/lib/proyectos";

function Editar({ id }: { id: string }) {
  const router = useRouter();
  const { p, cargando, error } = useProyectoPropio(id);

  if (cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!p) return <p className="mono text-xs text-[var(--solar)]">{error}</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <CabeceraProyecto p={p} pestana="editar" />
      {EDITABLES.includes(p.estado) ? (
        <FormularioProyecto
          proyecto={p}
          onListo={() => router.push(`/proyectos/${p.id}`)}
          onCancelar={() => router.push(`/proyectos/${p.id}`)}
        />
      ) : (
        <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
          {p.estado === "en_revision"
            ? "Está en revisión: espera la respuesta para poder editarlo."
            : "Un proyecto publicado o cerrado ya no se edita."}{" "}
          <Link href={`/proyectos/${p.id}`} className="underline underline-offset-4">
            volver al resumen
          </Link>
        </p>
      )}
    </div>
  );
}

export default function PaginaEditar() {
  const { id } = useParams<{ id: string }>();
  return (
    <ConSesion mensaje="Para editar una propuesta tuya hace falta entrar a tu cuenta.">
      <Editar id={id} />
    </ConSesion>
  );
}
