import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { validarProyecto } from "@/lib/proyectos";

/**
 * Proyectos tokenizados.
 *
 * Regla de acceso: para crear un borrador basta con haber ENVIADO el KYC; para
 * que el proyecto salga a la vitrina pública hace falta que esté APROBADO.
 * Separarlo así deja a la gente preparar su propuesta mientras la verificación
 * avanza, sin que nada llegue a pedir plata antes de tiempo.
 */

const CAMPOS_PUBLICOS =
  "id, titulo, descripcion, tipo, proponente, barrio, estado_obra, area_m2, " +
  "plazo_meses, meta_cop, recaudado_cop, imagenes, estado, updated_at";

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

  const v = validarProyecto(await req.json(), userId);
  if ("error" in v) return Response.json({ error: v.error }, { status: 400 });

  const { data, error } = await db
    .from("proyectos")
    .insert({
      privy_did: userId,
      ...v.datos,
      // Nace en borrador siempre. Publicar es una decisión de revisión, no del
      // proponente.
      estado: "borrador",
    })
    .select("id, estado")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, ...data, kyc: kyc.estado });
}
