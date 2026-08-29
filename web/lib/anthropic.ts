import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * El cliente de Anthropic, en un solo sitio.
 *
 * Existe por una razón concreta: las llaves ligadas a identidad
 * (identity-linked) exigen mandar `anthropic-workspace-id` en cada request, y
 * el SDK 0.120 no lo lee de ninguna variable de entorno — solo lo saca de las
 * respuestas, para el log. O sea que hay que ponerlo a mano, y ponerlo a mano
 * en cada `new Anthropic()` disperso termina en una ruta que se olvidó y falla
 * con un 400 que no dice nada obvio.
 *
 * La cabecera va solo si la variable existe. Una llave normal de workspace no
 * la necesita, y mandarla vacía sería peor que no mandarla.
 */

const workspace = process.env.ANTHROPIC_API_WORKSPACE?.trim();

export const anthropic = new Anthropic({
  ...(workspace
    ? { defaultHeaders: { "anthropic-workspace-id": workspace } }
    : {}),
});

/**
 * Diagnóstico legible para cuando la API responde 401 o 400 por credenciales.
 * Se aprendió por las malas: una llave con cuatro caracteres pegados al final
 * y una llave sin workspace fallan distinto, y ninguno de los dos mensajes
 * crudos lo dice.
 */
export function revisarCredenciales(): string | null {
  const llave = process.env.ANTHROPIC_API_KEY?.trim();

  if (!llave) return "Falta ANTHROPIC_API_KEY.";
  if (!llave.startsWith("sk-ant-"))
    return "ANTHROPIC_API_KEY no empieza por 'sk-ant-'.";
  // 108 es el largo de una llave de la API. Más caracteres casi siempre es
  // texto pegado al copiar, y la API lo reporta como "API key is invalid",
  // que manda a buscar en el lado equivocado.
  if (llave.length !== 108)
    return `ANTHROPIC_API_KEY mide ${llave.length} caracteres; una llave válida mide 108. Revisa si al copiarla se pegó algo.`;
  if (workspace && !workspace.startsWith("wrkspc_"))
    return "ANTHROPIC_API_WORKSPACE debería empezar por 'wrkspc_'.";

  return null;
}
