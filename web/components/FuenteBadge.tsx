"use client";
import { useState } from "react";
import { faviconDe, nombreFuente } from "@/lib/fuentes";

/**
 * Logo + nombre del portal de origen, enlazado al listing original.
 *
 * El favicon es de un dominio de terceros, así que puede fallar (404, CORS,
 * dominio caído). Si falla escondemos la imagen y dejamos solo el nombre —
 * nunca un ícono roto.
 */
export default function FuenteBadge({
  source,
  url,
  className = "",
}: {
  source: string;
  url: string;
  className?: string;
}) {
  const [sinIcono, setSinIcono] = useState(false);
  const favicon = faviconDe(source, url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mono text-[11px] inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--bone)] ${className}`}
    >
      {favicon && !sinIcono && (
        // <img> y no next/image: son cientos de dominios externos distintos y no
        // vale la pena pagar optimización por un ícono de 16px.
        <img
          src={favicon}
          alt=""
          aria-hidden="true"
          width={14}
          height={14}
          loading="lazy"
          onError={() => setSinIcono(true)}
          className="w-3.5 h-3.5 rounded-sm object-contain"
        />
      )}
      <span>ver en {nombreFuente(source)} →</span>
    </a>
  );
}
