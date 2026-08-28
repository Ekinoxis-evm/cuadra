/**
 * Las preguntas que hay que hacerle a quien pide financiación, por tipo.
 *
 * Una sola definición para dos superficies: el asistente las hace en voz alta,
 * una por una, y el formulario las pinta como campos. Cuando el guion del chat
 * y el formulario vivían aparte, el chat preguntaba cosas que el formulario no
 * guardaba y la revisión recibía propuestas a medias.
 *
 * ------------------------------------------------------------------ el marco
 * El Decreto 1357 de 2018 (que modifica el 2555 de 2010) regula la
 * "financiación colaborativa" SOLO cuando se emiten valores: títulos de deuda
 * o de participación. Esa actividad exige entidad autorizada por la
 * Superintendencia Financiera, y el receptor tiene que ser persona jurídica
 * con un proyecto productivo.
 *
 * La financiación por DONACIÓN o por RECOMPENSA quedó expresamente fuera de
 * ese decreto. Por eso CUADRA opera hoy en esa vía: quien aporta a
 * "reconstruir mi hogar" no está comprando un valor ni esperando retorno.
 *
 * La distinción no es una nota al pie, es la que decide qué se puede
 * preguntar y qué se puede prometer. Está codificada en REGIMENES y el
 * evaluador la resuelve ANTES que cualquier otra cosa: si una propuesta pide
 * retorno financiero, no es un caso de rúbrica baja, es un caso que esta
 * plataforma no puede recibir todavía.
 */

import type { Respuestas } from "./types";

// --------------------------------------------------------------- el régimen

export const REGIMENES = [
  {
    id: "donacion",
    titulo: "Aporte sin retorno",
    detalle:
      "Quien aporta no espera recuperar la plata ni recibir rendimiento. " +
      "Puede recibir reconocimiento o una recompensa no financiera.",
    // Fuera del Decreto 1357: no requiere autorización de la SFC.
    habilitado: true,
  },
  {
    id: "valores",
    titulo: "Deuda o participación",
    detalle:
      "Quien aporta espera que le devuelvan la plata, con rendimiento o con " +
      "una participación en el proyecto.",
    // Dentro del Decreto 1357. Requiere entidad autorizada por la
    // Superintendencia Financiera, receptor persona jurídica y proyecto
    // productivo. Hasta que eso exista, la propuesta se detiene aquí.
    habilitado: false,
  },
] as const;

export type RegimenId = (typeof REGIMENES)[number]["id"];

// -------------------------------------------------------------- proponentes

/**
 * Cada tipo trae su propio set de preguntas porque lo que acredita a cada uno
 * es distinto: a una persona la acredita su cédula y su relación con el
 * predio; a una empresa, el certificado de existencia y representación legal;
 * a una fundación, su personería jurídica y si está o no en el Régimen
 * Tributario Especial.
 */
export const PROPONENTES = [
  {
    id: "persona",
    label: "Persona",
    detalle: "Propongo a título personal, por mi vivienda o la de mi familia",
    regimen: "donacion",
  },
  {
    id: "empresa",
    label: "Empresa o negocio",
    detalle: "Un negocio afectado, una constructora o una sociedad",
    regimen: "donacion",
  },
  {
    id: "sin_animo_lucro",
    label: "Sin ánimo de lucro",
    detalle: "Fundación, corporación o asociación con personería jurídica",
    regimen: "donacion",
  },
  {
    id: "gobierno",
    label: "Entidad pública",
    detalle: "Alcaldía, secretaría o entidad del Estado",
    regimen: "donacion",
  },
] as const;

export type ProponenteId = (typeof PROPONENTES)[number]["id"];

// ------------------------------------------------------------------ la forma

/** Los ejes de la rúbrica. Cada pregunta alimenta uno; ver evaluacion.ts. */
export type EjeId =
  | "identidad"
  | "predio"
  | "presupuesto"
  | "viabilidad"
  | "impacto";

export type TipoCampo =
  | "texto"
  | "texto_largo"
  | "numero"
  | "moneda"
  | "opcion"
  | "booleano"
  | "fecha"
  | "url";

