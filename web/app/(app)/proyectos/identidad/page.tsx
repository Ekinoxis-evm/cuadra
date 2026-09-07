"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConSesion from "@/components/proyectos/ConSesion";
import FormularioKYC from "@/components/cuenta/FormularioKYC";
import { SIGNIFICADO_KYC, colorKyc } from "@/components/proyectos/Identidad";
import { useKyc } from "@/components/proyectos/datos";

/**
 * La identidad tiene página propia porque es un trámite propio: se hace una
 * vez, vale para todos los proyectos de la cuenta, y su estado lo decide la
 * revisión, no lo que uno haga con sus propuestas.
 */
function Identidad() {
  const router = useRouter();
  const { kyc, cargando, recargar } = useKyc();

  if (cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;

  if (!kyc)
    return (
      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Para proponer hace falta verificar quién eres, porque un proyecto
          recibe dinero de otras personas. Es un paso aparte de la propuesta:
          se hace una sola vez y queda para todo lo que propongas después.
        </p>
        <FormularioKYC onListo={recargar} onCancelar={() => router.push("/proyectos/mios")} />
      </div>
    );

  const sig = SIGNIFICADO_KYC[kyc.estado];
  return (
    <div className="max-w-2xl space-y-6">
      <section className="border rule p-5 space-y-3">
        <p className="mono text-[11px] text-[var(--muted)]">VERIFICACIÓN DE IDENTIDAD</p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className={`text-lg font-semibold ${colorKyc(kyc.estado)}`}>{sig.titulo}</span>
          <span className="mono text-xs text-[var(--muted)]">
            {kyc.tipo_documento ? `${kyc.tipo_documento} ` : ""}
            {kyc.documento_enmascarado}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{sig.detalle}</p>
      </section>

      <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
        Este paso no cambia con tus proyectos: cada propuesta lleva su propio
        avance en{" "}
        <Link href="/proyectos/mios" className="underline underline-offset-4 hover:text-[var(--bone)]">
          mis proyectos
        </Link>
        .
        {kyc.estado !== "rechazado" && (
          <>
            {" "}
            ¿Listo para proponer?{" "}
            <Link href="/proyectos/nuevo" className="underline underline-offset-4 hover:text-[var(--bone)]">
              Empieza aquí
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}

export default function PaginaIdentidad() {
  return (
    <ConSesion mensaje="Para verificar tu identidad hace falta entrar a tu cuenta.">
      <Identidad />
    </ConSesion>
  );
}
