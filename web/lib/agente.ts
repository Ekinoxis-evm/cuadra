import type Anthropic from "@anthropic-ai/sdk";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BarrioStat, Listing, Preferencias } from "./types";
import { nombreFuente } from "./fuentes";

export const MODELO = "claude-opus-5-5";

/**
 * Cuánto piensa el modelo por turno. En Opus 5.5 el pensamiento no se apaga:
 * `effort` es la única perilla de latencia y costo. El default de la API es
 * `medium` y se pone explícito para que un cambio de default no mueva la
 * factura en silencio. `low` es lo siguiente a medir: el chat es búsqueda con
 * filtros, no razonamiento largo, pero antes de bajarlo hay que comparar
 * respuestas reales.
 */
export const ESFUERZO = "medium" as const;

/**
 * Betas del chat, cada una por una razón:
 * - server-side-fallback: si Opus 5.5 declina por un falso positivo de sus
 *   clasificadores, la API reintenta en otro modelo dentro de la misma
 *   llamada en vez de dejar al usuario sin respuesta.
 * - thinking-display-updates: en Opus 5.5 lo que el modelo dice entre
 *   herramientas ("busco en Pance…") llega como bloque de thinking y, sin
 *   esto, vacío. Con `display: "updates"` llega como nota corta que la UI
 *   muestra mientras busca.
 * - thinking-binding-controls: los hilos viejos se armaron con la memoria en
 *   el `system`, que cambiaba entre turnos. Con `drop_block` la API descarta
 *   el razonamiento que ya no calza en vez de responder 400.
 */
export const BETAS = [
  "server-side-fallback-2026-07-01",
  "thinking-display-updates-2026-08-18",
  "thinking-binding-controls-2026-08-01",
];

/** Columnas que la UI necesita para pintar una tarjeta completa. */
const COLS_LISTING =
  "source,source_id,operacion,tipo,url,title,price_cop,admin_cop,barrio,zona," +
  "habs,banos,area_m2,estrato,comuna,direccion,imagen,imagenes,amenidades,last_seen";

export const SISTEMA = `Eres el asistente de búsqueda de CUADRA, un agregador de precios
inmobiliarios de Cali, Colombia. Ayudas a la gente a encontrar vivienda en arriendo o venta.

Cómo trabajas:
- Haz UNA pregunta a la vez. La gente se pierde con interrogatorios largos.
- Apenas tengas con qué filtrar, usa buscar_inmuebles. No esperes a saberlo todo:
  es mejor mostrar 5 opciones y afinar que preguntar cinco veces seguidas.
- Cada vez que aprendas algo estable del usuario (presupuesto, barrios, número de
  habitaciones, que tiene perro, que necesita parqueadero) llama a guardar_preferencias.
  Eso persiste entre sesiones y es lo que hace que la búsqueda mejore con el tiempo.
- Si te mandan una foto de un espacio, descríbela en voz alta brevemente (estilo, luz,
  acabados, tipo de espacio) y tradúcela a criterios de búsqueda concretos.
- Usa estadisticas_barrio cuando pregunten si un precio es caro o barato. Tienes la
  mediana y el $/m² por barrio: úsalos en vez de opinar sin datos.
- Antes de cada búsqueda di en una frase corta qué vas a buscar ("Busco aptos de
  3 habitaciones en Pance por menos de 3 millones"). La persona ve esa frase
  mientras esperas los resultados.

Cómo presentas inmuebles:
- Cada inmueble que menciones va enlazado a su aviso con el formato markdown
  [texto](url), usando la url que devuelve buscar_inmuebles. Nunca inventes ni
  armes una url.
- Uno por viñeta, con este orden: enlace con precio y barrio, y después los
  datos que importan para lo que pidió. Ejemplo:
  - [$1.900.000 · Valle del Lili](https://…) — 2 hab, 62 m², estrato 5, en Metrocuadrado
- Nombra el portal donde está publicado. Si el mismo inmueble aparece en dos
  portales, menciónalo una vez y di que está en ambos.
- Las tarjetas con fotos ya salen debajo de tu respuesta: no repitas todos los
  datos, quédate con los que comparan las opciones.

Tono: directo y breve, español colombiano, sin jerga de bienes raíces ni exageración.
Los precios van en pesos colombianos. Nunca inventes inmuebles ni precios: todo lo que
menciones debe salir de buscar_inmuebles. Si no hay resultados, dilo y propón aflojar
un filtro concreto.`;

