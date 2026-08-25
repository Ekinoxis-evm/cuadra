"use client";
import { usePrivy } from "@privy-io/react-auth";

/**
 * El muro de "entra para…" con la salida incluida.
 *
 * Antes cada sección sin sesión era una frase gris sin nada que tocar: había
 * que adivinar que el camino era un botón chiquito en el header. Ahora donde se
 * choca con el muro está el botón, y es uno solo — el modal de Privy sirve
 * igual para crear cuenta que para volver a entrar, así que ofrecer dos
 * caminos separados solo obligaba a escoger antes de tiempo.
 */
export default function EntrarCTA({
  mensaje,
  nota,
}: {
  mensaje: string;
  nota?: string;
}) {
  const { ready, login } = usePrivy();

  return (
    <div className="border rule p-5 max-w-md">
      <p className="text-sm leading-relaxed">{mensaje}</p>
      <button
        type="button"
        onClick={login}
        disabled={!ready}
        className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold mt-4 disabled:opacity-40"
      >
        CREAR CUENTA
      </button>
      <p className="mono text-[10px] text-[var(--muted)] mt-2.5 leading-relaxed">
        {nota ??
          "Con tu correo o Google. Si ya tienes cuenta, ese mismo botón te deja entrar."}
      </p>
    </div>
  );
}
