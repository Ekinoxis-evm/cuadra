"use client";
import { fmtCOP, type Listing } from "@/lib/types";

export default function ListingCard({
  l, onFav, faved,
}: { l: Listing; onFav?: () => void; faved?: boolean }) {
  return (
    <article className="border rule p-4 flex flex-col gap-2 hover:bg-[var(--petrol-2)]">
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
          l.area_m2 && `${l.area_m2} m²`].filter(Boolean).join(" · ")}
      </p>
      <a
        href={l.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mono text-[11px] underline underline-offset-4 text-[var(--muted)] hover:text-[var(--bone)]"
      >
        ver en {l.source} →
      </a>
    </article>
  );
}
