"use client";
import { useRouter } from "next/navigation";
import Fondear from "@/components/wallet/Fondear";
import MarcoWallet from "@/components/wallet/MarcoWallet";
import { useWallet } from "@/components/wallet/datos";

export default function PaginaFondear() {
  const router = useRouter();
  const w = useWallet();
  return (
    <MarcoWallet w={w} titulo="FONDEAR">
      {(direccion) => (
        <Fondear
          direccion={direccion}
          onRecibir={() => router.push("/cuenta/wallet/recibir")}
          onFondeado={w.refrescar}
        />
      )}
    </MarcoWallet>
  );
}
