"use client";
import { abreviarDireccion, formatearUnidades, urlTx } from "@/lib/activos";
import type { Movimiento } from "@/app/api/wallet/historial/route";

/** Los movimientos, más recientes primero. Entradas y salidas en la misma lista. */
export default function Historial({
  movimientos,
  cargando,
}: {
  movimientos: Movimiento[] | null;
  cargando: boolean;
}) {
  if (cargando && !movimientos)
    return <p className="mono text-xs text-[var(--muted)] py-2">···</p>;

  if (!movimientos?.length)
    return (
      <p className="mono text-xs text-[var(--muted)] py-2 leading-relaxed">
        Sin movimientos todavía. Aquí aparece lo que entra y lo que sale.
      </p>
    );

  return (
    <ul className="border rule divide-y divide-[color-mix(in_srgb,var(--muted)_35%,transparent)]">
      {movimientos.map((m) => {
        const salida = m.direccion === "salida";
        return (
          <li key={`${m.hash}-${m.activoId}-${m.contraparte}`} className="flex items-center justify-between gap-4 px-3 py-3">
            <div className="min-w-0">
              <p className="mono text-xs">
                <span className={salida ? "text-[var(--muted)]" : "text-[var(--alza)]"}>
                  {salida ? "enviaste" : "recibiste"}
                </span>{" "}
                <span className="text-[var(--muted)]">
                  {salida ? "a" : "de"} {m.contraparte ? abreviarDireccion(m.contraparte) : "—"}
                </span>
              </p>
              <a
                href={urlTx(m.chainId, m.hash)}
                target="_blank"
                rel="noreferrer"
                className="mono text-[10px] text-[var(--muted)] hover:text-[var(--solar)]"
              >
                {new Date(m.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })} · ver →
              </a>
            </div>
            <p className={`mono text-sm text-right tabular-nums shrink-0 ${salida ? "" : "text-[var(--alza)]"}`}>
              {salida ? "−" : "+"}{formatearUnidades(BigInt(m.bruto), m.decimales)}{" "}
              <span className="mono text-[10px] text-[var(--muted)]">{m.simbolo}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
