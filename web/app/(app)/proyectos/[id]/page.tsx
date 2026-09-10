"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import Pasos from "@/components/Pasos";
import ConSesion from "@/components/proyectos/ConSesion";
import CabeceraProyecto from "@/components/proyectos/CabeceraProyecto";
import Evaluacion from "@/components/proyectos/Evaluacion";
import { useFetchConSesion, useProyectoPropio } from "@/components/proyectos/datos";
import { fmtCOP } from "@/lib/types";
import { avance, conTipo, faltantes, type ProponenteId } from "@/lib/intake";
import {
  EDITABLES,
  QUE_SIGUE,
  TRAMOS_PROYECTO,
  etiquetaDocumento,
  etiquetaEstadoObra,
  etiquetaProponente,
  etiquetaTipo,
  pendientesParaRevision,
  pesoLegible,
  tramoDe,
} from "@/lib/proyectos";

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b rule">
      <span className="mono text-[10px] text-[var(--muted)] shrink-0">{k}</span>
      <span className="mono text-[11px] text-right">{v}</span>
    </div>
  );
}

/**
 * La página de un proyecto propio: dónde va, qué le falta, y la única acción
 * que corresponde a su estado. Antes todo esto estaba apretado en una tarjeta
 * de la lista, con los botones al lado de proyectos que no eran ese.
 */
