"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import NavApp from "@/components/NavApp";
import Onboarding from "@/components/cuenta/Onboarding";

/**
 * La cuenta, como sección con páginas.
 *
 * Antes era una sola página que cambiaba de contenido con ?tab=: el asistente,
 * los guardados, la wallet y los ajustes compartían URL y ninguna acción de la
 * wallet tenía dirección propia. Ahora cada una es una ruta bajo /cuenta, y
 * las acciones de la wallet son subpáginas.
 *
 * El onboarding se ofrece aquí, una vez, a quien entra por primera vez; tiene
 * salida y se puede completar después desde Ajustes.
 */
export default function LayoutCuenta({ children }: { children: React.ReactNode }) {
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
      <NavApp />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {necesitaOnboarding ? (
          <Onboarding
            onListo={() => setNecesitaOnboarding(false)}
            onOmitir={() => setNecesitaOnboarding(false)}
          />
        ) : (
          children
        )}
      </main>
    </>
  );
}
