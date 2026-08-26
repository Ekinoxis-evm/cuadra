import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { faltaParaRevision, validarProyecto, type Documento } from "@/lib/proyectos";

/**
 * Mandar una propuesta a revisión.
 *
 * Es el paso que le faltaba a la ruta: hasta ahora un borrador se quedaba en
 * borrador para siempre porque nadie podía moverlo. Lo mueve el proponente,
 * que es quien sabe cuándo terminó — no un revisor adivinando si la propuesta
 * ya está lista.
 *
 * Aquí se revalida todo otra vez. El borrador se pudo guardar con lo mínimo, y
 * lo que sale a revisión tiene que sostenerse solo.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: p } = await db
    .from("proyectos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!p || p.privy_did !== userId)
    return Response.json({ error: "Proyecto no encontrado" }, { status: 404 });

  if (!["borrador", "rechazado"].includes(p.estado))
    return Response.json(
      {
        error:
          p.estado === "en_revision"
            ? "Ya está en revisión."
            : "Este proyecto ya pasó por revisión.",
      },
      { status: 409 },
    );

  // La verificación pudo cambiar entre que se creó el borrador y hoy.
  const { data: kyc } = await db
    .from("kyc")
    .select("estado")
    .eq("privy_did", userId)
    .maybeSingle();
  if (!kyc || kyc.estado === "rechazado")
    return Response.json(
      { error: "Necesitas la verificación de identidad al día" },
      { status: 403 },
    );

  const v = validarProyecto(p, userId);
  if ("error" in v) return Response.json({ error: v.error }, { status: 400 });

  const falta = faltaParaRevision({ documentos: p.documentos as Documento[] });
  if (falta) return Response.json({ error: falta }, { status: 400 });

  const { error } = await db
    .from("proyectos")
    .update({
      estado: "en_revision",
      enviado_revision_at: new Date().toISOString(),
      // La nota de la revisión anterior deja de aplicar: se corrigió y volvió.
      nota_revision: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, estado: "en_revision" });
}
