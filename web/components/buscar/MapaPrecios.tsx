"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Map, { Marker, NavigationControl, Popup, type ViewStateChangeEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { claveListing, fmtCOP, type Listing } from "@/lib/types";
import type { Zona } from "@/lib/filtros";
import { nombreFuente } from "@/lib/fuentes";

/**
 * MapLibre con las teselas de OpenFreeMap: sin llave, sin cuenta de
 * facturación y con uso comercial permitido. Se probó Google Maps primero y
 * crear la cuenta de facturación se trabó (OR_BACR2_59); para pintar precios
 * sobre un mapa de Cali no hace falta nada que solo tenga Google.
 */
const ESTILO = "https://tiles.openfreemap.org/styles/dark";

/** Cali urbana, de Menga a Pance y del río Cauca a los cerros. */
const CALI: [[number, number], [number, number]] = [[-76.6, 3.33], [-76.46, 3.5]];

/** "$1,9 M" en arriendo, "$450 M" o "$1.250 M" en venta: cabe en un pin. */
export function precioCorto(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m < 10 ? m.toFixed(1).replace(".", ",").replace(",0", "") : Math.round(m).toLocaleString("es-CO")} M`;
  }
  return `$${Math.round(n / 1000)} k`;
}

type Tono = "normal" | "barato" | "activo";

function tonoDe(l: Listing, activo: boolean, medianas: globalThis.Map<string, number>): Tono {
  if (activo) return "activo";
  const med = l.barrio ? medianas.get(l.barrio) : undefined;
  if (med && l.area_m2 && l.area_m2 >= 15 && l.price_cop / l.area_m2 < med * 0.9)
    return "barato";
  return "normal";
}

const ESTILO_PIN: Record<Tono, string> = {
  normal: "bg-[var(--bone)] text-[var(--petrol)] border-[var(--petrol)]",
  barato: "bg-[var(--alza)] text-[var(--petrol)] border-[var(--petrol)]",
  activo: "bg-[var(--solar)] text-[var(--petrol)] border-[var(--petrol)] scale-110",
};

function TarjetaMapa({ l, onCerrar }: { l: Listing; onCerrar: () => void }) {
  const portada = l.imagen ?? l.imagenes?.[0] ?? null;
  const [sinFoto, setSinFoto] = useState(false);
  return (
    <div className="w-64 bg-[var(--petrol)] border rule shadow-2xl text-[var(--bone)] text-left">
      {portada && !sinFoto && (
        <div className="relative aspect-[16/10] bg-[var(--petrol-2)]">
          <Image src={portada} alt={l.title} fill sizes="256px"
            onError={() => setSinFoto(true)} className="object-cover" />
        </div>
      )}
      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span className="mono text-sm font-semibold">{fmtCOP(l.price_cop)}</span>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="mono text-xs text-[var(--muted)] hover:text-[var(--bone)]">✕</button>
        </div>
        <p className="mono text-[11px] text-[var(--muted)]">
          {[l.barrio, l.habs && `${l.habs} hab`, l.area_m2 && `${l.area_m2} m²`,
            l.estrato && `estrato ${l.estrato}`].filter(Boolean).join(" · ")}
        </p>
        <a href={l.url} target="_blank" rel="noopener noreferrer"
          className="mono text-[11px] text-[var(--solar)] hover:underline inline-block pt-1">
          Ver en {nombreFuente(l.source)} ↗
        </a>
      </div>
    </div>
  );
}

export default function MapaPrecios({
  listings, medianas, zona, onZona, buscarAlMover, onBuscarAlMover,
  activo, onActivo, className = "",
}: {
  listings: Listing[];
  medianas: globalThis.Map<string, number>;
  zona: Zona | null;
  onZona: (z: Zona) => void;
  buscarAlMover: boolean;
  onBuscarAlMover: (v: boolean) => void;
  /** Listing resaltado: el que tiene el mouse encima en la lista, o el elegido en el mapa. */
  activo: string | null;
  onActivo: (clave: string | null) => void;
  className?: string;
}) {
  const [elegido, setElegido] = useState<Listing | null>(null);
  const cerrar = useCallback(() => setElegido(null), []);

  // Si la búsqueda cambia y el elegido ya no está en los resultados, se cierra.
  useEffect(() => {
    if (elegido && !listings.some((l) => claveListing(l) === claveListing(elegido)))
      setElegido(null);
  }, [listings, elegido]);

  // Solo cuentan los movimientos que hizo la persona: el encuadre inicial
  // también dispara moveend, y filtrar por él vaciaría los avisos sin coordenadas.
  const tocado = useRef(false);
  const marcar = useCallback((e: ViewStateChangeEvent) => {
    if (e.originalEvent) tocado.current = true;
  }, []);
  const alTerminar = useCallback(
    (e: ViewStateChangeEvent) => {
      if (!tocado.current || !buscarAlMover) return;
      tocado.current = false;
      const b = e.target.getBounds();
      onZona({ sur: b.getSouth(), oeste: b.getWest(), norte: b.getNorth(), este: b.getEast() });
    },
    [buscarAlMover, onZona],
  );

  const conCoords = listings.filter((l) => l.lat != null && l.lng != null);
  const inicial = zona
    ? ([[zona.oeste, zona.sur], [zona.este, zona.norte]] as [[number, number], [number, number]])
    : CALI;

  return (
    <div className={`relative ${className}`}>
      <Map
        initialViewState={{ bounds: inicial }}
        mapStyle={ESTILO}
        style={{ width: "100%", height: "100%" }}
        onDragStart={marcar}
        onZoomStart={marcar}
        onMoveEnd={alTerminar}
        onClick={cerrar}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {conCoords.map((l) => {
          const k = claveListing(l);
          const esActivo = k === activo || (elegido != null && claveListing(elegido) === k);
          return (
            <Marker
              key={k}
              longitude={l.lng!}
              latitude={l.lat!}
              anchor="bottom"
              // El activo va encima de los demás; MapLibre ordena por DOM.
              style={{ zIndex: esActivo ? 10 : 1 }}
              onClick={(e) => {
                // Sin esto el clic llega también al mapa, que cierra la tarjeta.
                e.originalEvent.stopPropagation();
                setElegido(l);
                onActivo(k);
              }}
            >
              <span
                onMouseEnter={() => onActivo(k)}
                onMouseLeave={() => onActivo(null)}
                title={`${fmtCOP(l.price_cop)} · ${l.barrio ?? ""}`}
                className={`mono text-[11px] font-semibold px-2 py-1 rounded-full border shadow-md whitespace-nowrap cursor-pointer inline-block transition-transform ${
                  ESTILO_PIN[tonoDe(l, esActivo, medianas)]
                }`}
              >
                {precioCorto(l.price_cop)}
              </span>
            </Marker>
          );
        })}

        {elegido?.lat != null && elegido.lng != null && (
          <Popup
            longitude={elegido.lng}
            latitude={elegido.lat}
            anchor="bottom"
            offset={34}
            closeButton={false}
            closeOnClick={false}
            focusAfterOpen={false}
            onClose={cerrar}
            maxWidth="none"
            className="popup-cuadra"
          >
            <TarjetaMapa l={elegido} onCerrar={cerrar} />
          </Popup>
        )}
      </Map>

      <label className="absolute z-10 top-3 left-1/2 -translate-x-1/2 mono text-[11px] bg-[var(--petrol)]/90 border rule px-3 py-1.5 flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={buscarAlMover}
          onChange={(e) => onBuscarAlMover(e.target.checked)}
          className="accent-[var(--solar)]"
        />
        Buscar al mover el mapa
      </label>

      <p className="absolute z-10 bottom-3 left-3 mono text-[10px] bg-[var(--petrol)]/90 border rule px-2 py-1 flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--alza)]" />
        bajo la mediana de $/m² del barrio
      </p>
    </div>
  );
}
