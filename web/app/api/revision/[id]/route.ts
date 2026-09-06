import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { esRevisor, noEsRevisor } from "@/lib/revision";

/**
 * La decisión sobre una propuesta.
 *
 * El veredicto de la rúbrica NO decide: recomienda. Publicar es plata de
 * terceros sobre una obra real, y automatizar el sí definitivo con una
 * herramienta que puntúa sobre lo declarado sería confundir "coherente" con
 * "verificado". Quien aprueba deja su nombre en `revisado_por`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const did = await didDe(req);
  if (!did) return noAutorizado();
  if (!esRevisor(did)) return noEsRevisor(did);

  const { id } = await params;
  const { decision, nota } = (await req.json()) as {
    decision?: string;
    nota?: string;
  };

  if (!["publicar", "devolver"].includes(decision ?? ""))
    return Response.json({ error: "Decisión inválida" }, { status: 400 });

  // Devolver sin decir por qué deja a la persona adivinando, y es el caso en
  // que más falta hace saberlo: tiene que corregir algo concreto.
  const texto = (nota ?? "").trim();
  if (decision === "devolver" && texto.length < 10)
    return Response.json(
      { error: "Escribe qué hay que corregir; es lo que va a leer quien propuso." },
      { status: 400 },
    );

  const db = supabaseAdmin();

  const { data: p } = await db
    .from("proyectos")
    .select("estado, privy_did")
    .eq("id", id)
    .maybeSingle();

  if (!p) return Response.json({ error: "No encontrado" }, { status: 404 });
  if (p.estado !== "en_revision")
    return Response.json(
      { error: `Este proyecto ya no está en revisión (está en '${p.estado}').` },
      { status: 409 },
    );

  // Publicar exige KYC aprobado. La regla ya existía al proponer; se
  // revalida aquí porque entre que se propuso y se revisa el KYC pudo
  // cambiar, y esta es la puerta por la que se sale a recibir dinero.
  if (decision === "publicar") {
    const { data: k } = await db
      .from("kyc")
      .select("estado")
      .eq("privy_did", p.privy_did)
      .maybeSingle();

    if (k?.estado !== "aprobado")
      return Response.json(
        {
          error: "KYC sin aprobar",
          detalle:
            "No se puede publicar sin identidad verificada: es un proyecto que va a recibir dinero de terceros.",
        },
        { status: 409 },
      );
  }

  const { error } = await db
    .from("proyectos")
    .update({
      estado: decision === "publicar" ? "publicado" : "rechazado",
      nota_revision: decision === "devolver" ? texto : null,
      revisado_por: did,
      revisado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    // Vuelve a comprobar el estado en el UPDATE: entre el SELECT de arriba y
    // esta escritura otro revisor pudo decidir lo contrario, y sin esto el
    // último en escribir gana en silencio.
    .eq("estado", "en_revision");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, estado: decision === "publicar" ? "publicado" : "rechazado" });
}
