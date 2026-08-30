"use client";

/**
 * Las estadísticas de barrio como tabla.
 *
 * Antes la herramienta devolvía el JSON entero y el modelo lo transcribía en
 * prosa: veinte filas convertidas en párrafo se leen mal, cuestan tokens de
 * salida (los caros) y los números quedan sin alinear. Ahora los datos van por
 * su propio evento y el modelo solo comenta lo que aquí se ve.
 */

import { useState } from "react";
import { fmtCOP, type BarrioStat } from "@/lib/types";

type Col = "barrio" | "median_cop" | "median_m2" | "n";

export default function TablaBarrios({ filas }: { filas: BarrioStat[] }) {
  const [orden, setOrden] = useState<Col>("median_m2");
  const [asc, setAsc] = useState(true);

  if (!filas.length) return null;
  const operacion = filas[0].operacion;

  const ordenadas = [...filas].sort((a, b) => {
    if (orden === "barrio")
      return (asc ? 1 : -1) * a.barrio.localeCompare(b.barrio, "es");
    const va = a[orden] as number | null;
    const vb = b[orden] as number | null;
    // Los barrios sin $/m² van al final en las dos direcciones: son ausencia
    // de dato, no un valor bajo, y arriba desplazarían a los que sí lo tienen.
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (asc ? 1 : -1) * (va - vb);
  });

  const th = (col: Col, label: string, alineado = "text-right") => (
    <th
      onClick={() => { orden === col ? setAsc(!asc) : (setOrden(col), setAsc(true)); }}
      className={`${alineado} font-normal pb-1.5 cursor-pointer hover:text-[var(--bone)] select-none`}
    >
      {label}
      {orden === col && <span className="ml-1">{asc ? "↑" : "↓"}</span>}
    </th>
  );

  return (
    <div className="border rule overflow-x-auto my-2">
      <table className="w-full mono text-[11px]">
        <caption className="text-left px-3 pt-2.5 pb-1 text-[var(--muted)]">
          {operacion === "venta" ? "VENTA" : "ARRIENDO"} · {filas.length} barrio
          {filas.length > 1 ? "s" : ""}
        </caption>
        <thead className="text-[var(--muted)]">
          <tr className="border-b rule">
            <th
              onClick={() => { orden === "barrio" ? setAsc(!asc) : (setOrden("barrio"), setAsc(true)); }}
              className="text-left font-normal pb-1.5 pl-3 cursor-pointer hover:text-[var(--bone)] select-none"
            >
              BARRIO{orden === "barrio" && <span className="ml-1">{asc ? "↑" : "↓"}</span>}
            </th>
            {th("median_cop", "MEDIANA")}
            {th("median_m2", "$/M²")}
            <th className="text-right font-normal pb-1.5 pr-3">N</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((b) => (
            <tr key={b.barrio} className="border-b rule last:border-0">
              <td className="py-1.5 pl-3 pr-2">{b.barrio}</td>
              {/* tabular-nums: sin eso las columnas de cifras bailan */}
              <td className="text-right tabular-nums px-2">{fmtCOP(b.median_cop)}</td>
              <td className="text-right tabular-nums px-2 text-[var(--muted)]">
                {b.median_m2 ? fmtCOP(b.median_m2) : "—"}
              </td>
              <td className="text-right tabular-nums pr-3 text-[var(--muted)]">{b.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
