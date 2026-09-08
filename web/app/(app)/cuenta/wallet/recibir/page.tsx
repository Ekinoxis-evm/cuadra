"use client";
import Recibir from "@/components/wallet/Recibir";
import MarcoWallet from "@/components/wallet/MarcoWallet";
import { useWallet } from "@/components/wallet/datos";

export default function PaginaRecibir() {
  const w = useWallet();
  return (
    <MarcoWallet w={w} titulo="RECIBIR">
      {(direccion) => <Recibir direccion={direccion} />}
    </MarcoWallet>
  );
}
