import type { Respuestas } from "./types";

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

/**
 * Los cuatro tipos que acepta la base (migración 009). La entrevista crea
 * propuestas de los cuatro; cuando esta lista tenía tres, una fundación que
 * salía de la entrevista no podía ni editarse ni mandarse a revisión, porque
 * `validarProyecto` la rechazaba como "tipo de proponente inválido".
 */
export const PROPONENTES = [
  { id: "persona", label: "Persona", detalle: "Propongo a título personal" },
  { id: "empresa", label: "Empresa", detalle: "Constructora, negocio o sociedad" },
  {
    id: "sin_animo_lucro",
    label: "Sin ánimo de lucro",
    detalle: "Fundación, corporación o asociación con personería jurídica",
  },
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
  { id: "otro", titulo: "Otro documento", detalle: "Cualquier soporte que ayude a entender el proyecto." },
] as const;

/** Los tres que la revisión considera soporte técnico de verdad. */
export const SOPORTES_TECNICOS = ["peritaje", "avaluo", "evaluacion"];

export const MAX_BYTES_DOC = 10 * 1024 * 1024;
export const MIMES_DOC = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const MAX_BYTES_FOTO = 10 * 1024 * 1024;
export const MIMES_FOTO = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FOTOS = 8;

export interface Documento {
  tipo: string;
  nombre: string;
  ruta: string;
  bytes: number;
  mime: string;
  subido_at: string;
}

/** Columnas que cualquiera puede ver. Lo que no está aquí no sale de la API. */
export const CAMPOS_PUBLICOS =
  "id, titulo, descripcion, tipo, proponente, barrio, estado_obra, area_m2, " +
  "plazo_meses, meta_cop, recaudado_cop, imagenes, estado, updated_at";

/** Lo que ve cualquiera de un proyecto publicado. */
export interface ProyectoPublico {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  proponente: string;
  barrio: string | null;
  estado_obra: string | null;
  area_m2: number | null;
  plazo_meses: number | null;
  meta_cop: number | null;
  recaudado_cop: number;
  imagenes: string[] | null;
  estado: string;
  updated_at: string;
}

/** La fila completa, que solo ve quien la propuso. */
export interface ProyectoPropio extends ProyectoPublico {
  direccion: string | null;
  estado_detalle: string | null;
  documentos: Documento[] | null;
  nota_revision: string | null;
  respuestas: Respuestas;
  regimen: "donacion" | "valores";
  intake_completo_at: string | null;
  enviado_revision_at: string | null;
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "borrador",
  en_revision: "en revisión",
  publicado: "publicado",
  rechazado: "necesita ajustes",
  cerrado: "cerrado",
};

/** Qué le falta a este proyecto para avanzar, dicho sin rodeos. */
export const QUE_SIGUE: Record<string, string> = {
  borrador: "Guardado. Cuando esté listo, mándalo a revisión.",
  en_revision: "Lo estamos revisando. Todavía no recibe aportes.",
  publicado: "Público en la vitrina. Ya puede recibir aportes.",
  rechazado: "Corrige lo que te pedimos y vuelve a mandarlo.",
  cerrado: "Cerrado.",
};

/** Los tres tramos por los que pasa un proyecto ya creado. */
export const TRAMOS_PROYECTO = [
  { id: "borrador", titulo: "Borrador", nota: "Es tuyo: complétalo y mándalo a revisión cuando esté listo." },
  { id: "en_revision", titulo: "En revisión", nota: "Lo estamos leyendo. Si falta algo te lo decimos aquí." },
  { id: "publicado", titulo: "En vitrina", nota: "Público y con página propia. Ya puede recibir aportes." },
];

/** En qué tramo va un proyecto según su estado. Rechazado vuelve al primero. */
export const tramoDe = (estado: string) =>
  estado === "en_revision" ? 1 : ["publicado", "cerrado"].includes(estado) ? 3 : 0;

/** Estados en los que el proponente todavía puede tocar la propuesta. */
export const EDITABLES = ["borrador", "rechazado"];

/**
 * Una propuesta nacida en la entrevista llega sin título real. Es la señal de
 * que el camino para completarla es seguir conversando, no el formulario.
 */
export const TITULO_PROVISIONAL = "Propuesta sin título";

export const etiquetaTipo = (id: string) =>
  TIPOS.find((t) => t.id === id)?.titulo ?? id;
