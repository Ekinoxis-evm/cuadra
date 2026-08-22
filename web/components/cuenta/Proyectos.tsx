"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import FormularioKYC from "./FormularioKYC";
import { fmtCOP } from "@/lib/types";

interface EstadoKyc {
  documento_enmascarado: string;
  estado: "pendiente" | "aprobado" | "rechazado";
}

/**
 * Proyectos tokenizados. La propuesta está detrás del KYC porque implica
 * recibir dinero de terceros; mirar la vitrina no requiere nada.
 */
export default function Proyectos() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [kyc, setKyc] = useState<EstadoKyc | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarKyc, setMostrarKyc] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const token = await getAccessToken();
    const r = await fetch("/api/perfil", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const j = await r.json();
      setKyc(j.kyc ?? null);
    }
    setCargando(false);
  }, [getAccessToken]);

  useEffect(() => { if (authenticated) cargar(); }, [authenticated, cargar]);

  if (!ready || cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!authenticated)
    return <p className="mono text-xs text-[var(--muted)]">Entra para proponer un proyecto.</p>;

  if (mostrarKyc && !kyc)
    return (
      <FormularioKYC
        onListo={() => {
          setMostrarKyc(false);
          cargar();
        }}
      />
    );

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-semibold">Proyectos tokenizados</h2>
        <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
          Reconstruir una vivienda o levantar un proyecto nuevo, financiado entre
          varios. Personas, empresas y entidades públicas pueden participar.
        </p>
      </div>

      <div className="border rule p-4">
        <p className="mono text-[11px] text-[var(--muted)]">ESTADO DE VERIFICACIÓN</p>
        {!kyc ? (
          <>
            <p className="text-sm mt-2">
              Todavía no has verificado tu identidad.
            </p>
            <button
              onClick={() => setMostrarKyc(true)}
              className="mono text-xs px-4 py-2.5 bg-[var(--solar)] text-[var(--petrol)] font-semibold mt-3"
            >
              VERIFICAR IDENTIDAD
            </button>
          </>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="mono text-xs">
              Documento {kyc.documento_enmascarado} ·{" "}
              <span
                className={
                  kyc.estado === "aprobado"
                    ? "text-[var(--alza)]"
                    : kyc.estado === "rechazado"
                      ? "text-[var(--solar)]"
                      : "text-[var(--muted)]"
                }
              >
                {kyc.estado}
              </span>
            </p>
            <p className="mono text-[10px] text-[var(--muted)] leading-relaxed">
              {kyc.estado === "pendiente"
                ? "Recibimos tus datos. La revisión es manual por ahora."
                : kyc.estado === "aprobado"
                  ? "Ya puedes proponer proyectos."
                  : "No pudimos verificar tus datos. Escríbenos para revisarlo."}
            </p>
          </div>
        )}
      </div>

      <div className="border rule p-4">
        <p className="mono text-[11px] text-[var(--muted)]">PROPONER UN PROYECTO</p>
        <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
          {kyc?.estado === "aprobado"
            ? "El formulario de propuesta llega en la siguiente entrega."
            : "Disponible cuando tu identidad esté verificada."}
        </p>
        <p className="mono text-[10px] text-[var(--muted)] mt-3 leading-relaxed">
          Meta de recaudo en {fmtCOP(0).replace("0", "COP")}, aportes con los
          saldos de tu wallet. Cada proyecto pasa por revisión antes de aparecer
          en la vitrina pública.
        </p>
      </div>
    </div>
  );
}
