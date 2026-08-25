"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLogin, useModalStatus, usePrivy } from "@privy-io/react-auth";
import Nav from "@/components/Nav";
import Esfera from "@/components/Esfera";

/**
 * Una sola puerta de entrada.
 *
 * Antes, crear cuenta desde cero era: enlace "Entrar" → caer en /cuenta sin
 * sesión → leer un texto gris que decía "entra para…" → encontrar otro botón
 * en el header → y solo ahí aparecía el modal. Cuatro pasos para lo que es una
 * decisión sola. Esta ruta abre el modal de Privy al cargar y, cuando hay
 * sesión, manda directo a donde el usuario iba.
 *
 * El destino viaja en ?destino= para que un muro pueda mandar aquí y devolver
 * a la persona a la sección que estaba mirando.
 */
const DESTINO_POR_DEFECTO = "/cuenta?tab=intereses";

function Puerta() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, authenticated } = usePrivy();
  const { isOpen } = useModalStatus();
  const [cerrado, setCerrado] = useState(false);
  // Tope duro de aperturas automáticas. Sin él, un cierre que Privy no reporte
  // dejaría al usuario peleando con un modal que se vuelve a abrir solo.
  const intentos = useRef(0);

  // Solo rutas internas: un ?destino=https://… convertiría esta página en un
  // redirector abierto hacia cualquier dominio.
  const pedido = params.get("destino") ?? "";
  const destino = pedido.startsWith("/") && !pedido.startsWith("//")
    ? pedido
    : DESTINO_POR_DEFECTO;

  const { login } = useLogin({
    onComplete: () => router.replace(destino),
    // Cerrar el modal es una respuesta válida: se deja de insistir y queda el
    // botón de la página.
    onError: (codigo) => {
      if (codigo === "exited_auth_flow") setCerrado(true);
    },
  });

  useEffect(() => {
    if (!ready) return;
    if (authenticated) {
      router.replace(destino);
      return;
    }
    if (isOpen || cerrado || intentos.current >= 2) return;
    intentos.current += 1;
    login();
  }, [ready, authenticated, isOpen, cerrado, login, router, destino]);

  return (
    <main className="max-w-5xl mx-auto px-4">
      <div className="max-w-sm mx-auto py-20 flex flex-col items-center text-center gap-5">
        <Esfera estado={ready && !authenticated ? "reposo" : "pensando"} size={110} />

        <div>
          <h1 className="text-xl font-semibold">
            {authenticated ? "Entrando…" : "Crea tu cuenta"}
          </h1>
          <p className="mono text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
            Con tu correo o tu cuenta de Google. Si ya tienes cuenta, este mismo
            botón te deja entrar — no hay dos caminos distintos.
          </p>
        </div>

        {!authenticated && (
          <button
            onClick={() => login()}
            disabled={!ready}
            className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold w-full disabled:opacity-40"
          >
            {ready ? "CREAR CUENTA" : "cargando…"}
          </button>
        )}

        <p className="mono text-[10px] text-[var(--muted)] leading-relaxed">
          La cuenta sirve para guardar inmuebles, conversar con el asistente y
          proponer proyectos. Mirar precios no la necesita:{" "}
          <Link href="/buscar" className="underline underline-offset-4 hover:text-[var(--bone)]">
            ver el tablero
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export default function Entrar() {
  return (
    <>
      <Nav />
      <Suspense fallback={<p className="mono text-xs text-[var(--muted)] p-8">···</p>}>
        <Puerta />
      </Suspense>
    </>
  );
}
