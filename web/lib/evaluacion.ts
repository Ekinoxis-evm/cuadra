/**
 * La rúbrica: cómo se evalúa una propuesta, siempre igual.
 *
 * El punto de tener una rúbrica escrita y no "que el modelo opine" es que dos
 * propuestas parecidas reciban la misma lectura, y que quien recibe un no
 * pueda ver en qué eje perdió. Los pesos viven aquí, en código versionado, no
 * dentro de un prompt: cambiarlos deja rastro en git y `RUBRICA_VERSION` queda
 * guardada con cada veredicto, así que un fallo viejo se puede releer con la
 * rúbrica que lo produjo.
 *
 * -------------------------------------------------------------- el anclaje
 * El eje de presupuesto no se juzga a ojo. CUADRA tiene mediana y $/m² reales
 * de 303 barrios de Cali, así que "¿5 millones para 80 m² en El Limonar es
 * coherente?" es una pregunta con respuesta, no una impresión. El evaluador
 * está obligado a llamar `estadisticas_barrio` antes de puntuar ese eje; sin
 * ese dato el eje se marca como no evaluable en vez de inventarse un número.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { EjeId, ProponenteId } from "./intake";

/**
 * Fable 5 en effort bajo. El razonamiento se factura como salida y es lo que
 * domina el costo; una rúbrica cerrada con salida estructurada no necesita
 * profundidad, el juicio difícil ya está en los pesos y en los datos de
 * barrio. Los casos de banda gris se reevalúan en alto — ver `ESFUERZO_GRIS`.
 */
export const MODELO_EVALUACION = "claude-fable-5";
export const ESFUERZO = "low" as const;
export const ESFUERZO_GRIS = "high" as const;

/** Sube con cada cambio de pesos, ejes o umbrales. */
export const RUBRICA_VERSION = 1;

// --------------------------------------------------------------------- ejes

export interface Eje {
  id: EjeId;
  titulo: string;
  que_mide: string;
  /** Peso por tipo de proponente: lo que acredita a cada uno es distinto. */
  peso: Record<ProponenteId, number>;
}

export const EJES: Eje[] = [
  {
    id: "identidad",
    titulo: "Identidad y trazabilidad",
    que_mide:
      "Que haya alguien real y ubicable detrás, y que lo declarado coincida " +
      "con lo verificable: KYC, NIT, representación legal, huella pública " +
      "anterior a la propuesta.",
    // Una empresa o una ESAL se acreditan con registros públicos, y por eso
    // este eje pesa más en ellas: hay más que verificar y menos excusa para
    // que falte.
    peso: { persona: 20, empresa: 30, sin_animo_lucro: 30, gobierno: 30 },
  },
  {
    id: "predio",
    titulo: "Legitimidad del predio",
    que_mide:
      "Que exista el inmueble, que se sepa quién responde por él y que no " +
      "haya un impedimento de fondo: zona de riesgo, sin autorización del " +
      "dueño, predial en mora.",
    peso: { persona: 25, empresa: 20, sin_animo_lucro: 20, gobierno: 15 },
  },
  {
    id: "presupuesto",
    titulo: "Coherencia del presupuesto",
    que_mide:
      "Que la meta cuadre con el área, el estado de obra y lo que cuesta el " +
      "m² en ese barrio según los datos de CUADRA. Y que se sepa de dónde " +
      "salió la cifra.",
    peso: { persona: 25, empresa: 25, sin_animo_lucro: 20, gobierno: 25 },
  },
  {
    id: "viabilidad",
    titulo: "Viabilidad de ejecución",
    que_mide:
      "Que la obra se pueda hacer en el plazo dicho: licencias, estado " +
      "actual, quién la ejecuta.",
    peso: { persona: 15, empresa: 15, sin_animo_lucro: 15, gobierno: 20 },
  },
  {
    id: "impacto",
    titulo: "Impacto",
    que_mide:
      "A cuánta gente cambia la vida esta obra y qué tan urgente es. Hogares " +
      "con menores o adultos mayores en vivienda inhabitable, empleos que " +
      "dependen de reabrir, beneficiarios de una ESAL.",
    peso: { persona: 15, empresa: 10, sin_animo_lucro: 15, gobierno: 10 },
  },
];

// ------------------------------------------------------------------ bandas

