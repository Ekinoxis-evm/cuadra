"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { MAX_BYTES_FOTO, MAX_FOTOS } from "@/lib/proyectos";

/**
 * Fotos del proyecto — las públicas.
 *
 * Separadas de los soportes a propósito y con el aviso a la vista: esto sí lo
 * ve todo el mundo. Antes "registro fotográfico" era un tipo de documento más
 * y terminaba en el bucket privado, así que un proyecto publicado salía a la
 * vitrina sin una sola imagen.
 */
export default function Fotos({
  fotos,
  onCambio,
}: {
  fotos: string[];
  onCambio: (fotos: string[]) => void;
}) {
  const { getAccessToken } = usePrivy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restantes = MAX_FOTOS - fotos.length;

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    setSubiendo(true);
    const token = await getAccessToken();
    const nuevas: string[] = [];

    for (const archivo of Array.from(archivos).slice(0, restantes)) {
      if (archivo.size > MAX_BYTES_FOTO) {
        setError(`«${archivo.name}» pesa más de 10 MB`);
        continue;
      }
      const fd = new FormData();
      fd.append("archivo", archivo);
      try {
        const r = await fetch("/api/proyectos/fotos", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "No se pudo subir");
        nuevas.push(j.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir la foto");
      }
    }

    if (nuevas.length) onCambio([...fotos, ...nuevas]);
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function quitar(url: string) {
    onCambio(fotos.filter((f) => f !== url));
    const token = await getAccessToken();
    fetch(`/api/proyectos/fotos?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="mono text-[10px] text-[var(--muted)]">
          FOTOS DEL PROYECTO
        </span>
        <span className="mono text-[11px] text-[var(--muted)] block mt-1 leading-relaxed">
          Estas sí salen en la vitrina pública: el estado actual del espacio por
          dentro y por fuera. La primera es la que se ve en la tarjeta. Evita
          fotos donde aparezcan documentos o personas identificables.
        </span>
      </div>

      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {fotos.map((url, i) => (
            <li key={url} className="relative">
              <Image
                src={url}
                alt={i === 0 ? "Foto principal del proyecto" : `Foto ${i + 1}`}
                width={160}
                height={120}
                className="w-full h-20 object-cover border rule"
              />
              {i === 0 && (
                <span className="mono text-[9px] absolute top-1 left-1 bg-[var(--petrol)]/85 px-1 text-[var(--solar)]">
                  PORTADA
                </span>
              )}
              <button
                type="button"
                onClick={() => quitar(url)}
                aria-label={`Quitar foto ${i + 1}`}
                className="mono text-[10px] absolute top-1 right-1 bg-[var(--petrol)]/85 px-1.5 hover:text-[var(--solar)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => subir(e.target.files)}
        className="hidden"
        id="proyecto-foto"
      />
      <label
        htmlFor="proyecto-foto"
        className={`mono text-xs border rule px-4 py-2.5 inline-block cursor-pointer ${
          subiendo || restantes <= 0
            ? "opacity-40 pointer-events-none"
            : "hover:bg-[var(--petrol-2)]"
        }`}
      >
        {subiendo
          ? "subiendo…"
          : restantes <= 0
            ? `MÁXIMO ${MAX_FOTOS} FOTOS`
            : "+ AÑADIR FOTOS"}
      </label>

      {error && (
        <p className="mono text-[11px] text-[var(--solar)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
