"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "./supabase";
import { claveListing, type BarrioStat, type Listing, type Operacion } from "./types";
import {
  FILTROS_VACIOS, filtrosAUrl, filtrosDeUrl, operacionDeUrl, type Filtros, type Orden,
} from "./filtros";

const POR_PAGINA = 48;

const ORDEN_SQL: Record<Orden, [string, boolean]> = {
  recientes: ["last_seen", false],
  precio_asc: ["price_cop", true],
  precio_desc: ["price_cop", false],
  area_desc: ["area_m2", false],
  m2_asc: ["precio_m2", true],
};

/**
 * La búsqueda entera — filtros, resultados, estadísticas y guardados — en un
 * solo lugar, para que la vista de lista y la de mapa sean dos pantallas de
 * la misma búsqueda y no dos copias que se desincronizan.
 *
 * El estado de los filtros es la URL. Se usa `replace` y no `push`: arrastrar
 * el slider de precio o mover el mapa no debe llenar el historial de entradas
 * que el botón atrás tendría que deshacer una por una.
 */
export function useBusqueda() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, getAccessToken } = usePrivy();

  const clave = params.toString();
  const op = useMemo(() => operacionDeUrl(new URLSearchParams(clave)), [clave]);
  const filtros = useMemo(() => filtrosDeUrl(new URLSearchParams(clave)), [clave]);

  const navegar = useCallback(
    (nuevaOp: Operacion, f: Filtros) =>
      router.replace(`${pathname}${filtrosAUrl(nuevaOp, f)}`, { scroll: false }),
    [router, pathname],
  );

  const setFiltros = useCallback(
    (parcial: Partial<Filtros>) => navegar(op, { ...filtros, ...parcial }),
    [navegar, op, filtros],
  );
  // Cambiar de operación limpia los filtros: un tope de $3M de arriendo
  // aplicado a ventas deja la vista vacía sin explicación. La zona del mapa
  // se conserva porque es dónde está mirando la persona, no un filtro.
  const setOp = useCallback(
    (o: Operacion) => navegar(o, { ...FILTROS_VACIOS, zona: filtros.zona }),
    [navegar, filtros.zona],
  );
  const limpiar = useCallback(
    () => navegar(op, { ...FILTROS_VACIOS, zona: filtros.zona }),
    [navegar, op, filtros.zona],
  );

  // ------------------------------------------------------------ resultados
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [cargandoMas, setCargandoMas] = useState(false);

  const consulta = useCallback(() => {
    let q = supabase
      .from("listings")
      .select("*", { count: "exact" })
      .eq("active", true)
      .eq("operacion", op);

    if (filtros.barrios.length) q = q.in("barrio", filtros.barrios);
    if (filtros.tipos.length) q = q.in("tipo", filtros.tipos);
    if (filtros.fuentes.length) q = q.in("source", filtros.fuentes);
    if (filtros.estratos.length) q = q.in("estrato", filtros.estratos);
    if (filtros.precioMin != null) q = q.gte("price_cop", filtros.precioMin);
    if (filtros.precioMax != null) q = q.lte("price_cop", filtros.precioMax);
    if (filtros.habsMin != null) q = q.gte("habs", filtros.habsMin);
    if (filtros.banosMin != null) q = q.gte("banos", filtros.banosMin);
    if (filtros.areaMin != null) q = q.gte("area_m2", filtros.areaMin);
    if (filtros.parqueaderosMin != null) q = q.gte("parqueaderos", filtros.parqueaderosMin);
    if (filtros.amenidades.length) q = q.contains("amenidades", filtros.amenidades);
    if (filtros.texto.trim())
      q = q.textSearch("busqueda", filtros.texto.trim(), { type: "websearch", config: "spanish" });
    if (filtros.zona) {
      const z = filtros.zona;
      q = q.gte("lat", z.sur).lte("lat", z.norte).gte("lng", z.oeste).lte("lng", z.este);
    }

    const [col, asc] = ORDEN_SQL[filtros.orden];
    return q.order(col, { ascending: asc, nullsFirst: false });
  }, [op, filtros]);

  useEffect(() => {
    setCargando(true);
    setPagina(0);
    // Una respuesta que llega después de que la persona movió otro filtro (o
    // el mapa) ya no corresponde a lo que ve: se descarta.
    let vigente = true;
    consulta()
      .range(0, POR_PAGINA - 1)
      .then(({ data, count }) => {
        if (!vigente) return;
        setListings((data as Listing[]) ?? []);
        setTotal(count ?? 0);
        setCargando(false);
      });
    return () => { vigente = false; };
  }, [consulta]);

  const cargarMas = useCallback(async () => {
    setCargandoMas(true);
    const siguiente = pagina + 1;
    const desde = siguiente * POR_PAGINA;
    const { data } = await consulta().range(desde, desde + POR_PAGINA - 1);
    setListings((prev) => [...prev, ...((data as Listing[]) ?? [])]);
    setPagina(siguiente);
    setCargandoMas(false);
  }, [consulta, pagina]);

  // ------------------------------------------------------------ contexto
  const [stats, setStats] = useState<BarrioStat[]>([]);
  const [fuentes, setFuentes] = useState<{ source: string; n: number }[]>([]);

  useEffect(() => {
    supabase.from("barrio_stats").select("*").then(({ data }) => {
      if (data) setStats(data as BarrioStat[]);
    });
    // Las fuentes salen de los datos: un portal nuevo aparece en el filtro
    // tras el primer sync, sin tocar código.
    supabase
      .from("listings")
      .select("source")
      .eq("active", true)
      .then(({ data }) => {
        if (!data) return;
        const cuenta = new Map<string, number>();
        for (const r of data as { source: string }[])
          cuenta.set(r.source, (cuenta.get(r.source) ?? 0) + 1);
        setFuentes(
          [...cuenta.entries()].map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n),
        );
      });
  }, []);

  /** Mediana de $/m² por barrio de la operación actual, para teñir los pines. */
  const medianas = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stats)
      if (s.operacion === op && s.median_m2) m.set(s.barrio, s.median_m2);
    return m;
  }, [stats, op]);

  // ------------------------------------------------------------ guardados
  const [favs, setFavs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authenticated) return setFavs(new Set());
    (async () => {
      const token = await getAccessToken();
      const r = await fetch("/api/favoritos", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const rows: { source: string; source_id: string }[] = await r.json();
        setFavs(new Set(rows.map((x) => `${x.source}:${x.source_id}`)));
      }
    })();
  }, [authenticated, getAccessToken]);

  const toggleFav = useCallback(
    async (l: Listing) => {
      if (!authenticated) return;
      const k = claveListing(l);
      const token = await getAccessToken();
      const method = favs.has(k) ? "DELETE" : "POST";
      const r = await fetch("/api/favoritos", {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source: l.source, source_id: l.source_id }),
      });
      if (r.ok)
        setFavs((prev) => {
          const next = new Set(prev);
          if (method === "POST") next.add(k); else next.delete(k);
          return next;
        });
    },
    [authenticated, getAccessToken, favs],
  );

  return {
    op, setOp, filtros, setFiltros, limpiar, consultaUrl: filtrosAUrl(op, filtros),
    listings, total, cargando, cargarMas, cargandoMas,
    stats, medianas, fuentes, favs, toggleFav, puedeGuardar: authenticated,
  };
}

export type Busqueda = ReturnType<typeof useBusqueda>;
