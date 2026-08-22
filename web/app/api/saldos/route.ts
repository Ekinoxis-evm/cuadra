import { NextRequest } from "next/server";
import { ACTIVOS, RPC, type Activo } from "@/lib/activos";

/**
 * Saldos de una dirección en todas las cadenas que soportamos.
 *
 * Corre en el servidor y no en el navegador por dos razones: los RPC públicos
 * bloquean por origen, y así el día que pasemos a un RPC con llave, la llave no
 * queda expuesta en el cliente.
 *
 * La dirección no es secreta y es del usuario autenticado o de quien la pida:
 * consultar un saldo público de la cadena no requiere sesión.
 */

export const revalidate = 0;

/** balanceOf(address) */
const SELECTOR_BALANCE_OF = "0x70a08231";

async function rpc(chainId: number, method: string, params: unknown[]): Promise<string> {
  const r = await fetch(RPC[chainId], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`RPC ${chainId}: HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${chainId}: ${j.error.message}`);
  return j.result as string;
}

async function saldoDe(activo: Activo, direccion: string): Promise<bigint> {
  if (!activo.contrato) {
    return BigInt(await rpc(activo.chainId, "eth_getBalance", [direccion, "latest"]));
  }
  // balanceOf recibe la dirección rellenada a 32 bytes.
  const data = SELECTOR_BALANCE_OF + direccion.slice(2).toLowerCase().padStart(64, "0");
  const res = await rpc(activo.chainId, "eth_call", [
    { to: activo.contrato, data },
    "latest",
  ]);
  return res && res !== "0x" ? BigInt(res) : 0n;
}

export async function GET(req: NextRequest) {
  const direccion = new URL(req.url).searchParams.get("address");
  if (!direccion || !/^0x[a-fA-F0-9]{40}$/.test(direccion))
    return Response.json({ error: "Dirección inválida" }, { status: 400 });

  // Una cadena caída no debe tumbar toda la vista: cada activo reporta su
  // propio error y los demás siguen mostrándose.
  const saldos = await Promise.all(
    ACTIVOS.map(async (a) => {
      try {
        const bruto = await saldoDe(a, direccion);
        return { id: a.id, bruto: bruto.toString(), error: null };
      } catch (e) {
        return {
          id: a.id,
          bruto: null,
          error: e instanceof Error ? e.message : "no disponible",
        };
      }
    }),
  );

  return Response.json({ direccion, saldos });
}
