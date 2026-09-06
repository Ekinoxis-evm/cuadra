"use client";
import Link from "next/link";
import {
  EDITABLES,
  ETIQUETA_ESTADO,
  TITULO_PROVISIONAL,
  type ProyectoPropio,
} from "@/lib/proyectos";

export type PestanaProyecto = "resumen" | "entrevista" | "editar";

/**
 * Cabecera común a las tres páginas de un proyecto propio: título, estado y
 * las pestañas que aplican a ese estado. Un proyecto en revisión no ofrece
 * "editar" porque el servidor lo rechazaría; mejor no mostrar la puerta que
 * mostrarla cerrada.
 */
export default function CabeceraProyecto({
  p,
  pestana,
}: {
  p: ProyectoPropio;
  pestana: PestanaProyecto;
}) {
  const base = `/proyectos/${p.id}`;
  const tabs: { id: PestanaProyecto; href: string; label: string }[] = [
    { id: "resumen", href: base, label: "RESUMEN" },
  ];
  if (p.estado === "borrador")
    tabs.push({ id: "entrevista", href: `${base}/entrevista`, label: "ENTREVISTA" });
  if (EDITABLES.includes(p.estado))
    tabs.push({ id: "editar", href: `${base}/editar`, label: "EDITAR" });

  const sinTitulo = p.titulo === TITULO_PROVISIONAL;

  return (
    <div className="space-y-4">
      <Link
        href="/proyectos/mios"
        className="mono text-[11px] text-[var(--muted)] hover:text-[var(--bone)] inline-block"
      >
        ← mis proyectos
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h2 className={`text-lg font-semibold leading-snug ${sinTitulo ? "text-[var(--muted)] italic" : ""}`}>
          {p.titulo}
        </h2>
        <span
          className={`mono text-[11px] shrink-0 mt-1 ${
            p.estado === "publicado"
              ? "text-[var(--alza)]"
              : p.estado === "rechazado"
                ? "text-[var(--solar)]"
                : "text-[var(--muted)]"
          }`}
        >
          {ETIQUETA_ESTADO[p.estado] ?? p.estado}
        </span>
      </div>

      {tabs.length > 1 && (
        <nav aria-label="Secciones del proyecto" className="border-b rule">
          <ul className="flex gap-1">
            {tabs.map((t) => (
              <li key={t.id}>
                <Link
                  href={t.href}
                  aria-current={t.id === pestana ? "page" : undefined}
                  className={`block mono text-[11px] px-3 py-2 border-b-2 -mb-px transition-colors ${
                    t.id === pestana
                      ? "border-[var(--solar)] text-[var(--bone)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--bone)]"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
