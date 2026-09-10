import "server-only";

/**
 * El motor de la entrevista.
 *
 * La conversación la conduce el modelo, pero el guion NO lo decide él: las
 * preguntas, cuáles aplican y cuándo se acabaron salen de `intake.ts`, en
 * código. El modelo pone el tono, el orden fino y la capacidad de entender una
 * respuesta enredada; el servidor pone qué se pregunta y qué se guarda.
 *
 * Ese reparto es a propósito. Si el modelo decidiera cuándo terminó, dos
 * propuestas idénticas podrían recorrer preguntas distintas y la evaluación
 * dejaría de ser comparable — que es justo lo que la rúbrica intenta evitar.
 */

import type Anthropic from "@anthropic-ai/sdk";
import {
  BLOQUEO_VALORES, aplicables, faltantes, avance, regimenDe,
  type Pregunta, type ProponenteId,
} from "./intake";
import type { Respuestas } from "./types";

export const MODELO_INTAKE = "claude-opus-5";

/** Cuántas preguntas pendientes ve el modelo. */
const VENTANA = 3;

// ------------------------------------------------------------- validación

export interface Normalizado {
  aceptadas: Respuestas;
  /** Claves que llegaron y no se guardaron, con el motivo. */
  rechazadas: { id: string; porque: string }[];
}

/**
 * Solo entra lo que el guion conoce y con el tipo que el guion declara.
 *
 * El modelo escribe el objeto, y un modelo puede inventarse una clave, mandar
 * "unos 80" donde va un número o una opción que no existe. Nada de eso puede
 * llegar a `respuestas`: esa columna la lee después el evaluador y la
 * revisión humana, y un dato inventado ahí es peor que un dato faltante.
 */
export function normalizar(
  proponente: ProponenteId,
  actuales: Respuestas,
  crudas: unknown,
): Normalizado {
  const aceptadas: Respuestas = {};
  const rechazadas: { id: string; porque: string }[] = [];

  if (!crudas || typeof crudas !== "object" || Array.isArray(crudas))
    return { aceptadas, rechazadas };

  // Las que aplican se recalculan con lo que ya había MÁS lo que llega, para
  // que una pregunta condicional se pueda contestar en el mismo turno que la
  // que la habilita.
  const previo = { ...actuales, ...(crudas as Respuestas) };
  const porId = new Map(
    aplicables(proponente, previo).map((p) => [p.id, p] as const),
  );

  for (const [id, valor] of Object.entries(crudas as Record<string, unknown>)) {
    const p = porId.get(id);
    if (!p) {
      rechazadas.push({ id, porque: "no está en el guion de este proponente" });
      continue;
    }
    const v = coercer(p, valor);
    if (v === undefined) {
      rechazadas.push({ id, porque: `no es un valor válido de tipo ${p.tipo}` });
      continue;
    }
    aceptadas[id] = v;
  }

  return { aceptadas, rechazadas };
}

