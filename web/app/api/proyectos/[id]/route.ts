import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { validarProyecto } from "@/lib/proyectos";

/**
 * Editar una propuesta propia.
 *
 * Solo se toca lo que todavía no está en manos de nadie más: un borrador, o
 * algo rechazado que se va a corregir. Mientras está en revisión no se edita —
 * cambiar la propuesta debajo de quien la está leyendo es una forma barata de
 * colar otra cosa. Y publicado tampoco: ahí ya hay gente que aportó mirando
 * unas condiciones concretas.
 */
const EDITABLES = ["borrador", "rechazado"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: actual } = await db
    .from("proyectos")
    .select("id, privy_did, estado")
    .eq("id", id)
    .maybeSingle();

  // Mismo 404 si no existe o si es de otra persona: responder distinto delata
  // qué ids existen.
  if (!actual || actual.privy_did !== userId)
    return Response.json({ error: "Proyecto no encontrado" }, { status: 404 });

  if (!EDITABLES.includes(actual.estado))
    return Response.json(
      {
        error:
          actual.estado === "en_revision"
            ? "Está en revisión: espera la respuesta para poder editarlo."
            : "Un proyecto publicado o cerrado ya no se edita.",
      },
      { status: 409 },
    );

  const v = validarProyecto(await req.json(), userId);
  if ("error" in v) return Response.json({ error: v.error }, { status: 400 });

  const { error } = await db
    .from("proyectos")
    .update({
      ...v.datos,
      // Corregir algo rechazado lo devuelve a borrador: vuelve a ser tuyo, y de
      // ahí sale otra vez a revisión cuando lo mandes.
      estado: "borrador",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, estado: "borrador" });
}
