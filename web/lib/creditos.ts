/**
 * Créditos: lo que cuesta usar CUADRA, medido y cobrado.
 *
 * El orden importa y hasta hoy estaba al revés: no se puede cobrar lo que no
 * se mide. Ninguna llamada al modelo guardaba su `usage`, así que el gasto
 * real era invisible y cualquier tarifa habría sido un número inventado. Aquí
 * cada llamada deja su rastro en `consumo` con los tokens exactos que reportó
 * la API, y el crédito se descuenta de ese rastro — no de una estimación.
 *
 * ------------------------------------------------------------------ la razón
 * El sostén del producto no es la evaluación, es la búsqueda. Evaluar un
 * proyecto cuesta entre USD 0,17 y 0,51. Una sesión de chat de doce turnos,
 * medida contra la API con tamaños de mensaje reales, costaba USD 1,04 sin
 * caché y cuesta USD 0,21 con él — 4,9 veces menos, sin tocar una coma del
 * prompt. Aun así la búsqueda sigue siendo el gasto que manda, y por eso los
 * créditos existen: para acotarla sin ponerle un muro a quien apenas está
 * probando. El margen de los paquetes es lo que financia las obras.
 */

import type Anthropic from "@anthropic-ai/sdk";

// ------------------------------------------------------------------- tarifas

/**
 * USD por millón de tokens, tal como factura la API. La escritura de caché
 * cuesta 1,25× la entrada; la lectura, 0,1× — salvo en Opus 5.5, donde es
 * 0,05×. Sin esas filas el cálculo se va largo justamente en las
 * conversaciones cacheadas, que son la mayoría.
 *
 * Opus 5 y 4.8 siguen aquí aunque el chat ya no los pida: son a donde el
 * fallback de rechazos manda la vuelta cuando Opus 5.5 declina, y esa vuelta
 * se cobra a la tarifa del modelo que la contestó.
 */
export const TARIFAS: Record<string, { entrada: number; salida: number; lectura?: number }> = {
  "claude-fable-5": { entrada: 10, salida: 50 },
  "claude-opus-5-5": { entrada: 4, salida: 20, lectura: 0.05 },
  "claude-opus-5": { entrada: 5, salida: 25 },
  "claude-opus-4-8": { entrada: 5, salida: 25 },
  "claude-sonnet-5": { entrada: 2, salida: 10 },
  "claude-haiku-4-5": { entrada: 1, salida: 5 },
};

const MULT_CACHE_ESCRITURA = 1.25;
const MULT_CACHE_LECTURA = 0.1;

