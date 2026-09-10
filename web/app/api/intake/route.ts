import { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { PrivyClient } from "@privy-io/server-auth";
import { anthropic } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabase";
import { conCache } from "@/lib/agente";
import { registrarConsumo, saldo, sumarUso, usoVacio } from "@/lib/consumo";
import {
  HERRAMIENTAS_INTAKE, MODELO_INTAKE, SISTEMA_INTAKE, bloqueada, estadoIntake,
  normalizar,
} from "@/lib/intake-agente";
import { PROPONENTES, avance, columnasDeRespuestas, conTipo, faltantes } from "@/lib/intake";
import { TIPOS } from "@/lib/proyectos";
import type { Respuestas } from "@/lib/types";
import type { ProponenteId } from "@/lib/intake";

// La entrevista encadena guardar_respuestas y la siguiente pregunta.
export const maxDuration = 300;

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const MAX_VUELTAS = 6;

/** Lo que "dice" el usuario al abrir. Nadie lo escribió: no se muestra al retomar. */
const APERTURA = "Hola, quiero proponer un proyecto.";

async function did(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return (await privy.verifyAuthToken(auth.slice(7))).userId;
  } catch {
    return null;
  }
}

interface Entrada {
  proyectoId?: string;
  /** Solo al abrir: definen el guion y no se preguntan conversando. */
  proponente?: string;
  tipo?: string;
  mensaje?: string;
}

/**
 * Retomar una entrevista: los turnos visibles y dónde quedó.
 *
 * Antes retomar era imposible desde la interfaz — el componente aceptaba un
 * id pero arrancaba siempre desde el selector — y un borrador a medias solo
 * podía terminarse con el formulario, que no sabe nada del guion. Aquí se
 * devuelve solo el texto: los tool_use y tool_result son mecánica interna.
 */
