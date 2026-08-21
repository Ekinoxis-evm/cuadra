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

/** Favicon servido por el propio portal. null si no sabemos el dominio. */
export function faviconDe(source: string, url?: string | null): string | null {
  const host = hostDe(source, url);
  return host ? `https://${host}/favicon.ico` : null;
}