export interface Pregunta {
  /** Clave donde se guarda la respuesta. */
  id: string;
  /** Cómo la hace el asistente, en voz alta y en segunda persona. */
  pregunta: string;
  /** Etiqueta corta para el formulario. */
  campo: string;
  /**
   * Por qué se pregunta. Se le muestra a quien duda y también entra al prompt
   * del asistente: sin el motivo, el modelo insiste sin poder explicarse y la
   * gente abandona en la pregunta que le parece invasiva.
   */
  motivo: string;
  tipo: TipoCampo;
  opciones?: readonly { id: string; label: string }[];
  requerida: boolean;
  eje: EjeId;
  /** Solo se pregunta si esto da true. Evita interrogatorios que no aplican. */
  si?: (r: Respuestas) => boolean;
}

// ------------------------------------------------------- preguntas del predio
// Comunes a todos los tipos: el inmueble y la obra no cambian según quién
// proponga. Lo que cambia es quién responde por ellos.

export const PREDIO: Pregunta[] = [
  {
    id: "relacion_predio",
    campo: "Relación con el predio",
    pregunta: "¿Qué relación tienes con el predio? ¿Eres el dueño?",
    motivo:
      "Sin saber quién responde por el inmueble no se puede pedir plata para " +
      "intervenirlo. No exige ser propietario: un poseedor o un heredero " +
      "también puede proponer, pero se evalúa distinto.",
    tipo: "opcion",
    opciones: [
      { id: "propietario", label: "Soy el propietario" },
      { id: "poseedor", label: "Lo poseo sin escritura" },
      { id: "heredero", label: "Lo heredé, sucesión en trámite" },
      { id: "arrendatario", label: "Vivo o trabajo ahí en arriendo" },
      { id: "otro", label: "Otra" },
    ],
    requerida: true,
    eje: "predio",
  },
  {
    id: "matricula_inmobiliaria",
    campo: "Matrícula inmobiliaria",
    pregunta:
      "¿Cuál es la matrícula inmobiliaria del predio? Aparece en el " +
      "certificado de tradición y libertad, con forma tipo 370-123456.",
    motivo:
      "Es el único número que identifica un predio sin ambigüedad en el " +
      "registro público. Con él se verifica la titularidad y si hay hipotecas " +
      "o embargos; una dirección sola no sirve para eso.",
    tipo: "texto",
    requerida: false,
    eje: "predio",
    si: (r) => r.relacion_predio !== "arrendatario",
  },
  {
    id: "autorizacion_propietario",
    campo: "Autorización del propietario",
    pregunta:
      "Como no eres el dueño, ¿tienes autorización escrita del propietario " +
      "para intervenir el inmueble?",
    motivo:
      "Recoger plata para arreglar un inmueble ajeno sin permiso del dueño " +
      "deja la obra en el aire y a quien aportó sin nada.",
    tipo: "booleano",
    requerida: true,
    eje: "predio",
    si: (r) =>
      r.relacion_predio === "arrendatario" || r.relacion_predio === "otro",
  },
  {
    id: "zona_riesgo",
    campo: "Zona de riesgo",
    pregunta:
      "¿El predio está en zona de riesgo según el POT o alguna entidad lo " +
      "declaró así? Si no sabes, dilo y lo dejamos por verificar.",
    motivo:
      "Invertir en reconstruir donde el POT prohíbe ocupar es plata perdida y " +
      "puede exponer a la gente. Si está en riesgo, la salida suele ser " +
      "reubicación, no obra.",
    tipo: "opcion",
    opciones: [
      { id: "no", label: "No está en zona de riesgo" },
      { id: "si", label: "Sí, está en zona de riesgo" },
      { id: "no_se", label: "No sé" },
    ],
    requerida: true,
    eje: "predio",
  },
  {
    id: "licencia_estado",
    campo: "Licencia de construcción",
    pregunta: "¿El proyecto ya tiene licencia de construcción o está en trámite?",
    motivo:
      "Obra nueva y reforzamiento estructural requieren licencia de la " +
      "curaduría urbana. Una reparación menor no. Saber en qué punto está " +
      "cambia por completo el plazo real de la obra.",
    tipo: "opcion",
    opciones: [
      { id: "aprobada", label: "Ya está aprobada" },
      { id: "en_tramite", label: "En trámite" },
      { id: "no_requiere", label: "La obra no la requiere" },
      { id: "no_iniciada", label: "Todavía no se ha tramitado" },
    ],
    requerida: true,
    eje: "viabilidad",
    si: (r) => r.tipo === "nuevo" || r.estado_obra === "inhabitable",
  },
  {
    id: "paz_salvo_predial",
    campo: "Paz y salvo predial",
    pregunta: "¿El predio está al día en impuesto predial y valorización?",
    motivo:
      "Un predio con predial vencido puede terminar en cobro coactivo, y la " +
      "obra financiada quedaría sobre un bien en proceso de embargo.",
    tipo: "booleano",
    requerida: false,
    eje: "predio",
  },
  {
    id: "origen_meta",
    campo: "De dónde sale la meta",
    pregunta:
      "¿Cómo calculaste la meta? ¿Sale de una cotización, de un presupuesto " +
      "de obra, o es un estimado tuyo?",
    motivo:
      "Es la pregunta que más separa una propuesta seria de una cifra puesta " +
      "a ojo. No exige presupuesto formal, pero sí saber de dónde salió el " +
      "número que se le está pidiendo a la gente.",
    tipo: "texto_largo",
    requerida: true,
    eje: "presupuesto",
  },
  {
    id: "otras_ayudas",
    campo: "Otras ayudas recibidas",
    pregunta:
      "¿Ya recibiste ayuda de alguna entidad para esta misma obra? " +
      "Alcaldía, gestión del riesgo, una fundación, un seguro.",
    motivo:
      "No para descalificar: para no financiar dos veces lo mismo y para " +
      "ajustar la meta a lo que de verdad falta.",
    tipo: "texto_largo",
    requerida: true,
    eje: "presupuesto",
  },
];

