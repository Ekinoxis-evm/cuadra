import { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { PrivyClient } from "@privy-io/server-auth";
import { anthropic } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabase";
import {
  HERRAMIENTAS, MODELO, SISTEMA, buscarInmuebles, conCache, estadisticasBarrio,
  guardarPreferencias, leerPreferencias,
} from "@/lib/agente";
import { registrarConsumo, saldo, sumarUso, usoVacio } from "@/lib/consumo";
import type { BarrioStat, Listing } from "@/lib/types";

// El loop agéntico puede encadenar varias llamadas a herramientas.
export const maxDuration = 300;

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

  const messages: Anthropic.MessageParam[] = (previos ?? []).map((m) => ({
    role: m.rol as "user" | "assistant",
    content: m.contenido as Anthropic.ContentBlockParam[],
  }));

  // Mensaje nuevo: imágenes primero, luego el texto (orden recomendado para visión).
  const contenidoUsuario: Anthropic.ContentBlockParam[] = [
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

  // Las preferencias van en el system para no ensuciar el hilo visible.
  const memoria = await leerPreferencias(db, userId);
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
    ...(memoria ? [{ type: "text" as const, text: memoria }] : []),
  ];

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
          const respuesta = await anthropic.messages
            .stream({
              model: MODELO,
              max_tokens: 16000,
              thinking: { type: "adaptive" },
              system,
              tools: HERRAMIENTAS,
              messages: conCache(messages),
            })
            .on("text", (delta) => enviar("texto", delta))
            .finalMessage();

          sumarUso(uso, MODELO, respuesta.usage);

          messages.push({ role: "assistant", content: respuesta.content });
          await db.from("mensajes").insert({
            conversacion_id: conversacionId,
            rol: "assistant",
            contenido: respuesta.content,
          });

          if (respuesta.stop_reason !== "tool_use") break;

          const llamadas = respuesta.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );

          const resultados: Anthropic.ToolResultBlockParam[] = [];
          for (const llamada of llamadas) {
            const input = llamada.input as Record<string, unknown>;
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
              if (r.barrios.length) enviar("barrios", r.barrios);
            } else if (llamada.name === "guardar_preferencias") {
              texto = await guardarPreferencias(db, userId, input);
              enviar("preferencias", input);
            } else {
              texto = `Herramienta desconocida: ${llamada.name}`;
            }

            resultados.push({
              type: "tool_result",
              tool_use_id: llamada.id,
              content: texto,
            });
          }

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
        const msg = e instanceof Error ? e.message : "Error desconocido";
        enviar("error", { mensaje: msg });
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
