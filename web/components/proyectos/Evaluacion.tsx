"use client";
import { useCallback, useEffect, useState } from "react";
import { BANDAS, type BandaId } from "@/lib/evaluacion";
import { useFetchConSesion } from "./datos";

interface Veredicto {
  puntaje: number;
  banda: BandaId;
  cobertura: number;
  ejes: { eje: string; puntaje: number; evaluable: boolean; sustento: string }[];
  senales: { gravedad: "alta" | "media" | "baja"; asunto: string; detalle: string }[];
  resumen: string | null;
  para_quien_propone: string | null;
  rubrica: number;
  creado_at: string;
}

/**
 * La rúbrica, vista por quien propone.
 *
 * La API existía y nadie la llamaba desde la interfaz: el proponente mandaba
 * a revisión y no había forma de saber qué diría la rúbrica hasta que un
 * revisor abriera la cola. Aquí se corre a mano y se lee el resultado en el
 * mismo sitio. Se muestra `para_quien_propone`, que es el texto escrito para
 * esta persona; el resto de la ficha es para la revisión.
 */
export default function Evaluacion({
  proyectoId,
  puedeEvaluar,
  motivo,
}: {
  proyectoId: string;
  /** La rúbrica exige la entrevista completa. */
  puedeEvaluar: boolean;
  /** Por qué no se puede, en una frase. */
  motivo?: string;
}) {
  const f = useFetchConSesion();
  const [v, setV] = useState<Veredicto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [evaluando, setEvaluando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await f(`/api/proyectos/${proyectoId}/evaluacion`);
    setV(r.ok ? ((await r.json()) as Veredicto | null) : null);
    setCargando(false);
  }, [f, proyectoId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function evaluar() {
    setError(null);
    setEvaluando(true);
    try {
      const r = await f(`/api/proyectos/${proyectoId}/evaluacion`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detalle ?? j.error ?? "No se pudo evaluar");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
    } finally {
      setEvaluando(false);
    }
  }

  const banda = v ? BANDAS.find((b) => b.id === v.banda) : null;

  return (
    <section className="border rule p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="mono text-[11px] text-[var(--muted)]">EVALUACIÓN</h3>
        {v && (
          <span className="mono text-[10px] text-[var(--muted)]">
            rúbrica v{v.rubrica} · {new Date(v.creado_at).toLocaleDateString("es-CO")}
          </span>
        )}
      </div>

      {cargando ? (
        <p className="mono text-xs text-[var(--muted)]">···</p>
      ) : v ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold tabular-nums">{v.puntaje}</span>
            <span
              className={`mono text-[11px] ${
                v.banda === "recomendado"
                  ? "text-[var(--alza)]"
                  : v.banda === "devuelto"
                    ? "text-[var(--solar)]"
                    : "text-[var(--bone)]"
              }`}
            >
              {banda?.titulo ?? v.banda}
            </span>
            <span className="mono text-[10px] text-[var(--muted)]">
              cobertura {Math.round(v.cobertura * 100)}%
            </span>
          </div>
          {v.para_quien_propone && (
            <p className="text-sm leading-relaxed">{v.para_quien_propone}</p>
          )}
          {v.senales.length > 0 && (
            <ul className="space-y-1.5">
              {v.senales.map((s, i) => (
                <li key={i} className="mono text-[11px] leading-relaxed">
                  <span
                    className={
                      s.gravedad === "alta" ? "text-[var(--solar)]" : "text-[var(--muted)]"
                    }
                  >
                    {s.gravedad.toUpperCase()} ·{" "}
                  </span>
                  <span>{s.asunto}</span>
                  <span className="text-[var(--muted)]"> — {s.detalle}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
          Todavía no se ha corrido la rúbrica sobre esta propuesta.
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button
          type="button"
          onClick={evaluar}
          disabled={!puedeEvaluar || evaluando}
          title={!puedeEvaluar ? motivo : undefined}
          className="mono text-[11px] border rule px-3 py-1.5 hover:bg-[var(--petrol-2)] disabled:opacity-40"
        >
          {evaluando ? "evaluando… (~30 s)" : v ? "volver a evaluar" : "correr la rúbrica"}
        </button>
        <p className="mono text-[10px] text-[var(--muted)] leading-relaxed">
          {puedeEvaluar
            ? "Usa créditos de tu cuenta. Cada corrida queda guardada."
            : motivo}
        </p>
      </div>

      {error && (
        <p className="mono text-[11px] text-[var(--solar)]" role="alert">{error}</p>
      )}
    </section>
  );
}
