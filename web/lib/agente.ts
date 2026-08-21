import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing, Preferencias } from "./types";

export const MODELO = "claude-opus-5";

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

Tono: directo y breve, español colombiano, sin jerga de bienes raíces ni exageración.
Los precios van en pesos colombianos. Nunca inventes inmuebles ni precios: todo lo que
menciones debe salir de buscar_inmuebles. Si no hay resultados, dilo y propón aflojar
un filtro concreto.`;

export const HERRAMIENTAS: Anthropic.Tool[] = [
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
    q = q.in("barrio", input.barrios as string[]);
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
): Promise<string> {
  let q = db
    .from("barrio_stats")
    .select("*")
    .eq("operacion", (input.operacion as string) ?? "arriendo");
  if (Array.isArray(input.barrios) && input.barrios.length)
    q = q.in("barrio", input.barrios as string[]);

  const { data, error } = await q.order("n", { ascending: false }).limit(25);
  if (error) return `Error consultando estadísticas: ${error.message}`;
  if (!data?.length) return "No hay estadísticas para esos barrios.";
  return JSON.stringify(data);
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
