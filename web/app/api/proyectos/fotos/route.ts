import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  MAX_BYTES_FOTO,
  MIMES_FOTO,
  carpetaDe,
  rutaFotoDe,
} from "@/lib/proyectos";

/**
 * Fotos del proyecto: las que se ven en la vitrina.
 *
 * Bucket aparte y público, al revés que los soportes. Meter las fotos en el
 * bucket privado dejaba la vitrina sin una sola imagen, y sacar los peritajes
 * al bucket público publicaba direcciones y cédulas. Son dos cosas distintas y
 * ahora viven separadas: aquí lo que el proyecto quiere enseñar, allá lo que
 * la revisión necesita ver.
 */
const BUCKET = "proyectos";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

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

  if (!(archivo instanceof File))
    return Response.json({ error: "No llegó ninguna foto" }, { status: 400 });
  if (!MIMES_FOTO.includes(archivo.type))
    return Response.json(
      { error: "Formato no admitido. Sube JPG, PNG o WEBP." },
      { status: 400 },
    );
  if (archivo.size > MAX_BYTES_FOTO)
    return Response.json({ error: "La foto pesa más de 10 MB" }, { status: 400 });
  if (archivo.size === 0)
    return Response.json({ error: "El archivo está vacío" }, { status: 400 });

  const ruta = `${carpetaDe(userId)}/${crypto.randomUUID()}.${EXTENSION[archivo.type]}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data } = db.storage.from(BUCKET).getPublicUrl(ruta);
  return Response.json({ url: data.publicUrl, nombre: archivo.name.slice(0, 120) });
}

/** DELETE ?url=… — quitar una foto propia. */
export async function DELETE(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  // Mismo criterio que en los soportes: del enlace se saca el nombre, se
  // valida contra el patrón que generamos, y la ruta se arma de cero.
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const ruta = rutaFotoDe(url, userId);
  if (!ruta)
    return Response.json({ error: "Esa foto no es tuya" }, { status: 403 });

  const db = supabaseAdmin();
  const { error } = await db.storage.from(BUCKET).remove([ruta]);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Si ya estaba colgada de una propuesta sin publicar, se descuelga también.
  const { data: proyectos } = await db
    .from("proyectos")
    .select("id, imagenes")
    .eq("privy_did", userId)
    .neq("estado", "publicado");

  for (const p of proyectos ?? []) {
    const imgs = (p.imagenes ?? []) as string[];
    if (!imgs.includes(url)) continue;
    await db
      .from("proyectos")
      .update({ imagenes: imgs.filter((i) => i !== url) })
      .eq("id", p.id);
  }

  return Response.json({ ok: true });
}
