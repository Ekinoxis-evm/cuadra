"use client";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

/**
 * Sin sesión hay un botón y solo uno.
 *
 * "Crear perfil / Entrar" obligaba a decidir en qué caso estaba uno antes de
 * poder hacer nada, y el modal de Privy hace lo mismo en los dos: pide el
 * correo y sigue. Un botón, un camino.
 */
export default function AuthButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  if (!ready) return <span className="mono text-xs text-[var(--muted)]">···</span>;
  if (!authenticated)
    return (
      <button
        onClick={login}
        className="mono text-xs px-4 py-2 bg-[var(--solar)] text-[var(--petrol)] font-semibold"
      >
        CREAR CUENTA
      </button>
    );
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/cuenta"
        className="mono text-xs text-[var(--muted)] hover:text-[var(--bone)] truncate max-w-[140px] underline underline-offset-4"
      >
        {user?.email?.address ?? user?.wallet?.address?.slice(0, 8) ?? "mi cuenta"}
      </Link>
      <button onClick={logout} className="mono text-xs underline underline-offset-4">
        Salir
      </button>
    </div>
  );
}
