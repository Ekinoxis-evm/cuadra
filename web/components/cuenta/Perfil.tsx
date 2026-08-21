"use client";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { Preferencias } from "@/lib/types";
import { fmtCOP } from "@/lib/types";

/** Fila de dato: etiqueta a la izquierda, valor mono a la derecha. */
function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b rule">
      <span className="mono text-[11px] text-[var(--muted)]">{k}</span>
      <span className="mono text-xs text-right break-all">{v}</span>
    </div>
  );
}

export default function Perfil() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [prefs, setPrefs] = useState<Preferencias | null>(null);

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
    return <p className="mono text-xs text-[var(--muted)]">Entra para ver tu perfil.</p>;

  const rango =
    prefs?.presupuesto_min || prefs?.presupuesto_max
      ? [prefs.presupuesto_min && fmtCOP(prefs.presupuesto_min),
         prefs.presupuesto_max && fmtCOP(prefs.presupuesto_max)]
          .filter(Boolean).join(" – ")
      : null;

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h2 className="mono text-[11px] text-[var(--muted)] mb-2">CUENTA</h2>
        <Dato k="correo" v={user?.email?.address ?? "—"} />
        <Dato k="wallet" v={user?.wallet?.address ?? "—"} />
        <Dato
          k="métodos"
          v={user?.linkedAccounts?.map((a) => a.type).join(", ") || "—"}
        />
        <Dato k="id" v={user?.id ?? "—"} />
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