// -------------------------------------------------------- persona natural

export const PERSONA: Pregunta[] = [
  {
    id: "evento_causa",
    campo: "Qué pasó",
    pregunta:
      "¿Hubo un evento que dañó el inmueble? Un incendio, una inundación, " +
      "un deslizamiento, un sismo. ¿O es deterioro acumulado?",
    motivo:
      "Un daño por evento tiene fecha, suele tener registro en gestión del " +
      "riesgo y se puede contrastar. El deterioro acumulado se evalúa por el " +
      "estado actual, no por un hecho puntual.",
    tipo: "opcion",
    opciones: [
      { id: "incendio", label: "Incendio" },
      { id: "inundacion", label: "Inundación" },
      { id: "deslizamiento", label: "Deslizamiento o remoción en masa" },
      { id: "sismo", label: "Sismo" },
      { id: "estructural", label: "Falla estructural" },
      { id: "deterioro", label: "Deterioro acumulado, sin un evento" },
      { id: "ninguno", label: "No hubo daño; es una mejora o ampliación" },
    ],
    requerida: true,
    eje: "impacto",
  },
  {
    id: "evento_fecha",
    campo: "Cuándo pasó",
    pregunta: "¿En qué fecha ocurrió?",
    motivo:
      "Ancla el relato en el tiempo y permite cruzarlo con registros " +
      "públicos de la emergencia.",
    tipo: "fecha",
    requerida: true,
    eje: "impacto",
    si: (r) =>
      typeof r.evento_causa === "string" &&
      !["deterioro", "ninguno"].includes(r.evento_causa),
  },
  {
    id: "personas_hogar",
    campo: "Personas en el hogar",
    pregunta: "¿Cuántas personas viven o vivían en el inmueble?",
    motivo:
      "Es la medida de impacto de una vivienda: cuánta gente depende de que " +
      "esta obra se haga.",
    tipo: "numero",
    requerida: true,
    eje: "impacto",
  },
  {
    id: "menores_adultos_mayores",
    campo: "Menores o adultos mayores",
    pregunta:
      "¿Entre ellos hay menores de edad, adultos mayores o personas con " +
      "discapacidad?",
    motivo:
      "Prioriza. Un hogar con un adulto mayor en una casa inhabitable no " +
      "está en la misma urgencia que uno que puede esperar.",
    tipo: "booleano",
    requerida: true,
    eje: "impacto",
  },
  {
    id: "vive_actualmente",
    campo: "Dónde vive hoy",
    pregunta: "¿Dónde están viviendo mientras tanto?",
    motivo:
      "Distingue entre quien sigue habitando un inmueble deteriorado, quien " +
      "está donde un familiar y quien está pagando arriendo además de la " +
      "obra. Cambia la urgencia y el plazo tolerable.",
    tipo: "texto_largo",
    requerida: true,
    eje: "impacto",
  },
  {
    id: "redes_personales",
    campo: "Redes sociales",
    pregunta:
      "¿Tienes redes sociales donde se te pueda ubicar? Instagram, Facebook, " +
      "LinkedIn o X. Sirve una sola.",
    motivo:
      "Una cuenta con historia previa al proyecto es la señal de trazabilidad " +
      "más barata que existe. No se publica en la vitrina: la usa la " +
      "revisión para confirmar que hay una persona real detrás.",
    tipo: "url",
    requerida: true,
    eje: "identidad",
  },
];

