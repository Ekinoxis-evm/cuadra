"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ACTIVOS, abreviarDireccion, formatearUnidades } from "@/lib/activos";
import EntrarCTA from "@/components/EntrarCTA";
import Modal from "@/components/Modal";
import Enviar from "@/components/wallet/Enviar";
import Recibir from "@/components/wallet/Recibir";
import Fondear from "@/components/wallet/Fondear";
import Historial from "@/components/wallet/Historial";
import type { Saldo } from "@/components/wallet/tipos";
import type { Movimiento } from "@/app/api/wallet/historial/route";

/**
 * Wallet del usuario.
 *
 * Tres acciones arriba, y son tres cosas distintas: enviar (sale plata),
 * recibir (muestro dónde me la mandan) y fondear (la compro o la traigo). La
 * versión anterior tenía tres botones de fondeo que parecían el mismo, y nada
 * para enviar.
 *
 * Las cadenas siguen siendo invisibles en la vista principal — una dirección,
 * una lista de saldos — y aparecen solo donde importan: al escoger por dónde
 * sale un envío y al decir por dónde se puede recibir.
 */
type Accion = "enviar" | "recibir" | "fondear" | null;

export default function Wallet() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [saldos, setSaldos] = useState<Saldo[] | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [accion, setAccion] = useState<Accion>(null);
  const [copiado, setCopiado] = useState(false);

  // La embebida es la que firma. Si el usuario además conectó una externa,
  // `user.wallet` puede ser esa; aquí manda la que Privy controla.
  const embebida = wallets.find((w) => w.walletClientType === "privy");
  const direccion = embebida?.address ?? user?.wallet?.address ?? wallets[0]?.address ?? null;

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

  const cargarHistorial = useCallback(async () => {
    if (!direccion) return;
    setCargandoHistorial(true);
    try {
      const r = await fetch(`/api/wallet/historial?address=${direccion}`);
      const j = await r.json();
      setMovimientos(j.movimientos ?? []);
    } catch {
      setMovimientos([]);
    } finally {
      setCargandoHistorial(false);
    }
  }, [direccion]);

  useEffect(() => { cargarSaldos(); cargarHistorial(); }, [cargarSaldos, cargarHistorial]);

  const refrescar = useCallback(() => {
    cargarSaldos();
    // El explorador indexa con retraso: se vuelve a mirar un rato después.
    setTimeout(cargarHistorial, 15000);
  }, [cargarSaldos, cargarHistorial]);

  async function copiar() {
    if (!direccion) return;
    try {
      await navigator.clipboard.writeText(direccion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* se puede seleccionar el texto */ }
  }

  if (!ready) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!authenticated)
    return (
      <EntrarCTA
        mensaje="Tu wallet se crea sola al abrir la cuenta: no tienes que instalar nada ni guardar frases de respaldo."
        nota="Con tu correo o Google. La wallet queda lista en el mismo paso."
      />
    );

  if (!direccion)
    return (
      <p className="mono text-xs text-[var(--muted)]">
        Todavía no tienes wallet. Se crea sola al entrar con correo o Google; si
        acabas de entrar, dale unos segundos y recarga.
      </p>
    );

  const boton =
    "mono text-xs px-4 py-3 border rule hover:bg-[var(--petrol-2)] flex-1 text-center";

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button onClick={copiar} className="mono text-xs text-[var(--muted)] hover:text-[var(--bone)]" title={direccion}>
          {abreviarDireccion(direccion)}
          <span className="text-[var(--solar)] ml-2">{copiado ? "copiada" : "copiar"}</span>
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setAccion("enviar")} className={`${boton} bg-[var(--solar)] text-[var(--petrol)] font-semibold border-transparent hover:bg-[var(--solar)]`}>
          ENVIAR
        </button>
        <button type="button" onClick={() => setAccion("recibir")} className={boton}>RECIBIR</button>
        <button type="button" onClick={() => setAccion("fondear")} className={boton}>FONDEAR</button>
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
                <p className="mono text-sm text-right tabular-nums">
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
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <h2 className="mono text-[11px] text-[var(--muted)]">MOVIMIENTOS</h2>
          <button
            type="button"
            onClick={cargarHistorial}
            disabled={cargandoHistorial}
            className="mono text-[10px] text-[var(--muted)] hover:text-[var(--bone)] disabled:opacity-40"
          >
            {cargandoHistorial ? "actualizando…" : "actualizar"}
          </button>
        </div>
        <Historial movimientos={movimientos} cargando={cargandoHistorial} />
      </div>

      {accion === "enviar" && (
        <Modal titulo="ENVIAR" onCerrar={() => setAccion(null)}>
          <Enviar saldos={saldos} desde={direccion} onEnviado={refrescar} onCerrar={() => setAccion(null)} />
        </Modal>
      )}
      {accion === "recibir" && (
        <Modal titulo="RECIBIR" onCerrar={() => setAccion(null)}>
          <Recibir direccion={direccion} />
        </Modal>
      )}
      {accion === "fondear" && (
        <Modal titulo="FONDEAR" onCerrar={() => setAccion(null)}>
          <Fondear direccion={direccion} onRecibir={() => setAccion("recibir")} onFondeado={refrescar} />
        </Modal>
      )}
    </div>
  );
}
