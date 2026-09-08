"use client";
import { useState } from "react";
import Link from "next/link";
import { ACTIVOS, abreviarDireccion, formatearUnidades } from "@/lib/activos";
import Historial from "@/components/wallet/Historial";
import MarcoWallet from "@/components/wallet/MarcoWallet";
import { useWallet } from "@/components/wallet/datos";

/**
 * Wallet del usuario: la página principal.
 *
 * Tres acciones arriba, y son tres páginas: enviar (sale plata), recibir
 * (muestro dónde me la mandan) y fondear (la compro o la traigo). Aquí quedan
 * la dirección, los saldos y los movimientos. Las cadenas siguen siendo
 * invisibles en esta vista —una dirección, una lista— y aparecen solo donde
 * importan: al escoger por dónde sale un envío y al decir por dónde se recibe.
 */
export default function Wallet() {
  const w = useWallet();
  const [copiado, setCopiado] = useState(false);

  async function copiar(direccion: string) {
    try {
      await navigator.clipboard.writeText(direccion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* se puede seleccionar el texto */ }
  }

  const boton = "mono text-xs px-4 py-3 border rule hover:bg-[var(--petrol-2)] flex-1 text-center";

  return (
    <MarcoWallet w={w}>
      {(direccion) => (
        <div className="space-y-8">
          <button onClick={() => copiar(direccion)} className="mono text-xs text-[var(--muted)] hover:text-[var(--bone)]" title={direccion}>
            {abreviarDireccion(direccion)}
            <span className="text-[var(--solar)] ml-2">{copiado ? "copiada" : "copiar"}</span>
          </button>

          <div className="flex gap-2">
            <Link
              href="/cuenta/wallet/enviar"
              className={`${boton} bg-[var(--solar)] text-[var(--petrol)] font-semibold border-transparent hover:bg-[var(--solar)]`}
            >
              ENVIAR
            </Link>
            <Link href="/cuenta/wallet/recibir" className={boton}>RECIBIR</Link>
            <Link href="/cuenta/wallet/fondear" className={boton}>FONDEAR</Link>
          </div>

          <div>
            <h2 className="mono text-[11px] text-[var(--muted)] mb-2">SALDOS</h2>
            <div className="border rule divide-y divide-[color-mix(in_srgb,var(--muted)_35%,transparent)]">
              {ACTIVOS.map((a) => {
                const s = w.saldos?.find((x) => x.id === a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-4 px-3 py-3">
                    <div className="min-w-0">
                      <p className="mono text-xs font-semibold">{a.simbolo}</p>
                      <p className="mono text-[10px] text-[var(--muted)] truncate">{a.nombre}</p>
                    </div>
                    <p className="mono text-sm text-right tabular-nums">
                      {!w.saldos ? (
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
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <h2 className="mono text-[11px] text-[var(--muted)]">MOVIMIENTOS</h2>
              <button
                type="button"
                onClick={w.cargarHistorial}
                disabled={w.cargandoHistorial}
                className="mono text-[10px] text-[var(--muted)] hover:text-[var(--bone)] disabled:opacity-40"
              >
                {w.cargandoHistorial ? "actualizando…" : "actualizar"}
              </button>
            </div>
            <Historial movimientos={w.movimientos} cargando={w.cargandoHistorial} />
          </div>
        </div>
      )}
    </MarcoWallet>
  );
}
