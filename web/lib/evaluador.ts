import "server-only";

/**
 * Correr la rúbrica sobre una propuesta.
 *
 * Cierra la cadena que estaba cortada al final: la entrevista producía
 * `respuestas` completas y no había nada que las juzgara.
 *
 * El modelo no decide su propio puntaje global. Puntúa cada eje por separado y
 * el servidor pondera con los pesos de `EJES` según el tipo de proponente. Un
 * número que el modelo se saca de encima de un vistazo no es comparable entre
 * propuestas; una suma ponderada de ejes sustentados sí.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic } from "./anthropic";
import { estadisticasBarrio } from "./agente";
import {
  ESFUERZO, ESFUERZO_GRIS, EJES, HERRAMIENTAS_EVALUACION, MODELO_EVALUACION,
  RUBRICA_VERSION, SISTEMA_EVALUACION, bandaDe, puntajeFinal,
  type Veredicto,
} from "./evaluacion";
import { aplicables, regimenDe, type ProponenteId, conTipo } from "./intake";
import { registrarConsumo, sumarUso, usoVacio } from "./consumo";
import type { Respuestas } from "./types";

/** Tope de vueltas: consultar barrio, quizá otro, y emitir. */
const MAX_VUELTAS = 6;

export interface Proyecto {
  id: string;
  privy_did: string;
  proponente: ProponenteId;
  tipo: string;
  titulo: string | null;
  barrio: string | null;
  area_m2: number | null;
  meta_cop: number | null;
  plazo_meses: number | null;
  estado_obra: string | null;
  estado_detalle: string | null;
  respuestas: Respuestas;
  documentos: unknown[] | null;
}

/**
 * Lo que ve el evaluador. Se arma desde el guion y no volcando la fila: así
 * cada respuesta llega con la pregunta que la originó, y una pregunta que
 * aplicaba y quedó sin contestar aparece como tal en vez de desaparecer.
 * Un vacío invisible se lee como que no se preguntó.
 */
export function expediente(p: Proyecto, kyc?: string | null): string {
  const l: string[] = [
    // La fecha va aquí y no en el prompt de sistema, que está cacheado: una
    // fecha adentro lo invalidaria cada dia. Sin ella el modelo no sabe cuando
    // vive — en una prueba marco "fecha en el futuro" un incendio de marzo
    // estando en agosto del mismo ano, y lo levanto como senal de gravedad
    // media contra una propuesta que no tenia ese problema.
    `Hoy es ${new Date().toISOString().slice(0, 10)}.`,
    "",
    // Sin esto el modelo lo nota y castiga el eje de identidad por algo que sí
    // sabemos: el KYC vive en su propia tabla, no en el formulario.
    `Verificación de identidad (KYC): ${kyc ?? "sin enviar"}.`,
    "",
    `Proyecto: ${p.titulo ?? "(sin título)"}`,
    `Tipo de obra: ${p.tipo}`,
    `Proponente: ${p.proponente}`,
    `Barrio: ${p.barrio ?? "(no dice)"}`,
    `Área: ${p.area_m2 ?? "(no dice)"} m²`,
    `Meta: ${p.meta_cop ? `$${p.meta_cop.toLocaleString("es-CO")} COP` : "(no dice)"}`,
    `Plazo: ${p.plazo_meses ?? "(no dice)"} meses`,
    `Estado de obra: ${p.estado_obra ?? "(no dice)"}`,
    p.estado_detalle ? `Detalle: ${p.estado_detalle}` : "",
    "",
    "Soportes adjuntos: " +
      (Array.isArray(p.documentos) && p.documentos.length
        ? p.documentos
            .map((d) => (d as { tipo?: string }).tipo ?? "otro")
            .join(", ")
        : "ninguno"),
    "",
    "--- Entrevista ---",
  ].filter(Boolean);

  for (const q of aplicables(p.proponente, conTipo(p.tipo, p.respuestas))) {
    const v = p.respuestas[q.id];
    const vacio = v === undefined || v === null || v === "";
    l.push(`[${q.eje}] ${q.pregunta}`);
    l.push(
      vacio
        ? `  → SIN CONTESTAR${q.requerida ? " (era obligatoria)" : ""}`
        : `  → ${typeof v === "string" ? v : JSON.stringify(v)}`,
    );
  }

  l.push("", "--- Ejes y qué mide cada uno ---");
  for (const e of EJES)
    l.push(`${e.id} (peso ${e.peso[p.proponente]}): ${e.que_mide}`);

  return l.join("\n");
}

