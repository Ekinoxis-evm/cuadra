"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import NavApp from "@/components/NavApp";
import ChatIntereses from "@/components/ChatIntereses";
import Perfil from "@/components/cuenta/Perfil";
import Wallet from "@/components/cuenta/Wallet";
import Favoritos from "@/components/cuenta/Favoritos";
import Proyectos from "@/components/cuenta/Proyectos";
import Onboarding from "@/components/cuenta/Onboarding";

const TABS = ["intereses", "favoritos", "wallet", "proyectos", "perfil"] as const;
type Tab = (typeof TABS)[number];

function Contenido() {
  const params = useSearchParams();
  const pedida = params.get("tab");
  // Intereses por defecto: es el chat, y es lo que la gente viene a usar.
  const tab: Tab = TABS.includes(pedida as Tab) ? (pedida as Tab) : "intereses";

  const { ready, authenticated, getAccessToken } = usePrivy();
  const [necesitaOnboarding, setNecesitaOnboarding] = useState<boolean | null>(null);

  const revisarPerfil = useCallback(async () => {
    if (!authenticated) return setNecesitaOnboarding(false);
    const token = await getAccessToken();
    const r = await fetch("/api/perfil", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return setNecesitaOnboarding(false);
    const j = await r.json();
    setNecesitaOnboarding(!j.onboarding_at);
  }, [authenticated, getAccessToken]);

  useEffect(() => { if (ready) revisarPerfil(); }, [ready, revisarPerfil]);

  return (
    <>
      <NavApp tabActiva={tab} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {necesitaOnboarding ? (
          <Onboarding onListo={() => setNecesitaOnboarding(false)} />
        ) : (
        <>
        {tab === "intereses" && <ChatIntereses />}
        {tab === "favoritos" && <Favoritos />}
        {tab === "wallet" && <Wallet />}
        {tab === "proyectos" && <Proyectos />}
        {tab === "perfil" && <Perfil />}
        </>
        )}
      </main>
    </>
  );
}

export default function Cuenta() {
  // useSearchParams exige un límite de Suspense para no forzar render dinámico
  // de toda la ruta.
  return (
    <Suspense fallback={<NavApp />}>
      <Contenido />
    </Suspense>
  );
}
