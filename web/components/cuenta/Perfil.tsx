"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePrivy, useLinkAccount } from "@privy-io/react-auth";
import type { PasskeyWithMetadata } from "@privy-io/react-auth";
import EntrarCTA from "@/components/EntrarCTA";
import type { Preferencias } from "@/lib/types";
import { fmtCOP } from "@/lib/types";

/**
 * Ajustes de la cuenta.
 *
 * Regla de esta pantalla: no se muestra un número que el usuario no vaya a
 * usar. El DID de Privy, la lista cruda de tipos de cuenta vinculada y la
 * dirección completa de la wallet no le sirven a nadie aquí — son ruido que
 * hace ver la pantalla como un panel de depuración. La dirección larga vive en
 * la pestaña Wallet, que es donde de verdad se necesita para recibir.
 */

/** Fila de dato: etiqueta a la izquierda, valor a la derecha. */
function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b rule">
      <span className="mono text-[11px] text-[var(--muted)]">{k}</span>
      <span className="mono text-xs text-right break-words">{v}</span>
    </div>
  );
}

/** 0x1a2b…9f8e — suficiente para reconocerla, sin la ristra completa. */
const abreviar = (dir: string) => `${dir.slice(0, 6)}…${dir.slice(-4)}`;

const fecha = (d: Date | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

/** De dónde salió la llave, en palabras: "iPhone · Safari". */
function dispositivoDe(p: PasskeyWithMetadata) {
  const partes = [
    p.authenticatorName ?? p.createdWithDevice,
    p.createdWithOs,
    p.createdWithBrowser,
  ].filter(Boolean);
  // Sin metadatos no inventamos: mejor decir que no se sabe.
  return partes.length ? [...new Set(partes)].join(" · ") : "dispositivo sin identificar";
}

/**
 * Llaves de acceso (passkeys).
 *
 * Es la parte de seguridad de la cuenta y por eso vive en ajustes, no en el
 * flujo de entrada: se configura una vez, con calma, no en medio de un login.
 */

/** Los códigos de Privy son para el log, no para el usuario. */
const MENSAJE_ERROR: Record<string, string> = {
  exited_link_flow: "Cancelaste la creación de la llave. No pasó nada.",
  passkey_not_allowed: "Este dispositivo no dejó crear la llave.",
  not_supported: "Este navegador no admite llaves de acceso.",
  linked_to_another_user: "Esa llave ya está en otra cuenta.",
  max_accounts_reached: "Llegaste al máximo de llaves para esta cuenta.",
};

function Llaves() {
  const { user, unlinkPasskey } = usePrivy();
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El flujo de vinculación es de la UI de Privy: no devuelve promesa, avisa
  // por callback. Sin esto, cancelar el diálogo del sistema dejaba el botón
  // girando para siempre.
  const { linkPasskey } = useLinkAccount({
    onSuccess: () => {
      setTrabajando(null);
      setError(null);
    },
    onError: (codigo) => {
      setTrabajando(null);
      setError(MENSAJE_ERROR[codigo] ?? "No se pudo crear la llave de acceso.");
    },
  });

  const cuentas = user?.linkedAccounts ?? [];
  const llaves = cuentas.filter(
    (a): a is PasskeyWithMetadata => a.type === "passkey",
  );
  // Privy no deja dejar la cuenta sin ningún método de entrada, y quedarse por
  // fuera de la propia cuenta es peor que no tener passkey.
  const puedeQuitar = cuentas.length > 1;
  const soportado =
    typeof window !== "undefined" && !!window.PublicKeyCredential;

  function agregar() {
    setError(null);
    setTrabajando("nueva");
    linkPasskey();
  }

  async function quitar(credentialId: string) {
    setError(null);
    setTrabajando(credentialId);
    try {
      await unlinkPasskey(credentialId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo quitar la llave. Debe quedarte al menos una forma de entrar.",
      );
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <div>
      <h2 className="mono text-[11px] text-[var(--muted)] mb-2">
        SEGURIDAD · LLAVES DE ACCESO
      </h2>

      <p className="text-sm text-[var(--muted)] leading-relaxed">
        Una llave de acceso —o <em>passkey</em>— deja que entres con la huella,
        la cara o el PIN de tu propio dispositivo. No hay contraseña que se
        pueda robar ni código que esperar en el correo, y la llave nunca sale de
        tu teléfono o computador.
      </p>

      {llaves.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {llaves.map((p) => (
            <li
              key={p.credentialId}
              className="border rule px-3 py-2.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="mono text-xs">{dispositivoDe(p)}</p>
                <p className="mono text-[10px] text-[var(--muted)] mt-0.5">
                  {[
                    fecha(p.firstVerifiedAt ?? p.verifiedAt) &&
                      `añadida el ${fecha(p.firstVerifiedAt ?? p.verifiedAt)}`,
                    p.enrolledInMfa ? "también protege operaciones" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {puedeQuitar && (
                <button
                  type="button"
                  onClick={() => quitar(p.credentialId)}
                  disabled={trabajando !== null}
                  className="mono text-[10px] text-[var(--muted)] hover:text-[var(--solar)] shrink-0 disabled:opacity-40"
                >
                  {trabajando === p.credentialId ? "quitando…" : "quitar"}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mono text-[11px] text-[var(--muted)] mt-4">
          Todavía no tienes ninguna. Entras con el correo o con Google.
        </p>
      )}

      {error && (
        <p className="mono text-[11px] text-[var(--solar)] mt-3" role="alert">
          {error}
        </p>
      )}

      {soportado ? (
        <>
          <button
            type="button"
            onClick={agregar}
            disabled={trabajando !== null}
            className={`mono text-xs px-4 py-2.5 mt-4 disabled:opacity-40 ${
              llaves.length
                ? "border rule hover:bg-[var(--petrol-2)]"
                : "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
            }`}
          >
            {trabajando === "nueva"
              ? "esperando al dispositivo…"
              : llaves.length
                ? "+ AÑADIR OTRA LLAVE"
                : "CONFIGURAR LLAVE DE ACCESO"}
          </button>
          <p className="mono text-[10px] text-[var(--muted)] mt-2 leading-relaxed">
            Tu dispositivo va a pedirte confirmación. Añade una por cada aparato
            desde el que entres: la de tu teléfono no sirve en el computador.
          </p>
        </>
      ) : (
        <p className="mono text-[11px] text-[var(--muted)] mt-4 leading-relaxed">
          Este navegador no admite llaves de acceso. Abre CUADRA desde un
          teléfono o un navegador actualizado para configurarlas.
        </p>
      )}
    </div>
  );
}

export default function Perfil() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      const token = await getAccessToken();
      const r = await fetch("/api/preferencias", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setPrefs(await r.json());
    })();
  }, [authenticated, getAccessToken]);

  if (!ready) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!authenticated)
    return (
      <EntrarCTA mensaje="Tu perfil guarda lo que el asistente aprende de ti: presupuesto, barrios y lo que vas descartando. Necesita una cuenta." />
    );

  const rango =
    prefs?.presupuesto_min || prefs?.presupuesto_max
      ? [prefs.presupuesto_min && fmtCOP(prefs.presupuesto_min),
         prefs.presupuesto_max && fmtCOP(prefs.presupuesto_max)]
          .filter(Boolean).join(" – ")
      : null;

  // Cómo entra esta persona, en palabras y no en tipos internos de Privy.
  const entradas = [
    user?.email?.address && "correo",
    user?.google && "Google",
    user?.linkedAccounts?.some((a) => a.type === "passkey") && "llave de acceso",
  ].filter(Boolean) as string[];

  const direccion = user?.wallet?.address;

  async function copiarDireccion() {
    if (!direccion) return;
    try {
      await navigator.clipboard.writeText(direccion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de portapapeles no pasa nada: la dirección completa está
      // en la pestaña Wallet.
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
      <div className="space-y-10">
        <div>
          <h2 className="mono text-[11px] text-[var(--muted)] mb-2">CUENTA</h2>
          <Dato k="correo" v={user?.email?.address ?? "—"} />
          <Dato k="entras con" v={entradas.join(" · ") || "—"} />
          <Dato
            k="verificación"
            v={
              <Link href="/proyectos/verificacion" className="mono text-xs hover:text-[var(--solar)]">
                ver estado <span className="text-[var(--solar)] ml-2">→</span>
              </Link>
            }
          />
          <Dato
            k="wallet"
            v={
              direccion ? (
                <button
                  onClick={copiarDireccion}
                  title="Copiar dirección completa"
                  className="mono text-xs hover:text-[var(--solar)]"
                >
                  {abreviar(direccion)}
                  <span className="text-[var(--solar)] ml-2">
                    {copiado ? "copiada" : "copiar"}
                  </span>
                </button>
              ) : (
                "—"
              )
            }
          />
        </div>

        <Llaves />
      </div>

      <div>
        <h2 className="mono text-[11px] text-[var(--muted)] mb-2">
          LO QUE BUSCAS
        </h2>
        {!prefs ? (
          <p className="mono text-xs text-[var(--muted)] py-2">
            Todavía nada. Conversa en <strong>Intereses</strong> y esto se llena
            solo a medida que el asistente te va conociendo.
          </p>
        ) : (
          <>
            <Dato k="operación" v={prefs.operacion ?? "—"} />
            <Dato k="presupuesto" v={rango ?? "—"} />
            <Dato k="barrios" v={prefs.barrios?.join(", ") || "—"} />
            <Dato
              k="mínimos"
              v={
                [prefs.habs_min && `${prefs.habs_min} hab`,
                 prefs.banos_min && `${prefs.banos_min} baños`,
                 prefs.area_min && `${prefs.area_min} m²`]
                  .filter(Boolean).join(" · ") || "—"
              }
            />
            <Dato k="amenidades" v={prefs.amenidades?.join(", ") || "—"} />
            <Dato k="notas" v={prefs.notas ?? "—"} />
          </>
        )}
      </div>
    </div>
  );
}