/**
 * Tres salidas, no dos. El umbral alto no aprueba solo: manda a la vitrina
 * una propuesta que un humano todavía confirma. Con menos de cinco propuestas
 * al mes, automatizar el "sí" definitivo no ahorra nada y sí puede publicar
 * algo que nadie miró.
 */
export const BANDAS = [
  {
    id: "recomendado",
    desde: 75,
    titulo: "Listo para publicar",
    accion: "Pasa a la cola de revisión con recomendación favorable.",
  },
  {
    id: "gris",
    desde: 50,
    titulo: "Necesita mirada humana",
    accion:
      "Se reevalúa en esfuerzo alto y va a la cola marcado con lo que quedó " +
      "en duda.",
  },
  {
    id: "devuelto",
    desde: 0,
    titulo: "Devuelto a quien propone",
    accion:
      "Vuelve a borrador con las razones concretas y qué hay que corregir.",
  },
] as const;

export type BandaId = (typeof BANDAS)[number]["id"];

export const bandaDe = (puntaje: number): BandaId =>
  (BANDAS.find((b) => puntaje >= b.desde) ?? BANDAS[BANDAS.length - 1]).id;

// ------------------------------------------------------------------ salida

/**
 * Salida estructurada y no texto libre: el veredicto se guarda en columnas, se
 * puede ordenar la cola por puntaje y se puede releer un fallo viejo. Un
 * párrafo bonito no permite nada de eso.
 */
export const ESQUEMA_VEREDICTO = {
  type: "object",
  additionalProperties: false,
  required: ["ejes", "senales", "resumen", "para_quien_propone"],
  properties: {
    ejes: {
      type: "array",
      description: "Un elemento por eje de la rúbrica, en el mismo orden.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["eje", "puntaje", "evaluable", "sustento"],
        properties: {
          eje: {
            type: "string",
            enum: EJES.map((e) => e.id),
          },
          puntaje: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description:
              "0–100 dentro del eje. El peso lo aplica el servidor, no tú.",
          },
          evaluable: {
            type: "boolean",
            description:
              "false cuando falta el dato para juzgar. Un eje no evaluable " +
              "no es un eje en cero: se excluye del promedio y se pide el dato.",
          },
          sustento: {
            type: "string",
            description:
              "Dos o tres frases citando la respuesta o el dato concreto en " +
              "que te apoyas. Nada de generalidades.",
          },
        },
      },
    },
    senales: {
      type: "array",
      description:
        "Contradicciones, vacíos o cosas que no cuadran. Vacío si no hay.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gravedad", "asunto", "detalle"],
        properties: {
          gravedad: { type: "string", enum: ["alta", "media", "baja"] },
          asunto: { type: "string" },
          detalle: { type: "string" },
        },
      },
    },
    resumen: {
      type: "string",
      description: "Cuatro frases para quien revisa. Directo, sin preámbulo.",
    },
    para_quien_propone: {
      type: "string",
      description:
        "Qué le falta o qué debe corregir, dirigido a esa persona, en " +
        "segunda persona y sin jerga. Es el texto que va a leer si se le " +
        "devuelve la propuesta.",
    },
  },
} as const;

export interface EjeEvaluado {
  eje: EjeId;
  puntaje: number;
  evaluable: boolean;
  sustento: string;
}

export interface Veredicto {
  ejes: EjeEvaluado[];
  senales: { gravedad: "alta" | "media" | "baja"; asunto: string; detalle: string }[];
  resumen: string;
  para_quien_propone: string;
}

/**
 * Puntaje final: promedio ponderado de los ejes EVALUABLES, renormalizando los
 * pesos sobre esos. Contar un eje sin datos como cero castigaría por no haber
 * preguntado, que es culpa nuestra y no de quien propone.
 */
export function puntajeFinal(
  v: Veredicto,
  proponente: ProponenteId,
): { puntaje: number; cobertura: number } {
  const pesos = new Map(EJES.map((e) => [e.id, e.peso[proponente]]));
  const total = EJES.reduce((s, e) => s + e.peso[proponente], 0);

  let suma = 0;
  let pesoUsado = 0;
  for (const e of v.ejes) {
    if (!e.evaluable) continue;
    const peso = pesos.get(e.eje) ?? 0;
    suma += e.puntaje * peso;
    pesoUsado += peso;
  }

  return {
    puntaje: pesoUsado ? Math.round(suma / pesoUsado) : 0,
    // Qué proporción de la rúbrica se pudo evaluar. Un 90 con cobertura de
    // 0,4 no es un 90: es un 90 sobre menos de la mitad del examen.
    cobertura: total ? pesoUsado / total : 0,
  };
}

