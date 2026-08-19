"use client";
import { usePrivy } from "@privy-io/react-auth";

export default function AuthButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  if (!ready) return <span className="mono text-xs text-[var(--muted)]">···</span>;
  if (!authenticated)
    return (
      <button
        onClick={login}
        className="mono text-xs border rule px-3 py-1.5 hover:bg-[var(--petrol-2)]"
      >
        Crear perfil / Entrar
      </button>
    );
  return (
    <div className="flex items-center gap-3">
      <span className="mono text-xs text-[var(--muted)] truncate max-w-[140px]">
        {user?.email?.address ?? user?.wallet?.address?.slice(0, 8) ?? "perfil"}
      </span>
      <button onClick={logout} className="mono text-xs underline underline-offset-4">
        Salir
      </button>
    </div>
  );
}
