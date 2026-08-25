import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ESTADOS_OBRA, PROPONENTES, TIPOS, TIPOS_DOCUMENTO } from "@/lib/proyectos";

/**
 * Proyectos tokenizados.
 *
 * Regla de acceso: para crear un borrador basta con haber ENVIADO el KYC; para
 * que el proyecto salga a la vitrina pública hace falta que esté APROBADO.
 * Separarlo así deja a la gente preparar su propuesta mientras la verificación
 * avanza, sin que nada llegue a pedir plata antes de tiempo.
 */

const IDS_TIPO = TIPOS.map((t) => t.id) as readonly string[];
const IDS_PROPONENTE = PROPONENTES.map((p) => p.id) as readonly string[];
const IDS_ESTADO_OBRA = ESTADOS_OBRA.map((e) => e.id) as readonly string[];
const IDS_DOC = TIPOS_DOCUMENTO.map((t) => t.id) as readonly string[];

const CAMPOS_PUBLICOS =
  "id, titulo, descripcion, tipo, proponente, barrio, estado_obra, area_m2, " +
  "plazo_meses, meta_cop, recaudado_cop, imagenes, updated_at";

const carpetaDe = (did: string) => did.replace(/[^a-zA-Z0-9]/g, "-");

/** GET sin sesión: vitrina pública. Con sesión: además, los propios. */
export async function GET(req: NextRequest) {
  const db = supabaseAdmin();
  const userId = await didDe(req);

  const { data: publicos } = await db
    .from("proyectos")
    .select(CAMPOS_PUBLICOS)
    .eq("estado", "publicado")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!userId) return Response.json({ publicos: publicos ?? [], mios: [] });

  const { data: mios } = await db
    .from("proyectos")
    .select("*")
    .eq("privy_did", userId)
    .order("updated_at", { ascending: false });

  return Response.json({ publicos: publicos ?? [], mios: mios ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const db = supabaseAdmin();

  // Sin KYC enviado no se crea nada: un proyecto pide dinero a terceros y
  // tiene que haber una persona identificable detrás.
  const { data: kyc } = await db
    .from("kyc")
    .select("estado")
    .eq("privy_did", userId)
    .maybeSingle();
  if (!kyc)
    return Response.json(
      { error: "Primero verifica tu identidad" },
      { status: 403 },
    );
  if (kyc.estado === "rechazado")
    return Response.json(
      { error: "Tu verificación fue rechazada. Escríbenos para revisarla." },
      { status: 403 },
    );

  const body = await req.json();
  const titulo = String(body.titulo ?? "").trim();
  const descripcion = String(body.descripcion ?? "").trim();
  const tipo = String(body.tipo ?? "");
  const proponente = String(body.proponente ?? "persona");
  const estadoObra = String(body.estado_obra ?? "");
  const estadoDetalle = String(body.estado_detalle ?? "").trim();
  const meta = Number(body.meta_cop ?? 0);
  const area = body.area_m2 == null || body.area_m2 === "" ? null : Number(body.area_m2);
  const plazo =
    body.plazo_meses == null || body.plazo_meses === "" ? null : Number(body.plazo_meses);

  if (titulo.length < 6)
    return Response.json({ error: "El título es muy corto" }, { status: 400 });
  if (!IDS_TIPO.includes(tipo))
    return Response.json({ error: "Tipo de proyecto inválido" }, { status: 400 });
  if (!IDS_PROPONENTE.includes(proponente))
    return Response.json({ error: "Tipo de proponente inválido" }, { status: 400 });
  // La descripción dejó de ser opcional: es la respuesta a "qué se va a hacer",
  // y sin ella la revisión no tiene con qué decidir.
  if (descripcion.length < 40)
    return Response.json(
      { error: "Cuenta con un poco más de detalle qué se va a hacer (mínimo 40 caracteres)" },
      { status: 400 },
    );
  if (!IDS_ESTADO_OBRA.includes(estadoObra))
    return Response.json(
      { error: "Escoge en qué estado está el espacio hoy" },
      { status: 400 },
    );
  if (!Number.isFinite(meta) || meta <= 0)
    return Response.json({ error: "La meta debe ser mayor a cero" }, { status: 400 });
  if (area !== null && (!Number.isFinite(area) || area <= 0))
    return Response.json({ error: "El área debe ser mayor a cero" }, { status: 400 });
  if (plazo !== null && (!Number.isInteger(plazo) || plazo < 1 || plazo > 120))
    return Response.json(
      { error: "El plazo debe ir entre 1 y 120 meses" },
      { status: 400 },
    );

  // Los adjuntos llegan como rutas ya subidas por /api/proyectos/documentos.
  // Se revalida que cada una viva bajo la carpeta de quien pide, porque el
  // cuerpo del POST lo escribe el navegador y podría apuntar a otra cuenta.
  const prefijo = `${carpetaDe(userId)}/`;
  const crudos = Array.isArray(body.documentos) ? body.documentos : [];
  if (crudos.length > 12)
    return Response.json({ error: "Máximo 12 documentos" }, { status: 400 });

  const documentos = [];
  for (const d of crudos) {
    const ruta = String(d?.ruta ?? "");
    const tipoDoc = String(d?.tipo ?? "otro");
    if (!ruta.startsWith(prefijo))
      return Response.json({ error: "Documento no válido" }, { status: 403 });
    if (!IDS_DOC.includes(tipoDoc))
      return Response.json({ error: "Tipo de documento inválido" }, { status: 400 });
    documentos.push({
      tipo: tipoDoc,
      nombre: String(d?.nombre ?? "documento").slice(0, 120),
      ruta,
      bytes: Number(d?.bytes ?? 0),
      mime: String(d?.mime ?? ""),
      subido_at: String(d?.subido_at ?? new Date().toISOString()),
    });
  }

  const { data, error } = await db
    .from("proyectos")
    .insert({
      privy_did: userId,
      titulo,
      descripcion,
      tipo,
      proponente,
      estado_obra: estadoObra,
      estado_detalle: estadoDetalle || null,
      barrio: String(body.barrio ?? "").trim() || null,
      direccion: String(body.direccion ?? "").trim() || null,
      area_m2: area,
      plazo_meses: plazo,
      documentos,
      meta_cop: Math.round(meta),
      // Nace en borrador siempre. Publicar es una decisión de revisión, no del
      // proponente.
      estado: "borrador",
    })
    .select("id, estado")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, ...data, kyc: kyc.estado });
}