// ------------------------------------------------------------------ prompt

export const SISTEMA_EVALUACION = `Evalúas propuestas de financiación de obra de vivienda
en Cali, Colombia, para CUADRA. Tu salida la lee una persona que decide si publicar la
propuesta, y también quien la propuso si se le devuelve.

Cómo evalúas:
- Puntúas cada eje de 0 a 100 por separado. El peso lo aplica el servidor: no intentes
  ponderar ni dar un puntaje global.
- Antes de puntuar el eje de presupuesto DEBES llamar estadisticas_barrio con el barrio
  del proyecto. Compara la meta contra el área y el $/m² real de ese barrio. Si la
  herramienta no devuelve datos, marca ese eje evaluable: false. Nunca estimes un $/m²
  de memoria.
- Un eje sin el dato necesario va con evaluable: false, no con puntaje 0. Cero significa
  "lo evalué y está mal", no "no me lo dijeron".
- Te apoyas en lo que está escrito. Cita la respuesta concreta en el sustento. Si algo
  no se preguntó, eso es un vacío del formulario y va como señal, no como culpa de quien
  propone.
- El expediente trae la fecha de hoy y el estado del KYC. Úsalos: el KYC es la
  verificación de identidad y va en ese eje, y no lo pide el formulario porque vive
  aparte. Nunca juzgues una fecha sin compararla contra el "Hoy es" del expediente.

Qué es una señal de gravedad alta:
- El documento del KYC no coincide con el representante legal declarado.
- Predio en zona de riesgo con una obra que implica seguir ocupándolo.
- No es propietario ni tiene autorización del dueño.
- La meta se aparta un orden de magnitud de lo que sugieren el área y el $/m² del barrio.
- Cifras que se contradicen entre respuestas.
- Ninguna huella pública verificable cuando la entidad dice llevar años operando.

Lo que NO es señal alta: redacción pobre, respuestas cortas, no tener licencia cuando la
obra no la requiere, o no estar en Régimen Tributario Especial. Nada de eso habla de la
legitimidad de la propuesta.

Tono: español colombiano, directo, sin adornos. En para_quien_propone hablas de tú, dices
qué falta y cómo arreglarlo. Nadie que perdió su casa necesita leer jerga administrativa.`;

/**
 * Dos herramientas. La de barrio es la misma consulta que usa el chat, pero
 * aquí es obligatoria: es lo que convierte "el presupuesto suena raro" en
 * "pides 5M para 80 m² donde el m² se vende a 3,2M".
 *
 * El veredicto también es una herramienta y no salida estructurada. Con
 * `output_config.format` habría que elegir entre formato garantizado y poder
 * consultar el barrio; como herramienta, el modelo consulta lo que necesite y
 * después emite, y el esquema se valida igual.
 */
export const HERRAMIENTAS_EVALUACION: Anthropic.Tool[] = [
  {
    name: "emitir_veredicto",
    description:
      "Emite el fallo final. Llámala UNA sola vez, al final, después de " +
      "haber consultado las estadísticas del barrio. Un elemento por eje de " +
      "la rúbrica.",
    input_schema: ESQUEMA_VEREDICTO as unknown as Anthropic.Tool.InputSchema,
  },
  {
    name: "estadisticas_barrio",
    description:
      "Mediana de precio y $/m² reales de un barrio de Cali, sobre los " +
      "listings activos de CUADRA. Úsala siempre antes de puntuar el eje de " +
      "presupuesto.",
    input_schema: {
      type: "object",
      properties: {
        barrio: {
          type: "string",
          description: "Nombre del barrio tal como lo escribió quien propone.",
        },
        operacion: {
          type: "string",
          enum: ["venta", "arriendo"],
          description:
            "Para comparar contra costo de obra usa 'venta': el $/m² de " +
            "venta es el que se aproxima al valor del inmueble terminado.",
        },
      },
      required: ["barrio", "operacion"],
      additionalProperties: false,
    },
  },
];
