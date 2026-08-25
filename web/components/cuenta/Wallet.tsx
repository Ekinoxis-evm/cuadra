"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy, useWallets, useFundWallet } from "@privy-io/react-auth";
import { ACTIVOS, formatearUnidades } from "@/lib/activos";
import EntrarCTA from "@/components/EntrarCTA";

/**
 * Wallet del usuario.
 *
 * Las cadenas son invisibles a propósito: hay una sola dirección — Celo es EVM,
 * así que la misma sirve en ambas — y una lista de saldos. En ningún lado se
 * dice "Ethereum" o "Celo"; el usuario ve USDC, USDT, ETH y COPm y ya.
 *
 * Los tres métodos de fondeo salen del mismo hook de Privy; `defaultFundingMethod`
 * abre directo el flujo pedido en vez del selector.
 * Requieren estar habilitados en dashboard.privy.io > Funding.
 */
const METODOS = [
  { id: "card" as const, titulo: "Tarjeta", detalle: "Débito, crédito, Apple Pay o Google Pay." },
  { id: "exchange" as const, titulo: "Exchange", detalle: "Transfiere desde Coinbase, Binance u otro." },
  { id: "wallet" as const, titulo: "Depósito cripto", detalle: "Envía desde otra wallet a tu dirección." },
];

interface Saldo {
  id: string;
  bruto: string | null;
  error: string | null;
}

export default function Wallet() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet();
  const [saldos, setSaldos] = useState<Saldo[] | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const direccion = user?.wallet?.address ?? wallets[0]?.address ?? null;

  const cargarSaldos = useCallback(async () => {
    if (!direccion) return;
    try {
      const r = await fetch(`/api/saldos?address=${direccion}`);
      const j = await r.json();
      setSaldos(j.saldos ?? []);
    } catch {
      setSaldos([]);
    }
  }, [direccion]);

  useEffect(() => { cargarSaldos(); }, [cargarSaldos]);

  async function fondear(metodo: (typeof METODOS)[number]["id"]) {
    if (!direccion) return;
    setError(null);
    setAbriendo(metodo);
    try {
      await fundWallet(direccion, { defaultFundingMethod: metodo });
      // Tras fondear, el saldo tarda en confirmarse; recargamos igual.
      cargarSaldos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el fondeo");
    } finally {
      setAbriendo(null);
    }
  }

  async function copiar() {
    if (!direccion) return;
    try {
      await navigator.clipboard.writeText(direccion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de portapapeles: el usuario puede seleccionar el texto.
    }
  }

  if (!ready) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!authenticated)
    return (
      <EntrarCTA
        mensaje="Tu wallet se crea sola al abrir la cuenta: no tienes que instalar nada ni guardar frases de respaldo."
        nota="Con tu correo o Google. La wallet queda lista en el mismo paso."
      />
    );

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="mono text-[11px] text-[var(--muted)] mb-2">TU DIRECCIÓN</h2>
        {direccion ? (
          <button
            onClick={copiar}
            className="mono text-xs break-all border rule px-3 py-2.5 w-full text-left hover:bg-[var(--petrol-2)]"
          >
            {direccion}
            <span className="text-[var(--solar)] ml-2">{copiado ? "copiado" : "copiar"}</span>
          </button>
        ) : (
          <p className="mono text-xs text-[var(--muted)]">
            Todavía no tienes wallet. Se crea sola al entrar con correo o Google.
          </p>
        )}
        <p className="mono text-[10px] text-[var(--muted)] mt-2 leading-relaxed">
          Una sola dirección para todos tus activos. No tienes que escoger red.
        </p>
      </div>

      <div>
        <h2 className="mono text-[11px] text-[var(--muted)] mb-2">SALDOS</h2>
        <div className="border rule divide-y divide-[color-mix(in_srgb,var(--muted)_35%,transparent)]">
          {ACTIVOS.map((a) => {
            const s = saldos?.find((x) => x.id === a.id);
            return (
              <div key={a.id} className="flex items-center justify-between gap-4 px-3 py-3">
                <div className="min-w-0">
                  <p className="mono text-xs font-semibold">{a.simbolo}</p>
                  <p className="mono text-[10px] text-[var(--muted)] truncate">{a.nombre}</p>
                </div>
                <p className="mono text-sm text-right">
                  {!saldos ? (
                    <span className="text-[var(--muted)]">···</span>
                  ) : s?.error || s?.bruto == null ? (
                    <span className="mono text-[10px] text-[var(--muted)]">no disponible</span>
                  ) : (
                    formatearUnidades(BigInt(s.bruto), a.decimales)
                  )}
                </p>
              </div>
            );
          })}
        </div>
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
          <p className="mono text-[11px] text-[var(--solar)] mt-3" role="alert">{error}</p>
        )}
      </div>
    </div>
  );
}
