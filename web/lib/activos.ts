/**
 * Activos que maneja la wallet.
 *
 * Todas las direcciones fueron verificadas leyendo `symbol()` y `decimals()`
 * del propio contrato, no copiadas de un listado. Si agregas un activo, hazlo
 * igual: una direccion equivocada muestra saldos falsos o, peor, manda fondos
 * a un contrato que no es.
 *
 * La cadena es un detalle de implementacion: el usuario ve una sola direccion y
 * una lista de saldos. `chainId` existe para saber a que RPC preguntar, no para
 * mostrarse en pantalla.
 */

export interface Activo {
  id: string;
  simbolo: string;
  nombre: string;
  chainId: number;
  /** null = moneda nativa de la cadena. */
  contrato: string | null;
  decimales: number;
  /** Moneda en la que esta denominado, para agrupar en la UI. */
  denominacion: "USD" | "COP" | "ETH";
}

export const ACTIVOS: Activo[] = [
  {
    id: "eth",
    simbolo: "ETH",
    nombre: "Ether",
    chainId: 1,
    contrato: null,
    decimales: 18,
    denominacion: "ETH",
  },
  {
    id: "usdc",
    simbolo: "USDC",
    nombre: "USD Coin",
    chainId: 1,
    contrato: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimales: 6,
    denominacion: "USD",
  },
  {
    id: "usdt",
    simbolo: "USDT",
    nombre: "Tether USD",
    chainId: 1,
    contrato: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimales: 6,
    denominacion: "USD",
  },
  {
    id: "copm",
    simbolo: "COPm",
    nombre: "Mento Colombian Peso",
    chainId: 42220,
    contrato: "0x8a567e2ae79ca692bd748ab832081c45de4041ea",
    decimales: 18,
    denominacion: "COP",
  },
];

/** Celo es EVM, asi que la misma direccion sirve en ambas cadenas. */
export const RPC: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  42220: "https://forno.celo.org",
};

/**
 * Convierte un entero de la cadena a decimal legible sin pasar por float.
 * Number() sobre un uint256 de 18 decimales pierde precision en silencio.
 */
export function formatearUnidades(bruto: bigint, decimales: number, digitos = 4): string {
  const base = 10n ** BigInt(decimales);
  const entera = bruto / base;
  const resto = bruto % base;
  if (resto === 0n) return entera.toLocaleString("es-CO");

  const frac = resto.toString().padStart(decimales, "0").slice(0, digitos).replace(/0+$/, "");
  if (frac) return `${entera.toLocaleString("es-CO")},${frac}`;

  // Saldo no nulo pero menor a lo que muestran `digitos`: decir "0" haria
  // creer que no hay nada. Mejor marcarlo como polvo.
  if (entera === 0n) return `<0,${"0".repeat(digitos - 1)}1`;
  return entera.toLocaleString("es-CO");
}