function coercer(
  p: Pregunta,
  valor: unknown,
): string | number | boolean | undefined {
  if (valor === null || valor === undefined) return undefined;

  switch (p.tipo) {
    case "booleano": {
      if (typeof valor === "boolean") return valor;
      const s = String(valor).trim().toLowerCase();
      if (["si", "sí", "true", "1"].includes(s)) return true;
      if (["no", "false", "0"].includes(s)) return false;
      return undefined;
    }
    case "numero":
    case "moneda": {
      if (typeof valor === "number")
        return Number.isFinite(valor) && valor >= (p.tipo === "moneda" ? 1 : 0)
          ? (p.tipo === "moneda" ? Math.round(valor) : valor)
          : undefined;

      const limpio = String(valor).replace(p.tipo === "moneda" ? /[^\d]/g : /[^\d.-]/g, "");
      // Sin esta guarda, "varios" se limpia a cadena vacia, Number("") es 0 y
      // 0 pasa el >= 0: "¿cuantas personas viven ahi?" quedaba guardado como
      // un hogar de CERO personas, y el evaluador puntuaba impacto sobre eso.
      // Un dato inventado en silencio es peor que uno faltante.
      if (!/\d/.test(limpio)) return undefined;

      const n = Number(limpio);
      if (!Number.isFinite(n)) return undefined;
      return p.tipo === "moneda"
        ? (n > 0 ? Math.round(n) : undefined)
        : (n >= 0 ? n : undefined);
    }
    case "opcion": {
      const s = String(valor).trim();
      return p.opciones?.some((o) => o.id === s) ? s : undefined;
    }
    case "fecha": {
      const s = String(valor).trim();
      // Se guarda como AAAA-MM-DD. Una fecha en otro formato se rechaza en vez
      // de adivinarse: 03/04 es marzo o abril según de dónde venga quien
      // escribe, y equivocarse cambia el relato de un evento.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
      return Number.isNaN(Date.parse(s)) ? undefined : s;
    }
    case "url": {
      const s = String(valor).trim();
      if (!s) return undefined;
      // Se acepta un @usuario o un dominio pelado: pedirle a alguien la URL
      // canónica de su Instagram es pedirle que se equivoque.
      return s.length <= 300 ? s : undefined;
    }
    default: {
      const s = String(valor).trim();
      if (!s) return undefined;
      return s.length <= 4000 ? s : s.slice(0, 4000);
    }
  }
}

// ------------------------------------------------------------------ prompt

/** Parte fija: se cachea, no depende del estado de la entrevista. */
export const SISTEMA_INTAKE = `Acompañas a alguien que quiere financiar una obra de
vivienda en Cali a través de CUADRA. Tu trabajo es entender su caso y dejar registrado lo
que la revisión necesita para decidir.

Esto no es un formulario leído en voz alta. Mucha gente que llega aquí perdió su casa o su
negocio, y algunas preguntas se sienten invasivas si aparecen sin contexto.

Cómo trabajas:
- UNA pregunta por mensaje. Siempre.
- Si la pregunta puede sonar invasiva o burocrática, di en media línea para qué sirve
  antes de hacerla. Tienes el motivo de cada una: úsalo, no lo recites.
- Cuando te contesten, llama a guardar_respuestas de una con lo que entendiste, y sigue
  con la siguiente. No acumules varias respuestas para guardarlas al final.
- Una respuesta puede traer varias cosas a la vez ("somos cuatro, dos niños"). Guárdalas
  todas juntas.
- Si la respuesta es ambigua, no adivines: repregunta una sola vez, corto. Si aun así no
  queda claro, sigue adelante y déjalo sin guardar; un dato inventado es peor que uno
  faltante.
- Si no saben algo (la matrícula, si están en zona de riesgo), eso es una respuesta
  válida: guárdala como lo que dijeron y sigue. No los mandes a buscar papeles ahora.
- No prometas plata, plazos ni aprobación. No estimas si el proyecto es viable: eso lo
  decide la revisión después.

Tono: español colombiano, directo, cálido sin ser meloso. Frases cortas. Nada de "¡Qué
emocionante!" ni de lenguaje de formulario. Si alguien cuenta algo duro, respóndele como
una persona antes de seguir con la siguiente pregunta.`;

/**
 * Parte que cambia cada turno: va después del corte de caché.
 *
 * `estancada` es la cantidad de mensajes del asistente desde el último dato
 * guardado. Sin eso la entrevista se traba: la pregunta sin contestar sigue
 * saliendo de primera en la lista, el modelo vuelve a ella, y se cae en un
 * intercambio que no avanza y sí gasta créditos. Se vio en una simulación
 * completa contra la API.
 */
