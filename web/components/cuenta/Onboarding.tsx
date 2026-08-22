"use client";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Esfera from "@/components/Esfera";

/**
 * Onboarding: lo mínimo para que el asistente pueda arrancar la conversación
 * sabiendo a quién le habla y qué busca. Dos pasos y nada más — cada campo
 * extra aquí es gente que abandona.
 */
const INTERESES = [
  { id: "arriendo", titulo: "Arrendar", detalle: "Busco dónde vivir" },
  { id: "compra", titulo: "Comprar", detalle: "Busco inmueble para adquirir" },
  {
    id: "proyectos",
    titulo: "Proyectos tokenizados",
    detalle: "Invertir en o proponer proyectos de vivienda",
  },
];

export default function Onboarding({ onListo }: { onListo: () => void }) {
  const { getAccessToken } = usePrivy();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const token = await getAccessToken();
      const r = await fetch("/api/perfil", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, apellido, intereses: sel }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo guardar");
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="max-w-lg mx-auto py-12 space-y-8">
      <div className="flex flex-col items-center text-center gap-4">
        <Esfera estado="reposo" size={96} />
        <div>
          <h2 className="text-xl font-semibold">Antes de empezar</h2>
          <p className="mono text-xs text-[var(--muted)] mt-1.5">
            Dos datos y ya. Sirven para que el asistente sepa qué mostrarte.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">NOMBRE</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoComplete="given-name"
            className="mono text-xs bg-transparent border rule px-3 py-2.5 w-full mt-1 focus:outline-none focus:border-[var(--solar)]"
          />
        </label>
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">APELLIDO</span>
          <input
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            autoComplete="family-name"
            className="mono text-xs bg-transparent border rule px-3 py-2.5 w-full mt-1 focus:outline-none focus:border-[var(--solar)]"
          />
        </label>
      </div>

      <div>
        <span className="mono text-[10px] text-[var(--muted)]">
          ¿QUÉ TE INTERESA? (puedes escoger varios)
        </span>
        <div className="space-y-2 mt-2">
          {INTERESES.map((i) => {
            const on = sel.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                onClick={() => toggle(i.id)}
                aria-pressed={on}
                className={`border rule p-3 w-full text-left flex items-start gap-3 ${
                  on ? "border-[var(--solar)] bg-[var(--petrol-2)]" : "hover:bg-[var(--petrol-2)]"
                }`}
              >
                <span className={`mono text-xs mt-0.5 ${on ? "text-[var(--solar)]" : "text-[var(--muted)]"}`}>
                  {on ? "◉" : "○"}
                </span>
                <span>
                  <span className="block text-sm font-medium">{i.titulo}</span>
                  <span className="mono text-[11px] text-[var(--muted)]">{i.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mono text-[11px] text-[var(--solar)]" role="alert">{error}</p>
      )}

      <button
        type="submit"
        disabled={guardando || !nombre.trim() || !sel.length}
        className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold w-full disabled:opacity-40 disabled:bg-transparent disabled:text-[var(--muted)] disabled:border disabled:rule"
      >
        {guardando ? "guardando…" : "EMPEZAR"}
      </button>
    </form>
  );
}
