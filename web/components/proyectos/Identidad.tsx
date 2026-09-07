"use client";
import Link from "next/link";
import type { EstadoKyc } from "./datos";

/**
 * La verificación de identidad, dicha como lo que es: una cosa que se hace
 * una vez por cuenta, con tres estados posibles, y que no avanza ni retrocede
 * con los proyectos. Antes iba dibujada como el primer tramo de cada
 * propuesta, y una identidad pendiente aparecía con un ✓.
 */
export const SIGNIFICADO_KYC: Record<EstadoKyc["estado"], { titulo: string; detalle: string }> = {
  pendiente: {
    titulo: "En verificación",
    detalle:
      "Recibimos tus datos y los estamos revisando. Mientras tanto puedes preparar propuestas y mandarlas a revisión; salen a la vitrina solo cuando la identidad quede aprobada.",
  },
  aprobado: {
    titulo: "Verificada",
    detalle: "Tus proyectos pueden publicarse. No hay que repetir este paso.",
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

/** Una línea con el estado y el enlace a la pestaña. Para las otras páginas. */
export function LineaIdentidad({ kyc }: { kyc: EstadoKyc | null }) {
  return (
    <div className="border rule px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <p className="mono text-[11px]">
        <span className="text-[var(--muted)]">IDENTIDAD · </span>
        {kyc ? (
          <>
            <span className="text-[var(--muted)]">documento {kyc.documento_enmascarado} · </span>
            <span className={colorKyc(kyc.estado)}>{SIGNIFICADO_KYC[kyc.estado].titulo.toLowerCase()}</span>
          </>
        ) : (
          <span className="text-[var(--solar)]">sin verificar</span>
        )}
      </p>
      <Link
        href="/proyectos/identidad"
        className={`mono text-[11px] px-3 py-1.5 ${
          kyc
            ? "text-[var(--muted)] hover:text-[var(--bone)]"
            : "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
        }`}
      >
        {kyc ? "ver →" : "VERIFICAR IDENTIDAD"}
      </Link>
    </div>
  );
}
