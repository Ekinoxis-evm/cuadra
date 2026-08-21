import { NextRequest } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { supabaseAdmin } from "@/lib/supabase";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

async function did(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const claims = await privy.verifyAuthToken(auth.slice(7));
    return claims.userId;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await did(req);
  if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("preferencias")
    .select("*")
    .eq("privy_did", userId)
    .maybeSingle();

  // null explícito: la UI distingue "sin preferencias todavía" de un error.
  return Response.json(data);
}
