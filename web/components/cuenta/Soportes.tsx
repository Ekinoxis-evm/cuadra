"use client";
import { useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  MAX_BYTES_DOC,
  TIPOS_DOCUMENTO,
  etiquetaDocumento,
  pesoLegible,
  type Documento,
} from "@/lib/proyectos";

/**
 * Adjuntar peritajes, avalúos y evaluaciones del espacio.
 *
 * El tipo se escoge ANTES de subir el archivo, no después: un PDF llamado
 * "informe_final.pdf" no le dice nada a quien revisa, y pedir la clasificación
 * al final hace que todo el mundo la deje en "otro". Cada tipo trae su
 * explicación a la vista, porque peritaje, avalúo y evaluación se confunden.
 */
export default function Soportes({
  docs,
  onCambio,
}: {
  docs: Documento[];
  onCambio: (docs: Documento[]) => void;
}) {
  const { getAccessToken } = usePrivy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<string>(TIPOS_DOCUMENTO[0].id);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const explicacion = TIPOS_DOCUMENTO.find((t) => t.id === tipo)?.detalle;

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    setSubiendo(true);
    const token = await getAccessToken();
    const nuevos: Documento[] = [];

    for (const archivo of Array.from(archivos)) {
      if (archivo.size > MAX_BYTES_DOC) {
        setError(`«${archivo.name}» pesa más de 10 MB`);
        continue;
      }
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("tipo", tipo);
      try {
        const r = await fetch("/api/proyectos/documentos", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "No se pudo subir");
        nuevos.push(j as Documento);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir el archivo");
      }
    }

    if (nuevos.length) onCambio([...docs, ...nuevos]);
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function quitar(doc: Documento) {
    onCambio(docs.filter((d) => d.ruta !== doc.ruta));
    const token = await getAccessToken();
    // El borrado del archivo va detrás de la UI a propósito: si falla, lo peor
    // que queda es un archivo huérfano en el bucket, no un botón congelado.
    fetch(`/api/proyectos/documentos?ruta=${encodeURIComponent(doc.ruta)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  async function abrir(doc: Documento) {
    const token = await getAccessToken();
    const r = await fetch(
      `/api/proyectos/documentos?ruta=${encodeURIComponent(doc.ruta)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) return setError("No se pudo abrir el documento");
    const { url } = await r.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mono text-[10px] text-[var(--muted)]">
          QUÉ ESTÁS ADJUNTANDO
        </span>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {TIPOS_DOCUMENTO.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTipo(t.id)}
              aria-pressed={tipo === t.id}
              className={`mono text-[11px] border rule px-2.5 py-1.5 ${
                tipo === t.id
                  ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                  : "text-[var(--muted)] hover:text-[var(--bone)]"
              }`}
            >
              {t.titulo}
            </button>
          ))}
        </div>
        <p className="mono text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
          {explicacion}
        </p>
      </div>

      <div className="border rule border-dashed p-4 text-center">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => subir(e.target.files)}
          className="hidden"
          id="soporte-archivo"
        />
        <label
          htmlFor="soporte-archivo"
          className={`mono text-xs border rule px-4 py-2.5 inline-block cursor-pointer ${
            subiendo ? "opacity-40 pointer-events-none" : "hover:bg-[var(--petrol-2)]"
          }`}
        >
          {subiendo ? "subiendo…" : `+ ADJUNTAR ${etiquetaDocumento(tipo).toUpperCase()}`}
        </label>
        <p className="mono text-[10px] text-[var(--muted)] mt-2 leading-relaxed">
          PDF, JPG, PNG o WEBP · hasta 10 MB por archivo · puedes escoger varios
          a la vez
        </p>
      </div>

      {error && (
        <p className="mono text-[11px] text-[var(--solar)]" role="alert">
          {error}
        </p>
      )}

      {docs.length > 0 && (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li
              key={d.ruta}
              className="border rule px-3 py-2 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="mono text-[11px] text-[var(--solar)]">
                  {etiquetaDocumento(d.tipo)}
                </p>
                <p className="mono text-[11px] text-[var(--muted)] truncate">
                  {d.nombre} · {pesoLegible(d.bytes)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => abrir(d)}
                  className="mono text-[10px] text-[var(--muted)] hover:text-[var(--bone)] underline underline-offset-4"
                >
                  ver
                </button>
                <button
                  type="button"
                  onClick={() => quitar(d)}
                  className="mono text-[10px] text-[var(--muted)] hover:text-[var(--solar)]"
                  aria-label={`Quitar ${d.nombre}`}
                >
                  quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
