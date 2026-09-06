import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { cargarCola, esRevisor, noEsRevisor } from "@/lib/revision";

/** La cola de revisión, ya ordenada por urgencia. */
export async function GET(req: NextRequest) {
  const did = await didDe(req);
  if (!did) return noAutorizado();
  if (!esRevisor(did)) return noEsRevisor(did);

  return Response.json({ cola: await cargarCola(supabaseAdmin()) });
}
