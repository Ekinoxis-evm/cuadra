"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Esfera, { type EstadoEsfera } from "./Esfera";
import ListingCard from "./ListingCard";
import TablaBarrios from "./TablaBarrios";
import Markdown from "./Markdown";
import { leerSSE } from "@/lib/sse";
import { reconstruir } from "@/lib/historial";
import type { BarrioStat, Listing } from "@/lib/types";
import type { Turno } from "@/lib/historial";
import EntrarCTA from "@/components/EntrarCTA";

const SUGERENCIAS = [
  "Arriendo en el sur, máximo 2.5 millones",
  "¿Qué barrio da mejor $/m² en venta?",
  "Apartamento con balcón y piscina",
];

export default function ChatIntereses() {
  const { authenticated, getAccessToken } = usePrivy();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [entrada, setEntrada] = useState("");
  const [fotos, setFotos] = useState<{ media_type: string; data: string; url: string }[]>([]);
  const [estado, setEstado] = useState<EstadoEsfera>("reposo");
  // La nota de avance del modelo mientras busca ("Busco aptos en Pance…").
  // Solo vive mientras no hay respuesta escrita: después sobra.
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [hilos, setHilos] = useState<{ id: string; titulo: string | null; updated_at: string }[]>([]);
  const [cargandoHilo, setCargandoHilo] = useState(false);
  // Los créditos existían y no se veían: la ruta ya mandaba el saldo y nadie
  // lo escuchaba. Un contador que solo aparece cuando queda poco — mostrarlo
  // siempre convierte cada pregunta en una decisión de gasto.
  const [saldo, setSaldo] = useState<number | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ocupado = estado !== "reposo";

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos]);

  const abrirHilo = useCallback(async (id: string) => {
    setCargandoHilo(true);
    try {
      const token = await getAccessToken();
      const r = await fetch(`/api/chat?conversacion=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      setTurnos(await reconstruir(await r.json()));
      setConversacionId(id);
    } finally {
      setCargandoHilo(false);
    }
  }, [getAccessToken]);

  // Al entrar se retoma la ultima conversacion en vez de arrancar en blanco:
  // el historial ya se guardaba, pero la UI nunca lo leia de vuelta y cada
  // sesion empezaba de cero.
  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      const token = await getAccessToken();
      const r = await fetch("/api/chat", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const lista = await r.json();
      setHilos(lista);
      if (lista.length) abrirHilo(lista[0].id);
    })();
  }, [authenticated, getAccessToken, abrirHilo]);

  function nuevoHilo() {
    setConversacionId(null);
    setTurnos([]);
    setError(null);
  }

  async function agregarFotos(files: FileList | null) {
    if (!files) return;
    const nuevas = await Promise.all(
      Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, 4)
        .map(
          (f) =>
            new Promise<{ media_type: string; data: string; url: string }>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => {
                const url = String(r.result);
                // La API quiere el base64 pelado, sin el prefijo "data:...;base64,".
                resolve({ media_type: f.type, data: url.split(",")[1] ?? "", url });
              };
              r.onerror = () => reject(r.error);
              r.readAsDataURL(f);
            }),
        ),
    );
    setFotos((prev) => [...prev, ...nuevas].slice(0, 4));
  }

  async function enviar(texto: string) {
    if (ocupado || (!texto.trim() && !fotos.length)) return;
    setError(null);

    const misFotos = fotos;
    setTurnos((t) => [
      ...t,
      { rol: "user", texto, fotos: misFotos.map((f) => f.url) },
      { rol: "assistant", texto: "" },
    ]);
    setEntrada("");
    setFotos([]);
    setEstado("pensando");
    setProgreso("");

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: texto,
          conversacionId,
          imagenes: misFotos.map(({ media_type, data }) => ({ media_type, data })),
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(j.error ?? `Error ${res.status}`);
      }

      for await (const { evento, dato } of leerSSE(res)) {
        if (evento === "conversacion") {
          const id = (dato as { id: string }).id;
          setConversacionId(id);
          setHilos((h) =>
            h.some((x) => x.id === id)
              ? h
              : [{ id, titulo: texto.slice(0, 80), updated_at: new Date().toISOString() }, ...h],
          );
        } else if (evento === "progreso") {
          setProgreso(String(dato));
        } else if (evento === "texto") {
          setEstado("hablando");
          setProgreso("");
          // El delta llega como string JSON; se acumula en el último turno.
          setTurnos((t) => {
            const copia = [...t];
            const ult = copia[copia.length - 1];
            copia[copia.length - 1] = { ...ult, texto: ult.texto + String(dato) };
            return copia;
          });
        } else if (evento === "inmuebles") {
          setTurnos((t) => {
            const copia = [...t];
            const ult = copia[copia.length - 1];
            copia[copia.length - 1] = {
              ...ult,
              inmuebles: [...(ult.inmuebles ?? []), ...(dato as Listing[])],
            };
            return copia;
          });
        } else if (evento === "barrios") {
          setTurnos((prev) => {
            const c = [...prev];
            const ult = c[c.length - 1];
            if (ult?.rol === "assistant")
              c[c.length - 1] = {
                ...ult,
                barrios: [...(ult.barrios ?? []), ...(dato as BarrioStat[])],
              };
            return c;
          });
        } else if (evento === "saldo") {
          setSaldo((dato as { disponible: number }).disponible);
        } else if (evento === "error") {
          throw new Error((dato as { mensaje: string }).mensaje);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
      // Quitamos el turno vacío del asistente para no dejar una burbuja muerta.
      setTurnos((t) => (t[t.length - 1]?.texto === "" ? t.slice(0, -1) : t));
    } finally {
      setEstado("reposo");
      setProgreso("");
    }
  }

  if (!authenticated)
    return (
      <div className="flex flex-col items-center gap-6 py-20">
        <Esfera estado="reposo" size={140} />
        <EntrarCTA mensaje="El asistente recuerda lo que buscas entre sesiones y afina las recomendaciones con cada conversación. Para eso necesita saber quién eres." />
      </div>
    );

  const vacio = turnos.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)]">
      {/* Barra de hilos: el historial vive entre sesiones, asi que hay que
          poder volver a una conversacion vieja y no solo continuar la ultima. */}
      {hilos.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b rule mb-4">
          <button
            onClick={nuevoHilo}
            className="mono text-[11px] border rule px-2.5 py-1.5 shrink-0 text-[var(--solar)] hover:bg-[var(--petrol-2)]"
          >
            + nueva
          </button>
          {hilos.map((h) => (
            <button
              key={h.id}
              onClick={() => abrirHilo(h.id)}
              title={h.titulo ?? "Sin título"}
              className={`mono text-[11px] border rule px-2.5 py-1.5 shrink-0 max-w-[190px] truncate ${
                conversacionId === h.id
                  ? "border-[var(--solar)] text-[var(--bone)]"
                  : "text-[var(--muted)] hover:text-[var(--bone)]"
              }`}
            >
              {h.titulo?.trim() || "sin título"}
            </button>
          ))}
        </div>
      )}

      {saldo !== null && saldo < 15 && (
        <p className="mono text-[11px] text-[var(--solar)] mb-3">
          Te quedan {saldo} créditos este mes.
        </p>
      )}

      {cargandoHilo ? (
        <div className="flex-1 flex items-center justify-center">
          <Esfera estado="pensando" size={96} />
        </div>
      ) : vacio ? (
        // Estado de espera: la esfera al centro, como pediste.
        <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
          <Esfera estado={estado} size={176} />
          <div className="space-y-2">
            <p className="text-lg">¿Qué estás buscando?</p>
            <p className="mono text-xs text-[var(--muted)] max-w-md">
              Cuéntame presupuesto, zona y con quién vives. También puedes mandarme
              una foto de un espacio que te guste.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-w-lg">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="mono text-[11px] border rule px-3 py-1.5 text-[var(--muted)] hover:text-[var(--bone)] hover:bg-[var(--petrol-2)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {turnos.map((t, i) => (
            <div key={i} className="space-y-3">
              {t.rol === "user" ? (
                <div className="flex flex-col items-end gap-2">
                  {!!t.fotos?.length && (
                    <div className="flex gap-2">
                      {t.fotos.map((f, j) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={j} src={f} alt="" className="w-20 h-20 object-cover border rule" />
                      ))}
                    </div>
                  )}
                  {t.texto && (
                    <p className="text-sm bg-[var(--petrol-2)] border rule px-3 py-2 max-w-[80%] break-words">
                      {t.texto}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="shrink-0 pt-0.5">
                    <Esfera estado={i === turnos.length - 1 ? estado : "reposo"} size={28} />
                  </div>
                  <div className="flex-1 space-y-3 min-w-0">
                    {t.texto ? (
                      <Markdown>{t.texto}</Markdown>
                    ) : (
                      <p className="mono text-xs text-[var(--muted)]">
                        {(i === turnos.length - 1 && progreso) || "buscando…"}
                      </p>
                    )}
                    {t.texto && i === turnos.length - 1 && ocupado && progreso && (
                      <p className="mono text-xs text-[var(--muted)]">{progreso}</p>
                    )}
                    {!!t.barrios?.length && <TablaBarrios filas={t.barrios} />}
                    {!!t.inmuebles?.length && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {t.inmuebles.map((l) => (
                          <ListingCard key={`${l.source}:${l.source_id}`} l={l} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={finRef} />
        </div>
      )}

      {error && (
        <p className="mono text-[11px] text-[var(--solar)] py-2" role="alert">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(entrada);
        }}
        className="pt-4 space-y-2"
      >
        {!!fotos.length && (
          <div className="flex gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="w-14 h-14 object-cover border rule" />
                <button
                  type="button"
                  onClick={() => setFotos((p) => p.filter((_, j) => j !== i))}
                  aria-label="Quitar foto"
                  className="mono text-[10px] absolute -top-2 -right-2 w-5 h-5 border rule bg-[var(--petrol)]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={ocupado}
            aria-label="Adjuntar foto"
            className="mono text-xs border rule px-3 text-[var(--muted)] hover:text-[var(--bone)] disabled:opacity-40"
          >
            + foto
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              agregarFotos(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            disabled={ocupado}
            placeholder="Escribe lo que buscas…"
            className="flex-1 mono text-xs bg-transparent border rule px-3 py-2.5 placeholder:text-[var(--muted)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={ocupado || (!entrada.trim() && !fotos.length)}
            className="mono text-xs border rule px-4 bg-[var(--solar)] text-[var(--petrol)] font-semibold disabled:opacity-40 disabled:bg-transparent disabled:text-[var(--muted)]"
          >
            {ocupado ? "…" : "enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
