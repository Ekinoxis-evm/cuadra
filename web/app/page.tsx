"use client";
import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/lib/supabase";
import type { BarrioStat, Listing, Operacion } from "@/lib/types";
import AuthButton from "@/components/AuthButton";
import BarrioBoard from "@/components/BarrioBoard";
import ListingCard from "@/components/ListingCard";

export default function Home() {
  const { authenticated, getAccessToken } = usePrivy();
  const [op, setOp] = useState<Operacion>("arriendo");
  const [stats, setStats] = useState<BarrioStat[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [barrio, setBarrio] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("barrio_stats").select("*").then(({ data }) => {
      if (data) setStats(data as BarrioStat[]);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    let query = supabase
      .from("listings")
      .select("*")
      .eq("active", true)
      .eq("operacion", op)
      .order("last_seen", { ascending: false })
      .limit(60);
    if (barrio) query = query.eq("barrio", barrio);
    if (maxPrice) query = query.lte("price_cop", Number(maxPrice));
    if (q) query = query.ilike("title", `%${q}%`);
    query.then(({ data }) => {
      setListings((data as Listing[]) ?? []);
      setLoading(false);
    });
  }, [op, barrio, q, maxPrice]);

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
    const key = `${l.source}:${l.source_id}`;
    const token = await getAccessToken();
    const method = favs.has(key) ? "DELETE" : "POST";
    const r = await fetch("/api/favoritos", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: l.source, source_id: l.source_id }),
    });
    if (r.ok)
      setFavs((prev) => {
        const next = new Set(prev);
        if (method === "POST") next.add(key);
        else next.delete(key);
        return next;
      });
  }

  const nActivos = useMemo(
    () => stats.filter((s) => s.operacion === op).reduce((a, s) => a + s.n, 0),
    [stats, op]
  );

  return (
    <main className="max-w-5xl mx-auto px-4 pb-24">
      <header className="flex items-center justify-between py-6 border-b rule">
        <div>
          <h1 className="text-xl font-bold tracking-tight">CUADRA</h1>
          <p className="mono text-[11px] text-[var(--muted)]">
            precios inmobiliarios de cali · barrio por barrio
          </p>
        </div>
        <AuthButton />
      </header>

      {/* toggle arriendo / venta */}
      <div className="flex gap-0 mt-8 mono text-xs">
        {(["arriendo", "venta"] as Operacion[]).map((o) => (
          <button
            key={o}
            onClick={() => { setOp(o); setBarrio(null); }}
            className={`px-4 py-2 border rule ${
              op === o
                ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                : "text-[var(--muted)] hover:text-[var(--bone)]"
            }`}
          >
            {o.toUpperCase()}
          </button>
        ))}
        <span className="mono text-[11px] text-[var(--muted)] self-center ml-4">
          {nActivos} listings activos
        </span>
      </div>

      <section className="grid md:grid-cols-[minmax(280px,380px)_1fr] gap-8 mt-8">
        {/* tablero de barrios — el elemento firma */}
        <div>
          <h2 className="mono text-xs text-[var(--muted)] mb-2">
            TABLERO · mediana por barrio
          </h2>
          <BarrioBoard stats={stats} op={op} selected={barrio} onSelect={setBarrio} />
        </div>

        {/* búsqueda + resultados */}
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (amoblado, balcón, piscina...)"
              className="mono text-xs bg-transparent border rule px-3 py-2 flex-1 min-w-[180px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--solar)]"
            />
            <input
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
              placeholder="Precio máx COP"
              inputMode="numeric"
              className="mono text-xs bg-transparent border rule px-3 py-2 w-36 placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--solar)]"
            />
            {barrio && (
              <button
                onClick={() => setBarrio(null)}
                className="mono text-xs border rule px-3 py-2 text-[var(--solar)]"
              >
                {barrio} ✕
              </button>
            )}
          </div>

          {loading ? (
            <p className="mono text-xs text-[var(--muted)]">cargando…</p>
          ) : listings.length ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {listings.map((l) => (
                <ListingCard
                  key={`${l.source}:${l.source_id}`}
                  l={l}
                  faved={favs.has(`${l.source}:${l.source_id}`)}
                  onFav={authenticated ? () => toggleFav(l) : undefined}
                />
              ))}
            </div>
          ) : (
            <p className="mono text-xs text-[var(--muted)]">
              Nada con esos filtros. Amplía el precio o quita el barrio.
            </p>
          )}
        </div>
      </section>

      <footer className="mt-16 pt-6 border-t rule mono text-[11px] text-[var(--muted)]">
        Datos agregados de portales públicos (Fincaraíz, Mercado Libre y más).
        Cada listing enlaza a su fuente original.
      </footer>
    </main>
  );
}
