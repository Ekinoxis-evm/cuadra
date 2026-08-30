"use client";

/**
 * La cola de revisión.
 *
 * Sustituye las consultas SQL a mano del README. El veredicto de la rúbrica
 * llega al lado de cada propuesta, pero la decisión sigue siendo de una
 * persona: publicar es plata de terceros sobre una obra real.
 */

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import NavApp from "@/components/NavApp";
import { fmtCOP } from "@/lib/types";

interface Senal { gravedad: string; asunto: string; detalle: string }
interface Eje { eje: string; puntaje: number; evaluable: boolean; sustento: string }

interface EnCola {
  id: string;
  titulo: string | null;
  barrio: string | null;
  proponente: string;
  tipo: string;
  meta_cop: number | null;
  area_m2: number | null;
  enviado_revision_at: string | null;
  documentos: unknown[];
  kyc: string | null;
  graves: number;
  evaluacion: {
    puntaje: number; banda: string; cobertura: number;
    resumen: string | null; para_quien_propone: string | null;
    ejes: Eje[]; senales: Senal[]; rubrica: number; creado_at: string;
  } | null;
}

const COLOR_BANDA: Record<string, string> = {
  recomendado: "var(--alza)",
  gris: "var(--solar)",
  devuelto: "var(--muted)",
};

