"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/lib/supabase";
import ListingCard from "@/components/ListingCard";
import { claveListing, type Listing } from "@/lib/types";

export default function Favoritos() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [listings, setListings] = useState<Listing[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const token = await getAccessToken();
    const r = await fetch("/api/favoritos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      setListings([]);
      setCargando(false);
      return;
    }
    const claves: { source: string; source_id: string }[] = await r.json();
    if (!claves.length) {
      setListings([]);
      setCargando(false);
      return;
    }

    // Los favoritos guardan (source, source_id); traemos las filas completas por
    // lectura pública. Un solo round-trip filtrando por los ids guardados.
    const { data } = await supabase
      .from("listings")
      .select("*")
      .in("source_id", claves.map((c) => c.source_id));

    const guardadas = new Set(claves.map((c) => `${c.source}:${c.source_id}`));
    setListings(((data ?? []) as Listing[]).filter((l) => guardadas.has(claveListing(l))));
    setCargando(false);
  }, [getAccessToken]);

  useEffect(() => {
    if (authenticated) cargar();
  }, [authenticated, cargar]);

  async function quitar(l: Listing) {
    const token = await getAccessToken();
    const r = await fetch("/api/favoritos", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ source: l.source, source_id: l.source_id }),
    });
    if (r.ok)
      setListings((prev) => prev.filter((x) => claveListing(x) !== claveListing(l)));
  }

  if (!ready) return <p className="mono text-xs text-[var(--muted)]">···</p>;
  if (!authenticated)
    return <p className="mono text-xs text-[var(--muted)]">Entra para ver tus guardados.</p>;
  if (cargando) return <p className="mono text-xs text-[var(--muted)]">cargando…</p>;

  if (!listings.length)
    return (
      <p className="mono text-xs text-[var(--muted)]">
        Nada guardado todavía. Marca inmuebles con ☆ desde la búsqueda.
      </p>
    );

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {listings.map((l) => (
        <ListingCard key={claveListing(l)} l={l} faved onFav={() => quitar(l)} />
      ))}
    </div>
  );
}
