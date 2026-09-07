"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FormularioKYC from "./FormularioKYC";
import { useKyc, type EstadoKyc } from "@/components/proyectos/datos";

/**
 * Verificación de cuenta.
 *
 * Es un trámite de la CUENTA, no de los proyectos: se hace una vez, vale para
 * todo lo que la persona proponga, y su estado lo decide la verificación (hoy
 * una revisión nuestra; después, un proveedor de KYC). Por eso vive en la
 * cuenta y no dentro de la sección de proyectos, que solo pregunta por el
 * resultado antes de dejar proponer.
 */
export const SIGNIFICADO_KYC: Record<EstadoKyc["estado"], { titulo: string; detalle: string }> = {
  pendiente: {
    titulo: "En verificación",
    detalle:
      "Recibimos tus datos y los estamos revisando. Mientras tanto puedes preparar propuestas y mandarlas a revisión; salen a la vitrina solo cuando la cuenta quede verificada.",
  },
  aprobado: {
    titulo: "Verificada",
    detalle: "Tu cuenta está verificada. Tus proyectos pueden publicarse y no hay que repetir este paso.",
  },
  rechazado: {
    titulo: "Rechazada",
    detalle: "No pudimos verificar tus datos. Sin esto no se puede proponer. Escríbenos para revisarla.",
  },
};

export const colorKyc = (estado: EstadoKyc["estado"]) =>
  estado === "aprobado"
    ? "text-[var(--alza)]"
    : estado === "rechazado"
      ? "text-[var(--solar)]"
      : "text-[var(--bone)]";

export const RUTA_VERIFICACION = "/cuenta?tab=verificacion";

/** La pestaña de la cuenta: estado, o el formulario si nunca se envió. */
export default function VerificacionCuenta() {
  const router = useRouter();
  const { kyc, cargando, recargar } = useKyc();

  if (cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;

  if (!kyc)
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="font-semibold">Verificación de cuenta</h2>
          <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
            Para proponer un proyecto hace falta saber quién está detrás de la
            cuenta, porque un proyecto recibe dinero de otras personas. Se hace
            una sola vez.
          </p>
        </div>
        <FormularioKYC onListo={recargar} onCancelar={() => router.push("/cuenta?tab=perfil")} />
      </div>
    );

  const sig = SIGNIFICADO_KYC[kyc.estado];
  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="font-semibold">Verificación de cuenta</h2>
      <section className="border rule p-5 space-y-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className={`text-lg font-semibold ${colorKyc(kyc.estado)}`}>{sig.titulo}</span>
          <span className="mono text-xs text-[var(--muted)]">
            {kyc.tipo_documento ? `${kyc.tipo_documento} ` : ""}
            {kyc.documento_enmascarado}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{sig.detalle}</p>
      </section>
      {kyc.estado !== "rechazado" && (
        <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
          Con esto listo,{" "}
          <Link href="/proyectos/nuevo" className="underline underline-offset-4 hover:text-[var(--bone)]">
            propón un proyecto
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/**
 * Lo que la sección de proyectos muestra: el requisito y su estado, con el
 * enlace a la cuenta. Nada más — la verificación no se gestiona desde aquí.
 */
export function RequisitoVerificacion({ kyc }: { kyc: EstadoKyc | null }) {
  return (
    <div className="border rule px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <p className="mono text-[11px]">
        <span className="text-[var(--muted)]">CUENTA · </span>
        {kyc ? (
          <span className={colorKyc(kyc.estado)}>{SIGNIFICADO_KYC[kyc.estado].titulo.toLowerCase()}</span>
        ) : (
          <span className="text-[var(--solar)]">sin verificar</span>
        )}
      </p>
      <Link
        href={RUTA_VERIFICACION}
        className={`mono text-[11px] px-3 py-1.5 ${
          kyc
            ? "text-[var(--muted)] hover:text-[var(--bone)]"
            : "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
        }`}
      >
        {kyc ? "ver en la cuenta →" : "VERIFICAR CUENTA"}
      </Link>
    </div>
  );
}