/**
 * Sin `strict: true`, a propósito. Se probó contra la API (oct 2026) y con
 * strict el modelo pedía filtrar por barrio y precio pero esos campos
 * opcionales no llegaban en el input: buscaba en toda Cali, se daba cuenta y
 * reintentaba hasta rendirse. Sin strict llegan todos a la primera. Los
 * handlers ya toleran tipos raros (Number(), Array.isArray()).
 */
export const HERRAMIENTAS: Anthropic.Beta.BetaTool[] = [
  {
    name: "buscar_inmuebles",
    description:
      "Busca inmuebles activos en Cali. Devuelve los que mejor calzan con los filtros. " +
      "Combina filtros estructurados con búsqueda de texto libre en español sobre el " +
      "título, la descripción y las amenidades.",
    input_schema: {
      type: "object",
      properties: {
        operacion: { type: "string", enum: ["arriendo", "venta"] },
        texto: {
          type: "string",
          description:
            "Texto libre en español: 'balcón piscina', 'remodelado', 'iluminado'. " +
            "Busca en título, descripción y amenidades.",
        },
        barrios: {
          type: "array",
          items: { type: "string" },
          description: "Nombres exactos de barrio, ej. ['Pance', 'Ciudad Jardin'].",
        },
        precio_min: { type: "integer", description: "COP" },
        precio_max: { type: "integer", description: "COP" },
        habs_min: { type: "integer" },
        banos_min: { type: "integer" },
        area_min: { type: "number", description: "m²" },
        estrato_min: { type: "integer" },
        estrato_max: { type: "integer" },
        parqueaderos_min: { type: "integer" },
        amenidades: {
          type: "array",
          items: { type: "string" },
          description:
            "Amenidades que deben estar TODAS presentes, tal como las nombra la fuente " +
            "(ej. 'Piscina', 'Gimnasio', 'Ascensor').",
        },
        orden: {
          type: "string",
          enum: ["precio_asc", "precio_desc", "recientes"],
          description: "Por defecto precio_asc.",
        },
        limite: { type: "integer", description: "Máximo 20. Por defecto 8." },
      },
      required: [],
    },
  },
  {
    name: "estadisticas_barrio",
    description:
      "Mediana de precio y de $/m² por barrio, más el conteo de inmuebles. " +
      "Úsalo para decir si algo está caro o barato con datos, no con opinión.",
    input_schema: {
      type: "object",
      properties: {
        operacion: { type: "string", enum: ["arriendo", "venta"] },
        barrios: {
          type: "array",
          items: { type: "string" },
          description: "Vacío o ausente = los barrios con más inventario.",
        },
      },
      required: ["operacion"],
    },
  },
  {
    name: "guardar_preferencias",
    description:
      "Guarda lo que aprendiste del usuario para reusarlo en próximas sesiones. " +
      "Manda solo los campos que confirmaste; los que omitas se quedan como estaban.",
    input_schema: {
      type: "object",
      properties: {
        operacion: { type: "string", enum: ["arriendo", "venta"] },
        barrios: { type: "array", items: { type: "string" } },
        presupuesto_min: { type: "integer" },
        presupuesto_max: { type: "integer" },
        habs_min: { type: "integer" },
        banos_min: { type: "integer" },
        area_min: { type: "number" },
        estrato_min: { type: "integer" },
        estrato_max: { type: "integer" },
        amenidades: { type: "array", items: { type: "string" } },
        notas: {
          type: "string",
          description:
            "Lo que no cabe en los campos: 'tiene dos perros', 'trabaja en el norte', " +
            "'le importa la luz natural'. Reescribe la nota completa, no la vayas sumando.",
        },
      },
      required: [],
    },
  },
];

/** Lo que el modelo ve de un listing: sin fotos ni descripción, para no gastar contexto. */
function paraModelo(l: Listing) {
  return {
    id: `${l.source}:${l.source_id}`,
    // La URL va para que el modelo enlace cada aviso que menciona: la persona
    // quiere ir directo al portal, no buscar la tarjeta que le corresponde.
    url: l.url,
    fuente: nombreFuente(l.source),
    titulo: l.title,
    precio_cop: l.price_cop,
    admin_cop: l.admin_cop,
    barrio: l.barrio,
    comuna: l.comuna,
    habs: l.habs,
    banos: l.banos,
    area_m2: l.area_m2,
    estrato: l.estrato,
    amenidades: l.amenidades?.slice(0, 12) ?? null,
  };
}

