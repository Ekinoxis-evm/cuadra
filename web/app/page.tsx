"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/lib/supabase";
import { claveListing, type BarrioStat, type Listing, type Operacion } from "@/lib/types";
import { FILTROS_VACIOS, ORDENES, limitesPrecio, type Filtros, type Orden } from "@/lib/filtros";
import Nav from "@/components/Nav";
import BarrioBoard from "@/components/BarrioBoard";
import ListingCard from "@/components/ListingCard";
import PanelFiltros from "@/components/PanelFiltros";

const POR_PAGINA = 48;

export default function Home() {
  const { authenticated, getAccessToken } = usePrivy();
  const [op, setOp] = useState<Operacion>("arriendo");
  const [stats, setStats] = useState<BarrioStat[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [filtros, setF] = useState<Filtros>(FILTROS_VACIOS);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);

  const setFiltros = useCallback(
    (parcial: Partial<Filtros>) => setF((f) => ({ ...f, ...parcial })),
    [],
  );

  useEffect(() => {
    supabase.from("barrio_stats").select("*").then(({ data }) => {
      if (data) setStats(data as BarrioStat[]);
    });
  }, []);

  useEffect(() => {
    setCargando(true);
    let q = supabase
      .from("listings")
      .select("*", { count: "exact" })
      .eq("active", true)
      .eq("operacion", op);

    if (filtros.barrios.length) q = q.in("barrio", filtros.barrios);
    if (filtros.tipos.length) q = q.in("tipo", filtros.tipos);
    if (filtros.estratos.length) q = q.in("estrato", filtros.estratos);
    if (filtros.precioMin != null) q = q.gte("price_cop", filtros.precioMin);
    if (filtros.precioMax != null) q = q.lte("price_cop", filtros.precioMax);
    if (filtros.habsMin != null) q = q.gte("habs", filtros.habsMin);
    if (filtros.banosMin != null) q = q.gte("banos", filtros.banosMin);
    if (filtros.areaMin != null) q = q.gte("area_m2", filtros.areaMin);
    if (filtros.parqueaderosMin != null)
      q = q.gte("parqueaderos", filtros.parqueaderosMin);
    if (filtros.amenidades.length) q = q.contains("amenidades", filtros.amenidades);
    if (filtros.texto.trim())
      // Columna generada 'busqueda': tsvector en español con índice GIN. Mucho
      // mejor que el ilike sobre title que había antes, que ignoraba
      // descripción y amenidades.
      q = q.textSearch("busqueda", filtros.texto.trim(), {
        type: "websearch",
        config: "spanish",
      });

    const ordenes: Record<Orden, [string, boolean]> = {
      recientes: ["last_seen", false],
      precio_asc: ["price_cop", true],
      precio_desc: ["price_cop", false],
      area_desc: ["area_m2", false],
      m2_asc: ["price_cop", true],
    };
    const [col, asc] = ordenes[filtros.orden];
    q = q.order(col, { ascending: asc, nullsFirst: false });

    // El efecto puede quedar obsoleto si el usuario mueve otro filtro mientras
    // la consulta viaja; descartamos las respuestas que ya no corresponden.
    let vigente = true;
    q.limit(POR_PAGINA).then(({ data, count }) => {
      if (!vigente) return;
      setListings((data as Listing[]) ?? []);
      setTotal(count ?? 0);
      setCargando(false);
    });
    return () => { vigente = false; };
  }, [op, filtros]);

  useEffect(() => {
    if (!authenticated) return setFavs(new Set());
    (async () => {
      const token = await getAccessToken();
      const r = await fetch("/api/favoritos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const rows: { source: string; source_id: string }[] = await r.json();
        setFavs(new Set(rows.map((x) => `${x.source}:${x.source_id}`)));
      }
    })();
  }, [authenticated, getAccessToken]);

  async function toggleFav(l: Listing) {
    if (!authenticated) return;
    const key = claveListing(l);
    const token = await getAccessToken();
    const method = favs.has(key) ? "DELETE" : "POST";
    const r = await fetch("/api/favoritos", {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ source: l.source, source_id: l.source_id }),
    });
    if (r.ok)
      setFavs((prev) => {
        const next = new Set(prev);
        if (method === "POST") next.add(key); else next.delete(key);
        return next;
      });
  }

  const nActivos = useMemo(
    () => stats.filter((s) => s.operacion === op).reduce((a, s) => a + s.n, 0),
    [stats, op],
  );

  const toggleBarrio = useCallback(
    (b: string) =>
      setF((f) => ({
        ...f,
        barrios: f.barrios.includes(b)
          ? f.barrios.filter((x) => x !== b)
          : [...f.barrios, b],
      })),
    [],
  );

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 pb-24">
        <div className="flex flex-wrap items-center gap-3 mt-6">
          <div className="flex mono text-xs">
            {(["arriendo", "venta"] as Operacion[]).map((o) => (
              <button
                key={o}
                onClick={() => { setOp(o); setF(FILTROS_VACIOS); }}
                className={`px-4 py-2 border rule ${
                  op === o
                    ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                    : "text-[var(--muted)] hover:text-[var(--bone)]"
                }`}
              >
                {o.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="mono text-[11px] text-[var(--muted)]">
            {nActivos} con barrio · {total} en el filtro
          </span>
          <select
            value={filtros.orden}
            onChange={(e) => setFiltros({ orden: e.target.value as Orden })}
            className="mono text-[11px] bg-transparent border rule px-2 py-1.5 ml-auto focus:outline-none focus:border-[var(--solar)]"
          >
            {ORDENES.map((o) => (
              <option key={o.id} value={o.id} className="bg-[var(--petrol)]">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <section className="grid lg:grid-cols-[minmax(300px,400px)_1fr] gap-8 mt-6">
          <div className="space-y-6">
            <div>
              <h2 className="mono text-xs text-[var(--muted)] mb-2">
                TABLERO · mediana por barrio
              </h2>
              <BarrioBoard
                stats={stats}
                op={op}
                seleccionados={filtros.barrios}
                onToggle={toggleBarrio}
                onLimpiar={() => setFiltros({ barrios: [] })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <PanelFiltros
              filtros={filtros}
              setFiltros={setFiltros}
              limites={limitesPrecio(op)}
              nResultados={total}
              onLimpiar={() => setF(FILTROS_VACIOS)}
            />

            {cargando ? (
              <p className="mono text-xs text-[var(--muted)]">cargando…</p>
            ) : !listings.length ? (
              <p className="mono text-xs text-[var(--muted)]">
                Nada con esos filtros. Prueba aflojar el precio o quitar amenidades.
              </p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  {listings.map((l) => (
                    <ListingCard
                      key={claveListing(l)}
                      l={l}
                      faved={favs.has(claveListing(l))}
                      onFav={authenticated ? () => toggleFav(l) : undefined}
                    />
                  ))}
                </div>
                {total > listings.length && (
                  <p className="mono text-[11px] text-[var(--muted)] text-center pt-2">
                    Mostrando {listings.length} de {total}. Afina los filtros para ver el resto.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <footer className="mono text-[11px] text-[var(--muted)] mt-16 pt-6 border-t rule">
          Datos agregados de portales públicos. Cada listing enlaza a su fuente original.
        </footer>
      </main>
    </>
  );
}