// ---------------------------------------------------------------- empresa

export const EMPRESA: Pregunta[] = [
  {
    id: "nit",
    campo: "NIT",
    pregunta: "¿Cuál es el NIT de la empresa, con dígito de verificación?",
    motivo:
      "Con el NIT se consulta el RUES y se confirma que la empresa existe, " +
      "quién la representa y si está activa.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "razon_social",
    campo: "Razón social",
    pregunta: "¿Cuál es la razón social exacta, como aparece en el RUT?",
    motivo:
      "El nombre comercial y la razón social casi nunca coinciden, y la " +
      "verificación se hace contra la razón social.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "fecha_constitucion",
    campo: "Fecha de constitución",
    pregunta: "¿Desde cuándo existe la empresa?",
    motivo:
      "La antigüedad es una señal fuerte. Una sociedad constituida el mes " +
      "pasado que pide financiación se mira con otra lupa.",
    tipo: "fecha",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "actividad_ciiu",
    campo: "Actividad económica",
    pregunta: "¿A qué se dedica la empresa? Si sabes el código CIIU, mejor.",
    motivo:
      "Confirma que lo que se pide financiar tiene que ver con lo que la " +
      "empresa hace.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "representante_legal",
    campo: "Representante legal",
    pregunta:
      "¿Quién es el representante legal? Nombre completo y cédula, tal como " +
      "figura en el certificado de existencia y representación.",
    motivo:
      "Es la persona natural que responde por la empresa. Su documento tiene " +
      "que coincidir con el KYC de esta cuenta.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "opera_en_inmueble",
    campo: "Opera en el inmueble",
    pregunta:
      "¿La empresa opera en el inmueble del que estamos hablando? ¿Es el " +
      "local o la sede que resultó afectada?",
    motivo:
      "Separa dos casos muy distintos: un negocio afectado que necesita " +
      "volver a abrir, y una constructora que propone una obra para terceros.",
    tipo: "booleano",
    requerida: true,
    eje: "impacto",
  },
  {
    id: "empleados_afectados",
    campo: "Empleados afectados",
    pregunta: "¿Cuántas personas trabajan ahí o dejaron de trabajar por el daño?",
    motivo: "Es la medida de impacto de un negocio: cuántos empleos dependen de la obra.",
    tipo: "numero",
    requerida: true,
    eje: "impacto",
    si: (r) => r.opera_en_inmueble === true,
  },
  {
    id: "tiempo_cerrado",
    campo: "Tiempo cerrado",
    pregunta: "¿Hace cuánto está cerrado o operando a media máquina?",
    motivo:
      "Un negocio que lleva ocho meses cerrado tiene una urgencia y un riesgo " +
      "de no reabrir distintos a uno que cerró la semana pasada.",
    tipo: "texto",
    requerida: true,
    eje: "impacto",
    si: (r) => r.opera_en_inmueble === true,
  },
  {
    id: "sitio_web",
    campo: "Sitio web",
    pregunta: "¿La empresa tiene sitio web?",
    motivo: "Presencia pública verificable y anterior a la propuesta.",
    tipo: "url",
    requerida: false,
    eje: "identidad",
  },
  {
    id: "redes_empresa",
    campo: "Redes de la empresa",
    pregunta:
      "¿Y redes sociales de la empresa? Instagram, Facebook o LinkedIn.",
    motivo:
      "Para un negocio de barrio las redes suelen ser la única huella " +
      "pública, y muestran que operaba antes del daño.",
    tipo: "url",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "espera_retorno",
    campo: "Expectativa de retorno",
    pregunta:
      "Importante: ¿le vas a ofrecer a quien aporte que recupere la plata, " +
      "o algún rendimiento o participación en el negocio?",
    motivo:
      "Si la respuesta es sí, deja de ser un aporte y pasa a ser emisión de " +
      "valores: el Decreto 1357 de 2018 exige entidad autorizada por la " +
      "Superintendencia Financiera. CUADRA todavía no lo está, así que esa " +
      "propuesta no se puede recibir por aquí.",
    tipo: "booleano",
    requerida: true,
    eje: "identidad",
  },
];

