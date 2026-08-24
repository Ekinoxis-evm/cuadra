"use client";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { fmtCOP } from "@/lib/types";

const TIPOS = [
  { id: "reconstruccion", titulo: "Reconstrucción", detalle: "Arreglar o mejorar una vivienda que ya existe" },
  { id: "nuevo", titulo: "Proyecto nuevo", detalle: "Levantar vivienda desde cero" },
];

const PROPONENTES = [
  { id: "persona", label: "Persona" },
  { id: "empresa", label: "Empresa" },
  { id: "gobierno", label: "Entidad pública" },
];

export default function FormularioProyecto({ onListo }: { onListo: () => void }) {
  const { getAccessToken } = usePrivy();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("reconstruccion");
  const [proponente, setProponente] = useState("persona");
  const [barrio, setBarrio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [meta, setMeta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const token = await getAccessToken();
      const r = await fetch("/api/proyectos", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo, descripcion, tipo, proponente, barrio, direccion,
          meta_cop: Number(meta),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo crear");
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "mono text-xs bg-transparent border rule px-3 py-2.5 w-full mt-1 focus:outline-none focus:border-[var(--solar)]";

  return (
    <form onSubmit={enviar} className="max-w-lg space-y-5">
      <div>
        <h3 className="font-semibold">Nuevo proyecto</h3>
        <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
          Queda como borrador. Sale a la vitrina pública solo después de la
          revisión, y hasta entonces no recibe aportes.
        </p>
      </div>

      <label className="block">
        <span className="mono text-[10px] text-[var(--muted)]">TÍTULO</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required
          minLength={6} placeholder="Reconstrucción de vivienda en El Retiro" className={campo} />
      </label>

      <div>
        <span className="mono text-[10px] text-[var(--muted)]">TIPO</span>
        <div className="space-y-2 mt-1">
          {TIPOS.map((t) => (
            <button type="button" key={t.id} onClick={() => setTipo(t.id)}
              aria-pressed={tipo === t.id}
              className={`border rule p-3 w-full text-left flex items-start gap-3 ${
                tipo === t.id ? "border-[var(--solar)] bg-[var(--petrol-2)]" : "hover:bg-[var(--petrol-2)]"
              }`}>
              <span className={`mono text-xs mt-0.5 ${tipo === t.id ? "text-[var(--solar)]" : "text-[var(--muted)]"}`}>
                {tipo === t.id ? "◉" : "○"}
              </span>
              <span>
                <span className="block text-sm font-medium">{t.titulo}</span>
                <span className="mono text-[11px] text-[var(--muted)]">{t.detalle}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mono text-[10px] text-[var(--muted)]">QUIÉN PROPONE</span>
        <div className="flex gap-1 mt-1">
          {PROPONENTES.map((p) => (
            <button type="button" key={p.id} onClick={() => setProponente(p.id)}
              className={`mono text-[11px] border rule px-3 py-1.5 ${
                proponente === p.id
                  ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                  : "text-[var(--muted)] hover:text-[var(--bone)]"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mono text-[10px] text-[var(--muted)]">DESCRIPCIÓN</span>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          rows={4} placeholder="Qué se va a hacer, en qué estado está y para quién."
          className={`${campo} resize-y`} />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">BARRIO</span>
          <input value={barrio} onChange={(e) => setBarrio(e.target.value)} className={campo} />
        </label>
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">DIRECCIÓN</span>
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={campo} />
        </label>
      </div>

      <label className="block">
        <span className="mono text-[10px] text-[var(--muted)]">META DE RECAUDO (COP)</span>
        <input value={meta}
          onChange={(e) => setMeta(e.target.value.replace(/\D/g, ""))}
          required inputMode="numeric" placeholder="50000000" className={campo} />
        {meta && (
          <span className="mono text-[11px] text-[var(--alza)] mt-1 block">
            {fmtCOP(Number(meta))}
          </span>
        )}
      </label>

      {error && <p className="mono text-[11px] text-[var(--solar)]" role="alert">{error}</p>}

      <button type="submit" disabled={enviando}
        className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold disabled:opacity-40">
        {enviando ? "creando…" : "CREAR BORRADOR"}
      </button>
    </form>
  );
}
