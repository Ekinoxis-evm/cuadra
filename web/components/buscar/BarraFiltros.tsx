"use client";
import { useEffect, useState } from "react";
import type { Operacion } from "@/lib/types";
import { ORDENES, TIPOS, contarFiltros, limitesPrecio, type Orden } from "@/lib/filtros";
import type { Busqueda } from "@/lib/useBusqueda";
import PanelFiltros from "@/components/PanelFiltros";

const chip = (on: boolean) =>
  `mono text-[11px] border rule px-3 py-1.5 whitespace-nowrap ${
    on
      ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
      : "text-[var(--muted)] hover:text-[var(--bone)] hover:bg-[var(--petrol-2)]"
  }`;

/**
 * La barra de arriba: lo que más se usa queda a un toque (operación, texto,
 * tipo, habitaciones, orden) y el resto vive en el panel lateral. Antes todos
 * los filtros ocupaban una columna entera al lado de los resultados y
 * empujaban las tarjetas fuera de la pantalla.
 */
export default function BarraFiltros({ b }: { b: Busqueda }) {
  const { op, setOp, filtros, setFiltros, limpiar, total, cargando, fuentes, stats } = b;
  const [panel, setPanel] = useState(false);
  const n = contarFiltros(filtros);

  // El texto se escribe local y se manda con una pausa: cada tecla en la URL
  // sería una consulta a Supabase.
  const [texto, setTexto] = useState(filtros.texto);
  useEffect(() => setTexto(filtros.texto), [filtros.texto]);
  useEffect(() => {
    if (texto === filtros.texto) return;
    const t = setTimeout(() => setFiltros({ texto }), 400);
    return () => clearTimeout(t);
  }, [texto, filtros.texto, setFiltros]);

  // Esc cierra el panel.
  useEffect(() => {
    if (!panel) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setPanel(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [panel]);

  const barrios = stats
    .filter((s) => s.operacion === op)
    .map((s) => s.barrio)
    .sort((a, c) => a.localeCompare(c, "es"));

  return (
    <div className="border-b rule bg-[var(--petrol)]">
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto sin-barra">
        <div className="flex mono text-xs shrink-0">
          {(["arriendo", "venta"] as Operacion[]).map((o) => (
            <button
              key={o}
              onClick={() => setOp(o)}
              className={`px-3 py-1.5 border rule ${
                op === o
                  ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                  : "text-[var(--muted)] hover:text-[var(--bone)]"
              }`}
            >
              {o.toUpperCase()}
            </button>
          ))}
        </div>

        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="amoblado, vista, remodelado…"
          aria-label="Buscar por texto"
          className="mono text-xs bg-transparent border rule px-3 py-1.5 w-48 shrink-0 placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--solar)]"
        />

        <span className="w-px h-5 bg-[var(--muted)]/30 shrink-0" />

        {TIPOS.map((t) => {
          const on = filtros.tipos.includes(t);
          return (
            <button
              key={t}
              onClick={() =>
                setFiltros({ tipos: on ? filtros.tipos.filter((x) => x !== t) : [...filtros.tipos, t] })
              }
              className={`${chip(on)} capitalize`}
            >
              {t}
            </button>
          );
        })}

        {[1, 2, 3, 4].map((h) => (
          <button
            key={h}
            onClick={() => setFiltros({ habsMin: filtros.habsMin === h ? null : h })}
            className={chip(filtros.habsMin === h)}
          >
            {h}+ hab
          </button>
        ))}

        <button onClick={() => setPanel(true)} className={`${chip(n > 0)} ml-1`}>
          Filtros{n > 0 ? ` · ${n}` : ""}
        </button>

        <span className="ml-auto mono text-[11px] text-[var(--muted)] whitespace-nowrap pl-3">
          {cargando ? "buscando…" : `${total.toLocaleString("es-CO")} resultados`}
        </span>
        <select
          value={filtros.orden}
          onChange={(e) => setFiltros({ orden: e.target.value as Orden })}
          aria-label="Ordenar"
          className="mono text-[11px] bg-transparent border rule px-2 py-1.5 shrink-0 focus:outline-none focus:border-[var(--solar)]"
        >
          {ORDENES.map((o) => (
            <option key={o.id} value={o.id} className="bg-[var(--petrol)]">{o.label}</option>
          ))}
        </select>
      </div>

      {panel && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true"
          aria-label="Filtros">
          <button className="absolute inset-0 bg-black/50" aria-label="Cerrar filtros"
            onClick={() => setPanel(false)} />
          <aside className="relative w-full max-w-md h-full overflow-y-auto bg-[var(--petrol)] border-l rule">
            <div className="flex items-center justify-between px-4 py-3 border-b rule sticky top-0 bg-[var(--petrol)] z-10">
              <p className="mono text-xs">FILTROS</p>
              <button onClick={() => setPanel(false)}
                className="mono text-xs text-[var(--muted)] hover:text-[var(--bone)]">cerrar ✕</button>
            </div>
            <PanelFiltros
              filtros={filtros}
              setFiltros={setFiltros}
              limites={limitesPrecio(op)}
              nResultados={total}
              fuentes={fuentes}
              barrios={barrios}
              onLimpiar={limpiar}
            />
            <div className="sticky bottom-0 bg-[var(--petrol)] border-t rule p-4">
              <button onClick={() => setPanel(false)}
                className="w-full mono text-xs bg-[var(--solar)] text-[var(--petrol)] font-semibold py-2.5">
                VER {total.toLocaleString("es-CO")} RESULTADOS
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
