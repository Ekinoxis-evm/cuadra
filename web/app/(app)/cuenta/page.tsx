"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * /cuenta ya no es una página: es la sección. Esto solo traduce los enlaces
 * viejos con ?tab= —que siguen vivos en marcadores y chats— a la ruta nueva.
 */
const DESTINOS: Record<string, string> = {
  intereses: "/cuenta/asistente",
  favoritos: "/cuenta/guardados",
  wallet: "/cuenta/wallet",
  perfil: "/cuenta/ajustes",
  proyectos: "/proyectos",
  verificacion: "/proyectos/verificacion",
};

function Redirigir() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") ?? "";
  useEffect(() => {
    router.replace(DESTINOS[tab] ?? "/cuenta/asistente");
  }, [tab, router]);
  return <p className="mono text-xs text-[var(--muted)]">···</p>;
}

export default function Cuenta() {
  return (
    <Suspense fallback={<p className="mono text-xs text-[var(--muted)]">···</p>}>
      <Redirigir />
    </Suspense>
  );
}
