import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PrivyClient } from "@privy-io/server-auth";
import { anthropic } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabase";
import {
  BETAS, ESFUERZO, HERRAMIENTAS, MODELO, SISTEMA, buscarInmuebles, conCache,
  estadisticasBarrio, guardarPreferencias, leerPreferencias,
} from "@/lib/agente";
import { registrarConsumo, saldo, sumarUso, usoVacio } from "@/lib/consumo";
import type { BarrioStat, Listing } from "@/lib/types";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

// El loop agéntico puede encadenar varias llamadas a herramientas.
export const maxDuration = 300;

/**
 * Lo que ve el usuario cuando la API falla. El mensaje crudo ("invalid
 * x-api-key", "overloaded_error") no le dice nada y sí expone la plomería; el
 * detalle va al log del servidor, que es donde alguien lo puede arreglar.
 */
function mensajeDeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return "El asistente no está disponible en este momento. Ya quedó registrado.";
  if (e instanceof Anthropic.RateLimitError)
    return "Hay mucha gente buscando a la vez. Intenta de nuevo en un minuto.";
  if (e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError)
    return "El asistente tuvo un problema temporal. Intenta de nuevo.";
  if (e instanceof Anthropic.APIError)
    return "No se pudo completar la respuesta. Intenta de nuevo.";
  return "Algo falló procesando la respuesta.";
}

/**
 * Un hilo que se cortó entre la respuesta del modelo y el resultado de sus
 * herramientas queda con `tool_use` sin `tool_result`, y la API rechaza ese
 * historial con 400 en cada turno siguiente: la conversación muere. Se
 * repara agregando al final los resultados que faltan, marcados como error.
 * Agregar y no borrar: editar lo ya enviado rompería el caché y el
 * razonamiento guardado.
 */
function resultadosFaltantes(messages: MessageParam[]): ToolResult[] {
  const ult = messages[messages.length - 1];
  if (ult?.role !== "assistant" || typeof ult.content === "string") return [];
  return ult.content
    .filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use")
    .map((b) => ({
      type: "tool_result",
      tool_use_id: b.id,
      content: "La búsqueda se interrumpió y no devolvió resultados.",
      is_error: true,
    }));
}

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

/** Tope de vueltas del loop, por si el modelo se queda pidiendo herramientas. */
const MAX_VUELTAS = 8;

async function did(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const claims = await privy.verifyAuthToken(auth.slice(7));
    return claims.userId;
  } catch {
    return null;
  }
}

interface Entrada {
  mensaje: string;
  conversacionId?: string;
  /** Imágenes que sube el usuario, ya en base64 sin el prefijo data:. */
  imagenes?: { media_type: string; data: string }[];
}

