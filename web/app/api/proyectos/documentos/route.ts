import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { MAX_BYTES_DOC, MIMES_DOC, TIPOS_DOCUMENTO, carpetaDe } from "@/lib/proyectos";

/**
 * Soportes de un proyecto: peritajes, avalúos, evaluaciones del espacio.
 *
 * Van a un bucket privado sin políticas de RLS, igual que la tabla kyc: un
 * peritaje trae dirección, linderos y a veces la cédula del dueño. Nada se
 * sirve por URL pública; para verlos hay que pedir una URL firmada por este
 * mismo endpoint, que antes comprueba que la ruta sea de quien pregunta.
 *
 * Se suben ANTES de crear el proyecto, bajo la carpeta del usuario. Pedirle a
 * la gente que primero cree el borrador y luego vuelva a adjuntar era una
 * vuelta de más, y el borrador quedaba a medias si abandonaba en el camino.
 */

const BUCKET = "soportes";
const TIPOS_VALIDOS = TIPOS_DOCUMENTO.map((t) => t.id) as readonly string[];

const EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** GET ?ruta=… → URL firmada de 5 minutos para que el dueño lo abra. */
export async function GET(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const ruta = req.nextUrl.searchParams.get("ruta") ?? "";
  if (!ruta.startsWith(`${carpetaDe(userId)}/`))
    return Response.json({ error: "Ese documento no es tuyo" }, { status: 403 });

  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(ruta, 300);

  if (error || !data)
    return Response.json({ error: "No se pudo abrir el documento" }, { status: 404 });
  return Response.json({ url: data.signedUrl });
}

export async function POST(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  // Adjuntar implica pedir plata más adelante: mismo requisito que crear.
  const db = supabaseAdmin();
  const { data: kyc } = await db
    .from("kyc")
    .select("estado")
    .eq("privy_did", userId)
    .maybeSingle();
  if (!kyc)
    return Response.json({ error: "Primero verifica tu identidad" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  const tipo = String(form?.get("tipo") ?? "otro");

  if (!(archivo instanceof File))
    return Response.json({ error: "No llegó ningún archivo" }, { status: 400 });
  if (!TIPOS_VALIDOS.includes(tipo))
    return Response.json({ error: "Tipo de documento inválido" }, { status: 400 });
  if (!MIMES_DOC.includes(archivo.type))
    return Response.json(
      { error: "Formato no admitido. Sube PDF, JPG, PNG o WEBP." },
      { status: 400 },
    );
  if (archivo.size > MAX_BYTES_DOC)
    return Response.json(
      { error: "El archivo pesa más de 10 MB" },
      { status: 400 },
    );
  if (archivo.size === 0)
    return Response.json({ error: "El archivo está vacío" }, { status: 400 });

  const ruta = `${carpetaDe(userId)}/${crypto.randomUUID()}.${EXTENSION[archivo.type]}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    tipo,
    // El nombre original solo se usa para mostrarlo; la llave real es la ruta.
    nombre: archivo.name.slice(0, 120),
    ruta,
    bytes: archivo.size,
    mime: archivo.type,
    subido_at: new Date().toISOString(),
  });
}

/** DELETE ?ruta=… → quitar un adjunto antes o después de crear el borrador. */
export async function DELETE(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const ruta = req.nextUrl.searchParams.get("ruta") ?? "";
  if (!ruta.startsWith(`${carpetaDe(userId)}/`))
    return Response.json({ error: "Ese documento no es tuyo" }, { status: 403 });

  const db = supabaseAdmin();
  const { error } = await db.storage.from(BUCKET).remove([ruta]);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Si ya estaba colgado de un borrador, se descuelga también: dejar la ruta
  // apuntando a un archivo borrado rompe la vista de revisión.
  const { data: proyectos } = await db
    .from("proyectos")
    .select("id, documentos")
    .eq("privy_did", userId)
    .neq("estado", "publicado");

  for (const p of proyectos ?? []) {
    const docs = (p.documentos ?? []) as { ruta: string }[];
    if (!docs.some((d) => d.ruta === ruta)) continue;
    await db
      .from("proyectos")
      .update({ documentos: docs.filter((d) => d.ruta !== ruta) })
      .eq("id", p.id);
  }

  return Response.json({ ok: true });
}
