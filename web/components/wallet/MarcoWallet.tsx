"use client";
import Link from "next/link";
import EntrarCTA from "@/components/EntrarCTA";
import type { EstadoWallet } from "./datos";

/**
 * Los tres estados previos a cualquier pantalla de la wallet —cargando, sin
 * sesión, sin wallet todavía— y, si hay dirección, la pantalla. Las subpáginas
 * llevan además el título y el camino de vuelta.
 */
export default function MarcoWallet({
  w,
  titulo,
  children,
}: {
  w: EstadoWallet;
  /** Si viene, es una subpágina: se dibuja el título y el "← wallet". */
  titulo?: string;
  children: (direccion: string) => React.ReactNode;
}) {
  if (!w.ready) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!w.authenticated)
    return (
      <EntrarCTA
        mensaje="Tu wallet se crea sola al abrir la cuenta: no tienes que instalar nada ni guardar frases de respaldo."
        nota="Con tu correo o Google. La wallet queda lista en el mismo paso."
      />
    );
  if (!w.direccion)
    return (
      <p className="mono text-xs text-[var(--muted)] leading-relaxed">
        Todavía no tienes wallet. Se crea sola al entrar con correo o Google; si
        acabas de entrar, dale unos segundos y recarga.
      </p>
    );

  return (
    <div className="max-w-md space-y-6">
      {titulo && (
        <div className="space-y-3">
          <Link href="/cuenta/wallet" className="mono text-[11px] text-[var(--muted)] hover:text-[var(--bone)] inline-block">
            ← wallet
          </Link>
          <h2 className="mono text-[11px] text-[var(--muted)]">{titulo}</h2>
        </div>
      )}
      {children(w.direccion)}
    </div>
  );
}
