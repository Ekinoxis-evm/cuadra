"use client";
import { useState } from "react";
import Link from "next/link";
import AuthButton from "@/components/AuthButton";
import ChatIntereses from "@/components/ChatIntereses";
import Perfil from "@/components/cuenta/Perfil";
import Wallet from "@/components/cuenta/Wallet";
import Favoritos from "@/components/cuenta/Favoritos";

const TABS = ["intereses", "favoritos", "wallet", "perfil"] as const;
type Tab = (typeof TABS)[number];

export default function Cuenta() {
  // Intereses primero: es el chat, y es lo que la gente viene a usar.
  const [tab, setTab] = useState<Tab>("intereses");

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <header className="flex items-baseline justify-between gap-4 border-b rule pb-4">
        <div>
          <Link href="/" className="text-2xl font-bold tracking-tight">
            CUADRA
          </Link>
          <p className="mono text-[11px] text-[var(--muted)] mt-1">mi cuenta</p>
        </div>
        <AuthButton />
      </header>

      <nav className="flex gap-0 mt-6 border-b rule" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`mono text-xs px-4 py-2.5 border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-[var(--solar)] text-[var(--bone)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--bone)]"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </nav>

      <section className="mt-6" role="tabpanel">
        {tab === "intereses" && <ChatIntereses />}
        {tab === "favoritos" && <Favoritos />}
        {tab === "wallet" && <Wallet />}
        {tab === "perfil" && <Perfil />}
      </section>
    </main>
  );
}
