"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { claveListing } from "@/lib/types";
import { useBusqueda } from "@/lib/useBusqueda";
import type { Zona } from "@/lib/filtros";
import NavApp from "@/components/NavApp";
import ListingCard from "@/components/ListingCard";
import BarraFiltros from "./BarraFiltros";
import MapaPrecios from "./MapaPrecios";

/**
 * Una sola búsqueda, dos rutas:
 *  - /buscar: lista y mapa lado a lado en escritorio; en el celular, la lista.
 *  - /buscar/mapa: el mapa a pantalla completa, que es como se busca desde el
 *    celular. Los filtros viajan en la URL, así que pasar de una a otra no
 *    pierde nada.
 */
export default function VistaBusqueda({ modo }: { modo: "lista" | "mapa" }) {
  const b = useBusqueda();
  const { filtros, setFiltros, listings, total, cargando, cargarMas, cargandoMas } = b;
  const [activo, setActivo] = useState<string | null>(null);
  const [buscarAlMover, setBuscarAlMover] = useState(true);

  const onZona = useCallback((zona: Zona) => setFiltros({ zona }), [setFiltros]);
  const onBuscarAlMover = useCallback(
    (v: boolean) => {
      setBuscarAlMover(v);
      // Apagarlo vuelve a buscar en toda la ciudad, no en el último encuadre.
      if (!v && filtros.zona) setFiltros({ zona: null });
    },
    [filtros.zona, setFiltros],
  );

  const mapa = (
    <MapaPrecios
      listings={listings}
      medianas={b.medianas}
      zona={filtros.zona}
      onZona={onZona}
      buscarAlMover={buscarAlMover}
      onBuscarAlMover={onBuscarAlMover}
      activo={activo}
      onActivo={setActivo}
      className="w-full h-full"
    />
  );

  return (
    <div className="h-dvh flex flex-col">
      <NavApp />
      <BarraFiltros b={b} />

      {modo === "mapa" ? (
        <div className="relative flex-1 min-h-0">
          {mapa}
          <Link
            href={`/buscar${b.consultaUrl}`}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 mono text-xs bg-[var(--bone)] text-[var(--petrol)] font-semibold px-5 py-2.5 rounded-full shadow-xl"
          >
            ☰ Ver lista · {total.toLocaleString("es-CO")}
          </Link>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,46%)]">
          <section className="overflow-y-auto px-4 py-5">
            {cargando && !listings.length ? (
              <p className="mono text-xs text-[var(--muted)]">cargando…</p>
            ) : !listings.length ? (
              <div className="mono text-xs text-[var(--muted)] space-y-2 max-w-md">
                <p>Nada con esos filtros{filtros.zona ? " en esta zona del mapa" : ""}.</p>
                <p>Prueba aflojar el precio, quitar amenidades o alejar el mapa.</p>
              </div>
            ) : (
              <>
                <div className={`grid sm:grid-cols-2 gap-4 ${cargando ? "opacity-50" : ""}`}>
                  {listings.map((l) => {
                    const k = claveListing(l);
                    return (
                      <ListingCard
                        key={k}
                        l={l}
                        activo={activo === k}
                        onHover={(on) => setActivo(on ? k : null)}
                        faved={b.favs.has(k)}
                        onFav={b.puedeGuardar ? () => b.toggleFav(l) : undefined}
                      />
                    );
                  })}
                </div>
                {total > listings.length && (
                  <div className="text-center pt-6 space-y-2">
                    <button
                      onClick={cargarMas}
                      disabled={cargandoMas}
                      className="mono text-xs border rule px-5 py-2.5 hover:bg-[var(--petrol-2)] disabled:opacity-40"
                    >
                      {cargandoMas ? "cargando…" : "CARGAR MÁS"}
                    </button>
                    <p className="mono text-[11px] text-[var(--muted)]">
                      {listings.length} de {total.toLocaleString("es-CO")}
                    </p>
                  </div>
                )}
              </>
            )}
            <p className="mono text-[11px] text-[var(--muted)] mt-10 pt-4 border-t rule">
              Datos agregados de portales públicos. Cada aviso enlaza a su fuente original.
            </p>
          </section>

          <div className="hidden lg:block border-l rule">{mapa}</div>

          <Link
            href={`/buscar/mapa${b.consultaUrl}`}
            className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 mono text-xs bg-[var(--bone)] text-[var(--petrol)] font-semibold px-5 py-2.5 rounded-full shadow-xl z-40"
          >
            ◉ Ver mapa
          </Link>
        </div>
      )}
    </div>
  );
}
