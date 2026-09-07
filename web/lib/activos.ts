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

/**
 * Las cadenas, para lo poco que el usuario tiene que saber de ellas: cómo se
 * llama la red al confirmar un envío, en qué se paga la comisión, y dónde ver
 * la transacción después.
 */
export const CADENAS: Record<number, { nombre: string; gas: string; explorador: string }> = {
  1: { nombre: "Ethereum", gas: "ETH", explorador: "https://eth.blockscout.com" },
  42220: { nombre: "Celo", gas: "CELO", explorador: "https://celo.blockscout.com" },
};

export const urlTx = (chainId: number, hash: string) =>
  `${CADENAS[chainId]?.explorador ?? "https://eth.blockscout.com"}/tx/${hash}`;

export const esDireccion = (x: string) => /^0x[0-9a-fA-F]{40}$/.test(x.trim());

export const abreviarDireccion = (x: string) => `${x.slice(0, 6)}…${x.slice(-4)}`;

/**
 * "12,5" o "12.5" → entero de la cadena. Sin float en el camino: 0,1 + 0,2 en
 * coma flotante no es 0,3, y en un envío eso es plata que no llega.
 */
export function parsearUnidades(texto: string, decimales: number): bigint | null {
  const limpio = texto.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d*\.?\d*$/.test(limpio) || limpio === "" || limpio === ".") return null;
  const [entera = "0", frac = ""] = limpio.split(".");
  if (frac.length > decimales) return null;
  return BigInt(entera || "0") * 10n ** BigInt(decimales) + BigInt((frac || "0").padEnd(decimales, "0"));
}

/** transfer(address,uint256), armado a mano: no hace falta un ABI entero para una función. */
export function codificarTransfer(a: string, monto: bigint): `0x${string}` {
  const dir = a.trim().slice(2).toLowerCase().padStart(64, "0");
  const cant = monto.toString(16).padStart(64, "0");
  return `0xa9059cbb${dir}${cant}`;
}
