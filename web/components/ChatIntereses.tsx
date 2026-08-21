"use client";
import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Esfera, { type EstadoEsfera } from "./Esfera";
import ListingCard from "./ListingCard";
import Markdown from "./Markdown";
import { leerSSE } from "@/lib/sse";
import type { Listing } from "@/lib/types";

interface Turno {
  rol: "user" | "assistant";
  texto: string;
  /** Fotos que subió el usuario, como data URL para previsualizar. */
  fotos?: string[];
  /** Inmuebles que el agente encontró en este turno. */
  inmuebles?: Listing[];
}

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
  const [error, setError] = useState<string | null>(null);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ocupado = estado !== "reposo";

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos]);

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
          setConversacionId((dato as { id: string }).id);
        } else if (evento === "texto") {
          setEstado("hablando");
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
    }
  }

  if (!authenticated)
    return (
      <div className="flex flex-col items-center gap-6 py-20 text-center">
        <Esfera estado="reposo" size={140} />
        <p className="mono text-xs text-[var(--muted)] max-w-sm">
          Entra con tu perfil para conversar. El asistente recuerda lo que busques
          y afina las recomendaciones con cada conversación.
        </p>
      </div>
    );

  const vacio = turnos.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)]">
      {vacio ? (
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
                      <p className="mono text-xs text-[var(--muted)]">buscando…</p>
                    )}
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
