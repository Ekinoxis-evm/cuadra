"use client";
import { useRouter } from "next/navigation";
import Enviar from "@/components/wallet/Enviar";
import MarcoWallet from "@/components/wallet/MarcoWallet";
import { useWallet } from "@/components/wallet/datos";

export default function PaginaEnviar() {
  const router = useRouter();
  const w = useWallet();
  return (
    <MarcoWallet w={w} titulo="ENVIAR">
      {(direccion) => (
        <Enviar
          saldos={w.saldos}
          desde={direccion}
          onEnviado={w.refrescar}
          onCerrar={() => router.push("/cuenta/wallet")}
        />
      )}
    </MarcoWallet>
  );
}
