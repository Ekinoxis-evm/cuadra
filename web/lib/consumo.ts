import "server-only";

/**
 * Registrar lo que se gastó y cobrarlo. Solo servidor.
 *
 * Va aparte de creditos.ts a propósito: allá están las tarifas y la aritmética,
 * que son datos puros y los puede leer el navegador para mostrar precios; aquí
 * está lo que toca la base con service role y no puede salir del servidor.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { costoUSD, creditosDe, periodoActual, GRATIS_MENSUAL } from "./creditos";

/** Suma de varias llamadas — el chat encadena hasta ocho vueltas por turno. */
export interface Uso {
  entrada: number;
  salida: number;
  cache_escritura: number;
  cache_lectura: number;
  costo_usd: number;
}

export const usoVacio = (): Uso => ({
  entrada: 0,
  salida: 0,
  cache_escritura: 0,
  cache_lectura: 0,
  costo_usd: 0,
});

/** Acumula el usage de una respuesta sobre el total del turno. */
export function sumarUso(
  acc: Uso,
  modelo: string,
  usage: Anthropic.Usage | Anthropic.Beta.BetaUsage,
): Uso {
  acc.entrada += usage.input_tokens ?? 0;
  acc.salida += usage.output_tokens ?? 0;
  acc.cache_escritura += usage.cache_creation_input_tokens ?? 0;
  acc.cache_lectura += usage.cache_read_input_tokens ?? 0;
  acc.costo_usd += costoUSD(modelo, usage);
  return acc;
}

/**
 * Saldo disponible hoy: la bolsa gratis del mes más lo comprado.
 *
 * No crea la fila del mes. Que consultar el saldo otorgue créditos haría que
 * mirar el saldo cada primero de mes fuera distinto a no mirarlo; la fila nace
 * cuando se cobra, en `cobrar_creditos`.
 */
export async function saldo(db: SupabaseClient, did: string) {
  const periodo = periodoActual();

  const [mes, comprados] = await Promise.all([
    db
      .from("creditos_mes")
      .select("otorgados, gastados")
      .eq("privy_did", did)
      .eq("periodo", periodo)
      .maybeSingle(),
    db
      .from("creditos_comprados")
      .select("saldo")
      .eq("privy_did", did)
      .maybeSingle(),
  ]);

  // Sin fila del mes, todavía no ha gastado nada este mes: le corresponde la
  // bolsa completa.
  const gratis = mes.data
    ? Math.max(mes.data.otorgados - mes.data.gastados, 0)
    : GRATIS_MENSUAL;
  const comprado = comprados.data?.saldo ?? 0;

  return { gratis, comprado, disponible: gratis + comprado, periodo };
}

/**
 * Deja el rastro del gasto y descuenta.
 *
 * El registro en `consumo` va SIEMPRE, aunque el cobro no alcance: es la
 * contabilidad de lo que la API ya facturó, y perderla porque el usuario quedó
 * sin saldo nos dejaría sin saber cuánto costó de verdad el mes.
 *
 * Devuelve el faltante en créditos (0 si alcanzó). El llamador decide qué
 * hacer con eso; aquí no se corta nada, porque para cuando esto corre el
 * modelo ya respondió y ya nos cobraron.
 */
export async function registrarConsumo(
  db: SupabaseClient,
  did: string,
  opciones: {
    concepto: "chat" | "evaluacion" | "intake";
    modelo: string;
    uso: Uso;
    referencia?: string;
  },
): Promise<{ creditos: number; faltante: number }> {
  const { concepto, modelo, uso, referencia } = opciones;
  const creditos = creditosDe(uso.costo_usd);

  await db.from("consumo").insert({
    privy_did: did,
    concepto,
    modelo,
    entrada: uso.entrada,
    salida: uso.salida,
    cache_escritura: uso.cache_escritura,
    cache_lectura: uso.cache_lectura,
    costo_usd: uso.costo_usd,
    creditos,
    referencia: referencia ?? null,
  });

  if (creditos <= 0) return { creditos: 0, faltante: 0 };

  const { data } = await db.rpc("cobrar_creditos", {
    p_did: did,
    p_creditos: creditos,
    p_periodo: periodoActual(),
  });

  // La función devuelve lo cobrado, o el faltante en negativo.
  const r = typeof data === "number" ? data : creditos;
  return { creditos, faltante: r < 0 ? -r : 0 };
}
