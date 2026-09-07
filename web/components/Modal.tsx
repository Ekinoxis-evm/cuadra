"use client";
import { useEffect } from "react";

/**
 * Ventana sobre la página. Cierra con Escape y tocando afuera; en pantallas
 * chicas sube desde abajo, que es donde está el pulgar.
 */
export default function Modal({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--petrol)] border rule w-full sm:max-w-md max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b rule sticky top-0 bg-[var(--petrol)]">
          <p className="mono text-[11px] text-[var(--muted)]">{titulo}</p>
          <button
            type="button"
            onClick={onCerrar}
            className="mono text-[11px] text-[var(--muted)] hover:text-[var(--bone)]"
          >
            cerrar
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