// ------------------------------------------------------- sin ánimo de lucro

export const SIN_ANIMO_LUCRO: Pregunta[] = [
  {
    id: "nit",
    campo: "NIT",
    pregunta: "¿Cuál es el NIT de la entidad?",
    motivo:
      "Con el NIT se confirma la existencia y la representación legal en el " +
      "RUES, y el estado tributario en la DIAN.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "razon_social",
    campo: "Razón social",
    pregunta: "¿Cuál es el nombre exacto de la fundación, corporación o asociación?",
    motivo: "La verificación pública se hace contra el nombre registrado, no el de uso.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "personeria_juridica",
    campo: "Personería jurídica",
    pregunta:
      "¿Tienen certificado de existencia y representación legal vigente de " +
      "la Cámara de Comercio?",
    motivo:
      "Desde 2012 las ESAL se registran en la Cámara de Comercio y ahí consta " +
      "la personería jurídica. Sin eso, la entidad no puede recibir recursos " +
      "a su nombre.",
    tipo: "booleano",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "regimen_tributario_especial",
    campo: "Régimen Tributario Especial",
    pregunta:
      "¿Están calificados en el Régimen Tributario Especial ante la DIAN?",
    motivo:
      "El RTE es lo que permite que un aporte sea deducible para quien dona. " +
      "No estar en RTE no descalifica, pero cambia lo que se le puede " +
      "prometer a quien aporta, y eso hay que decirlo de frente.",
    tipo: "opcion",
    opciones: [
      { id: "si", label: "Sí, calificados en RTE" },
      { id: "en_tramite", label: "En trámite de calificación" },
      { id: "no", label: "No" },
      { id: "no_se", label: "No sé" },
    ],
    requerida: true,
    eje: "identidad",
  },
  {
    id: "objeto_social",
    campo: "Objeto social",
    pregunta:
      "¿Cuál es el objeto social de la entidad, como está en los estatutos?",
    motivo:
      "La obra que se propone tiene que caber dentro del objeto social. Una " +
      "fundación de educación pidiendo para vivienda necesita explicar el " +
      "vínculo.",
    tipo: "texto_largo",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "representante_legal",
    campo: "Representante legal",
    pregunta: "¿Quién es el representante legal? Nombre completo y cédula.",
    motivo:
      "Es quien responde por la entidad, y su documento debe coincidir con el " +
      "KYC de esta cuenta.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "beneficiarios",
    campo: "Beneficiarios",
    pregunta:
      "¿A cuántas personas beneficia esta obra y quiénes son?",
    motivo:
      "Es la razón de ser de una ESAL y el eje de impacto que más pesa en su " +
      "evaluación.",
    tipo: "texto_largo",
    requerida: true,
    eje: "impacto",
  },
  {
    id: "recursos_publicos",
    campo: "Recursos públicos",
    pregunta: "¿La entidad recibe o ha recibido recursos públicos para esta obra?",
    motivo:
      "No descalifica, pero cambia la meta real y obliga a declarar la " +
      "concurrencia de fuentes.",
    tipo: "booleano",
    requerida: true,
    eje: "presupuesto",
  },
  {
    id: "redes_entidad",
    campo: "Redes o sitio web",
    pregunta: "¿Dónde se puede ver el trabajo de la entidad? Sitio web o redes.",
    motivo:
      "Una ESAL con años de trabajo tiene rastro público. La ausencia total " +
      "de huella en una entidad que dice llevar años es una señal que la " +
      "revisión tiene que mirar.",
    tipo: "url",
    requerida: true,
    eje: "identidad",
  },
];

