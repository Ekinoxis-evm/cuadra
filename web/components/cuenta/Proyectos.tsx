"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import FormularioKYC from "./FormularioKYC";
import FormularioProyecto from "./FormularioProyecto";
import Pasos from "@/components/Pasos";
import EntrarCTA from "@/components/EntrarCTA";
import { fmtCOP } from "@/lib/types";
import {
  RUTA_PUBLICAR,
  etiquetaDocumento,
  etiquetaEstadoObra,
  etiquetaTipo,
  type Documento,
} from "@/lib/proyectos";

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
  estado_obra: string | null;
  area_m2: number | null;
  plazo_meses: number | null;
  documentos: Documento[] | null;
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

/** Qué le falta a este proyecto para avanzar, dicho sin rodeos. */
const QUE_SIGUE: Record<string, string> = {
  borrador: "Guardado. Lo revisamos y te escribimos si falta algo.",
  en_revision: "En revisión. Todavía no recibe aportes.",
  publicado: "Público en la vitrina. Ya puede recibir aportes.",
  rechazado: "No pasó la revisión. Escríbenos para saber qué ajustar.",
  cerrado: "Cerrado.",
};

/** Los tres tramos por los que pasa un proyecto ya creado. */
const TRAMOS_PROYECTO = ["borrador", "en_revision", "publicado"];

function Tarjeta({ p, propio }: { p: Proyecto; propio?: boolean }) {
  const pct = p.meta_cop ? Math.min(100, (p.recaudado_cop / p.meta_cop) * 100) : 0;
  const avance = TRAMOS_PROYECTO.indexOf(p.estado);
  const docs = p.documentos ?? [];

  return (
    <article className="border rule p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug">{p.titulo}</p>
        <span
          className={`mono text-[10px] shrink-0 ${
            p.estado === "publicado"
              ? "text-[var(--alza)]"
              : p.estado === "rechazado"
                ? "text-[var(--solar)]"
                : "text-[var(--muted)]"
          }`}
        >
          {ETIQUETA_ESTADO[p.estado] ?? p.estado}
        </span>
      </div>

      <p className="mono text-[11px] text-[var(--muted)]">
        {[
          etiquetaTipo(p.tipo),
          etiquetaEstadoObra(p.estado_obra),
          p.barrio,
          p.area_m2 ? `${p.area_m2} m²` : null,
          p.plazo_meses ? `${p.plazo_meses} meses` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* Avance del propio proyecto: dónde va y qué falta. En la vitrina no
          hace falta porque todo lo público ya llegó al final. */}
      {propio && avance >= 0 && (
        <div className="flex items-center gap-1.5 pt-0.5">
          {TRAMOS_PROYECTO.map((t, i) => (
            <span
              key={t}
              className={`h-0.5 flex-1 ${
                i <= avance ? "bg-[var(--solar)]" : "bg-[var(--muted)]/25"
              }`}
            />
          ))}
        </div>
      )}
      {propio && (
        <p className="mono text-[10px] text-[var(--muted)] leading-relaxed">
          {QUE_SIGUE[p.estado] ?? ""}
        </p>
      )}

      {propio && (
        <p className="mono text-[10px] text-[var(--muted)]">
          {docs.length
            ? `soportes: ${docs.map((d) => etiquetaDocumento(d.tipo)).join(", ")}`
            : "sin soportes adjuntos · la revisión pide al menos uno"}
        </p>
      )}

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
 *
 * La pantalla abre siempre con la ruta completa dibujada — identidad,
 * propuesta, revisión, vitrina — porque la queja de fondo era no saber en qué
 * punto estaba uno ni cuánto faltaba.
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
    return (
      <EntrarCTA
        mensaje="Los proyectos tokenizados reconstruyen o levantan vivienda con plata de varios. Para proponer uno o participar hace falta una cuenta."
        nota="Con tu correo o Google. Mirar la vitrina no exige nada; proponer sí."
      />
    );

  if (vista === "kyc")
    return (
      <FormularioKYC
        onListo={() => { setVista("lista"); cargar(); }}
        onCancelar={() => setVista("lista")}
      />
    );
  if (vista === "nuevo")
    return (
      <FormularioProyecto
        onListo={() => { setVista("lista"); cargar(); }}
        onCancelar={() => setVista("lista")}
      />
    );

  // En qué tramo de la ruta está esta cuenta.
  const publicado = mios.some((p) => p.estado === "publicado");
  const enCurso = mios.some((p) => ["borrador", "en_revision"].includes(p.estado));
  const tramo = !kyc ? 0 : publicado ? 3 : enCurso ? 2 : 1;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-semibold">Proyectos tokenizados</h2>
        <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
          Reconstruir una vivienda o levantar una nueva, financiada entre varios.
          Personas, empresas y entidades públicas pueden proponer y participar.
        </p>
      </div>

      {/* Ruta completa: qué queda hecho, dónde vas, qué falta. */}
      <div className="border rule p-4">
        <Pasos pasos={RUTA_PUBLICAR} actual={tramo} etiqueta="TRAMO" />
      </div>

      <div className="border rule p-4">
        <p className="mono text-[11px] text-[var(--muted)]">
          TRAMO 1 · VERIFICACIÓN
        </p>
        {!kyc ? (
          <>
            <p className="text-sm mt-2 leading-relaxed">
              Para proponer hace falta verificar tu identidad, porque un proyecto
              recibe dinero de otras personas. Son cuatro datos y toma un minuto.
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
                className={`mono text-xs px-4 py-2.5 ${
                  mios.length
                    ? "border rule hover:bg-[var(--petrol-2)]"
                    : "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                }`}
              >
                {mios.length ? "+ PROYECTO" : "DESCRIBIR MI PROYECTO"}
              </button>
            )}
          </div>
        )}
      </div>

      {!!mios.length && (
        <div>
          <h3 className="mono text-[11px] text-[var(--muted)] mb-2">TUS PROYECTOS</h3>
          <div className="space-y-3">
            {mios.map((p) => <Tarjeta key={p.id} p={p} propio />)}
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
