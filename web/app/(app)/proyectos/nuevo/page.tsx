"use client";
import Link from "next/link";
import ConSesion from "@/components/proyectos/ConSesion";
import { RequisitoVerificacion, RUTA_VERIFICACION } from "@/components/cuenta/Verificacion";
import { useKyc } from "@/components/proyectos/datos";

/**
 * La puerta para proponer. Depende de que la cuenta esté verificada —sin eso
 * no se abre— pero la verificación no es parte de la propuesta ni de esta
 * sección: se muestra como requisito, con su estado, y se resuelve en la
 * cuenta. Después, dos caminos para la
 * misma propuesta: contarla conversando o llenar el formulario de corrido.
 */
function Nuevo() {
  const { kyc, cargando } = useKyc();

  if (cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;

  if (!kyc || kyc.estado === "rechazado")
    return (
      <div className="max-w-2xl space-y-6">
        <RequisitoVerificacion kyc={kyc} />
        <div className="border rule p-5">
          <p className="mono text-[11px] text-[var(--muted)]">REQUISITO</p>
          <p className="text-sm mt-2 leading-relaxed">
            {kyc
              ? "La verificación de tu cuenta fue rechazada y sin ella no se puede proponer. Escríbenos para revisarla."
              : "Para proponer hace falta una cuenta verificada, porque un proyecto recibe dinero de otras personas. Se hace una vez, desde tu cuenta, y toma un minuto."}
          </p>
          {!kyc && (
            <Link
              href={RUTA_VERIFICACION}
              className="mono text-xs px-4 py-2.5 bg-[var(--solar)] text-[var(--petrol)] font-semibold inline-block mt-4"
            >
              VERIFICAR CUENTA
            </Link>
          )}
        </div>
      </div>
    );

  return (
    <div className="max-w-2xl space-y-6">
      <RequisitoVerificacion kyc={kyc} />

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
        la revisión{kyc.estado === "pendiente" ? " y de que tu cuenta quede verificada" : ""}, y
        hasta entonces no recibe aportes.
      </p>
    </div>
  );
}

export default function PaginaNuevo() {
  return (
    <ConSesion
      mensaje="Para proponer un proyecto hace falta una cuenta. Mirar la vitrina no."
      nota="Con tu correo o Google. Proponer exige además una cuenta verificada."
    >
      <Nuevo />
    </ConSesion>
  );
}