export interface Resultado {
  veredicto: Veredicto;
  puntaje: number;
  cobertura: number;
  banda: string;
  esfuerzo: string;
  costo_usd: number;
}

/**
 * Evalúa y guarda. `esfuerzo` sube a alto en la banda gris: gastar el doble
 * solo tiene sentido donde el fallo está en duda, no en lo que ya es claro.
 */
export async function evaluar(
  db: SupabaseClient,
  p: Proyecto,
  opciones: { esfuerzo?: "low" | "high" } = {},
): Promise<Resultado> {
  const esfuerzo = opciones.esfuerzo ?? ESFUERZO;

  // Una propuesta que ofrece retorno no se puntúa: no es que sea mala, es que
  // esta plataforma no la puede recibir. Ver el Decreto 1357 en intake.ts.
  if (regimenDe(p.respuestas) === "valores")
    throw new Error(
      "Esta propuesta ofrece retorno y queda fuera del régimen de donación. " +
        "No se evalúa con la rúbrica.",
    );

  const { data: kyc } = await db
    .from("kyc")
    .select("estado")
    .eq("privy_did", p.privy_did)
    .maybeSingle();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: expediente(p, kyc?.estado) },
  ];
  const uso = usoVacio();
  let veredicto: Veredicto | null = null;

  for (let vuelta = 0; vuelta < MAX_VUELTAS && !veredicto; vuelta++) {
    const r = await anthropic.messages.create({
      model: MODELO_EVALUACION,
      max_tokens: 8000,
      output_config: { effort: esfuerzo },
      system: [
        { type: "text", text: SISTEMA_EVALUACION, cache_control: { type: "ephemeral" } },
      ],
      tools: HERRAMIENTAS_EVALUACION,
      messages,
    });

    sumarUso(uso, MODELO_EVALUACION, r.usage);

    // Un clasificador puede declinar; hay que mirarlo antes de leer content.
    if (r.stop_reason === "refusal")
      throw new Error("El modelo declinó evaluar esta propuesta.");

    messages.push({ role: "assistant", content: r.content });
    if (r.stop_reason !== "tool_use") break;

    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const ll of r.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    )) {
      if (ll.name === "emitir_veredicto") {
        veredicto = ll.input as unknown as Veredicto;
        resultados.push({
          type: "tool_result",
          tool_use_id: ll.id,
          content: "Veredicto recibido.",
        });
        continue;
      }

      if (ll.name === "estadisticas_barrio") {
        const i = ll.input as { barrio?: string; operacion?: string };
        // El esquema de la herramienta pide un barrio; la consulta espera una
        // lista. Sin barrio se traen los de más volumen, que al menos dan
        // referencia de ciudad.
        const { paraModelo } = await estadisticasBarrio(db, {
          barrios: i.barrio ? [i.barrio] : [],
          operacion: i.operacion ?? "venta",
        });
        resultados.push({ type: "tool_result", tool_use_id: ll.id, content: paraModelo });
        continue;
      }

      resultados.push({
        type: "tool_result",
        tool_use_id: ll.id,
        content: `Herramienta desconocida: ${ll.name}`,
        is_error: true,
      });
    }
    messages.push({ role: "user", content: resultados });
  }

  // El registro va aunque no haya veredicto: la API ya facturó los intentos.
  await registrarConsumo(db, p.privy_did, {
    concepto: "evaluacion",
    modelo: MODELO_EVALUACION,
    uso,
    referencia: p.id,
  }).catch(() => {});

  if (!veredicto)
    throw new Error("El evaluador no emitió veredicto en el número de vueltas permitido.");

  const { puntaje, cobertura } = puntajeFinal(veredicto, p.proponente);
  const banda = bandaDe(puntaje);

  await db.from("evaluaciones").insert({
    proyecto_id: p.id,
    rubrica: RUBRICA_VERSION,
    modelo: MODELO_EVALUACION,
    esfuerzo,
    puntaje,
    cobertura,
    banda,
    ejes: veredicto.ejes,
    senales: veredicto.senales,
    resumen: veredicto.resumen,
    para_quien_propone: veredicto.para_quien_propone,
    costo_usd: uso.costo_usd,
  });

  return { veredicto, puntaje, cobertura, banda, esfuerzo, costo_usd: uso.costo_usd };
}

export { ESFUERZO_GRIS };
