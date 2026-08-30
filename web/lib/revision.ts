import "server-only";

/**
 * Quién puede revisar, y en qué orden mirar.
 *
 * El panel llega ahora y no antes por una razón concreta: hasta que la rúbrica
 * no producía veredictos, una cola no tenía nada que ordenar y un `select` en
 * el dashboard de Supabase alcanzaba. Con `evaluaciones` llenándose sola, la
 * cola sí compra algo — mirar primero lo que tiene señales graves en vez de lo
 * que llegó primero.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lista de DIDs de Privy separados por coma. Es un apaño honesto: con un
 * revisor no compensa una tabla de roles, y una tabla vacía con un panel de
 * administración encima sería más código sin más seguridad.
 *
 * Falla cerrado. Sin la variable no revisa NADIE — que el panel quede abierto
 * porque falta configurar algo es exactamente el error que no se puede
 * cometer aquí: desde acá se publica y se rechaza plata ajena.
 */
export function esRevisor(did: string | null): boolean {
  if (!did) return false;
  const lista = (process.env.ADMIN_DIDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return lista.includes(did);
}

export const noEsRevisor = () =>
  Response.json({ error: "No autorizado" }, { status: 403 });

export interface EnCola {
  id: string;
  titulo: string | null;
  barrio: string | null;
  proponente: string;
  tipo: string;
  meta_cop: number | null;
  area_m2: number | null;
  enviado_revision_at: string | null;
  documentos: unknown[];
  kyc: string | null;
  evaluacion: {
    puntaje: number;
    banda: string;
    cobertura: number;
    resumen: string | null;
    para_quien_propone: string | null;
    ejes: unknown[];
    senales: { gravedad: string; asunto: string; detalle: string }[];
    rubrica: number;
    creado_at: string;
  } | null;
  /** Cuántas señales de gravedad alta. Es lo que manda en el orden. */
  graves: number;
}

/**
 * El orden del triage, y por qué no es "lo más viejo primero".
 *
 * Primero lo que tiene señales graves: una meta que se aparta un orden de
 * magnitud o un KYC que no coincide con el representante legal hay que verlo
 * hoy, llegue cuando llegue. Después lo que la rúbrica recomienda publicar,
 * porque son las decisiones más rápidas y desatascan la cola. Al final la
 * antigüedad, para que nada se quede olvidado abajo.
 *
 * Lo que NO ordena es el puntaje solo: un 80 con señal grave es más urgente
 * que un 45 limpio, y ordenar por puntaje los pondría al revés.
 */
const PESO_BANDA: Record<string, number> = {
  recomendado: 0,
  gris: 1,
  devuelto: 2,
};

export function ordenarCola(filas: EnCola[]): EnCola[] {
  return [...filas].sort((a, b) => {
    if (a.graves !== b.graves) return b.graves - a.graves;
    const pa = PESO_BANDA[a.evaluacion?.banda ?? "gris"] ?? 1;
    const pb = PESO_BANDA[b.evaluacion?.banda ?? "gris"] ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.enviado_revision_at ?? "").localeCompare(b.enviado_revision_at ?? "");
  });
}

/**
 * Las filas crudas. Se declaran porque el proyecto no genera tipos de la base:
 * sin esto supabase-js no infiere nada de un `select` armado por concatenación
 * y todo el archivo queda en `any` disfrazado.
 */
interface FilaProyecto {
  id: string;
  privy_did: string;
  titulo: string | null;
  barrio: string | null;
  proponente: string;
  tipo: string;
  meta_cop: number | null;
  area_m2: number | null;
  enviado_revision_at: string | null;
  documentos: unknown[] | null;
}

type FilaEval = NonNullable<EnCola["evaluacion"]> & { proyecto_id: string };

/** La cola completa, con el último veredicto y el KYC de cada proponente. */
export async function cargarCola(db: SupabaseClient): Promise<EnCola[]> {
  const { data: crudos } = await db
    .from("proyectos")
    .select(
      "id, privy_did, titulo, barrio, proponente, tipo, meta_cop, area_m2, " +
        "enviado_revision_at, documentos",
    )
    .eq("estado", "en_revision");

  const proyectos = (crudos ?? []) as unknown as FilaProyecto[];
  if (!proyectos.length) return [];

  // Dos consultas por lote en vez de dos por proyecto: la cola es pequeña
  // hoy, pero N+1 dentro de un bucle es la clase de cosa que solo se nota
  // cuando ya duele.
  const ids = proyectos.map((p) => p.id);
  const dids = [...new Set(proyectos.map((p) => p.privy_did))];

  const [{ data: evalsCrudas }, { data: kycsCrudos }] = await Promise.all([
    db
      .from("evaluaciones")
      .select(
        "proyecto_id, puntaje, banda, cobertura, resumen, para_quien_propone, " +
          "ejes, senales, rubrica, creado_at",
      )
      .in("proyecto_id", ids)
      .order("creado_at", { ascending: false }),
    db.from("kyc").select("privy_did, estado").in("privy_did", dids),
  ]);

  // La primera de cada proyecto es la más reciente: vienen ordenadas desc.
  const evals = (evalsCrudas ?? []) as unknown as FilaEval[];
  const ultima = new Map<string, NonNullable<EnCola["evaluacion"]>>();
  for (const e of evals) if (!ultima.has(e.proyecto_id)) ultima.set(e.proyecto_id, e);

  const kycs = (kycsCrudos ?? []) as unknown as { privy_did: string; estado: string }[];
  const porDid = new Map(kycs.map((k) => [k.privy_did, k.estado]));

  return ordenarCola(
    proyectos.map((p) => {
      const ev = ultima.get(p.id) ?? null;
      return {
        id: p.id,
        titulo: p.titulo,
        barrio: p.barrio,
        proponente: p.proponente,
        tipo: p.tipo,
        meta_cop: p.meta_cop,
        area_m2: p.area_m2,
        enviado_revision_at: p.enviado_revision_at,
        documentos: p.documentos ?? [],
        kyc: porDid.get(p.privy_did) ?? null,
        evaluacion: ev,
        graves: (ev?.senales ?? []).filter((s) => s.gravedad === "alta").length,
      };
    }),
  );
}
