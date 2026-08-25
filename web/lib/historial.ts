import { supabase } from "./supabase";
import { claveListing, type Listing } from "./types";

/**
 * Reconstruye la conversación guardada para poder retomarla en otra sesión.
 *
 * Lo guardado son los content blocks crudos de Anthropic. De ahí sale el texto
 * y las imágenes del usuario directo, pero NO las tarjetas de inmuebles: al
 * modelo se le manda una versión compacta sin fotos ni URL, así que en la base
 * solo quedan los ids.
 *
 * Por eso, al rehidratar, se leen los ids del tool_result y se vuelven a traer
 * los inmuebles de Supabase. Es un round-trip extra pero devuelve la
 * conversación completa en vez de un hilo de texto suelto.
 */

export interface Turno {
  rol: "user" | "assistant";
  texto: string;
  fotos?: string[];
  inmuebles?: Listing[];
}

interface BloqueGuardado {
  type: string;
  text?: string;
  source?: { type: string; media_type: string; data: string };
  content?: string;
  name?: string;
}

interface MensajeGuardado {
  rol: "user" | "assistant";
  contenido: BloqueGuardado[];
}

/** Saca los "source:source_id" del JSON que buscar_inmuebles devolvió. */
function idsDeResultado(texto: string): string[] {
  try {
    const j = JSON.parse(texto);
    if (!Array.isArray(j?.inmuebles)) return [];
    return j.inmuebles.map((x: { id?: string }) => x.id).filter(Boolean);
  } catch {
    // Los tool_result de estadísticas o de error no son ese JSON: se ignoran.
    return [];
  }
}

export async function reconstruir(mensajes: MensajeGuardado[]): Promise<Turno[]> {
  const turnos: Turno[] = [];
  // Se recolectan todos los ids primero para traerlos en una sola consulta en
  // vez de una por turno.
  const pendientes = new Map<number, string[]>();

  for (const m of mensajes) {
    const bloques = Array.isArray(m.contenido) ? m.contenido : [];

    const resultados = bloques.filter((b) => b.type === "tool_result");
    if (resultados.length) {
      // Los tool_result van en un mensaje de rol "user" que el usuario nunca
      // escribió: no es un turno visible, se adjunta al del asistente anterior.
      const ids = resultados.flatMap((b) => idsDeResultado(String(b.content ?? "")));
      const iAsistente = turnos.findLastIndex((t) => t.rol === "assistant");
      if (ids.length && iAsistente >= 0) {
        pendientes.set(iAsistente, [...(pendientes.get(iAsistente) ?? []), ...ids]);
      }
      continue;
    }

    const texto = bloques
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();

    const fotos = bloques
      .filter((b) => b.type === "image" && b.source?.data)
      .map((b) => `data:${b.source!.media_type};base64,${b.source!.data}`);

    // Un turno del asistente que solo pidió herramientas no tiene texto; se
    // deja igual para poder colgarle los inmuebles.
    if (!texto && !fotos.length && m.rol === "user") continue;
    turnos.push({ rol: m.rol, texto, ...(fotos.length ? { fotos } : {}) });
  }

  const todos = [...new Set([...pendientes.values()].flat())];
  if (todos.length) {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .in("source_id", todos.map((k) => k.split(":")[1]));

    const porClave = new Map(
      ((data ?? []) as Listing[]).map((l) => [claveListing(l), l]),
    );
    for (const [i, ids] of pendientes) {
      const encontrados = ids.map((k) => porClave.get(k)).filter(Boolean) as Listing[];
      if (encontrados.length) turnos[i] = { ...turnos[i], inmuebles: encontrados };
    }
  }

  // Un turno de asistente sin texto ni inmuebles no aporta nada en pantalla.
  return turnos.filter((t) => t.texto || t.fotos?.length || t.inmuebles?.length);
}