interface UsoTokens {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

function costoTramo(modelo: string, u: UsoTokens): number {
  const t = TARIFAS[modelo];
  // Un modelo sin tarifa conocida no se cobra en silencio a cero: se deja
  // pasar y se registra, para que aparezca en el consumo y se note.
  if (!t) return 0;

  return (
    ((u.input_tokens ?? 0) * t.entrada +
      (u.output_tokens ?? 0) * t.salida +
      (u.cache_creation_input_tokens ?? 0) * t.entrada * MULT_CACHE_ESCRITURA +
      (u.cache_read_input_tokens ?? 0) * t.entrada * (t.lectura ?? MULT_CACHE_LECTURA)) /
    1_000_000
  );
}

/**
 * Costo real en USD de una llamada, desde el `usage` que devolvió la API.
 *
 * Con fallback de rechazos una sola respuesta puede venir de dos modelos: el
 * pedido, que declinó a mitad, y el que terminó. `usage.iterations` trae un
 * tramo por modelo; cuando está, se cobra tramo por tramo con la tarifa de
 * quien lo generó. Un tramo sin `model` es del modelo pedido.
 */
export function costoUSD(
  modelo: string,
  usage: Anthropic.Usage | Anthropic.MessageDeltaUsage | Anthropic.Beta.BetaUsage,
): number {
  const tramos = (usage as Anthropic.Beta.BetaUsage).iterations as
    | (UsoTokens & { model?: string | null })[]
    | null
    | undefined;
  if (tramos?.length)
    return tramos.reduce((s, it) => s + costoTramo(it.model ?? modelo, it), 0);
  return costoTramo(modelo, usage as UsoTokens);
}

// ------------------------------------------------------------------ créditos

/**
 * Un crédito = un centavo de dólar de costo nuestro. La equivalencia es
 * directa a propósito: cualquier otra unidad ("puntos", "gemas") obliga a
 * mantener una tabla de conversión que se desactualiza sola, y esconde de
 * nosotros mismos cuánto cuesta cada cosa.
 */
export const USD_POR_CREDITO = 0.01;

export const creditosDe = (usd: number) => Math.ceil(usd / USD_POR_CREDITO);

/**
 * Lo que cuesta cada cosa, en créditos, para mostrarlo antes de gastarlo. Son
 * promedios, no topes: se cobra el consumo real que reporta la API.
 *
 * Chat medido contra la API con el caché ya puesto: doce turnos por USD 0,21,
 * o sea unos 2 créditos por turno. Se deja en 3 porque la medición usó turnos
 * sin herramientas, y una búsqueda que devuelve listings engorda el hilo más
 * rápido que la simulación.
 */
export const COSTO_TIPICO = {
  turno_chat: 3,
  sesion_chat: 25,
  evaluacion: 25,
  evaluacion_gris: 55,
} as const;

// ------------------------------------------------------------------ el plan

/**
 * 60 créditos al mes: alcanzan para una sesión de búsqueda completa más una
 * propuesta evaluada. Cuesta unos USD 0,60 por usuario activo — con mil
 * registrados son USD 600 al mes de piso, que es asumible y suficiente para
 * que alguien conozca el producto antes de que se le pida plata.
 *
 * La recarga es mensual y no se acumula: guardar saldo gratis de meses sin uso
 * premia al que no usa el producto y nos deja un pasivo creciendo solo.
 */
export const GRATIS_MENSUAL = 60;

/**
 * Paquetes en pesos. El margen baja con el tamaño porque quien compra el
 * paquete grande ya demostró que el producto le sirve, y porque es ahí donde
 * se compite. Ese margen es lo que va a financiar los proyectos: no es un
 * extra, es el mecanismo.
 */
export const PAQUETES = [
  {
    id: "arranque",
    creditos: 500,
    cop: 39_000,
    titulo: "Arranque",
    detalle: "Unas doce sesiones de búsqueda, o veinte propuestas evaluadas",
  },
  {
    id: "constante",
    creditos: 2_000,
    cop: 139_000,
    titulo: "Constante",
    detalle: "Para quien busca en serio o propone varios proyectos",
  },
  {
    id: "profesional",
    creditos: 10_000,
    cop: 599_000,
    titulo: "Profesional",
    detalle: "Inmobiliarias, constructoras y fundaciones con volumen",
  },
] as const;

/**
 * Cuánto margen deja un paquete, al cambio que se le pase. Está en código y no
 * en una hoja aparte para que cambiar un precio obligue a ver qué le pasa al
 * margen en el mismo diff.
 */
export function margen(paqueteId: string, copPorUSD: number) {
  const p = PAQUETES.find((x) => x.id === paqueteId);
  if (!p) return null;
  const ingresoUSD = p.cop / copPorUSD;
  const costoUSD = p.creditos * USD_POR_CREDITO;
  return {
    ingresoUSD,
    costoUSD,
    margenUSD: ingresoUSD - costoUSD,
    multiplo: ingresoUSD / costoUSD,
  };
}

// ------------------------------------------------------------------- saldo

export interface Saldo {
  disponible: number;
  gratis_restante: number;
  comprados: number;
  periodo: string;
}

/**
 * Saldo del mes en curso. `creditos_mes` se recalcula por período para que la
 * bolsa gratis se renueve sola sin un cron: el período es (año, mes) y una
 * fila nueva nace con GRATIS_MENSUAL. Los comprados no caducan y viven aparte.
 */
export const periodoActual = (d = new Date()) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
