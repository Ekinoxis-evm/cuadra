"use client";
import { useState } from "react";
import { usePrivy, useWallets, useFundWallet } from "@privy-io/react-auth";

/**
 * Fondeo de la wallet del usuario.
 *
 * Los tres métodos salen del mismo hook: `defaultFundingMethod` salta el paso de
 * selección y abre directo el flujo pedido. Privy soporta 'card' | 'exchange' |
 * 'wallet' | 'manual'; usamos los tres primeros.
 *
 * Requiere tener card/exchange habilitados en dashboard.privy.io > Funding.
 * Si no están activos, el modal abre pero sin opciones disponibles.
 */
const METODOS = [
  {
    id: "card" as const,
    titulo: "Tarjeta",
    detalle: "Débito, crédito, Apple Pay o Google Pay. Sin fees ni mínimos.",
  },
  {
    id: "exchange" as const,
    titulo: "Exchange",
    detalle: "Transfiere desde Coinbase, Binance u otro exchange.",
  },
  {
    id: "wallet" as const,
    titulo: "Depósito cripto",
    detalle: "Envía desde otra wallet a tu dirección de depósito.",
  },
];

export default function Wallet() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet();
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La embedded wallet de Privy es la que fondeamos; si el usuario entró con una
  // wallet externa, usamos esa.
  const direccion = user?.wallet?.address ?? wallets[0]?.address ?? null;

  async function fondear(metodo: (typeof METODOS)[number]["id"]) {
    if (!direccion) return;
    setError(null);
    setAbriendo(metodo);
    try {
      await fundWallet(direccion, { defaultFundingMethod: metodo });
    } catch (e) {
      // El usuario cerrando el modal también cae acá; no es un fallo real.
      setError(e instanceof Error ? e.message : "No se pudo abrir el fondeo");
    } finally {
      setAbriendo(null);
    }
  }

  if (!ready) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!authenticated)
    return <p className="mono text-xs text-[var(--muted)]">Entra para ver tu wallet.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="mono text-[11px] text-[var(--muted)] mb-2">TU WALLET</h2>
        {direccion ? (
          <p className="mono text-xs break-all border rule px-3 py-2.5">{direccion}</p>
        ) : (
          <p className="mono text-xs text-[var(--muted)]">
            Todavía no tienes wallet. Se crea sola al entrar con correo o Google.
          </p>
        )}
      </div>

      <div>
        <h2 className="mono text-[11px] text-[var(--muted)] mb-2">AGREGAR FONDOS</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {METODOS.map((m) => (
            <button
              key={m.id}
              onClick={() => fondear(m.id)}
              disabled={!direccion || abriendo !== null}
              className="border rule p-4 text-left hover:bg-[var(--petrol-2)] disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <p className="mono text-xs font-semibold">
                {abriendo === m.id ? "abriendo…" : m.titulo}
              </p>
              <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
                {m.detalle}
              </p>
            </button>
          ))}
        </div>
        {error && (
          <p className="mono text-[11px] text-[var(--solar)] mt-3" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