export default function Revision() {
  const { authenticated, getAccessToken } = usePrivy();
  const [cola, setCola] = useState<EnCola[]>([]);
  const [cargando, setCargando] = useState(true);
  const [prohibido, setProhibido] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!authenticated) return;
    setCargando(true);
    try {
      const token = await getAccessToken();
      const r = await fetch("/api/revision", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 403) { setProhibido(true); return; }
      if (!r.ok) { setError(`Error ${r.status}`); return; }
      setCola((await r.json()).cola);
    } finally {
      setCargando(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => { void cargar(); }, [cargar]);

  const decidir = async (id: string, decision: "publicar" | "devolver") => {
    setOcupado(id); setError(null);
    try {
      const token = await getAccessToken();
      const r = await fetch(`/api/revision/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, nota: notas[id] ?? "" }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.detalle ?? j.error ?? `Error ${r.status}`); return; }
      await cargar();
      setAbierto(null);
    } finally {
      setOcupado(null);
    }
  };

  if (!authenticated)
    return <main className="max-w-5xl mx-auto px-5 py-16"><NavApp /><p className="mono text-xs text-[var(--muted)] mt-8">Entra para revisar.</p></main>;

  if (prohibido)
    return (
      <main className="max-w-5xl mx-auto px-5 py-16">
        <NavApp />
        <p className="mono text-xs text-[var(--muted)] mt-8">
          Esta pantalla es solo para quien revisa propuestas.
        </p>
      </main>
    );

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <NavApp />

      <div className="flex items-baseline justify-between mt-8 mb-6">
        <h1 className="text-2xl">Cola de revisión</h1>
        <span className="mono text-[11px] text-[var(--muted)]">
          {cargando ? "cargando…" : `${cola.length} esperando`}
        </span>
      </div>

      {error && <p className="mono text-[11px] text-[var(--solar)] mb-4">{error}</p>}

      {!cargando && !cola.length && (
        <p className="mono text-xs text-[var(--muted)]">Nada pendiente.</p>
      )}

      <div className="space-y-3">
        {cola.map((p) => {
          const ev = p.evaluacion;
          const puesto = abierto === p.id;
          return (
            <article key={p.id} className="border rule">
              <button
                onClick={() => setAbierto(puesto ? null : p.id)}
                className="w-full text-left p-4 hover:bg-[var(--petrol-2)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Las señales graves van primero y en el sitio donde se
                          mira: son la razón por la que esta fila está arriba. */}
                      {p.graves > 0 && (
                        <span className="mono text-[10px] px-1.5 py-0.5 bg-[var(--solar)] text-[var(--petrol)]">
                          {p.graves} GRAVE{p.graves > 1 ? "S" : ""}
                        </span>
                      )}
                      <span className="text-sm truncate">{p.titulo ?? "(sin título)"}</span>
                    </div>
                    <p className="mono text-[11px] text-[var(--muted)] mt-1">
                      {p.proponente} · {p.tipo} · {p.barrio ?? "sin barrio"}
                      {p.area_m2 ? ` · ${p.area_m2} m²` : ""}
                      {p.meta_cop ? ` · ${fmtCOP(p.meta_cop)}` : ""}
                    </p>
                    <p className="mono text-[11px] text-[var(--muted)]">
                      KYC {p.kyc ?? "sin enviar"}
                      {p.documentos.length ? ` · ${p.documentos.length} soporte(s)` : " · sin soportes"}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    {ev ? (
                      <>
                        <div className="mono text-xl" style={{ color: COLOR_BANDA[ev.banda] }}>
                          {ev.puntaje}
                        </div>
                        <div className="mono text-[10px] text-[var(--muted)]">{ev.banda}</div>
                        {/* Un 90 sobre media rúbrica no es un 90. */}
                        {ev.cobertura < 1 && (
                          <div className="mono text-[10px] text-[var(--solar)]">
                            cobertura {Math.round(ev.cobertura * 100)}%
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="mono text-[10px] text-[var(--muted)]">sin evaluar</span>
                    )}
                  </div>
                </div>
              </button>

              {puesto && (
                <div className="border-t rule p-4 space-y-4">
                  {ev ? (
                    <>
                      <p className="text-sm">{ev.resumen}</p>

                      <div className="space-y-1">
                        {ev.ejes.map((e) => (
                          <div key={e.eje} className="flex gap-3 text-[13px]">
                            <span className="mono text-[11px] w-24 shrink-0 text-[var(--muted)]">
                              {e.eje}
                            </span>
                            <span className="mono text-[11px] w-8 shrink-0">
                              {e.evaluable ? e.puntaje : "--"}
                            </span>
                            <span className="text-[var(--muted)]">{e.sustento}</span>
                          </div>
                        ))}
                      </div>

                      {ev.senales.length > 0 && (
                        <div className="space-y-1">
                          {ev.senales.map((s, i) => (
                            <p key={i} className="text-[13px]">
                              <span
                                className="mono text-[10px] mr-2"
                                style={{ color: s.gravedad === "alta" ? "var(--solar)" : "var(--muted)" }}
                              >
                                [{s.gravedad}]
                              </span>
                              <span>{s.asunto}: </span>
                              <span className="text-[var(--muted)]">{s.detalle}</span>
                            </p>
                          ))}
                        </div>
                      )}

                      <p className="mono text-[10px] text-[var(--muted)]">
                        rúbrica v{ev.rubrica} · {new Date(ev.creado_at).toLocaleString("es-CO")}
                      </p>
                    </>
                  ) : (
                    <p className="mono text-xs text-[var(--muted)]">
                      Esta propuesta no tiene evaluación. Puedes decidir igual, pero
                      la rúbrica no la ha mirado.
                    </p>
                  )}

                  <div className="border-t rule pt-4 space-y-2">
                    <textarea
                      value={notas[p.id] ?? ev?.para_quien_propone ?? ""}
                      onChange={(e) => setNotas((n) => ({ ...n, [p.id]: e.target.value }))}
                      rows={4}
                      placeholder="Qué hay que corregir. Esto lo lee quien propuso."
                      className="w-full bg-transparent border rule p-2 text-sm outline-none focus:border-[var(--solar)]"
                    />
                    {/* El texto viene precargado con lo que la rúbrica le
                        escribió al proponente: casi siempre sirve tal cual, y
                        se puede editar antes de mandarlo. */}
                    <div className="flex gap-2">
                      <button
                        disabled={ocupado === p.id}
                        onClick={() => decidir(p.id, "publicar")}
                        className="mono text-[11px] border rule px-4 py-2 disabled:opacity-40 hover:bg-[var(--petrol-2)]"
                      >
                        PUBLICAR
                      </button>
                      <button
                        disabled={ocupado === p.id}
                        onClick={() => decidir(p.id, "devolver")}
                        className="mono text-[11px] border rule px-4 py-2 disabled:opacity-40 hover:bg-[var(--petrol-2)]"
                      >
                        DEVOLVER CON NOTA
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
