"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { Saldo } from "./tipos";
import type { Movimiento } from "@/app/api/wallet/historial/route";

/**
 * Lo que toda página de la wallet necesita: la dirección que firma, los saldos
 * y los movimientos. Vive en un hook y no en la página principal porque
 * enviar, recibir y fondear son páginas propias y cada una llega por su URL.
 */
export function useWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [saldos, setSaldos] = useState<Saldo[] | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

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

  /** Tras un envío o un fondeo. El explorador indexa con retraso: se vuelve a mirar después. */
  const refrescar = useCallback(() => {
    cargarSaldos();
    setTimeout(cargarHistorial, 15000);
  }, [cargarSaldos, cargarHistorial]);

  return { ready, authenticated, direccion, saldos, movimientos, cargandoHistorial, cargarHistorial, refrescar };
}

export type EstadoWallet = ReturnType<typeof useWallet>;