export const etiquetaEstadoObra = (id: string | null) =>
  ESTADOS_OBRA.find((e) => e.id === id)?.titulo ?? null;
export const etiquetaDocumento = (id: string) =>
  TIPOS_DOCUMENTO.find((t) => t.id === id)?.titulo ?? id;
export const etiquetaProponente = (id: string) =>
  PROPONENTES.find((p) => p.id === id)?.label ?? id;

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

/**
 * El did de Privy trae ':' y las llaves del storage se llevan mal con eso.
 * Es el prefijo de la carpeta del usuario en los dos buckets.
 */
export const carpetaDe = (did: string) => did.replace(/[^a-zA-Z0-9]/g, "-");

/** Prefijo público de las fotos de un usuario, para validar propiedad. */
export const prefijoFotos = (did: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/proyectos/${carpetaDe(did)}/`;

/**
 * Nombres de archivo que aceptamos: los que generamos nosotros, un uuid y su
 * extensión. Nada más.
 *
 * Comprobar solo que la ruta EMPIECE por la carpeta del usuario no alcanzaba:
 * `mi-carpeta/../otra-carpeta/peritaje.pdf` pasa ese filtro, y el storage de
 * Supabase normaliza el `..` al firmar la URL — comprobado contra el proyecto
 * real: se descargaba el peritaje de otra persona, con su cédula y la
 * dirección del inmueble dentro. Anclar el nombre completo cierra de una vez
 * el `..`, las barras extra, las rutas absolutas y el %2e%2e.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NOMBRE_SOPORTE = new RegExp(`^${UUID}\\.(pdf|jpg|png|webp)$`, "i");
const NOMBRE_FOTO = new RegExp(`^${UUID}\\.(jpg|png|webp)$`, "i");

/**
 * Valida una ruta del bucket privado y devuelve la ruta canónica, o null.
 * Se construye de cero a partir de las piezas verificadas: lo que entró por la
 * red no se vuelve a usar tal cual.
 */
export function rutaSoporteDe(ruta: string, did: string): string | null {
  const carpeta = carpetaDe(did);
  const partes = String(ruta).split("/");
  if (partes.length !== 2) return null;
  if (partes[0] !== carpeta) return null;
  if (!NOMBRE_SOPORTE.test(partes[1])) return null;
  return `${carpeta}/${partes[1]}`;
}

/** Igual para una foto pública: de la URL entera se saca solo el nombre. */
export function rutaFotoDe(url: string, did: string): string | null {
  const prefijo = prefijoFotos(did);
  if (!String(url).startsWith(prefijo)) return null;
  const nombre = String(url).slice(prefijo.length);
  if (!NOMBRE_FOTO.test(nombre)) return null;
  return `${carpetaDe(did)}/${nombre}`;
}

export interface DatosProyecto {
  titulo: string;
  descripcion: string;
  tipo: string;
  proponente: string;
  estado_obra: string;
  estado_detalle: string | null;
  barrio: string | null;
  direccion: string | null;
  area_m2: number | null;
  plazo_meses: number | null;
  meta_cop: number;
  documentos: Documento[];
  imagenes: string[];
}

/**
 * Validación de una propuesta, compartida por crear y editar.
 *
 * Vive junto al vocabulario y no dentro de una ruta porque las tres entradas
 * que escriben un proyecto (POST, PATCH y el envío a revisión) tienen que
 * exigir exactamente lo mismo; cuando la regla estaba copiada en cada ruta,
 * editar dejaba pasar lo que crear rechazaba.
 *
 * `did` es de quien pide: los adjuntos los escribe el navegador y podrían
 * apuntar a la carpeta de otra cuenta.
 */
export function validarProyecto(
  body: Record<string, unknown>,
  did: string,
): { error: string } | { datos: DatosProyecto } {
  const texto = (v: unknown) => String(v ?? "").trim();
  const titulo = texto(body.titulo);
  const descripcion = texto(body.descripcion);
  const tipo = texto(body.tipo);
  const proponente = texto(body.proponente) || "persona";
  const estadoObra = texto(body.estado_obra);
  const meta = Number(body.meta_cop ?? 0);
  const area =
    body.area_m2 == null || body.area_m2 === "" ? null : Number(body.area_m2);
  const plazo =
    body.plazo_meses == null || body.plazo_meses === ""
      ? null
      : Number(body.plazo_meses);

  if (titulo.length < 6) return { error: "El título es muy corto" };
  if (!TIPOS.some((t) => t.id === tipo))
    return { error: "Tipo de proyecto inválido" };
  if (!PROPONENTES.some((p) => p.id === proponente))
    return { error: "Tipo de proponente inválido" };
  if (descripcion.length < 40)
    return {
      error:
        "Cuenta con un poco más de detalle qué se va a hacer (mínimo 40 caracteres)",
    };
  if (!ESTADOS_OBRA.some((e) => e.id === estadoObra))
    return { error: "Escoge en qué estado está el espacio hoy" };
  if (!Number.isFinite(meta) || meta <= 0)
    return { error: "La meta debe ser mayor a cero" };
  if (area !== null && (!Number.isFinite(area) || area <= 0))
    return { error: "El área debe ser mayor a cero" };
  if (plazo !== null && (!Number.isInteger(plazo) || plazo < 1 || plazo > 120))
    return { error: "El plazo debe ir entre 1 y 120 meses" };

  const crudos = Array.isArray(body.documentos) ? body.documentos : [];
  if (crudos.length > 12) return { error: "Máximo 12 documentos" };

  const documentos: Documento[] = [];
  for (const d of crudos as Record<string, unknown>[]) {
    const ruta = rutaSoporteDe(String(d?.ruta ?? ""), did);
    const tipoDoc = String(d?.tipo ?? "otro");
    if (!ruta) return { error: "Documento no válido" };
    if (!TIPOS_DOCUMENTO.some((t) => t.id === tipoDoc))
      return { error: "Tipo de documento inválido" };
    documentos.push({
      tipo: tipoDoc,
      nombre: String(d?.nombre ?? "documento").slice(0, 120),
      ruta,
      bytes: Number(d?.bytes ?? 0),
      mime: String(d?.mime ?? ""),
      subido_at: String(d?.subido_at ?? new Date().toISOString()),
    });
  }

  const fotos = Array.isArray(body.imagenes) ? body.imagenes : [];
  if (fotos.length > MAX_FOTOS)
    return { error: `Máximo ${MAX_FOTOS} fotos` };
  const imagenes: string[] = [];
  for (const url of fotos) {
    if (typeof url !== "string" || !rutaFotoDe(url, did))
      return { error: "Foto no válida" };
    imagenes.push(url);
  }

  return {
    datos: {
      titulo,
      descripcion,
      tipo,
      proponente,
      estado_obra: estadoObra,
      estado_detalle: texto(body.estado_detalle) || null,
      barrio: texto(body.barrio) || null,
      direccion: texto(body.direccion) || null,
      area_m2: area,
      plazo_meses: plazo,
      meta_cop: Math.round(meta),
      documentos,
      imagenes,
    },
  };
}

/**
 * Todo lo que falta para que una propuesta pueda mandarse a revisión, en el
 * mismo orden en que el servidor lo exigiría. La entrevista llena
 * `respuestas` pero no las columnas que `validarProyecto` revisa, así que
 * una propuesta nacida conversando llega aquí con casi todo pendiente: esta
 * lista es lo que evita que el botón de enviar falle sin explicar por qué.
 */
export function pendientesParaRevision(p: {
  titulo: string | null;
  descripcion: string | null;
  estado_obra: string | null;
  meta_cop: number | null;
  documentos?: Documento[] | null;
}): string[] {
  const falta: string[] = [];
  if (!p.titulo || p.titulo === TITULO_PROVISIONAL || p.titulo.trim().length < 6)
    falta.push("un título");
  if ((p.descripcion ?? "").trim().length < 40)
    falta.push("qué se va a hacer, con al menos 40 caracteres");
  if (!p.estado_obra) falta.push("en qué estado está el espacio hoy");
  if (!p.meta_cop || p.meta_cop <= 0) falta.push("la meta de recaudo");
  const soporte = faltaParaRevision({ documentos: p.documentos });
  if (soporte) falta.push("un soporte técnico (peritaje, avalúo o evaluación)");
  return falta;
}

/** Qué le falta a una propuesta para poder mandarse a revisión. */
export function faltaParaRevision(p: {
  documentos?: Documento[] | null;
}): string | null {
  const docs = p.documentos ?? [];
  if (!docs.some((d) => SOPORTES_TECNICOS.includes(d.tipo)))
    return "Adjunta al menos un soporte técnico (peritaje, avalúo o evaluación del espacio).";
  return null;
}
