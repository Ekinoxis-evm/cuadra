"use client";

/**
 * Indicador de progreso, compartido por todo lo que tenga varios tramos:
 * el formulario de proyecto, la verificación de identidad y la ruta completa
 * hasta publicar.
 *
 * Antes cada pantalla era una hoja suelta y no había forma de saber cuántas
 * faltaban ni por qué estabas ahí. La regla aquí: siempre se ve dónde estás,
 * qué queda hecho y cuánto falta.
 */

export interface Paso {
  id: string;
  titulo: string;
  /** Qué pasa en ese tramo, en una línea. Solo se muestra el del paso actual. */
  nota?: string;
}

export default function Pasos({
  pasos,
  actual,
  onIr,
  etiqueta = "PASO",
}: {
  pasos: Paso[];
  /** Índice del paso en curso. Igual a pasos.length significa "todo hecho". */
  actual: number;
  /** Si se pasa, los pasos ya completados son clicables para volver atrás. */
  onIr?: (i: number) => void;
  etiqueta?: string;
}) {
  const total = pasos.length;
  const hechos = Math.min(actual, total);
  const pct = (hechos / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="mono text-[10px] text-[var(--muted)]">
          {actual >= total ? (
            <span className="text-[var(--alza)]">COMPLETO</span>
          ) : (
            <>
              {etiqueta} {actual + 1} DE {total} ·{" "}
              <span className="text-[var(--bone)]">{pasos[actual]?.titulo}</span>
            </>
          )}
        </p>
        <p className="mono text-[10px] text-[var(--muted)] tabular-nums">
          {Math.round(pct)}%
        </p>
      </div>

      {/* Barra: la señal de "cuánto falta" que el número solo no da. */}
      <div
        className="h-0.5 bg-[var(--muted)]/25"
        role="progressbar"
        aria-valuenow={hechos}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${etiqueta.toLowerCase()} ${hechos} de ${total}`}
      >
        <div
          className="h-full bg-[var(--solar)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="flex gap-1 overflow-x-auto pb-0.5">
        {pasos.map((p, i) => {
          const hecho = i < actual;
          const aqui = i === actual;
          const clicable = !!onIr && hecho;
          const Etiqueta = clicable ? "button" : "div";
          return (
            <li key={p.id} className="flex-1 min-w-[92px]">
              <Etiqueta
                {...(clicable
                  ? { type: "button" as const, onClick: () => onIr!(i) }
                  : {})}
                aria-current={aqui ? "step" : undefined}
                className={`w-full text-left border-t-2 pt-2 transition-colors ${
                  aqui
                    ? "border-[var(--solar)]"
                    : hecho
                      ? "border-[var(--alza)]"
                      : "border-[var(--muted)]/25"
                } ${clicable ? "cursor-pointer hover:opacity-80" : ""}`}
              >
                <span
                  className={`mono text-[10px] block ${
                    aqui
                      ? "text-[var(--solar)]"
                      : hecho
                        ? "text-[var(--alza)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {hecho ? "✓" : String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`mono text-[10px] block leading-tight mt-0.5 ${
                    aqui ? "text-[var(--bone)]" : "text-[var(--muted)]"
                  }`}
                >
                  {p.titulo}
                </span>
              </Etiqueta>
            </li>
          );
        })}
      </ol>

      {pasos[actual]?.nota && (
        <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
          {pasos[actual].nota}
        </p>
      )}
    </div>
  );
}