// ------------------------------------------------------------------ gobierno

export const GOBIERNO: Pregunta[] = [
  {
    id: "entidad_nombre",
    campo: "Entidad",
    pregunta: "¿Qué entidad es? Nombre oficial completo.",
    motivo: "Se verifica contra el directorio de entidades públicas.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "nit",
    campo: "NIT",
    pregunta: "¿Cuál es el NIT de la entidad?",
    motivo: "Identifica la entidad sin ambigüedad.",
    tipo: "texto",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "acto_administrativo",
    campo: "Acto administrativo",
    pregunta:
      "¿Hay acto administrativo, convenio o certificado presupuestal que " +
      "respalde este proyecto?",
    motivo:
      "Una entidad pública no dispone de recursos ni recibe aportes sin " +
      "soporte administrativo. Sin eso no hay a qué imputar lo recaudado.",
    tipo: "texto_largo",
    requerida: true,
    eje: "identidad",
  },
  {
    id: "beneficiarios",
    campo: "Beneficiarios",
    pregunta: "¿A cuánta población beneficia la obra?",
    motivo: "Es el eje de impacto de una obra pública.",
    tipo: "texto_largo",
    requerida: true,
    eje: "impacto",
  },
];

// -------------------------------------------------------------------- armado

const POR_PROPONENTE: Record<ProponenteId, Pregunta[]> = {
  persona: PERSONA,
  empresa: EMPRESA,
  sin_animo_lucro: SIN_ANIMO_LUCRO,
  gobierno: GOBIERNO,
};

/**
 * El guion completo para un proponente: primero quién es, después el predio.
 * Ese orden importa — arrancar por la matrícula inmobiliaria a alguien que
 * acaba de perder la casa es la forma más rápida de que cierre la pestaña.
 */
export function guion(proponente: ProponenteId): Pregunta[] {
  return [...POR_PROPONENTE[proponente], ...PREDIO];
}

/** Las que aplican dadas las respuestas de hasta ahora. */
export function aplicables(
  proponente: ProponenteId,
  r: Respuestas,
): Pregunta[] {
  return guion(proponente).filter((p) => !p.si || p.si(r));
}

/** Lo que todavía falta. Vacío = la propuesta se puede enviar a revisión. */
export function faltantes(
  proponente: ProponenteId,
  r: Respuestas,
): Pregunta[] {
  return aplicables(proponente, r).filter((p) => {
    if (!p.requerida) return false;
    const v = r[p.id];
    return v === undefined || v === null || v === "";
  });
}

/** Avance 0–1, para la barra de progreso del intake. */
export function avance(proponente: ProponenteId, r: Respuestas): number {
  const req = aplicables(proponente, r).filter((p) => p.requerida);
  if (!req.length) return 1;
  return (req.length - faltantes(proponente, r).length) / req.length;
}

/**
 * Una propuesta que ofrece retorno no es una propuesta mala: es una que esta
 * plataforma no puede recibir mientras no esté autorizada por la SFC. Se
 * detecta aquí y no en la rúbrica para que el asistente lo diga en el momento,
 * y no después de hacer treinta preguntas.
 */
export function regimenDe(r: Respuestas): RegimenId {
  return r.espera_retorno === true ? "valores" : "donacion";
}

export const BLOQUEO_VALORES =
  "Ofrecer retorno, rendimiento o participación convierte esto en emisión de " +
  "valores. El Decreto 1357 de 2018 solo permite esa modalidad a entidades " +
  "autorizadas por la Superintendencia Financiera, y CUADRA todavía no lo " +
  "está. Se puede seguir como aporte sin retorno, o esperar a que la " +
  "plataforma tenga la autorización.";
