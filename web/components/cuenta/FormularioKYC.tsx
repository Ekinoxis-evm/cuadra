"use client";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Pasos from "@/components/Pasos";
import Campo, { claseCampo } from "@/components/Campo";
import { RUTA_PUBLICAR } from "@/lib/proyectos";

/**
 * KYC mínimo, requisito para proponer un proyecto.
 *
 * El indicativo va en un campo aparte del número: guardarlos juntos en un texto
 * libre hace imposible validar por país o normalizar después. Colombia queda
 * por defecto.
 *
 * La pantalla dice antes de pedir nada qué se pide, para qué, quién lo ve y qué
 * pasa después. Un formulario de identidad sin ese contexto se lee como una
 * trampa y la gente lo abandona ahí mismo.
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
  { id: "CC", label: "Cédula de ciudadanía", detalle: "Documento colombiano de persona natural" },
  { id: "CE", label: "Cédula de extranjería", detalle: "Residente extranjero en Colombia" },
  { id: "NIT", label: "NIT", detalle: "Empresa, fundación o entidad. Sin el dígito de verificación" },
  { id: "PA", label: "Pasaporte", detalle: "Si no tienes documento colombiano" },
];

export default function FormularioKYC({
  onListo,
  onCancelar,
}: {
  onListo: () => void;
  onCancelar?: () => void;
}) {
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

  const detalleTipo = TIPOS.find((t) => t.id === tipo)?.detalle;

  return (
    <form onSubmit={enviar} className="max-w-lg space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Verificación de identidad</h3>
          <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
            Primer tramo para proponer un proyecto. Toma un minuto y se hace una
            sola vez.
          </p>
        </div>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="mono text-[11px] text-[var(--muted)] hover:text-[var(--bone)] shrink-0"
          >
            cancelar
          </button>
        )}
      </div>

      {/* La ruta completa, no solo este formulario: enseña que verificar no es
          el trámite final sino el primero de cuatro. */}
      <Pasos pasos={RUTA_PUBLICAR} actual={0} etiqueta="TRAMO" />

      <div className="border rule p-4 space-y-3 bg-[var(--petrol-2)]">
        <div>
          <p className="mono text-[10px] text-[var(--solar)]">QUÉ PEDIMOS Y PARA QUÉ</p>
          <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
            Documento, nombre y teléfono. Un proyecto recibe dinero de otras
            personas, así que tiene que haber alguien identificable respondiendo
            por él.
          </p>
        </div>
        <div>
          <p className="mono text-[10px] text-[var(--solar)]">QUIÉN LO VE</p>
          <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
            Solo el equipo que revisa. Tus datos no aparecen en la vitrina
            pública, y el número de documento no vuelve a mostrarse completo en
            pantalla una vez guardado.
          </p>
        </div>
        <div>
          <p className="mono text-[10px] text-[var(--solar)]">QUÉ PASA DESPUÉS</p>
          <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
            Queda en <strong className="text-[var(--bone)]">pendiente</strong>.
            Con eso ya puedes preparar tu propuesta; la aprobación hace falta
            para que salga a la vitrina y reciba aportes.
          </p>
        </div>
      </div>

      <div>
        <span className="mono text-[10px] text-[var(--muted)]">TIPO DE DOCUMENTO</span>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {TIPOS.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTipo(t.id)}
              aria-pressed={tipo === t.id}
              className={`mono text-[11px] border rule px-3 py-1.5 ${
                tipo === t.id
                  ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                  : "text-[var(--muted)] hover:text-[var(--bone)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mono text-[11px] text-[var(--muted)] mt-2">{detalleTipo}</p>
      </div>

      <Campo
        etiqueta="NÚMERO DE DOCUMENTO"
        ayuda="Solo dígitos, sin puntos ni comas. Un mismo documento no puede estar en dos cuentas."
      >
        <input
          value={documento}
          onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ""))}
          required
          inputMode="numeric"
          placeholder="1234567890"
          className={claseCampo}
        />
      </Campo>

      <div>
        <p className="mono text-[10px] text-[var(--muted)]">
          NOMBRE COMPLETO
        </p>
        <p className="mono text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
          Como aparece en el documento. Si registras un NIT, el nombre del
          representante legal.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-1">
          <label className="block">
            <span className="mono text-[10px] text-[var(--muted)]">NOMBRE</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoComplete="given-name"
              className={claseCampo}
            />
          </label>
          <label className="block">
            <span className="mono text-[10px] text-[var(--muted)]">APELLIDO</span>
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              required
              autoComplete="family-name"
              className={claseCampo}
            />
          </label>
        </div>
      </div>

      <div>
        <p className="mono text-[10px] text-[var(--muted)]">TELÉFONO</p>
        <p className="mono text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
          Por aquí te escribimos si falta algo en la verificación o en tu
          propuesta. No se publica.
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-3 mt-1">
          <label className="block">
            <span className="mono text-[10px] text-[var(--muted)]">INDICATIVO</span>
            <select
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              className={claseCampo}
            >
              {INDICATIVOS.map((i) => (
                <option key={i.code} value={i.code} className="bg-[var(--petrol)]">
                  {i.code} · {i.pais}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mono text-[10px] text-[var(--muted)]">NÚMERO</span>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
              required
              inputMode="tel"
              placeholder="3001234567"
              className={claseCampo}
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="mono text-[11px] text-[var(--solar)]" role="alert">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={enviando}
          className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold disabled:opacity-40"
        >
          {enviando ? "enviando…" : "ENVIAR Y SEGUIR"}
        </button>
        <p className="mono text-[10px] text-[var(--muted)] mt-2">
          Siguiente tramo: describir el proyecto.
        </p>
      </div>
    </form>
  );
}
