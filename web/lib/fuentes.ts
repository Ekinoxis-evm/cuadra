/**
 * Registro de portales de origen.
 *
 * El favicon se toma del dominio real del listing en vez de un archivo local:
 * así una fuente nueva se ve bien sin tocar código, y el ícono siempre coincide
 * con el sitio al que efectivamente lleva el enlace.
 */

export interface Fuente {
  /** Nombre para mostrar, con tildes y mayúsculas correctas. */
  nombre: string;
  /** Dominio de respaldo si el listing no trajera URL. */
  dominio: string;
}

const REGISTRO: Record<string, Fuente> = {
  fincaraiz: { nombre: "Fincaraíz", dominio: "www.fincaraiz.com.co" },
  meli: { nombre: "Mercado Libre", dominio: "www.mercadolibre.com.co" },
  metrocuadrado: { nombre: "Metrocuadrado", dominio: "www.metrocuadrado.com" },
  ciencuadras: { nombre: "Ciencuadras", dominio: "www.ciencuadras.com" },
};

/** Hostname del listing; cae al del registro si la URL viene vacía o inválida. */
export function hostDe(source: string, url?: string | null): string {
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // URL malformada en la data: seguimos al respaldo del registro.
    }
  }
  return REGISTRO[source]?.dominio ?? "";
}

export function nombreFuente(source: string): string {
  return REGISTRO[source]?.nombre ?? source;
}

/**
 * Portales que agregamos, para la sección de fuentes de la landing.
 * `activa` refleja si hoy hay inventario suyo en la base — no se anuncia como
 * fuente algo de lo que no tenemos un solo listing.
 */
export const CATALOGO_FUENTES: {
  id: string;
  nombre: string;
  sitio: string;
  nota: string;
}[] = [
  {
    id: "fincaraiz",
    nombre: "Fincaraíz",
    sitio: "https://www.fincaraiz.com.co",
    nota: "Portal inmobiliario con la mayor cobertura en Cali.",
  },
  {
    id: "meli",
    nombre: "Mercado Libre",
    sitio: "https://www.mercadolibre.com.co/inmuebles",
    nota: "Clasificados de inmuebles. Su API exige OAuth desde 2025; pendiente registrar la app.",
  },
  {
    id: "metrocuadrado",
    nombre: "Metrocuadrado",
    sitio: "https://www.metrocuadrado.com",
    nota: "Trae coordenadas, estrato y galería completa desde la búsqueda.",
  },
  {
    id: "ciencuadras",
    nombre: "Ciencuadras",
    sitio: "https://www.ciencuadras.com",
    nota: "Trae comuna, dirección y coordenadas de cada aviso.",
  },
];

/** Favicon servido por el propio portal. null si no sabemos el dominio. */
export function faviconDe(source: string, url?: string | null): string | null {
  const host = hostDe(source, url);
  return host ? `https://${host}/favicon.ico` : null;
}
