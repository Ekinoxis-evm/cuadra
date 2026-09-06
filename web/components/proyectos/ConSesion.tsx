"use client";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import EntrarCTA from "@/components/EntrarCTA";

/**
 * Muro de sesión para las páginas que la exigen.
 *
 * Tres estados y ninguno en silencio: cargando, sin poder cargar (Privy caído
 * o bloqueado a los cinco segundos), y sin sesión con el botón para entrar.
 * Lo que va adentro solo se monta cuando hay sesión, así los hooks de datos
 * de las páginas no tienen que preguntar por ella.
 */
export default function ConSesion({
  mensaje,
  nota,
  children,
}: {
  mensaje: string;
  nota?: string;
  children: React.ReactNode;
}) {
  const { ready, authenticated } = usePrivy();
  const [lento, setLento] = useState(false);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setLento(true), 5000);
    return () => clearTimeout(t);
  }, [ready]);

  if (!ready && !lento)
    return <p className="mono text-xs text-[var(--muted)]">···</p>;

  if (!ready)
    return (
      <p className="mono text-[11px] text-[var(--muted)] leading-relaxed border rule p-4 max-w-md">
        No pudimos cargar tu sesión. Recarga la página; si sigue igual, revisa
        que el navegador no esté bloqueando a Privy.
      </p>
    );

  if (!authenticated) return <EntrarCTA mensaje={mensaje} nota={nota} />;

  return <>{children}</>;
}
