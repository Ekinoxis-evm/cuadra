"use client";
import { useState } from "react";
import { useFundWallet } from "@privy-io/react-auth";

/**
 * Fondear: los caminos para meter plata, uno por fila y con lo que implica
 * cada uno. Los tres primeros los abre Privy (hay que tenerlos habilitados en
 * dashboard.privy.io › Funding); el último es recibir desde otra wallet, que
 * no necesita a nadie en el medio.
 */
const METODOS = [
  {
    id: "card" as const,
    titulo: "Tarjeta",
    detalle: "Débito o crédito, Apple Pay o Google Pay. Llega en minutos; el proveedor cobra comisión.",
  },
  {
    id: "exchange" as const,
    titulo: "Desde un exchange",
    detalle: "Transfiere desde Coinbase, Binance u otro donde ya tengas saldo.",
  },
  {
    id: "wallet" as const,
    titulo: "Desde otra wallet",
    detalle: "Conecta una wallet externa y envía a esta.",
  },
];

export default function Fondear({
  direccion,
  onRecibir,
  onFondeado,
}: {
  direccion: string;
  /** Abrir la pantalla de recibir, para el depósito manual. */
  onRecibir: () => void;
  onFondeado: () => void;
}) {
  const { fundWallet } = useFundWallet();
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function abrir(metodo: (typeof METODOS)[number]["id"]) {
    setError(null);
    setAbriendo(metodo);
    try {
      await fundWallet(direccion, { defaultFundingMethod: metodo });
      onFondeado();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo abrir";
      setError(
        /not enabled|disabled|unavailable|no funding/i.test(msg)
          ? "Este método no está disponible todavía. Prueba otro o recibe desde otra wallet."
          : msg,
      );
    } finally {
      setAbriendo(null);
    }
  }

  return (
    <div className="space-y-3">
      {METODOS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => abrir(m.id)}
          disabled={abriendo !== null}
          className="w-full text-left border rule p-4 hover:bg-[var(--petrol-2)] disabled:opacity-40"
        >
          <p className="mono text-xs font-semibold">{abriendo === m.id ? "abriendo…" : m.titulo}</p>
          <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">{m.detalle}</p>
        </button>
      ))}
      <button
        type="button"
        onClick={onRecibir}
        className="w-full text-left border rule p-4 hover:bg-[var(--petrol-2)]"
      >
        <p className="mono text-xs font-semibold">Depósito directo</p>
        <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
          Muestra tu QR y tu dirección para que te envíen desde donde sea.
        </p>
      </button>
      {error && <p className="mono text-[11px] text-[var(--solar)]" role="alert">{error}</p>}
    </div>
  );
}
