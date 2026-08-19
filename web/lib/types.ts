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
  habs: number | null;
  banos: number | null;
  area_m2: number | null;
  last_seen: string;
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

export const fmtCOP = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-CO");
