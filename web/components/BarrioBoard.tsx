"use client";
import { useMemo, useState } from "react";
import { fmtCOP, type BarrioStat, type Operacion } from "@/lib/types";

type Columna = "barrio" | "n" | "median_cop" | "median_m2";
type Direccion = "asc" | "desc";

const COLUMNAS: { id: Columna; label: string; alinear: string }[] = [
  { id: "barrio", label: "BARRIO", alinear: "text-left" },
  { id: "n", label: "N", alinear: "text-right" },
  { id: "median_cop", label: "MEDIANA", alinear: "text-right" },
  { id: "median_m2", label: "$/m²", alinear: "text-right" },
];

export default function BarrioBoard({
  stats, op, seleccionados, onToggle, onLimpiar,
}: {
  stats: BarrioStat[];
  op: Operacion;
  seleccionados: string[];
  onToggle: (barrio: string) => void;
  onLimpiar: () => void;
}) {
  const [orden, setOrden] = useState<Columna>("n");
  const [dir, setDir] = useState<Direccion>("desc");
  const [buscar, setBuscar] = useState("");

  const filas = useMemo(() => {
    const base = stats
      .filter((s) => s.operacion === op)
      .filter((s) => s.barrio.toLowerCase().includes(buscar.toLowerCase().trim()));

    return [...base].sort((a, b) => {
      let cmp: number;
      if (orden === "barrio") {
        // localeCompare con 'es' para que las tildes y la ñ ordenen bien.
        cmp = a.barrio.localeCompare(b.barrio, "es");
      } else {
        // Los barrios sin $/m² van siempre al final, sin importar la dirección.
        const va = a[orden], vb = b[orden];
        if (va == null && vb == null) cmp = 0;
        else if (va == null) return 1;
        else if (vb == null) return -1;
        else cmp = va - vb;
      }
      return dir === "asc" ? cmp : -cmp;
    });
  }, [stats, op, orden, dir, buscar]);

  function ordenarPor(c: Columna) {
    if (c === orden) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrden(c);
      // Texto arranca A→Z; los números arrancan de mayor a menor, que es lo
      // que uno quiere ver primero en un ranking.
      setDir(c === "barrio" ? "asc" : "desc");
    }
  }

  const sel = new Set(seleccionados);

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Filtrar barrio…"
          className="mono text-[11px] bg-transparent border rule px-2 py-1.5 flex-1 min-w-0 placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--solar)]"
        />
        {!!seleccionados.length && (
          <button
            onClick={onLimpiar}
            className="mono text-[11px] border rule px-2 py-1.5 text-[var(--solar)] whitespace-nowrap"
          >
            {seleccionados.length} ✕
          </button>
        )}
      </div>

      {!filas.length ? (
        <p className="mono text-xs text-[var(--muted)] py-8">
          {stats.length ? "Ningún barrio coincide." : "Sin datos aún."}
        </p>
      ) : (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="mono w-full text-xs">
            <thead className="sticky top-0 bg-[var(--petrol)] z-10">
              <tr className="text-[var(--muted)] border-b rule">
                <th className="w-6" />
                {COLUMNAS.map((c) => (
                  <th key={c.id} className={`py-2 pr-3 font-normal ${c.alinear}`}>
                    <button
                      onClick={() => ordenarPor(c.id)}
                      aria-sort={
                        orden === c.id
                          ? dir === "asc" ? "ascending" : "descending"
                          : "none"
                      }
                      className={`hover:text-[var(--bone)] ${
                        orden === c.id ? "text-[var(--bone)]" : ""
                      }`}
                    >
                      {c.label}
                      {orden === c.id && (
                        <span className="text-[var(--solar)] ml-1">
                          {dir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => {
                const activo = sel.has(r.barrio);
                return (
                  <tr
                    key={r.barrio}
                    onClick={() => onToggle(r.barrio)}
                    className={`border-b rule cursor-pointer hover:bg-[var(--petrol-2)] ${
                      activo ? "text-[var(--solar)]" : ""
                    }`}
                  >
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => onToggle(r.barrio)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Filtrar por ${r.barrio}`}
                        className="accent-[var(--solar)] align-middle"
                      />
                    </td>
                    <td className="py-2 pr-3">{r.barrio}</td>
                    <td className="py-2 pr-3 text-right text-[var(--muted)]">{r.n}</td>
                    <td className="py-2 pr-3 text-right">{fmtCOP(r.median_cop)}</td>
                    <td className={`py-2 text-right ${activo ? "" : "text-[var(--alza)]"}`}>
                      {r.median_m2 ? fmtCOP(r.median_m2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
