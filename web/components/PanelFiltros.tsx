"use client";
import { fmtCOP } from "@/lib/types";
import type { Filtros } from "@/lib/filtros";
import { AMENIDADES_COMUNES, TIPOS, ESTRATOS } from "@/lib/filtros";

/** Grupo de botones tipo "cualquiera / 1+ / 2+ / 3+". */
function Minimos({
  label, valor, opciones, onChange, sufijo = "+",
}: {
  label: string;
  valor: number | null;
  opciones: number[];
  onChange: (v: number | null) => void;
  sufijo?: string;
}) {
  return (
    <div>
      <p className="mono text-[10px] text-[var(--muted)] mb-1.5">{label}</p>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(null)}
          className={`mono text-[11px] border rule px-2 py-1 ${
            valor === null ? "bg-[var(--petrol-2)] text-[var(--bone)]" : "text-[var(--muted)]"
          }`}
        >
          —
        </button>
        {opciones.map((o) => (
          <button
            key={o}
            onClick={() => onChange(valor === o ? null : o)}
            className={`mono text-[11px] border rule px-2 py-1 ${
              valor === o
                ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                : "text-[var(--muted)] hover:text-[var(--bone)]"
            }`}
          >
            {o}{sufijo}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PanelFiltros({
  filtros, setFiltros, limites, nResultados, onLimpiar,
}: {
  filtros: Filtros;
  setFiltros: (f: Partial<Filtros>) => void;
  /** Rango real de precios de la operación actual, para acotar el slider. */
  limites: { min: number; max: number };
  nResultados: number;
  onLimpiar: () => void;
}) {
  const precioMin = filtros.precioMin ?? limites.min;
  const precioMax = filtros.precioMax ?? limites.max;

  // Escala logarítmica: los precios van de ~$300k a ~$15.000M, y en escala
  // lineal el 95% del recorrido del slider quedaría en el tramo alto e inútil.
  const aPos = (v: number) =>
    ((Math.log(v) - Math.log(limites.min)) /
      (Math.log(limites.max) - Math.log(limites.min))) * 100;
  const aValor = (p: number) =>
    Math.round(
      Math.exp(
        Math.log(limites.min) + (p / 100) * (Math.log(limites.max) - Math.log(limites.min)),
      ),
    );

  const activos =
    filtros.barrios.length + filtros.estratos.length + filtros.tipos.length +
    filtros.amenidades.length +
    [filtros.precioMin, filtros.precioMax, filtros.habsMin, filtros.banosMin,
     filtros.areaMin, filtros.parqueaderosMin].filter((v) => v != null).length +
    (filtros.texto ? 1 : 0);

  return (
    <div className="space-y-5 border rule p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="mono text-[11px] text-[var(--muted)]">
          {nResultados} resultado{nResultados === 1 ? "" : "s"}
          {activos > 0 && ` · ${activos} filtro${activos === 1 ? "" : "s"}`}
        </p>
        {activos > 0 && (
          <button onClick={onLimpiar} className="mono text-[11px] text-[var(--solar)]">
            limpiar todo
          </button>
        )}
      </div>

      <input
        value={filtros.texto}
        onChange={(e) => setFiltros({ texto: e.target.value })}
        placeholder="Buscar: amoblado, remodelado, vista…"
        className="mono text-xs bg-transparent border rule px-3 py-2 w-full placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--solar)]"
      />

      {/* ---- precio: dos sliders superpuestos ---- */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="mono text-[10px] text-[var(--muted)]">PRECIO</p>
          <p className="mono text-[11px]">
            {fmtCOP(precioMin)} – {fmtCOP(precioMax)}
          </p>
        </div>
        <div className="relative h-6">
          {/* riel */}
          <div className="absolute top-1/2 -translate-y-1/2 w-full h-px bg-[var(--muted)]/40" />
          {/* tramo seleccionado */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-[var(--solar)]"
            style={{ left: `${aPos(precioMin)}%`, right: `${100 - aPos(precioMax)}%` }}
          />
          <input
            type="range" min={0} max={100} step={0.5} value={aPos(precioMin)}
            aria-label="Precio mínimo"
            onChange={(e) => {
              const v = aValor(Number(e.target.value));
              setFiltros({ precioMin: Math.min(v, precioMax) });
            }}
            className="slider absolute w-full"
          />
          <input
            type="range" min={0} max={100} step={0.5} value={aPos(precioMax)}
            aria-label="Precio máximo"
            onChange={(e) => {
              const v = aValor(Number(e.target.value));
              setFiltros({ precioMax: Math.max(v, precioMin) });
            }}
            className="slider absolute w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Minimos label="HABITACIONES" valor={filtros.habsMin} opciones={[1, 2, 3, 4]}
          onChange={(v) => setFiltros({ habsMin: v })} />
        <Minimos label="BAÑOS" valor={filtros.banosMin} opciones={[1, 2, 3]}
          onChange={(v) => setFiltros({ banosMin: v })} />
        <Minimos label="PARQUEADEROS" valor={filtros.parqueaderosMin} opciones={[1, 2, 3]}
          onChange={(v) => setFiltros({ parqueaderosMin: v })} />
        <Minimos label="ÁREA m²" valor={filtros.areaMin} opciones={[50, 80, 120, 200]}
          onChange={(v) => setFiltros({ areaMin: v })} sufijo="+" />
      </div>

      <div>
        <p className="mono text-[10px] text-[var(--muted)] mb-1.5">TIPO</p>
        <div className="flex gap-1">
          {TIPOS.map((t) => {
            const on = filtros.tipos.includes(t);
            return (
              <button
                key={t}
                onClick={() =>
                  setFiltros({
                    tipos: on ? filtros.tipos.filter((x) => x !== t) : [...filtros.tipos, t],
                  })
                }
                className={`mono text-[11px] border rule px-2 py-1 capitalize ${
                  on ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold" : "text-[var(--muted)]"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mono text-[10px] text-[var(--muted)] mb-1.5">ESTRATO</p>
        <div className="flex gap-1">
          {ESTRATOS.map((e) => {
            const on = filtros.estratos.includes(e);
            return (
              <button
                key={e}
                onClick={() =>
                  setFiltros({
                    estratos: on
                      ? filtros.estratos.filter((x) => x !== e)
                      : [...filtros.estratos, e],
                  })
                }
                className={`mono text-[11px] border rule w-7 py-1 ${
                  on ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold" : "text-[var(--muted)]"
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mono text-[10px] text-[var(--muted)] mb-1.5">AMENIDADES</p>
        <div className="flex flex-wrap gap-1">
          {AMENIDADES_COMUNES.map((a) => {
            const on = filtros.amenidades.includes(a);
            return (
              <button
                key={a}
                onClick={() =>
                  setFiltros({
                    amenidades: on
                      ? filtros.amenidades.filter((x) => x !== a)
                      : [...filtros.amenidades, a],
                  })
                }
                className={`mono text-[10px] border rule px-2 py-1 ${
                  on ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold" : "text-[var(--muted)] hover:text-[var(--bone)]"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        /* Sliders superpuestos: el riel no debe capturar el mouse, solo los
           pulgares, o el de arriba bloquearía al de abajo. */
        .slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          pointer-events: none;
          height: 24px;
          margin: 0;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          pointer-events: auto;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--solar);
          border: 2px solid var(--petrol);
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          pointer-events: auto;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--solar);
          border: 2px solid var(--petrol);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
