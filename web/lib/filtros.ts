import type { Operacion } from "./types";

export interface Filtros {
  barrios: string[];
  precioMin: number | null;
  precioMax: number | null;
  habsMin: number | null;
  banosMin: number | null;
  areaMin: number | null;
  parqueaderosMin: number | null;
  estratos: number[];
  tipos: string[];
  amenidades: string[];
  fuentes: string[];
  texto: string;
  orden: Orden;
  /** Rectángulo visible del mapa cuando "buscar al mover el mapa" está activo. */
  zona: Zona | null;
}

export interface Zona {
  sur: number;
  oeste: number;
  norte: number;
  este: number;
}

export type Orden = "recientes" | "precio_asc" | "precio_desc" | "area_desc" | "m2_asc";

export const ORDENES: { id: Orden; label: string }[] = [
  { id: "recientes", label: "más recientes" },
  { id: "precio_asc", label: "precio ↑" },
  { id: "precio_desc", label: "precio ↓" },
  { id: "area_desc", label: "área ↓" },
  { id: "m2_asc", label: "$/m² ↑" },
];

export const TIPOS = ["apartamentos", "casas"];
export const ESTRATOS = [1, 2, 3, 4, 5, 6];

/** Las 12 amenidades más frecuentes; el resto se alcanza por texto libre. */
export const AMENIDADES_COMUNES = [
  "Balcón", "Piscina", "Ascensor", "Vigilancia", "En conjunto cerrado",
  "Zona Infantil", "Estudio", "Vista panorámica", "Calentador",
  "Cocina Integral", "Zonas Verdes", "Salón Comunal",
];

export const FILTROS_VACIOS: Filtros = {
  barrios: [], precioMin: null, precioMax: null, habsMin: null, banosMin: null,
  areaMin: null, parqueaderosMin: null, estratos: [], tipos: [], amenidades: [], fuentes: [],
  texto: "", orden: "recientes", zona: null,
};

/** Rango de precios real de la operación, para acotar el slider. */
export function limitesPrecio(op: Operacion) {
  return op === "arriendo"
    ? { min: 300_000, max: 60_000_000 }
    : { min: 60_000_000, max: 15_000_000_000 };
}

// ------------------------------------------------------------------ URL
//
// Los filtros viven en la URL y no en estado local: una búsqueda se puede
// compartir o recargar, el botón atrás funciona, y /buscar y /buscar/mapa
// leen exactamente la misma búsqueda. Solo se escribe lo que difiere del
// valor vacío, para que la URL de una búsqueda simple siga siendo corta.

const LISTAS = ["barrios", "estratos", "tipos", "amenidades", "fuentes"] as const;
const NUMEROS = [
  "precioMin", "precioMax", "habsMin", "banosMin", "areaMin", "parqueaderosMin",
] as const;

export function operacionDeUrl(p: URLSearchParams): Operacion {
  return p.get("op") === "venta" ? "venta" : "arriendo";
}

export function filtrosDeUrl(p: URLSearchParams): Filtros {
  const f: Filtros = { ...FILTROS_VACIOS };
  for (const k of LISTAS) {
    const v = p.get(k);
    if (!v) continue;
    const partes = v.split("|").filter(Boolean);
    (f as unknown as Record<string, unknown>)[k] =
      k === "estratos" ? partes.map(Number).filter(Number.isFinite) : partes;
  }
  for (const k of NUMEROS) {
    const n = Number(p.get(k));
    if (p.has(k) && Number.isFinite(n)) f[k] = n;
  }
  f.texto = p.get("q") ?? "";
  const orden = p.get("orden") as Orden | null;
  if (orden && ORDENES.some((o) => o.id === orden)) f.orden = orden;
  const z = p.get("zona")?.split(",").map(Number);
  if (z?.length === 4 && z.every(Number.isFinite))
    f.zona = { sur: z[0], oeste: z[1], norte: z[2], este: z[3] };
  return f;
}

export function filtrosAUrl(op: Operacion, f: Filtros): string {
  const p = new URLSearchParams();
  if (op !== "arriendo") p.set("op", op);
  for (const k of LISTAS) if (f[k].length) p.set(k, f[k].join("|"));
  for (const k of NUMEROS) if (f[k] != null) p.set(k, String(f[k]));
  if (f.texto.trim()) p.set("q", f.texto.trim());
  if (f.orden !== FILTROS_VACIOS.orden) p.set("orden", f.orden);
  if (f.zona) {
    const r = (n: number) => n.toFixed(4);
    p.set("zona", [f.zona.sur, f.zona.oeste, f.zona.norte, f.zona.este].map(r).join(","));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Cuántos filtros hay puestos, sin contar orden ni zona del mapa. */
export function contarFiltros(f: Filtros): number {
  return (
    f.barrios.length + f.estratos.length + f.tipos.length + f.amenidades.length +
    f.fuentes.length +
    NUMEROS.filter((k) => f[k] != null).length +
    (f.texto.trim() ? 1 : 0)
  );
}
