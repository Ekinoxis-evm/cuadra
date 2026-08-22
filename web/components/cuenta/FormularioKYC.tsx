"use client";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

/**
 * KYC mínimo, requisito para proponer un proyecto.
 *
 * El indicativo va en un campo aparte del número, como pediste: guardarlos
 * juntos en un texto libre hace imposible validar por país o normalizar
 * después. Colombia queda por defecto.
 */
const INDICATIVOS = [
  { code: "+57", pais: "Colombia" },
  { code: "+1", pais: "EE. UU. / Canadá" },
  { code: "+52", pais: "México" },
  { code: "+34", pais: "España" },
  { code: "+51", pais: "Perú" },
  { code: "+56", pais: "Chile" },
  { code: "+593", pais: "Ecuador" },
  { code: "+58", pais: "Venezuela" },
];

const TIPOS = [
  { id: "CC", label: "Cédula de ciudadanía" },
  { id: "CE", label: "Cédula de extranjería" },
  { id: "NIT", label: "NIT (empresa)" },
  { id: "PA", label: "Pasaporte" },
];

export default function FormularioKYC({ onListo }: { onListo: () => void }) {
  const { getAccessToken } = usePrivy();
  const [tipo, setTipo] = useState("CC");
  const [documento, setDocumento] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [pais, setPais] = useState("+57");
  const [numero, setNumero] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const token = await getAccessToken();
      const r = await fetch("/api/kyc", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_documento: tipo,
          documento,
          nombre,
          apellido,
          telefono_pais: pais,
          telefono_numero: numero,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo enviar");
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
        <h3 className="font-semibold">Verificación de identidad</h3>
        <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
          Hace falta para proponer un proyecto, porque implica recibir dinero de
          otras personas. Tus datos no se muestran en la vitrina pública.
        </p>
      </div>

      <div className="grid sm:grid-cols-[1fr_1.3fr] gap-3">
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">TIPO</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id} className="bg-[var(--petrol)]">
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">NÚMERO DE DOCUMENTO</span>
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ""))}
            required
            inputMode="numeric"
            placeholder="1234567890"
            className={campo}
          />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">NOMBRE</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
            autoComplete="given-name" className={campo} />
        </label>
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">APELLIDO</span>
          <input value={apellido} onChange={(e) => setApellido(e.target.value)} required
            autoComplete="family-name" className={campo} />
        </label>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">INDICATIVO</span>
          <select value={pais} onChange={(e) => setPais(e.target.value)} className={campo}>
            {INDICATIVOS.map((i) => (
              <option key={i.code} value={i.code} className="bg-[var(--petrol)]">
                {i.code} · {i.pais}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mono text-[10px] text-[var(--muted)]">TELÉFONO</span>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
            required
            inputMode="tel"
            placeholder="3001234567"
            className={campo}
          />
        </label>
      </div>

      {error && <p className="mono text-[11px] text-[var(--solar)]" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold disabled:opacity-40"
      >
        {enviando ? "enviando…" : "ENVIAR VERIFICACIÓN"}
      </button>
    </form>
  );
}
