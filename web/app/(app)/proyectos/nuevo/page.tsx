"use client";
import Link from "next/link";
import Pasos from "@/components/Pasos";
import ConSesion from "@/components/proyectos/ConSesion";
import { useKyc } from "@/components/proyectos/datos";
import { RUTA_PUBLICAR } from "@/lib/proyectos";

/**
 * La puerta para proponer. Primero la identidad; después, dos caminos para
 * la misma propuesta: contarla conversando o llenar el formulario de corrido.
 * Obligar a conversar a quien ya sabe qué va en cada casilla es ponerle un
 * trámite más largo, no uno mejor.
 */
function Nuevo() {
  const { kyc, cargando } = useKyc();

  if (cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;

  if (!kyc)
    return (
      <div className="max-w-2xl space-y-6">
        <div className="border rule p-4">
          <Pasos pasos={RUTA_PUBLICAR} actual={0} etiqueta="TRAMO" />
        </div>
        <div className="border rule p-5 space-y-3">
          <p className="text-sm leading-relaxed">
            Para proponer hace falta verificar tu identidad, porque un proyecto
            recibe dinero de otras personas. Son cuatro datos y toma un minuto.
          </p>
          <Link
            href="/proyectos/verificacion"
            className="mono text-xs px-4 py-2.5 bg-[var(--solar)] text-[var(--petrol)] font-semibold inline-block"
          >
            VERIFICAR IDENTIDAD
          </Link>
        </div>
      </div>
    );

  if (kyc.estado === "rechazado")
    return (
      <div className="max-w-2xl border rule p-5">
        <p className="mono text-[11px] text-[var(--solar)]">VERIFICACIÓN RECHAZADA</p>
        <p className="text-sm mt-2 leading-relaxed">
          No pudimos verificar tus datos, y sin eso no se puede proponer.
          Escríbenos para revisarla.
        </p>
      </div>
    );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="border rule p-4">
        <Pasos pasos={RUTA_PUBLICAR} actual={1} etiqueta="TRAMO" />
      </div>

      <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
        Identidad {kyc.documento_enmascarado} · {kyc.estado}.{" "}
        {kyc.estado === "pendiente"
          ? "Puedes preparar la propuesta mientras se aprueba; se publica después."
          : "Tu propuesta puede salir a la vitrina cuando pase revisión."}
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          href="/proyectos/nuevo/entrevista"
          className="border rule border-[var(--solar)] p-5 hover:bg-[var(--petrol-2)] transition-colors block"
        >
          <p className="mono text-[10px] text-[var(--solar)]">RECOMENDADO</p>
          <p className="text-sm font-medium mt-1.5">Contarme tu proyecto</p>
          <p className="mono text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
            Una conversación que pregunta solo lo que aplica a tu caso. Puedes
            salir cuando quieras: lo contestado queda guardado y se retoma.
          </p>
        </Link>
        <Link
          href="/proyectos/nuevo/formulario"
          className="border rule p-5 hover:bg-[var(--petrol-2)] transition-colors block"
        >
          <p className="mono text-[10px] text-[var(--muted)]">DE CORRIDO</p>
          <p className="text-sm font-medium mt-1.5">Llenar el formulario</p>
          <p className="mono text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
            Cuatro tramos: qué se va a hacer, dónde y cómo está, fotos y
            soportes, plata. Para quien ya sabe qué va en cada casilla.
          </p>
        </Link>
      </div>

      <p className="mono text-[10px] text-[var(--muted)] leading-relaxed">
        En los dos casos queda como borrador. Sale a la vitrina solo después de
        la revisión, y hasta entonces no recibe aportes.
      </p>
    </div>
  );
}

export default function PaginaNuevo() {
  return (
    <ConSesion
      mensaje="Para proponer un proyecto hace falta una cuenta. Mirar la vitrina no."
      nota="Con tu correo o Google. Proponer exige además verificar tu identidad."
    >
      <Nuevo />
    </ConSesion>
  );
}
