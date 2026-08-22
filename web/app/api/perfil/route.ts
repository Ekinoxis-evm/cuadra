import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/** Onboarding: nombre y en qué está interesado el usuario. */

const INTERESES_VALIDOS = ["arriendo", "compra", "proyectos"];

export async function GET(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const db = supabaseAdmin();
  const { data } = await db
    .from("profiles")
    .select("nombre, apellido, telefono_pais, telefono_numero, intereses, onboarding_at")
    .eq("privy_did", userId)
    .maybeSingle();

  // Del KYC solo se devuelve el estado y el documento enmascarado. El número
  // completo no vuelve nunca al navegador una vez guardado.
  const { data: kyc } = await db
    .from("kyc")
    .select("tipo_documento, documento, estado")
    .eq("privy_did", userId)
    .maybeSingle();

  return Response.json({
    ...(data ?? {}),
    kyc: kyc
      ? {
          tipo_documento: kyc.tipo_documento,
          documento_enmascarado: `••••${kyc.documento.slice(-4)}`,
          estado: kyc.estado,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const body = await req.json();
  const nombre = String(body.nombre ?? "").trim();
  const apellido = String(body.apellido ?? "").trim();
  const intereses: string[] = Array.isArray(body.intereses) ? body.intereses : [];

  if (!nombre)
    return Response.json({ error: "El nombre es obligatorio" }, { status: 400 });
  if (!intereses.length || intereses.some((i) => !INTERESES_VALIDOS.includes(i)))
    return Response.json({ error: "Escoge al menos un interés válido" }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from("profiles").upsert({
    privy_did: userId,
    nombre,
    apellido: apellido || null,
    intereses,
    onboarding_at: new Date().toISOString(),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
