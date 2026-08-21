import "server-only";

/**
 * Cifras reales para la landing, leídas en el servidor.
 *
 * Los agregados los calcula Postgres en las vistas `resumen_publico` y
 * `fuentes_publicas`. La versión anterior traía las filas y sumaba en JS, y
 * PostgREST corta en 1.000 filas por defecto: el total de fotos salía
 * subestimado sin ningún error visible.
 *
 * Se usa fetch directo en vez de supabase-js para poder pasar
 * `next: { revalidate }` y dejar la landing estática con regeneración horaria.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const UNA_HORA = 3600;

export interface Resumen {
  listings: number;
  barrios: number;
  fotos: number;
  porFuente: Record<string, number>;
}

const VACIO: Resumen = { listings: 0, barrios: 0, fotos: 0, porFuente: {} };

async function leer<T>(vista: string): Promise<T[]> {
  const r = await fetch(`${URL_BASE}/rest/v1/${vista}?select=*`, {
    headers: { apikey: ANON!, Authorization: `Bearer ${ANON!}` },
    next: { revalidate: UNA_HORA },
  });
  if (!r.ok) throw new Error(`${vista}: ${r.status}`);
  return r.json();
}

export async function resumen(): Promise<Resumen> {
  try {
    const [totales, fuentes] = await Promise.all([
      leer<{ listings: number; barrios: number; fotos: number }>("resumen_publico"),
      leer<{ source: string; n: number }>("fuentes_publicas"),
    ]);

    const t = totales[0];
    if (!t) return VACIO;

    return {
      listings: t.listings,
      barrios: t.barrios,
      fotos: t.fotos,
      porFuente: Object.fromEntries(fuentes.map((f) => [f.source, f.n])),
    };
  } catch {
    // La landing nunca debe caerse por la base: se degrada a ceros y las
    // secciones que dependen de cifras se esconden.
    return VACIO;
  }
}
