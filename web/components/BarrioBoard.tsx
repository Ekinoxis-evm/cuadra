"use client";
import { fmtCOP, type BarrioStat, type Operacion } from "@/lib/types";

export default function BarrioBoard({
  stats, op, selected, onSelect,
}: {
  stats: BarrioStat[];
  op: Operacion;
  selected: string | null;
  onSelect: (b: string | null) => void;
}) {
  const rows = stats.filter((s) => s.operacion === op).sort((a, b) => b.n - a.n);
  if (!rows.length)
    return (
      <p className="mono text-xs text-[var(--muted)] py-8">
        Sin datos aún. Corre el scraper y sincroniza con Supabase.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="mono w-full text-xs">
        <thead>
          <tr className="text-[var(--muted)] text-left border-b rule">
            <th className="py-2 pr-4 font-normal">BARRIO</th>
            <th className="py-2 pr-4 font-normal text-right">N</th>
            <th className="py-2 pr-4 font-normal text-right">MEDIANA</th>
            <th className="py-2 font-normal text-right">$/m²</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.barrio}
              onClick={() => onSelect(selected === r.barrio ? null : r.barrio)}
              className={`border-b rule cursor-pointer hover:bg-[var(--petrol-2)] ${
                selected === r.barrio ? "text-[var(--solar)]" : ""
              }`}
            >
              <td className="py-2 pr-4">{r.barrio}</td>
              <td className="py-2 pr-4 text-right text-[var(--muted)]">{r.n}</td>
              <td className="py-2 pr-4 text-right">{fmtCOP(r.median_cop)}</td>
              <td className="py-2 text-right text-[var(--alza)]">
                {r.median_m2 ? fmtCOP(r.median_m2) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
