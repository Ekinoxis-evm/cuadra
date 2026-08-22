import { NextRequest } from "next/server";
import { didDe, noAutorizado } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * KYC mínimo para proponer proyectos: documento, nombre, apellido y teléfono.
 *
 * El documento de identidad es el dato más sensible del sistema:
 *  - vive en su propia tabla con RLS y sin políticas, así que el anon key no lo
 *    alcanza nunca; solo esta ruta con service role, tras validar el token.
 *  - no se devuelve completo jamás: el GET de /api/perfil lo enmascara.
 *
 * Esto NO es verificación de identidad real, solo recolección. Antes de mover
 * dinero de terceros hay que enchufar un proveedor que valide contra la
 * Registraduría y cifrar la columna en reposo.
 */

const TIPOS = ["CC", "CE", "NIT", "PA"];

export async function POST(req: NextRequest) {
  const userId = await didDe(req);
  if (!userId) return noAutorizado();

  const body = await req.json();
  const tipo = String(body.tipo_documento ?? "CC").toUpperCase();
  // Solo dígitos: las cédulas colombianas se escriben con puntos y hay que
  // normalizar o el índice único deja pasar "1.234" y "1234" como distintos.
  const documento = String(body.documento ?? "").replace(/\D/g, "");
  const nombre = String(body.nombre ?? "").trim();
  const apellido = String(body.apellido ?? "").trim();
  const pais = String(body.telefono_pais ?? "").trim();
  const numero = String(body.telefono_numero ?? "").replace(/\D/g, "");

  if (!TIPOS.includes(tipo))
    return Response.json({ error: "Tipo de documento inválido" }, { status: 400 });
  if (documento.length < 5 || documento.length > 15)
    return Response.json({ error: "Número de documento inválido" }, { status: 400 });
  if (!nombre || !apellido)
    return Response.json({ error: "Nombre y apellido son obligatorios" }, { status: 400 });
  if (!/^\+\d{1,4}$/.test(pais))
    return Response.json(
      { error: "Indicativo inválido; debe ser como +57" },
      { status: 400 },
    );
  if (numero.length < 6 || numero.length > 15)
    return Response.json({ error: "Número de teléfono inválido" }, { status: 400 });

  const db = supabaseAdmin();
  await db.from("profiles").upsert({
    privy_did: userId,
    nombre,
    apellido,
    telefono_pais: pais,
    telefono_numero: numero,
  });

  const { error } = await db.from("kyc").upsert({
    privy_did: userId,
    tipo_documento: tipo,
    documento,
    nombre,
    apellido,
    telefono_pais: pais,
    telefono_numero: numero,
    estado: "pendiente",
  });

  if (error) {
    // 23505 = violación de índice único: ese documento ya está en otra cuenta.
    if (error.code === "23505")
      return Response.json(
        { error: "Ese documento ya está registrado en otra cuenta" },
        { status: 409 },
      );
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, estado: "pendiente" });
}
