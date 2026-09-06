"use client";

/**
 * La entrevista, del lado del navegador.
 *
 * Dos toques y después conversación: el tipo de proponente y el tipo de obra
 * ramifican el guion entero, así que se escogen antes. Deducirlos de una frase
 * suelta arriesga recorrer un guion equivocado durante veinte preguntas.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import Esfera, { type EstadoEsfera } from "@/components/Esfera";
import Markdown from "@/components/Markdown";
import { leerSSE } from "@/lib/sse";
import { PROPONENTES } from "@/lib/intake";
import { TIPOS } from "@/lib/proyectos";

interface Turno {
  rol: "user" | "assistant";
  texto: string;
}

interface Props {
  /** Si viene, se retoma esa entrevista donde quedó en vez de abrir una nueva. */
  proyectoId?: string;
  /** Se llama una vez, apenas existe el borrador en la base. */
  alCrear?: (proyectoId: string) => void;
  /** Se llama cuando la entrevista queda completa EN ESTA sesión. */
  alTerminar?: (proyectoId: string) => void;
}

interface Historial {
  proponente: string;
  tipo: string;
  turnos: Turno[];
  avance: number;
  pendientes: number;
  completo: boolean;
  bloqueo: string | null;
}

export default function IntakeConversacional({ proyectoId, alCrear, alTerminar }: Props) {
  const { authenticated, getAccessToken } = usePrivy();

  const [proponente, setProponente] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [id, setId] = useState<string | undefined>(proyectoId);

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [entrada, setEntrada] = useState("");
  const [estado, setEstado] = useState<EstadoEsfera>("reposo");
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [completo, setCompleto] = useState(false);
  // Completo por lo que pasó aquí, no por lo que ya venía guardado: abrir una
  // entrevista terminada para releerla no debe sacarte de la página.
  const [terminoAqui, setTerminoAqui] = useState(false);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [retomando, setRetomando] = useState(!!proyectoId);

  const finRef = useRef<HTMLDivElement>(null);
  const arrancado = useRef(false);
  const ocupado = estado !== "reposo";

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos]);

  const hablar = useCallback(
    async (mensaje?: string) => {
      setError(null);
      setEstado("pensando");
      if (mensaje) setTurnos((t) => [...t, { rol: "user", texto: mensaje }]);

      try {
        const token = await getAccessToken();
        const r = await fetch("/api/intake", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ proyectoId: id, proponente, tipo, mensaje }),
        });

        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(j.detalle ?? j.error ?? `Error ${r.status}`);
          setEstado("reposo");
          return;
        }

        // El turno del asistente se va llenando con el stream.
        let acumulado = "";
        setTurnos((t) => [...t, { rol: "assistant", texto: "" }]);

        for await (const { evento, dato } of leerSSE(r)) {
          if (evento === "proyecto") {
            const nuevo = (dato as { id: string }).id;
            if (!id) alCrear?.(nuevo);
            setId(nuevo);
          } else if (evento === "texto") {
            setEstado("hablando");
            acumulado += dato as string;
            setTurnos((t) => {
              const c = [...t];
              c[c.length - 1] = { rol: "assistant", texto: acumulado };
              return c;
            });
          } else if (evento === "avance") {
            const d = dato as {
              avance: number; pendientes: number; completo: boolean; bloqueo: string | null;
            };
            setProgreso(d.avance);
            setPendientes(d.pendientes);
            setCompleto(d.completo);
            if (d.completo) setTerminoAqui(true);
            if (d.bloqueo) setBloqueo(d.bloqueo);
          } else if (evento === "fin") {
            const d = dato as { avance: number; completo: boolean };
            setProgreso(d.avance);
            setCompleto(d.completo);
            if (d.completo) setTerminoAqui(true);
          } else if (evento === "error") {
            setError((dato as { mensaje: string }).mensaje);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Se cayó la conexión");
      } finally {
        setEstado("reposo");
      }
    },
    [getAccessToken, id, proponente, tipo, alCrear],
  );

  // Retomar: se carga lo conversado y se sigue desde ahí. El guion ya está
  // decidido por el borrador, así que el selector no se muestra.
  useEffect(() => {
    if (!proyectoId || !authenticated || arrancado.current) return;
    arrancado.current = true;
    (async () => {
      try {
        const token = await getAccessToken();
        const r = await fetch(`/api/intake?proyectoId=${proyectoId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(j.error ?? `Error ${r.status}`);
          return;
        }
        const h = (await r.json()) as Historial;
        setProponente(h.proponente);
        setTipo(h.tipo);
        setTurnos(h.turnos);
        setProgreso(h.avance);
        setPendientes(h.pendientes);
        setCompleto(h.completo);
        setBloqueo(h.bloqueo);
        // Un borrador sin conversación guardada (se cerró la pestaña antes de
        // la primera pregunta): el asistente vuelve a abrir.
        if (!h.turnos.length && !h.completo && !h.bloqueo) void hablar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar la entrevista");
      } finally {
        setRetomando(false);
      }
    })();
  }, [proyectoId, authenticated, getAccessToken, hablar]);

  // Apertura: apenas hay tipo elegido, el asistente saluda solo.
  useEffect(() => {
    if (!proponente || !tipo || arrancado.current) return;
    arrancado.current = true;
    void hablar();
  }, [proponente, tipo, hablar]);

  useEffect(() => {
    if (terminoAqui && id) alTerminar?.(id);
  }, [terminoAqui, id, alTerminar]);

  if (!authenticated)
    return (
      <p className="mono text-xs text-[var(--muted)]">
        Entra a tu cuenta para proponer un proyecto.
      </p>
    );

  if (retomando)
    return <p className="mono text-xs text-[var(--muted)]">···</p>;

  // ------------------------------------------------------------ los dos toques
  if (!proponente || !tipo)
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="mono text-[11px] text-[var(--muted)]">¿QUIÉN PROPONE?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROPONENTES.map((p) => (
              <button
                key={p.id}
                onClick={() => setProponente(p.id)}
                className={`text-left border rule p-3 hover:bg-[var(--petrol-2)] ${
                  proponente === p.id ? "border-[var(--solar)]" : ""
                }`}
              >
                <span className="block text-sm">{p.label}</span>
                <span className="mono text-[11px] text-[var(--muted)]">{p.detalle}</span>
              </button>
            ))}
          </div>
        </div>

        {proponente && (
          <div className="space-y-3">
            <p className="mono text-[11px] text-[var(--muted)]">¿QUÉ TIPO DE OBRA?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTipo(t.id)}
                  className="text-left border rule p-3 hover:bg-[var(--petrol-2)]"
                >
                  <span className="block text-sm">{t.titulo}</span>
                  <span className="mono text-[11px] text-[var(--muted)]">{t.detalle}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mono text-[11px] text-[var(--muted)] max-w-md">
          De ahí en adelante es una conversación. Puedes salir cuando quieras: lo
          contestado queda guardado y al volver se retoma donde ibas.
        </p>
      </div>
    );

  // ------------------------------------------------------------ la entrevista
  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      {/* Barra de avance: una entrevista sin final visible se siente eterna. */}
      <div className="border rule px-3 py-2 mb-4 flex items-center gap-3">
        <div className="flex-1 h-1 bg-[var(--petrol-2)]">
          <div
            className="h-1 bg-[var(--solar)] transition-all"
            style={{ width: `${Math.round(progreso * 100)}%` }}
          />
        </div>
        <span className="mono text-[11px] text-[var(--muted)] shrink-0">
          {completo
            ? "completo"
            : pendientes !== null
              ? `faltan ${pendientes}`
              : `${Math.round(progreso * 100)}%`}
        </span>
      </div>

      {bloqueo && (
        <div className="border rule border-[var(--solar)] p-3 mb-4">
          <p className="mono text-[11px] text-[var(--solar)] mb-1">
            ESTA PROPUESTA NO PUEDE SEGUIR POR AQUÍ
          </p>
          <p className="text-sm">{bloqueo}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {turnos.map((t, i) =>
          t.rol === "user" ? (
            <p key={i} className="text-sm text-right text-[var(--muted)]">
              {t.texto}
            </p>
          ) : (
            <div key={i} className="text-sm max-w-2xl">
              {t.texto ? <Markdown>{t.texto}</Markdown> : <Esfera estado="pensando" size={28} />}
            </div>
          ),
        )}
        <div ref={finRef} />
      </div>

      {error && <p className="mono text-[11px] text-[var(--solar)] mt-3">{error}</p>}

      {!completo && !bloqueo && (
        <form
          className="flex gap-2 mt-4 border-t rule pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = entrada.trim();
            if (!v || ocupado) return;
            setEntrada("");
            void hablar(v);
          }}
        >
          <input
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            disabled={ocupado}
            placeholder="Escribe tu respuesta"
            className="flex-1 bg-transparent border rule px-3 py-2 text-sm outline-none focus:border-[var(--solar)]"
          />
          <button
            type="submit"
            disabled={ocupado || !entrada.trim()}
            className="mono text-[11px] border rule px-4 disabled:opacity-40 hover:bg-[var(--petrol-2)]"
          >
            {ocupado ? "..." : "ENVIAR"}
          </button>
        </form>
      )}

      {completo && (
        <div className="border rule p-3 mt-4">
          <p className="mono text-[11px] text-[var(--alza)] mb-1">ENTREVISTA COMPLETA</p>
          <p className="text-sm">
            Ya tenemos todo lo necesario. Revisa la propuesta y mándala a revisión
            cuando quieras.
          </p>
          {id && (
            <Link
              href={`/proyectos/${id}`}
              className="mono text-[11px] border rule px-3 py-1.5 hover:bg-[var(--petrol-2)] inline-block mt-3"
            >
              ver la propuesta
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
