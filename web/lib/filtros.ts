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
  texto: "", orden: "recientes",
};

/** Rango de precios real de la operación, para acotar el slider. */
export function limitesPrecio(op: Operacion) {
  return op === "arriendo"
    ? { min: 300_000, max: 60_000_000 }
    : { min: 60_000_000, max: 15_000_000_000 };
}