export function estadoIntake(
  proponente: ProponenteId,
  r: Respuestas,
  estancada = 0,
): string {
  let pendientes = faltantes(proponente, r);
  // `tipo` viene de la fila, no de la entrevista: se dice aparte.
  const contestadas = Object.entries(r).filter(([k, v]) => k !== "tipo" && v !== null && v !== "");

  const lineas: string[] = [
    // El modelo no sabe qué día es, y sin esto "el mes pasado" o "este año" se
    // resuelven a un año cualquiera. Medido: dijo "12 de marzo de este año"
    // estando en 2026 y quedó guardado 2025-03-12 — el evento desplazado un
    // año entero, y la fecha es justo lo que ancla el relato.
    `Hoy es ${new Date().toISOString().slice(0, 10)}. Resuelve con esa fecha cualquier`,
    `referencia relativa ("el mes pasado", "este año", "hace dos meses").`,
    "",
    `Tipo de proponente: ${proponente}.`,
    r.tipo ? `Tipo de obra: ${r.tipo} (ya escogido; no lo preguntes).` : "",
    `Avance: ${Math.round(avance(proponente, r) * 100)}%.`,
  ];

  if (contestadas.length) {
    lineas.push("", "Ya contestado (no lo vuelvas a preguntar):");
    for (const [k, v] of contestadas) lineas.push(`- ${k}: ${JSON.stringify(v)}`);
  }

  if (!pendientes.length) {
    lineas.push(
      "",
      "No queda nada pendiente. Dile que con esto basta, resume en tres o cuatro " +
        "líneas lo que entendiste del proyecto y avísale que puede revisarlo y " +
        "mandarlo a revisión cuando quiera. No hagas más preguntas.",
    );
    return lineas.join("\n");
  }

  // Tras tres intentos sin sacar nada, esa pregunta pasa al final. Insistir
  // una cuarta vez no la va a contestar; la rúbrica ya sabe qué hacer con un
  // dato que falta, y trabar la entrevista entera por uno solo es peor.
  if (estancada >= 3 && pendientes.length > 1) {
    const [trabada, ...resto] = pendientes;
    pendientes = [...resto, trabada];
    lineas.push(
      "",
      `Llevas ${estancada} intentos con "${trabada.id}" sin resultado. Déjala por ` +
        "ahora, dilo en media línea y sigue con la siguiente. No la repitas.",
    );
  }

  lineas.push("", `Faltan ${pendientes.length}. Las siguientes, en orden:`);
  for (const p of pendientes.slice(0, VENTANA)) {
    lineas.push(`- ${p.id} · ${p.pregunta}`);
    lineas.push(`  para qué sirve: ${p.motivo}`);
    if (p.opciones)
      lineas.push(`  opciones (guarda el id): ${p.opciones.map((o) => `${o.id}=${o.label}`).join(", ")}`);
    else lineas.push(`  tipo: ${p.tipo}`);
  }
  lineas.push("", "Haz SOLO la primera de esa lista.");

  return lineas.join("\n");
}

export const HERRAMIENTAS_INTAKE: Anthropic.Tool[] = [
  {
    name: "guardar_respuestas",
    description:
      "Guarda lo que acabas de entender. Las claves son los identificadores " +
      "del guion (los que aparecen antes del '·'). Manda solo lo que la " +
      "persona realmente dijo; nunca rellenes lo que no contestó.",
    input_schema: {
      type: "object",
      properties: {
        respuestas: {
          type: "object",
          description:
            "Mapa id → valor. Para preguntas de opción, el id de la opción. " +
            "Para booleanos, true o false. Para fechas, AAAA-MM-DD.",
          additionalProperties: true,
        },
      },
      required: ["respuestas"],
      additionalProperties: false,
    },
  },
];

// --------------------------------------------------------------- el bloqueo

/**
 * La única salida que no es una pregunta más. Si la propuesta ofrece retorno,
 * deja de ser un aporte y pasa a ser emisión de valores, que exige
 * autorización de la Superintendencia Financiera. Se corta aquí y no en la
 * rúbrica para poder decirlo en el momento y no después de treinta preguntas.
 */
export function bloqueada(r: Respuestas): string | null {
  return regimenDe(r) === "valores" ? BLOQUEO_VALORES : null;
}
