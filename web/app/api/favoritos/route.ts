import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { supabaseAdmin } from "@/lib/supabase";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

async function did(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const claims = await privy.verifyAuthToken(auth.slice(7));
    return claims.userId; // did:privy:...
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await did(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("favoritos")
    .select("source, source_id")
    .eq("privy_did", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await did(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { source, source_id } = await req.json();
  if (!source || !source_id)
    return NextResponse.json({ error: "Faltan source y source_id" }, { status: 400 });
  const db = supabaseAdmin();
  await db.from("profiles").upsert({ privy_did: userId });
  const { error } = await db
    .from("favoritos")
    .upsert({ privy_did: userId, source, source_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await did(req);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { source, source_id } = await req.json();
  const db = supabaseAdmin();
  const { error } = await db
    .from("favoritos")
    .delete()
    .match({ privy_did: userId, source, source_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
