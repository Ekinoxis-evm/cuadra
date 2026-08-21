"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import ChatIntereses from "@/components/ChatIntereses";
import Perfil from "@/components/cuenta/Perfil";
import Wallet from "@/components/cuenta/Wallet";
import Favoritos from "@/components/cuenta/Favoritos";

const TABS = ["intereses", "favoritos", "wallet", "perfil"] as const;
type Tab = (typeof TABS)[number];

function Contenido() {
  const params = useSearchParams();
  const pedida = params.get("tab");
  // Intereses por defecto: es el chat, y es lo que la gente viene a usar.
  const tab: Tab = TABS.includes(pedida as Tab) ? (pedida as Tab) : "intereses";

  return (
    <>
      <Nav tabActiva={tab} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === "intereses" && <ChatIntereses />}
        {tab === "favoritos" && <Favoritos />}
        {tab === "wallet" && <Wallet />}
        {tab === "perfil" && <Perfil />}
      </main>
    </>
  );
}

export default function Cuenta() {
  // useSearchParams exige un límite de Suspense para no forzar render dinámico
  // de toda la ruta.
  return (
    <Suspense fallback={<Nav />}>
      <Contenido />
    </Suspense>
  );
}
