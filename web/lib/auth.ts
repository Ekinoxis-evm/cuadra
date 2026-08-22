import "server-only";
import { NextRequest } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

/**
 * Verificación del token de Privy, compartida por todas las rutas de API.
 * Estaba duplicada en cada archivo; un solo sitio evita que una ruta nueva se
 * quede sin la validación por olvido.
 */
const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

/** DID del usuario autenticado, o null si el token falta o no valida. */
export async function didDe(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const claims = await privy.verifyAuthToken(auth.slice(7));
    return claims.userId;
  } catch {
    return null;
  }
}

export const noAutorizado = () =>
  Response.json({ error: "No autorizado" }, { status: 401 });