function Detalle({ id }: { id: string }) {
  const f = useFetchConSesion();
  const { p, cargando, error, recargar } = useProyectoPropio(id);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  if (cargando) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!p)
    return (
      <div className="space-y-3">
        <p className="mono text-xs text-[var(--solar)]">{error}</p>
        <Link href="/proyectos/mios" className="mono text-[11px] underline underline-offset-4">
          volver a mis proyectos
        </Link>
      </div>
    );

  const editable = EDITABLES.includes(p.estado);
  const pendientes = pendientesParaRevision(p);
  const docs = p.documentos ?? [];
  const fotos = p.imagenes ?? [];

  // La entrevista: cuánto va y si vale la pena seguirla.
  const proponente = p.proponente as ProponenteId;
  const respuestas = conTipo(p.tipo, p.respuestas ?? {});
  const avanceEntrevista = avance(proponente, respuestas);
  const faltanRespuestas = faltantes(proponente, respuestas).length;
  const entrevistaCompleta = !!p.intake_completo_at || faltanRespuestas === 0;
  const entrevistaEmpezada = Object.keys(p.respuestas ?? {}).length > 0;

  async function enviarARevision() {
    setErrorEnvio(null);
    setEnviando(true);
    try {
      const r = await f(`/api/proyectos/${p!.id}/revision`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo enviar");
      await recargar();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "Algo falló");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <CabeceraProyecto p={p} pestana="resumen" />

      <div className="border rule p-4">
        <Pasos pasos={TRAMOS_PROYECTO} actual={tramoDe(p.estado)} etiqueta="TRAMO" />
      </div>

      {/* La respuesta de la revisión, textual. */}
      {p.nota_revision && (
        <div className="border-l-2 border-[var(--solar)] pl-3 py-1">
          <p className="mono text-[10px] text-[var(--solar)]">LO QUE PEDIMOS AJUSTAR</p>
          <p className="mono text-[11px] mt-1 leading-relaxed">{p.nota_revision}</p>
        </div>
      )}

      {/* Qué sigue, y el botón que corresponde. */}
      <section className="border rule p-4 space-y-3">
        <p className="mono text-[11px] text-[var(--muted)]">QUÉ SIGUE</p>
        <p className="text-sm leading-relaxed">{QUE_SIGUE[p.estado] ?? ""}</p>

        {editable && pendientes.length > 0 && (
          <div className="mono text-[11px] text-[var(--muted)] leading-relaxed">
            Para mandarlo a revisión falta:
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {pendientes.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {p.estado === "borrador" && !entrevistaCompleta && (
            <Link
              href={`/proyectos/${p.id}/entrevista`}
              className={`mono text-[11px] px-3 py-1.5 ${
                entrevistaEmpezada
                  ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                  : "border rule hover:bg-[var(--petrol-2)]"
              }`}
            >
              {entrevistaEmpezada ? "CONTINUAR LA ENTREVISTA" : "empezar la entrevista"}
            </Link>
          )}
          {editable && (
            <Link
              href={`/proyectos/${p.id}/editar`}
              className="mono text-[11px] border rule px-3 py-1.5 hover:bg-[var(--petrol-2)]"
            >
              {pendientes.length ? "completar en el formulario" : "editar"}
            </Link>
          )}
          {editable && (
            <button
              type="button"
              onClick={enviarARevision}
              disabled={enviando || pendientes.length > 0}
              className="mono text-[11px] px-3 py-1.5 bg-[var(--solar)] text-[var(--petrol)] font-semibold disabled:opacity-40 disabled:bg-transparent disabled:text-[var(--muted)] disabled:border disabled:rule"
            >
              {enviando ? "enviando…" : "ENVIAR A REVISIÓN"}
            </button>
          )}
          {p.estado === "publicado" && (
            <Link
              href={`/proyecto/${p.id}`}
              className="mono text-[11px] border rule px-3 py-1.5 hover:bg-[var(--petrol-2)]"
            >
              ver la página pública
            </Link>
          )}
        </div>
        {errorEnvio && (
          <p className="mono text-[11px] text-[var(--solar)]" role="alert">{errorEnvio}</p>
        )}
      </section>

      {/* La entrevista, como una línea: cuánto va. */}
      <section className="border rule p-4 flex items-center gap-4">
        <div className="flex-1 space-y-1.5">
          <p className="mono text-[11px] text-[var(--muted)]">ENTREVISTA</p>
          <div className="h-0.5 bg-[var(--muted)]/25">
            <div
              className="h-full bg-[var(--solar)]"
              style={{ width: `${Math.round(avanceEntrevista * 100)}%` }}
            />
          </div>
          <p className="mono text-[10px] text-[var(--muted)]">
            {entrevistaCompleta
              ? "completa"
              : entrevistaEmpezada
                ? `faltan ${faltanRespuestas} respuestas`
                : "sin empezar"}
          </p>
        </div>
        {p.estado === "borrador" && (
          <Link
            href={`/proyectos/${p.id}/entrevista`}
            className="mono text-[11px] text-[var(--muted)] hover:text-[var(--bone)] shrink-0"
          >
            {entrevistaCompleta ? "releer" : "abrir →"}
          </Link>
        )}
      </section>

      {p.descripcion && (
        <section>
          <h3 className="mono text-[11px] text-[var(--muted)] mb-2">QUÉ SE VA A HACER</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line">{p.descripcion}</p>
        </section>
      )}

      <section>
        <h3 className="mono text-[11px] text-[var(--muted)] mb-1">FICHA</h3>
        <Fila k="tipo" v={etiquetaTipo(p.tipo)} />
        <Fila k="propone" v={etiquetaProponente(p.proponente)} />
        <Fila k="estado hoy" v={etiquetaEstadoObra(p.estado_obra) ?? "—"} />
        <Fila k="dónde" v={[p.barrio, p.direccion].filter(Boolean).join(" · ") || "—"} />
        <Fila k="área" v={p.area_m2 ? `${p.area_m2} m²` : "—"} />
        <Fila k="meta" v={p.meta_cop ? fmtCOP(p.meta_cop) : "—"} />
        <Fila k="recaudado" v={fmtCOP(p.recaudado_cop)} />
        <Fila k="plazo" v={p.plazo_meses ? `${p.plazo_meses} meses` : "—"} />
        <Fila k="régimen" v={p.regimen === "valores" ? "valores (fuera de alcance)" : "donación"} />
      </section>

      {p.estado_detalle && (
        <section>
          <h3 className="mono text-[11px] text-[var(--muted)] mb-2">EN QUÉ ESTADO ESTÁ HOY</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line">{p.estado_detalle}</p>
        </section>
      )}

      <section>
        <h3 className="mono text-[11px] text-[var(--muted)] mb-2">
          FOTOS · {fotos.length || "ninguna"}
        </h3>
        {fotos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {fotos.map((url) => (
              <Image
                key={url}
                src={url}
                alt=""
                width={240}
                height={160}
                className="w-full h-20 object-cover border rule"
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mono text-[11px] text-[var(--muted)] mb-1">
          SOPORTES · {docs.length || "ninguno"}
        </h3>
        {docs.map((d) => (
          <Fila
            key={d.ruta}
            k={etiquetaDocumento(d.tipo)}
            v={
              <>
                {d.nombre} <span className="text-[var(--muted)]">· {pesoLegible(d.bytes)}</span>
              </>
            }
          />
        ))}
        <p className="mono text-[10px] text-[var(--muted)] mt-2 leading-relaxed">
          Los soportes solo los ve quien revisa. No se publican.
        </p>
      </section>

      <Evaluacion
        proyectoId={p.id}
        puedeEvaluar={entrevistaCompleta && p.regimen !== "valores"}
        motivo={
          p.regimen === "valores"
            ? "Esta propuesta ofrece retorno y queda fuera del régimen de donación."
            : "La rúbrica necesita la entrevista completa."
        }
      />
    </div>
  );
}

export default function PaginaProyecto() {
  const { id } = useParams<{ id: string }>();
  return (
    <ConSesion mensaje="Para ver una propuesta tuya hace falta entrar a tu cuenta.">
      <Detalle id={id} />
    </ConSesion>
  );
}