/**
 * Filtro de barrios sin importar mayúsculas. La base guarda "Valle Del Lili"
 * tal como lo escribe el portal, el modelo pide "Valle del Lili", y con un
 * `in` exacto eso daba cero resultados: el agente gastaba dos o tres vueltas
 * adivinando la capitalización. `ilike` sin comodines es igualdad sin
 * mayúsculas; se quitan `%` y `_` para que un nombre no se vuelva patrón, y
 * las comillas para no romper la sintaxis de `or` de PostgREST.
 */
function filtroBarrios(barrios: string[]): string {
  return barrios
    .map((b) => String(b).replace(/["\\%_]/g, "").trim())
    .filter(Boolean)
    .map((b) => `barrio.ilike."${b}"`)
    .join(",");
}

export interface ResultadoBusqueda {
  /** Texto compacto que vuelve al modelo como tool_result. */
  paraModelo: string;
  /** Filas completas para que la UI pinte tarjetas con foto. */
  listings: Listing[];
}

export async function buscarInmuebles(
  db: SupabaseClient,
  input: Record<string, unknown>,
): Promise<ResultadoBusqueda> {
  const limite = Math.min(Number(input.limite) || 8, 20);
  let q = db.from("listings").select(COLS_LISTING).eq("active", true);

  if (input.operacion) q = q.eq("operacion", input.operacion as string);
  if (Array.isArray(input.barrios) && input.barrios.length)
    q = q.or(filtroBarrios(input.barrios as string[]));
  if (input.precio_min) q = q.gte("price_cop", input.precio_min as number);
  if (input.precio_max) q = q.lte("price_cop", input.precio_max as number);
  if (input.habs_min) q = q.gte("habs", input.habs_min as number);
  if (input.banos_min) q = q.gte("banos", input.banos_min as number);
  if (input.area_min) q = q.gte("area_m2", input.area_min as number);
  if (input.estrato_min) q = q.gte("estrato", input.estrato_min as number);
  if (input.estrato_max) q = q.lte("estrato", input.estrato_max as number);
  if (input.parqueaderos_min)
    q = q.gte("parqueaderos", input.parqueaderos_min as number);
  if (Array.isArray(input.amenidades) && input.amenidades.length)
    q = q.contains("amenidades", input.amenidades as string[]);
  if (typeof input.texto === "string" && input.texto.trim())
    // La columna generada 'busqueda' es un tsvector en español con índice GIN.
    q = q.textSearch("busqueda", input.texto.trim(), {
      type: "websearch",
      config: "spanish",
    });

  if (input.orden === "precio_desc") q = q.order("price_cop", { ascending: false });
  else if (input.orden === "recientes") q = q.order("last_seen", { ascending: false });
  else q = q.order("price_cop", { ascending: true });

  const { data, error } = await q.limit(limite);
  if (error) {
    return { paraModelo: `Error consultando la base: ${error.message}`, listings: [] };
  }

  const listings = (data ?? []) as unknown as Listing[];
  if (!listings.length) {
    return {
      paraModelo:
        "Sin resultados con esos filtros. Sugiere aflojar uno concreto (precio, barrio o amenidades).",
      listings: [],
    };
  }
  return {
    paraModelo: JSON.stringify({
      encontrados: listings.length,
      inmuebles: listings.map(paraModelo),
    }),
    listings,
  };
}

export async function estadisticasBarrio(
  db: SupabaseClient,
  input: Record<string, unknown>,
): Promise<{ paraModelo: string; barrios: BarrioStat[] }> {
  let q = db
    .from("barrio_stats")
    .select("*")
    .eq("operacion", (input.operacion as string) ?? "arriendo");
  if (Array.isArray(input.barrios) && input.barrios.length)
    q = q.or(filtroBarrios(input.barrios as string[]));

  const { data, error } = await q.order("n", { ascending: false }).limit(25);
  if (error)
    return { paraModelo: `Error consultando estadísticas: ${error.message}`, barrios: [] };
  if (!data?.length)
    return { paraModelo: "No hay estadísticas para esos barrios.", barrios: [] };

  const barrios = data as unknown as BarrioStat[];

  // Al modelo va texto compacto, no el JSON entero: los mismos números en
  // JSON cuestan casi el triple de tokens y lo empujan a transcribirlos en
  // prosa. La tabla la pinta la UI desde `barrios`, que van por su propio
  // evento; el modelo solo tiene que comentar lo que ahí se ve.
  const paraModelo = barrios
    .map(
      (b) =>
        `${b.barrio}: mediana ${Math.round(b.median_cop).toLocaleString("es-CO")}` +
        (b.median_m2 ? `, ${Math.round(b.median_m2).toLocaleString("es-CO")}/m²` : "") +
        `, n=${b.n}`,
    )
    .join("\n");

  return { paraModelo, barrios };
}

export async function guardarPreferencias(
  db: SupabaseClient,
  privyDid: string,
  input: Record<string, unknown>,
): Promise<string> {
  // Solo los campos que el modelo mandó: un upsert parcial deja intacto el resto.
  const campos: (keyof Preferencias)[] = [
    "operacion", "barrios", "presupuesto_min", "presupuesto_max", "habs_min",
    "banos_min", "area_min", "estrato_min", "estrato_max", "amenidades", "notas",
  ];
  const fila: Record<string, unknown> = {
    privy_did: privyDid,
    actualizado_at: new Date().toISOString(),
  };
  for (const c of campos) if (input[c] !== undefined) fila[c] = input[c];

  const { error } = await db.from("preferencias").upsert(fila);
  if (error) return `No se pudo guardar: ${error.message}`;
  return "Preferencias guardadas.";
}

export async function leerPreferencias(
  db: SupabaseClient,
  privyDid: string,
): Promise<string | null> {
  const { data } = await db
    .from("preferencias")
    .select("*")
    .eq("privy_did", privyDid)
    .maybeSingle();
  if (!data) return null;

  // Se inyecta como contexto para que el agente no vuelva a preguntar lo que ya sabe.
  const limpio = Object.fromEntries(
    Object.entries(data).filter(
      ([k, v]) => v !== null && k !== "privy_did" && k !== "actualizado_at",
    ),
  );
  if (!Object.keys(limpio).length) return null;
  return `Lo que ya sabes de este usuario de sesiones anteriores: ${JSON.stringify(
    limpio,
  )}. No vuelvas a preguntar esto; confírmalo solo si parece desactualizado.`;
}

/**
 * Puntos de caché sobre el historial.
 *
 * El prompt de sistema y las herramientas ya se cacheaban, pero eso es un
 * prefijo fijo de unos 3.500 tokens: lo que crece turno a turno es el hilo, y
 * el hilo se estaba reenviando entero a precio completo en cada vuelta del
 * loop. En una sesión de quince turnos eso es la mayor parte de la factura.
 *
 * Dos marcas y no una. Con una sola, moverla hacia adelante en cada petición
 * deja el prefijo nuevo sin escribir todavía y el viejo sin marcar, y se
 * pierde el acierto justo cuando más historial hay. La de atrás es la que se
 * lee; la de adelante escribe el tramo nuevo para el turno siguiente.
 *
 * Devuelve un arreglo nuevo: `messages` se persiste en la tabla `mensajes` y
 * al rehidratar una conversación no queremos revivir marcas de caché viejas.
 */
export function conCache<M extends Anthropic.MessageParam | MessageParam>(
  messages: M[],
): M[] {
  // Menos de dos mensajes no tiene prefijo que valga la pena cachear, y por
  // debajo del mínimo cacheable la marca no hace nada salvo ocupar un cupo.
  if (messages.length < 2) return messages;

  const marcas = new Set<number>([messages.length - 1]);
  // Unas dos vueltas atrás: es el prefijo que la petición anterior escribió.
  if (messages.length >= 4) marcas.add(messages.length - 3);

  return messages.map((m, i) => {
    // El mensaje de sistema con la memoria va sin marca: es corto y solo
    // ocupa el último lugar en el primer turno, donde no hay prefijo que leer.
    if (!marcas.has(i) || m.role === "system") return m;

    // El bloque va al final del contenido, así que el contenido tiene que ser
    // bloques. Un `content` de texto plano se convierte.
    const bloques: ContentBlockParam[] =
      typeof m.content === "string"
        ? [{ type: "text", text: m.content }]
        : [...m.content];

    if (!bloques.length) return m;

    const ultimo = bloques[bloques.length - 1];
    // `thinking` y `redacted_thinking` no aceptan cache_control; marcarlos es
    // un 400 en mitad de la conversación.
    if (ultimo.type === "thinking" || ultimo.type === "redacted_thinking")
      return m;

    bloques[bloques.length - 1] = {
      ...ultimo,
      cache_control: { type: "ephemeral" },
    } as ContentBlockParam;

    return { ...m, content: bloques } as M;
  });
}
