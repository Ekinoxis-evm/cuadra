import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Proyectos tokenizados.
 *
 * Regla de acceso: para crear un borrador basta con haber ENVIADO el KYC; para
 * que el proyecto salga a la vitrina pública hace falta que esté APROBADO.
 * Separarlo así deja a la gente preparar su propuesta mientras la verificación
 * avanza, sin que nada llegue a pedir plata antes de tiempo.
 */

const TIPOS = ["reconstruccion", "nuevo"];
const PROPONENTES = ["persona", "empresa", "gobierno"];

/** GET sin sesión: vitrina pública. Con sesión: además, los propios. */
export async function GET(req: NextRequest) {
  const db = supabaseAdmin();
  const userId = await didDe(req);

  const { data: publicos } = await db
    .from("proyectos")
    .select("id, titulo, descripcion, tipo, proponente, barrio, meta_cop, recaudado_cop, imagenes, updated_at")
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
  const meta = Number(body.meta_cop ?? 0);

  if (titulo.length < 6)
    return Response.json({ error: "El título es muy corto" }, { status: 400 });
  if (!TIPOS.includes(tipo))
    return Response.json({ error: "Tipo de proyecto inválido" }, { status: 400 });
  if (!PROPONENTES.includes(proponente))
    return Response.json({ error: "Tipo de proponente inválido" }, { status: 400 });
  if (!Number.isFinite(meta) || meta <= 0)
    return Response.json({ error: "La meta debe ser mayor a cero" }, { status: 400 });

  const { data, error } = await db
    .from("proyectos")
    .insert({
      privy_did: userId,
      titulo,
      descripcion: descripcion || null,
      tipo,
      proponente,
      barrio: String(body.barrio ?? "").trim() || null,
      direccion: String(body.direccion ?? "").trim() || null,
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
