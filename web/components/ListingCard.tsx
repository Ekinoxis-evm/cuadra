"use client";
import { useState } from "react";
import Image from "next/image";
import { fmtCOP, type Listing } from "@/lib/types";
import FuenteBadge from "./FuenteBadge";

export default function ListingCard({
  l, onFav, faved,
}: { l: Listing; onFav?: () => void; faved?: boolean }) {
  const [sinFoto, setSinFoto] = useState(false);
  const portada = l.imagen ?? l.imagenes?.[0] ?? null;
  const nFotos = l.imagenes?.length ?? 0;

  return (
    <article className="border rule flex flex-col hover:bg-[var(--petrol-2)]">
      {portada && !sinFoto && (
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--petrol-2)]">
          {/* next/image y no <img>: los originales pesan ~2,5 MB y el CDN de
              origen no da miniaturas. Sin redimensionar, la grilla es inusable. */}
          <Image
            src={portada}
            alt={l.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
            onError={() => setSinFoto(true)}
            className="object-cover"
          />
          {nFotos > 1 && (
            <span className="mono text-[10px] absolute bottom-2 right-2 px-1.5 py-0.5 bg-[var(--petrol)]/85 text-[var(--bone)]">
              {nFotos} fotos
            </span>
          )}
        </div>
      )}

      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <span className="mono text-sm font-semibold">{fmtCOP(l.price_cop)}</span>
          {onFav && (
            <button
              onClick={onFav}
              aria-label={faved ? "Quitar de guardados" : "Guardar"}
              className={`mono text-xs ${faved ? "text-[var(--solar)]" : "text-[var(--muted)]"}`}
            >
              {faved ? "★ guardado" : "☆ guardar"}
            </button>
          )}
        </div>
        <p className="text-sm leading-snug line-clamp-2">{l.title}</p>
        <p className="mono text-[11px] text-[var(--muted)]">
          {[l.barrio, l.habs && `${l.habs} hab`, l.banos && `${l.banos} baños`,
            l.area_m2 && `${l.area_m2} m²`,
            l.estrato && `estrato ${l.estrato}`].filter(Boolean).join(" · ")}
        </p>
        <FuenteBadge source={l.source} url={l.url} />
      </div>
    </article>
  );
}
