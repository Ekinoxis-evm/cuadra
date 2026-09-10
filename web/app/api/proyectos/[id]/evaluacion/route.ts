import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { saldo } from "@/lib/consumo";
import { evaluar, ESFUERZO_GRIS, type Proyecto } from "@/lib/evaluador";
import { BLOQUEO_VALORES, conTipo, faltantes, regimenDe } from "@/lib/intake";
import type { ProponenteId } from "@/lib/intake";
import type { Respuestas } from "@/lib/types";

// La rúbrica encadena consulta de barrio y veredicto; medido, ~30 s.
export const maxDuration = 300;

/**
 * Correr la rúbrica sobre una propuesta.
 *
 * La dispara el proponente al mandar a revisión, y también se puede repetir a
 * mano. Cada corrida deja su fila en `evaluaciones` con la versión de rúbrica:
 * no se sobrescribe la anterior, porque comparar el antes y el después de una
 * corrección es justo lo que le sirve a quien revisa.
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

  const respuestas = conTipo(p.tipo, (p.respuestas ?? {}) as Respuestas);
  const proponente = p.proponente as ProponenteId;

  // Ofrecer retorno no es un puntaje bajo: es una propuesta que esta
  // plataforma no puede recibir. Ver el Decreto 1357 en lib/intake.ts.
  if (regimenDe(respuestas) === "valores")
    return Response.json({ error: "Fuera de régimen", detalle: BLOQUEO_VALORES }, { status: 409 });

  // Evaluar una entrevista a medias produce un veredicto que castiga vacíos
  // que solo existen porque nadie terminó de preguntar.
  const pendientes = faltantes(proponente, respuestas);
  if (pendientes.length)
    return Response.json(
      {
        error: "Entrevista incompleta",
        detalle: `Faltan ${pendientes.length} respuestas antes de poder evaluar.`,
        pendientes: pendientes.map((q) => q.id),
      },
      { status: 409 },
    );

  const { disponible } = await saldo(db, userId);
  if (disponible <= 0)
    return Response.json(
      { error: "Sin créditos", detalle: "Se acabaron los créditos de este mes." },
      { status: 402 },
    );

  try {
    let r = await evaluar(db, p as Proyecto);

    // La banda gris se vuelve a correr en esfuerzo alto. Gastar el doble solo
    // se justifica donde el fallo está en duda; en lo que ya quedó claro no
    // compra nada. Ambas corridas quedan guardadas.
    if (r.banda === "gris")
      r = await evaluar(db, p as Proyecto, { esfuerzo: ESFUERZO_GRIS });

    return Response.json({
      puntaje: r.puntaje,
      banda: r.banda,
      cobertura: r.cobertura,
      esfuerzo: r.esfuerzo,
      ejes: r.veredicto.ejes,
      senales: r.veredicto.senales,
      resumen: r.veredicto.resumen,
      para_quien_propone: r.veredicto.para_quien_propone,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Falló la evaluación" },
      { status: 500 },
    );
  }
}

/** El último veredicto, para pintarlo sin volver a gastar. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: p } = await db
    .from("proyectos")
    .select("privy_did")
    .eq("id", id)
    .maybeSingle();
  if (!p || p.privy_did !== userId)
    return Response.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const { data } = await db
    .from("evaluaciones")
    .select("puntaje, banda, cobertura, esfuerzo, ejes, senales, resumen, para_quien_propone, rubrica, creado_at")
    .eq("proyecto_id", id)
    .order("creado_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json(data ?? null);
}