export async function POST(req: NextRequest) {
  const userId = await did(req);
  if (!userId)
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json()) as Entrada;
  if (!body.mensaje?.trim() && !body.imagenes?.length)
    return Response.json({ error: "Mensaje vacío" }, { status: 400 });

  const db = supabaseAdmin();
  await db.from("profiles").upsert({ privy_did: userId });

  // Se mira el saldo ANTES de llamar al modelo. Después no sirve de nada: para
  // entonces la respuesta ya se generó y a nosotros ya nos la facturaron. No
  // se reserva ni se estima el costo del turno — se corta solo cuando la bolsa
  // ya está en cero, así que el último turno puede quedar debiendo unos pocos
  // créditos. Cobrar por adelantado un turno cuyo tamaño no se conoce sería
  // peor: descontaría de más en el caso común.
  const { disponible } = await saldo(db, userId);
  if (disponible <= 0)
    return Response.json(
      {
        error: "Sin créditos",
        detalle:
          "Se acabaron los créditos de este mes. Se renuevan el primero, o " +
          "puedes recargar.",
      },
      { status: 402 },
    );

  // ---------------------------------------------------------- conversación
  let conversacionId = body.conversacionId;
  if (conversacionId) {
    // Verificamos dueño: el id viene del cliente y no es secreto.
    const { data } = await db
      .from("conversaciones")
      .select("id")
      .eq("id", conversacionId)
      .eq("privy_did", userId)
      .maybeSingle();
    if (!data)
      return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
  } else {
    const { data, error } = await db
      .from("conversaciones")
      .insert({ privy_did: userId, titulo: body.mensaje.slice(0, 80) || "Nueva búsqueda" })
      .select("id")
      .single();
    if (error || !data)
      return Response.json({ error: "No se pudo crear la conversación" }, { status: 500 });
    conversacionId = data.id;
  }

  // ---------------------------------------------------------- historial
  const { data: previos } = await db
    .from("mensajes")
    .select("rol, contenido")
    .eq("conversacion_id", conversacionId)
    .order("id", { ascending: true });

  const messages: MessageParam[] = (previos ?? []).map((m) => ({
    role: m.rol as MessageParam["role"],
    content: m.contenido as ContentBlockParam[],
  }));

  const reparar = resultadosFaltantes(messages);
  if (reparar.length) {
    messages.push({ role: "user", content: reparar });
    await db.from("mensajes").insert({
      conversacion_id: conversacionId,
      rol: "user",
      contenido: reparar,
    });
  }

  // La memoria entra una sola vez por hilo: mientras el modelo no haya
  // contestado nada todavía. Ver `memoria` más abajo.
  const sinRespuestas = !messages.some((m) => m.role === "assistant");

  // Mensaje nuevo: imágenes primero, luego el texto (orden recomendado para visión).
  const contenidoUsuario: ContentBlockParam[] = [
    ...(body.imagenes ?? []).map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: img.data,
      },
    })),
    ...(body.mensaje?.trim() ? [{ type: "text" as const, text: body.mensaje }] : []),
  ];
  messages.push({ role: "user", content: contenidoUsuario });

  await db.from("mensajes").insert({
    conversacion_id: conversacionId,
    rol: "user",
    contenido: contenidoUsuario,
  });

  // El `system` de arriba no cambia nunca: es el prefijo cacheado de todos
  // los hilos. Las preferencias iban ahí y se releían en cada turno, así que
  // cuando el agente guardaba algo el turno siguiente cambiaba el prefijo y
  // se perdía el caché del hilo entero. Ahora entran como mensaje de sistema
  // a mitad de conversación, una vez, al abrir el hilo; lo que el agente
  // aprende después ya queda en el hilo en sus llamadas a guardar_preferencias.
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
  ];
  const memoria = sinRespuestas ? await leerPreferencias(db, userId) : null;
  // Se guarda recién cuando llega la primera respuesta: un mensaje de sistema
  // tiene que ir seguido del asistente, y si esta llamada falla, un
  // `system` seguido del próximo `user` dejaría el hilo inservible.
  let memoriaPendiente = Boolean(memoria);
  if (memoria) messages.push({ role: "system", content: memoria });

  // Un turno son varias llamadas: el loop encadena hasta ocho vueltas. Se
  // acumulan todas y se cobra una vez al final.
  const uso = usoVacio();

  // ---------------------------------------------------------- stream SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (evento: string, dato: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${evento}\ndata: ${JSON.stringify(dato)}\n\n`),
        );

      try {
        enviar("conversacion", { id: conversacionId });

        for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
          let huboTexto = false;
          const respuesta = await anthropic.beta.messages
            .stream({
              model: MODELO,
              max_tokens: 16000,
              betas: BETAS,
              // Si Opus 5.5 declina por un falso positivo, la API reintenta
              // en el modelo que recomienda para esa categoría.
              fallbacks: "default",
              // `display` y `block_binding` aún no están en los tipos del SDK
              // 0.120; la API los acepta con las betas de arriba.
              thinking: {
                type: "adaptive",
                display: "updates",
                block_binding: { prefix_mismatch_behavior: "drop_block" },
              } as unknown as Anthropic.Beta.BetaThinkingConfigParam,
              output_config: { effort: ESFUERZO },
              system,
              tools: HERRAMIENTAS,
              messages: conCache(messages),
            })
            .on("text", (delta) => {
              huboTexto = true;
              enviar("texto", delta);
            })
            // Con display "updates" el thinking solo trae las notas de avance
            // ("busco en Pance…"), nunca el razonamiento. Va la nota entera y
            // no el delta: así la UI reemplaza en vez de pegar notas seguidas.
            .on("thinking", (_delta, nota) => enviar("progreso", nota))
            .finalMessage();

          sumarUso(uso, MODELO, respuesta.usage);

          if (memoriaPendiente) {
            memoriaPendiente = false;
            await db.from("mensajes").insert({
              conversacion_id: conversacionId,
              rol: "system",
              contenido: memoria,
            });
          }

          messages.push({ role: "assistant", content: respuesta.content });
          await db.from("mensajes").insert({
            conversacion_id: conversacionId,
            rol: "assistant",
            contenido: respuesta.content,
          });

          // Llega aquí solo si declinaron Opus 5.5 y también el fallback.
          if (respuesta.stop_reason === "refusal") {
            if (!huboTexto)
              enviar(
                "texto",
                "No puedo ayudarte con eso. Si buscas vivienda en Cali, cuéntame " +
                  "qué necesitas y lo busco.",
              );
            break;
          }
          if (respuesta.stop_reason !== "tool_use") break;

          const llamadas = respuesta.content.filter(
            (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
          );

          // En paralelo: el modelo puede pedir búsqueda y estadísticas en la
          // misma vuelta, y son consultas independientes a Supabase.
          const resultados: ToolResult[] = await Promise.all(
            llamadas.map(async (llamada): Promise<ToolResult> => {
              const input = llamada.input as Record<string, unknown>;
              try {
                let texto: string;
                if (llamada.name === "buscar_inmuebles") {
                  const r = await buscarInmuebles(db, input);
                  texto = r.paraModelo;
                  // Las fotos y la URL van directo a la UI: el modelo no las necesita.
                  if (r.listings.length)
                    enviar("inmuebles", r.listings satisfies Listing[]);
                } else if (llamada.name === "estadisticas_barrio") {
                  const r = await estadisticasBarrio(db, input);
                  texto = r.paraModelo;
                  // La tabla la pinta la UI. Al modelo le queda comentar lo que
                  // ahí se ve, en vez de transcribir veinte filas en prosa.
                  if (r.barrios.length) enviar("barrios", r.barrios satisfies BarrioStat[]);
                } else if (llamada.name === "guardar_preferencias") {
                  texto = await guardarPreferencias(db, userId, input);
                  enviar("preferencias", input);
                } else {
                  return {
                    type: "tool_result",
                    tool_use_id: llamada.id,
                    content: `Herramienta desconocida: ${llamada.name}`,
                    is_error: true,
                  };
                }
                return { type: "tool_result", tool_use_id: llamada.id, content: texto };
              } catch (e) {
                console.error(`[chat] ${llamada.name} falló`, e);
                // Con is_error el modelo sabe que fue una falla y no "cero
                // resultados", y se lo dice al usuario en vez de aflojar filtros.
                return {
                  type: "tool_result",
                  tool_use_id: llamada.id,
                  content: "La consulta a la base falló. No hay resultados de esta búsqueda.",
                  is_error: true,
                };
              }
            }),
          );

          // Todos los tool_result en UN solo mensaje de usuario.
          messages.push({ role: "user", content: resultados });
          await db.from("mensajes").insert({
            conversacion_id: conversacionId,
            rol: "user",
            contenido: resultados,
          });
        }

        await db
          .from("conversaciones")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversacionId);

        enviar("fin", { ok: true });
      } catch (e) {
        console.error("[chat]", e);
        enviar("error", { mensaje: mensajeDeError(e) });
      } finally {
        // En el finally y no en el try: si el loop se cae en la vuelta cinco,
        // las cuatro primeras ya se facturaron. Cobrar solo los turnos que
        // terminaron bien convierte cada error en gasto invisible.
        if (uso.costo_usd > 0) {
          try {
            await registrarConsumo(db, userId, {
              concepto: "chat",
              modelo: MODELO,
              uso,
              referencia: conversacionId,
            });
            const s = await saldo(db, userId);
            enviar("saldo", { disponible: s.disponible });
          } catch {
            // Que falle la contabilidad no puede tumbar una respuesta que el
            // usuario ya recibió. Queda el hueco en `consumo` y se ve al
            // cuadrar contra la factura real.
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

/** Historial de conversaciones del usuario, para la pestaña Intereses. */
export async function GET(req: NextRequest) {
  const userId = await did(req);
  if (!userId)
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const db = supabaseAdmin();
  const url = new URL(req.url);
  const conversacionId = url.searchParams.get("conversacion");

  if (conversacionId) {
    const { data: duena } = await db
      .from("conversaciones")
      .select("id")
      .eq("id", conversacionId)
      .eq("privy_did", userId)
      .maybeSingle();
    if (!duena)
      return Response.json({ error: "No encontrada" }, { status: 404 });

    const { data } = await db
      .from("mensajes")
      .select("rol, contenido, created_at")
      .eq("conversacion_id", conversacionId)
      // La memoria inyectada es para el modelo, no un turno de la charla.
      .neq("rol", "system")
      .order("id", { ascending: true });
    return Response.json(data ?? []);
  }

  const { data } = await db
    .from("conversaciones")
    .select("id, titulo, updated_at")
    .eq("privy_did", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  return Response.json(data ?? []);
}
