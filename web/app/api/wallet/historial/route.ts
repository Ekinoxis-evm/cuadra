import { NextRequest } from "next/server";
import { ACTIVOS, CADENAS } from "@/lib/activos";

/**
 * Movimientos de una dirección, en los activos que manejamos.
 *
 * Se leen de Blockscout (una instancia por red) en vez de guardarlos nosotros:
 * así aparecen también los que entran desde fuera, y no hay una tabla que
 * mantener sincronizada con la cadena. Solo se listan los tokens de
 * lib/activos.ts y el ETH nativo; el resto de lo que pase por la dirección no
 * es de esta wallet en el sentido que el usuario le da.
 *
 * Blockscout indexa con retraso: un envío recién hecho puede tardar un rato en
 * salir aquí. La UI lo muestra desde el hash mientras tanto.
 */
export const revalidate = 0;

export interface Movimiento {
  hash: string;
  chainId: number;
  direccion: "entrada" | "salida";
  activoId: string;
  simbolo: string;
  bruto: string;
  decimales: number;
  contraparte: string;
  fecha: string;
}

interface Cuenta { hash?: string | null }
interface TransferenciaBS {
  transaction_hash?: string;
  tx_hash?: string;
  from: Cuenta;
  to: Cuenta;
  timestamp: string;
  total?: { value?: string };
  token?: { address_hash?: string; address?: string };
}
interface TxBS {
  hash: string;
  from: Cuenta;
  to: Cuenta | null;
  value: string;
  timestamp: string;
  status?: string;
  result?: string;
}

async function blockscout<T>(chainId: number, ruta: string): Promise<T[]> {
  const r = await fetch(`${CADENAS[chainId].explorador}/api/v2${ruta}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Blockscout ${chainId}: HTTP ${r.status}`);
  const j = (await r.json()) as { items?: T[] };
  return j.items ?? [];
}

export async function GET(req: NextRequest) {
  const direccion = new URL(req.url).searchParams.get("address") ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(direccion))
    return Response.json({ error: "Dirección inválida" }, { status: 400 });
  const yo = direccion.toLowerCase();

  const porContrato = new Map(
    ACTIVOS.filter((a) => a.contrato).map((a) => [a.contrato!.toLowerCase(), a]),
  );
  const chains = [...new Set(ACTIVOS.map((a) => a.chainId))];
  const movimientos: Movimiento[] = [];
  const errores: string[] = [];

  await Promise.all(
    chains.map(async (chainId) => {
      // Tokens.
      try {
        const items = await blockscout<TransferenciaBS>(
          chainId,
          `/addresses/${direccion}/token-transfers?type=ERC-20`,
        );
        for (const t of items) {
          const contrato = (t.token?.address_hash ?? t.token?.address ?? "").toLowerCase();
          const a = porContrato.get(contrato);
          if (!a || a.chainId !== chainId) continue;
          const de = (t.from?.hash ?? "").toLowerCase();
          movimientos.push({
            hash: t.transaction_hash ?? t.tx_hash ?? "",
            chainId,
            direccion: de === yo ? "salida" : "entrada",
            activoId: a.id,
            simbolo: a.simbolo,
            bruto: t.total?.value ?? "0",
            decimales: a.decimales,
            contraparte: de === yo ? (t.to?.hash ?? "") : (t.from?.hash ?? ""),
            fecha: t.timestamp,
          });
        }
      } catch (e) {
        errores.push(e instanceof Error ? e.message : String(e));
      }

      // Moneda nativa, solo donde la manejamos como activo.
      const nativo = ACTIVOS.find((a) => a.chainId === chainId && !a.contrato);
      if (!nativo) return;
      try {
        const items = await blockscout<TxBS>(chainId, `/addresses/${direccion}/transactions`);
        for (const t of items) {
          if (!t.value || t.value === "0") continue;
          if ((t.status ?? t.result) && !["ok", "success"].includes(String(t.status ?? t.result))) continue;
          const de = (t.from?.hash ?? "").toLowerCase();
          movimientos.push({
            hash: t.hash,
            chainId,
            direccion: de === yo ? "salida" : "entrada",
            activoId: nativo.id,
            simbolo: nativo.simbolo,
            bruto: t.value,
            decimales: nativo.decimales,
            contraparte: de === yo ? (t.to?.hash ?? "") : (t.from?.hash ?? ""),
            fecha: t.timestamp,
          });
        }
      } catch (e) {
        errores.push(e instanceof Error ? e.message : String(e));
      }
    }),
  );

  movimientos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return Response.json({ movimientos: movimientos.slice(0, 40), errores });
}
