"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import FormularioKYC from "./FormularioKYC";
import FormularioProyecto from "./FormularioProyecto";
import { fmtCOP } from "@/lib/types";

interface EstadoKyc {
  documento_enmascarado: string;
  estado: "pendiente" | "aprobado" | "rechazado";
}

interface Proyecto {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  proponente: string;
  barrio: string | null;
  meta_cop: number | null;
  recaudado_cop: number;
  estado: string;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "borrador",
  en_revision: "en revisión",
  publicado: "publicado",
  rechazado: "rechazado",
  cerrado: "cerrado",
};

function Tarjeta({ p }: { p: Proyecto }) {
  const pct = p.meta_cop ? Math.min(100, (p.recaudado_cop / p.meta_cop) * 100) : 0;
  return (
    <article className="border rule p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug">{p.titulo}</p>
        <span
          className={`mono text-[10px] shrink-0 ${
            p.estado === "publicado" ? "text-[var(--alza)]" : "text-[var(--muted)]"
          }`}
        >
          {ETIQUETA_ESTADO[p.estado] ?? p.estado}
        </span>
      </div>
      <p className="mono text-[11px] text-[var(--muted)]">
        {[p.tipo === "reconstruccion" ? "reconstrucción" : "nuevo", p.proponente, p.barrio]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {p.meta_cop && (
        <div className="space-y-1 pt-1">
          <div className="h-0.5 bg-[var(--muted)]/30">
            <div className="h-full bg-[var(--solar)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mono text-[11px]">
            {fmtCOP(p.recaudado_cop)}{" "}
            <span className="text-[var(--muted)]">de {fmtCOP(p.meta_cop)}</span>
          </p>
        </div>
      )}
    </article>
  );
}

/**
 * Proyectos tokenizados. Proponer exige KYC enviado; publicar exige KYC
 * aprobado. Mirar la vitrina no exige nada.
 */
export default function Proyectos() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [kyc, setKyc] = useState<EstadoKyc | null>(null);
  const [mios, setMios] = useState<Proyecto[]>([]);
  const [publicos, setPublicos] = useState<Proyecto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"lista" | "kyc" | "nuevo">("lista");

  const cargar = useCallback(async () => {
    setCargando(true);
    const token = authenticated ? await getAccessToken() : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const [rp, rpr] = await Promise.all([
      fetch("/api/perfil", { headers }),
      fetch("/api/proyectos", { headers }),
    ]);
    if (rp.ok) setKyc((await rp.json()).kyc ?? null);
    if (rpr.ok) {
      const j = await rpr.json();
      setMios(j.mios ?? []);
      setPublicos(j.publicos ?? []);
    }
    setCargando(false);
  }, [authenticated, getAccessToken]);

  useEffect(() => { if (ready) cargar(); }, [ready, cargar]);

  if (!ready || cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!authenticated)
    return <p className="mono text-xs text-[var(--muted)]">Entra para proponer un proyecto.</p>;

  if (vista === "kyc")
    return <FormularioKYC onListo={() => { setVista("lista"); cargar(); }} />;
  if (vista === "nuevo")
    return <FormularioProyecto onListo={() => { setVista("lista"); cargar(); }} />;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-semibold">Proyectos tokenizados</h2>
        <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
          Reconstruir una vivienda o levantar una nueva, financiada entre varios.
          Personas, empresas y entidades públicas pueden proponer y participar.
        </p>
      </div>

      <div className="border rule p-4">
        <p className="mono text-[11px] text-[var(--muted)]">VERIFICACIÓN</p>
        {!kyc ? (
          <>
            <p className="text-sm mt-2">
              Para proponer hace falta verificar tu identidad, porque un proyecto
              recibe dinero de otras personas.
            </p>
            <button
              onClick={() => setVista("kyc")}
              className="mono text-xs px-4 py-2.5 bg-[var(--solar)] text-[var(--petrol)] font-semibold mt-3"
            >
              VERIFICAR IDENTIDAD
            </button>
          </>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-4 flex-wrap">
            <div>
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
              <p className="mono text-[10px] text-[var(--muted)] mt-1 leading-relaxed">
                {kyc.estado === "pendiente"
                  ? "Puedes preparar borradores; se publican al aprobarse."
                  : kyc.estado === "aprobado"
                    ? "Tus proyectos pueden salir a la vitrina."
                    : "No pudimos verificar tus datos. Escríbenos."}
              </p>
            </div>
            {kyc.estado !== "rechazado" && (
              <button
                onClick={() => setVista("nuevo")}
                className="mono text-xs px-4 py-2.5 border rule hover:bg-[var(--petrol-2)]"
              >
                + PROYECTO
              </button>
            )}
          </div>
        )}
      </div>

      {!!mios.length && (
        <div>
          <h3 className="mono text-[11px] text-[var(--muted)] mb-2">TUS PROYECTOS</h3>
          <div className="space-y-3">
            {mios.map((p) => <Tarjeta key={p.id} p={p} />)}
          </div>
        </div>
      )}

      <div>
        <h3 className="mono text-[11px] text-[var(--muted)] mb-2">VITRINA</h3>
        {publicos.length ? (
          <div className="space-y-3">
            {publicos.map((p) => <Tarjeta key={p.id} p={p} />)}
          </div>
        ) : (
          <p className="mono text-xs text-[var(--muted)]">
            Todavía no hay proyectos publicados.
          </p>
        )}
      </div>
    </div>
  );
}
