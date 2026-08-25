/**
 * Vocabulario de proyectos, compartido entre el formulario y la API.
 *
 * Vive en un solo archivo a propósito: cuando las listas estaban duplicadas en
 * el componente y en la ruta, el texto que veía el usuario y lo que el servidor
 * aceptaba se desincronizaban en silencio.
 */

export const TIPOS = [
  {
    id: "reconstruccion",
    titulo: "Reconstrucción",
    detalle: "Arreglar, ampliar o reforzar una vivienda que ya existe",
  },
  {
    id: "nuevo",
    titulo: "Proyecto nuevo",
    detalle: "Levantar vivienda desde cero sobre un lote",
  },
] as const;

export const PROPONENTES = [
  { id: "persona", label: "Persona", detalle: "Propongo a título personal" },
  { id: "empresa", label: "Empresa", detalle: "Constructora, fundación o sociedad" },
  { id: "gobierno", label: "Entidad pública", detalle: "Alcaldía, secretaría o entidad" },
] as const;

/**
 * Estado físico del espacio hoy, antes de intervenirlo. Cada opción trae el
 * caso concreto que la distingue: sin eso la gente escoge la primera que suena
 * parecida y la revisión termina pidiendo aclaraciones por correo.
 */
export const ESTADOS_OBRA = [
  {
    id: "lote",
    titulo: "Lote sin construir",
    detalle: "Terreno limpio o con ruinas por demoler",
    aplica: ["nuevo"],
  },
  {
    id: "cimientos",
    titulo: "Obra iniciada",
    detalle: "Cimentación o primeros muros levantados",
    aplica: ["nuevo"],
  },
  {
    id: "obra_gris",
    titulo: "Obra gris",
    detalle: "Estructura y muros en pie, sin acabados ni redes terminadas",
    aplica: ["nuevo", "reconstruccion"],
  },
  {
    id: "habitable_deteriorada",
    titulo: "Habitable pero deteriorada",
    detalle: "Se puede vivir ahí, con humedades, grietas o redes viejas",
    aplica: ["reconstruccion"],
  },
  {
    id: "inhabitable",
    titulo: "No habitable",
    detalle: "Daños graves, riesgo estructural o afectación por desastre",
    aplica: ["reconstruccion"],
  },
  {
    id: "en_uso",
    titulo: "En uso, se quiere mejorar",
    detalle: "Ocupada y en buen estado; la obra es una mejora o ampliación",
    aplica: ["reconstruccion"],
  },
] as const;

/**
 * Soportes que se pueden adjuntar. El texto explica qué es cada documento
 * porque "perito" y "avalúo" no significan lo mismo y la gente los mezcla.
 */
export const TIPOS_DOCUMENTO = [
  {
    id: "peritaje",
    titulo: "Peritaje técnico",
    detalle:
      "Concepto de un ingeniero o arquitecto sobre el estado estructural: qué está fallando y qué hay que intervenir.",
  },
  {
    id: "avaluo",
    titulo: "Avalúo comercial",
    detalle:
      "Valor del inmueble o del lote firmado por un avaluador. Sustenta cuánto vale hoy lo que se va a intervenir.",
  },
  {
    id: "evaluacion",
    titulo: "Evaluación reciente del espacio",
    detalle:
      "Inspección, diagnóstico de daños, estudio de suelos o levantamiento hecho en los últimos 24 meses.",
  },
  {
    id: "presupuesto",
    titulo: "Presupuesto de obra",
    detalle:
      "Cotización o presupuesto detallado por capítulos. Es lo que explica de dónde sale la meta de recaudo.",
  },
  {
    id: "licencia",
    titulo: "Licencia o permiso",
    detalle:
      "Licencia de construcción, reforzamiento o demolición, si el proyecto ya la tramitó.",
  },
  {
    id: "propiedad",
    titulo: "Prueba de propiedad",
    detalle:
      "Certificado de tradición y libertad, escritura o el documento que acredita quién es el dueño del predio.",
  },
  {
    id: "fotos",
    titulo: "Registro fotográfico",
    detalle: "Fotos del estado actual del espacio, por dentro y por fuera.",
  },
  { id: "otro", titulo: "Otro documento", detalle: "Cualquier soporte que ayude a entender el proyecto." },
] as const;

export const MAX_BYTES_DOC = 10 * 1024 * 1024;
export const MIMES_DOC = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export interface Documento {
  tipo: string;
  nombre: string;
  ruta: string;
  bytes: number;
  mime: string;
  subido_at: string;
}

export const etiquetaTipo = (id: string) =>
  TIPOS.find((t) => t.id === id)?.titulo ?? id;
export const etiquetaEstadoObra = (id: string | null) =>
  ESTADOS_OBRA.find((e) => e.id === id)?.titulo ?? null;
export const etiquetaDocumento = (id: string) =>
  TIPOS_DOCUMENTO.find((t) => t.id === id)?.titulo ?? id;

export const pesoLegible = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} kB`;

/**
 * Ruta completa de un proyecto, desde una cuenta recién creada hasta la
 * vitrina. Se dibuja igual en la lista, en la verificación y en el formulario
 * para que en todo momento se sepa en qué tramo va uno y qué falta.
 */
export const RUTA_PUBLICAR = [
  {
    id: "identidad",
    titulo: "Identidad",
    nota: "Verificamos quién propone. Un proyecto recibe dinero de terceros, así que tiene que haber alguien identificable detrás.",
  },
  {
    id: "borrador",
    titulo: "Propuesta",
    nota: "Cuentas qué se va a hacer, en qué estado está el espacio y cuánto cuesta. Puedes guardarla y volver después.",
  },
  {
    id: "revision",
    titulo: "Revisión",
    nota: "Revisamos la propuesta y los soportes. Si falta algo te escribimos; nada recibe aportes en este tramo.",
  },
  {
    id: "vitrina",
    titulo: "En vitrina",
    nota: "El proyecto es público y puede recibir aportes.",
  },
];
