export type Operacion = "arriendo" | "venta";

export interface Listing {
  source: string;
  source_id: string;
  operacion: Operacion;
  tipo: string;
  url: string;
  title: string;
  price_cop: number;
  admin_cop: number | null;
  barrio: string | null;
  zona: string | null;
  habs: number | null;
  banos: number | null;
  area_m2: number | null;
  last_seen: string;

  // Enriquecimiento desde la página de detalle (migraciones 002 y 003).
  // Todo opcional: 1.532 de 1.536 listings lo tienen, no el 100%.
  imagen?: string | null;
  imagenes?: string[] | null;
  descripcion?: string | null;
  amenidades?: string[] | null;
  estrato?: number | null;
  comuna?: string | null;
  direccion?: string | null;
  parqueaderos?: number | null;
  lat?: number | null;
  lng?: number | null;
}

export interface BarrioStat {
  operacion: Operacion;
  barrio: string;
  n: number;
  median_cop: number;
  min_cop: number;
  max_cop: number;
  median_m2: number | null;
}

/** Lo que el agente aprende del usuario y reusa entre sesiones. */
export interface Preferencias {
  operacion?: Operacion | null;
  barrios?: string[] | null;
  presupuesto_min?: number | null;
  presupuesto_max?: number | null;
  habs_min?: number | null;
  banos_min?: number | null;
  area_min?: number | null;
  estrato_min?: number | null;
  estrato_max?: number | null;
  amenidades?: string[] | null;
  notas?: string | null;
}

export const fmtCOP = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-CO");

/** Clave estable de un listing: la tabla usa (source, source_id) como PK. */
export const claveListing = (l: Pick<Listing, "source" | "source_id">) =>
  `${l.source}:${l.source_id}`;

/**
 * Las respuestas del intake, guardadas tal cual las dio quien propone. Es un
 * mapa abierto porque el set de preguntas depende del tipo de proponente y
 * crece; las claves son los `id` de intake.ts y el esquema vive allá, no aquí.
 */
export type Respuestas = Record<
  string,
  string | number | boolean | null | undefined
>;