export async function GET(req: NextRequest) {
  const userId = await did(req);
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const proyectoId = req.nextUrl.searchParams.get("proyectoId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(proyectoId))
    return Response.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const db = supabaseAdmin();
  const { data: p } = await db
    .from("proyectos")
    .select("id, privy_did, proponente, tipo, estado, respuestas")
    .eq("id", proyectoId)
    .maybeSingle();
  if (!p || p.privy_did !== userId)
    return Response.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const { data: mensajes } = await db
    .from("mensajes")
    .select("rol, contenido")
    .eq("conversacion_id", proyectoId)
    .order("created_at");

  type Bloque = { type: string; text?: string };
  const turnos: { rol: "user" | "assistant"; texto: string }[] = [];
  for (const m of mensajes ?? []) {
    const bloques = (Array.isArray(m.contenido) ? m.contenido : []) as Bloque[];
    const texto = bloques
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();
    if (!texto || texto === APERTURA) continue;
    turnos.push({ rol: m.rol as "user" | "assistant", texto });
  }

  const proponente = p.proponente as ProponenteId;
  const respuestas = conTipo(p.tipo, (p.respuestas ?? {}) as Respuestas);
  return Response.json({
    proponente,
    tipo: p.tipo,
    estado: p.estado,
    turnos,
    avance: avance(proponente, respuestas),
    pendientes: faltantes(proponente, respuestas).length,
    completo: faltantes(proponente, respuestas).length === 0,
    bloqueo: bloqueada(respuestas),
  });
}

export async function POST(req: NextRequest) {
  const userId = await did(req);
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json()) as Entrada;
  const db = supabaseAdmin();
  await db.from("profiles").upsert({ privy_did: userId });

  const { disponible } = await saldo(db, userId);
  if (disponible <= 0)
    return Response.json(
      { error: "Sin créditos", detalle: "Se acabaron los créditos de este mes." },
      { status: 402 },
    );

  // ------------------------------------------------------------- proyecto
  // El tipo de proponente y el tipo de obra NO se preguntan conversando:
  // ramifican el guion entero, así que se escogen antes y de ahí sale todo lo
  // demás. Que el modelo los dedujera de una frase suelta arriesga recorrer un
  // guion que no era.
  const idEntrante = body.proyectoId;
  let proyectoId: string;
  let proponente: ProponenteId;
  let respuestas: Respuestas;

  if (idEntrante) {
    const { data } = await db
      .from("proyectos")
      .select("id, privy_did, proponente, tipo, respuestas, estado")
      .eq("id", idEntrante)
      .maybeSingle();

    // El id viene del cliente y no es secreto: se verifica dueño.
    if (!data || data.privy_did !== userId)
      return Response.json({ error: "Proyecto no encontrado" }, { status: 404 });
    if (data.estado !== "borrador")
      return Response.json(
        { error: "Este proyecto ya salió de borrador y no se puede seguir editando aquí." },
        { status: 409 },
      );

    proyectoId = idEntrante;
    proponente = data.proponente as ProponenteId;
    respuestas = conTipo(data.tipo, (data.respuestas ?? {}) as Respuestas);
  } else {
    const p = PROPONENTES.find((x) => x.id === body.proponente);
    const t = TIPOS.find((x) => x.id === body.tipo);
    if (!p || !t)
      return Response.json(
        { error: "Falta decir quién propone y qué tipo de obra es." },
        { status: 400 },
      );

    const { data, error } = await db
      .from("proyectos")
      .insert({
        privy_did: userId,
        proponente: p.id,
        tipo: t.id,
        titulo: "Propuesta sin título",
        estado: "borrador",
        respuestas: {},
      })
      .select("id")
      .single();

    if (error || !data)
      return Response.json({ error: "No se pudo crear el borrador" }, { status: 500 });

    proyectoId = data.id;
    proponente = p.id as ProponenteId;
    respuestas = conTipo(t.id, {});
  }

  // ------------------------------------------------------------- historial
  // La entrevista se guarda como una conversación normal: así se puede
  // retomar días después sin volver a empezar.
  const { data: conv } = await db
    .from("conversaciones")
    .upsert(
      { id: proyectoId, privy_did: userId, titulo: `Propuesta ${proyectoId.slice(0, 8)}` },
      { onConflict: "id" },
    )
    .select("id")
    .single();
  const conversacionId = conv?.id ?? proyectoId;

  const { data: previos } = await db
    .from("mensajes")
    .select("rol, contenido")
    .eq("conversacion_id", conversacionId)
    .order("created_at");

  const messages: Anthropic.MessageParam[] = (previos ?? []).map((m) => ({
    role: m.rol as "user" | "assistant",
    content: m.contenido as Anthropic.ContentBlockParam[],
  }));

  // Sin mensaje: es la apertura. El modelo saluda y hace la primera pregunta.
  const texto = body.mensaje?.trim();
  if (texto) {
    const contenido = [{ type: "text" as const, text: texto }];
    messages.push({ role: "user", content: contenido });
    await db.from("mensajes").insert({
      conversacion_id: conversacionId,
      rol: "user",
      contenido,
    });
  } else if (!messages.length) {
    const contenido = [{ type: "text" as const, text: APERTURA }];
    messages.push({ role: "user", content: contenido });
    await db.from("mensajes").insert({
      conversacion_id: conversacionId,
      rol: "user",
      contenido,
    });
  }

  /**
   * Mensajes del asistente desde el último dato guardado. Se deduce del
   * historial en vez de guardarse en una columna: es información derivada, y
   * una columna más habría que mantenerla sincronizada con los mensajes.
   */
  const estancamiento = () => {
    let n = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant") { n++; continue; }
      if (Array.isArray(m.content) &&
          m.content.some(
            (b) => b.type === "tool_result" &&
              typeof b.content === "string" && b.content.startsWith("Guardado:")))
        break;
    }
    return n;
  };

  const uso = usoVacio();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (evento: string, dato: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${evento}\ndata: ${JSON.stringify(dato)}\n\n`),
        );

      try {
        enviar("proyecto", { id: proyectoId, proponente });

        for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
          // El estado se recalcula en CADA vuelta: si el modelo acaba de
          // guardar algo, la siguiente pregunta ya sale de la lista nueva.
          const system: Anthropic.TextBlockParam[] = [
            { type: "text", text: SISTEMA_INTAKE, cache_control: { type: "ephemeral" } },
            {
              type: "text",
              text: estadoIntake(proponente, respuestas, estancamiento()),
            },
          ];

          const respuesta = await anthropic.messages
            .stream({
              model: MODELO_INTAKE,
              max_tokens: 4000,
              thinking: { type: "adaptive" },
              system,
              tools: HERRAMIENTAS_INTAKE,
              messages: conCache(messages),
            })
            .on("text", (delta) => enviar("texto", delta))
            .finalMessage();

          sumarUso(uso, MODELO_INTAKE, respuesta.usage);

          messages.push({ role: "assistant", content: respuesta.content });
          await db.from("mensajes").insert({
            conversacion_id: conversacionId,
            rol: "assistant",
            contenido: respuesta.content,
          });

          if (respuesta.stop_reason !== "tool_use") break;

          const resultados: Anthropic.ToolResultBlockParam[] = [];
          for (const llamada of respuesta.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          )) {
            const entrada = llamada.input as { respuestas?: unknown };
            const { aceptadas, rechazadas } = normalizar(
              proponente,
              respuestas,
              entrada.respuestas,
            );

            respuestas = { ...respuestas, ...aceptadas };

            const pendientes = faltantes(proponente, respuestas);
            const listo = pendientes.length === 0;
            const corte = bloqueada(respuestas);

            // Lo que es columna del proyecto se escribe también como columna:
            // título, meta, barrio… Es lo que la revisión valida y la vitrina
            // muestra. `tipo` no va en el JSON: es de la fila.
            const { tipo: _tipo, ...guardables } = respuestas;
            void _tipo;
            await db
              .from("proyectos")
              .update({
                respuestas: guardables,
                ...columnasDeRespuestas(aceptadas),
                regimen: corte ? "valores" : "donacion",
                intake_completo_at: listo ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", proyectoId);

            enviar("avance", {
              guardadas: Object.keys(aceptadas),
              pendientes: pendientes.length,
              avance: avance(proponente, respuestas),
              completo: listo,
              bloqueo: corte,
            });

            // Al modelo se le dice qué entró y qué no. Sin eso vuelve a
            // preguntar lo que ya guardó, o da por bueno algo que se rechazó.
            const partes = [
              aceptadas && Object.keys(aceptadas).length
                ? `Guardado: ${Object.keys(aceptadas).join(", ")}.`
                : "No se guardó nada de lo que mandaste.",
              ...rechazadas.map((x) => `Rechazado ${x.id}: ${x.porque}.`),
              corte
                ? `ALTO. ${corte} Explícaselo con tus palabras y no sigas preguntando.`
                : listo
                  ? "Ya no falta nada. Cierra la entrevista."
                  : `Faltan ${pendientes.length}.`,
            ];

            resultados.push({
              type: "tool_result",
              tool_use_id: llamada.id,
              content: partes.join(" "),
            });
          }

          messages.push({ role: "user", content: resultados });
          await db.from("mensajes").insert({
            conversacion_id: conversacionId,
            rol: "user",
            contenido: resultados,
          });

          if (bloqueada(respuestas)) break;
        }

        enviar("fin", {
          avance: avance(proponente, respuestas),
          completo: faltantes(proponente, respuestas).length === 0,
        });
      } catch (e) {
        enviar("error", {
          mensaje: e instanceof Error ? e.message : "Error desconocido",
        });
      } finally {
        if (uso.costo_usd > 0) {
          try {
            await registrarConsumo(db, userId, {
              concepto: "intake",
              modelo: MODELO_INTAKE,
              uso,
              referencia: proyectoId,
            });
          } catch {
            // La contabilidad no puede tumbar una respuesta ya entregada.
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
