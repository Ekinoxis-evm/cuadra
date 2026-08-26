"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  faltaParaRevision,
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
  direccion: string | null;
  estado_obra: string | null;
  estado_detalle: string | null;
  area_m2: number | null;
  plazo_meses: number | null;
  documentos: Documento[] | null;
  imagenes: string[] | null;
  meta_cop: number | null;
  recaudado_cop: number;
  estado: string;
  nota_revision: string | null;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "borrador",
  en_revision: "en revisión",
  publicado: "publicado",
  rechazado: "necesita ajustes",
  cerrado: "cerrado",
};

/** Qué le falta a este proyecto para avanzar, dicho sin rodeos. */
const QUE_SIGUE: Record<string, string> = {
  borrador: "Guardado. Cuando esté listo, mándalo a revisión.",
  en_revision: "Lo estamos revisando. Todavía no recibe aportes.",
  publicado: "Público en la vitrina. Ya puede recibir aportes.",
  rechazado: "Corrige lo que te pedimos y vuelve a mandarlo.",
  cerrado: "Cerrado.",
};

/** Los tres tramos por los que pasa un proyecto ya creado. */
const TRAMOS_PROYECTO = ["borrador", "en_revision", "publicado"];

function Tarjeta({
  p,
  propio,
  onEditar,
  onEnviar,
  ocupado,
}: {
  p: Proyecto;
  propio?: boolean;
  onEditar?: () => void;
  onEnviar?: () => void;
  ocupado?: boolean;
}) {
  const pct = p.meta_cop ? Math.min(100, (p.recaudado_cop / p.meta_cop) * 100) : 0;
  const avance = TRAMOS_PROYECTO.indexOf(p.estado);
  const docs = p.documentos ?? [];
  const portada = p.imagenes?.[0];
  const falta = faltaParaRevision({ documentos: docs });
  const editable = ["borrador", "rechazado"].includes(p.estado);

  return (
    <article className="border rule">
      {portada && (
        <Image
          src={portada}
          alt=""
          width={640}
          height={200}
          className="w-full h-32 object-cover border-b rule"
        />
      )}
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          {p.estado === "publicado" ? (
            <Link
              href={`/proyecto/${p.id}`}
              className="text-sm font-medium leading-snug hover:text-[var(--solar)]"
            >
              {p.titulo}
            </Link>
          ) : (
            <p className="text-sm font-medium leading-snug">{p.titulo}</p>
          )}
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

        {/* La respuesta de la revisión, textual. Sin esto, "te escribimos si
            falta algo" era una promesa que la app no podía cumplir. */}
        {propio && p.nota_revision && (
          <div className="border-l-2 border-[var(--solar)] pl-3 py-1">
            <p className="mono text-[10px] text-[var(--solar)]">
              LO QUE PEDIMOS AJUSTAR
            </p>
            <p className="mono text-[11px] mt-1 leading-relaxed">
              {p.nota_revision}
            </p>
          </div>
        )}

        {propio && (
          <p className="mono text-[10px] text-[var(--muted)]">
            {docs.length
              ? `soportes: ${docs.map((d) => etiquetaDocumento(d.tipo)).join(", ")}`
              : "sin soportes adjuntos"}
            {p.imagenes?.length ? ` · ${p.imagenes.length} fotos` : " · sin fotos"}
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

        {propio && editable && (
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <button
              onClick={onEditar}
              disabled={ocupado}
              className="mono text-[11px] border rule px-3 py-1.5 hover:bg-[var(--petrol-2)] disabled:opacity-40"
            >
              editar
            </button>
            <button
              onClick={onEnviar}
              disabled={ocupado || !!falta}
              title={falta ?? undefined}
              className="mono text-[11px] px-3 py-1.5 bg-[var(--solar)] text-[var(--petrol)] font-semibold disabled:opacity-40 disabled:bg-transparent disabled:text-[var(--muted)] disabled:border disabled:rule"
            >
              {ocupado ? "enviando…" : "ENVIAR A REVISIÓN"}
            </button>
            {falta && (
              <p className="mono text-[10px] text-[var(--muted)] leading-relaxed basis-full">
                {falta}
              </p>
            )}
          </div>
        )}

        {propio && p.estado === "publicado" && (
          <Link
            href={`/proyecto/${p.id}`}
            className="mono text-[11px] border rule px-3 py-1.5 hover:bg-[var(--petrol-2)] inline-block mt-2"
          >
            ver la página pública
          </Link>
        )}
      </div>
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
  const [editando, setEditando] = useState<Proyecto | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [privyLento, setPrivyLento] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const token = ready && authenticated ? await getAccessToken() : null;
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
  }, [ready, authenticated, getAccessToken]);

  // Corre sin esperar a Privy: la vitrina es pública y no necesita sesión.
  useEffect(() => { cargar(); }, [cargar]);

  // Si Privy no arranca —está caído, bloqueado, o el origen no está en su
  // lista— la pestaña se quedaba en "···" para siempre, escondiendo una
  // vitrina que no necesita sesión para nada. A los cinco segundos se sigue
  // sin él.
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setPrivyLento(true), 5000);
    return () => clearTimeout(t);
  }, [ready]);

  async function enviarARevision(p: Proyecto) {
    setError(null);
    setOcupado(p.id);
    try {
      const token = await getAccessToken();
      const r = await fetch(`/api/proyectos/${p.id}/revision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo enviar");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
    } finally {
      setOcupado(null);
    }
  }

  if ((!ready && !privyLento) || cargando)
    return <p className="mono text-xs text-[var(--muted)]">···</p>;

  // Sin sesión se ve la vitrina completa: es pública, tiene página propia por
  // proyecto y es lo que alguien abre cuando le comparten un enlace. La cuenta
  // solo hace falta para proponer.
  if (!authenticated)
    return (
      <div className="max-w-2xl space-y-8">
        <div>
          <h2 className="font-semibold">Proyectos tokenizados</h2>
          <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">
            Reconstruir una vivienda o levantar una nueva, financiada entre
            varios. Personas, empresas y entidades públicas pueden proponer y
            participar.
          </p>
        </div>

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

        {ready ? (
          <EntrarCTA
            mensaje="Para proponer un proyecto o participar en uno hace falta una cuenta. Mirar la vitrina no."
            nota="Con tu correo o Google. Proponer exige además verificar tu identidad."
          />
        ) : (
          <p className="mono text-[11px] text-[var(--muted)] leading-relaxed border rule p-4">
            No pudimos cargar tu sesión. La vitrina se ve igual; para proponer
            un proyecto, recarga la página.
          </p>
        )}
      </div>
    );

  if (vista === "kyc")
    return (
      <FormularioKYC
        onListo={() => { setVista("lista"); cargar(); }}
        onCancelar={() => setVista("lista")}
      />
    );
  if (vista === "nuevo" || editando)
    return (
      <FormularioProyecto
        proyecto={editando ?? undefined}
        onListo={() => { setVista("lista"); setEditando(null); cargar(); }}
        onCancelar={() => { setVista("lista"); setEditando(null); }}
      />
    );

  // En qué tramo de la ruta está esta cuenta.
  const publicado = mios.some((p) => p.estado === "publicado");
  const enCurso = mios.some((p) => ["borrador", "en_revision", "rechazado"].includes(p.estado));
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

      {error && (
        <p className="mono text-[11px] text-[var(--solar)]" role="alert">{error}</p>
      )}

      {!!mios.length && (
        <div>
          <h3 className="mono text-[11px] text-[var(--muted)] mb-2">TUS PROYECTOS</h3>
          <div className="space-y-3">
            {mios.map((p) => (
              <Tarjeta
                key={p.id}
                p={p}
                propio
                ocupado={ocupado === p.id}
                onEditar={() => setEditando(p)}
                onEnviar={() => enviarARevision(p)}
              />
            ))}
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
