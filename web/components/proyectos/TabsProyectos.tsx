"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Las tres pestañas de la sección. Cada una es una ruta, no un estado en
 * memoria: se puede enlazar, recargar y volver atrás con el botón del
 * navegador. Antes todo esto vivía en una sola pestaña de la cuenta que
 * cambiaba de vista por dentro, y "atrás" te sacaba de la sección entera.
 */
const TABS = [
  { href: "/proyectos", label: "VITRINA", nota: "Lo publicado" },
  { href: "/proyectos/mios", label: "MIS PROYECTOS", nota: "Lo tuyo, en cualquier tramo" },
  { href: "/proyectos/nuevo", label: "PROPONER", nota: "Propuesta nueva" },
];

/** A qué pestaña pertenece una ruta. Las páginas de un proyecto son "mis proyectos". */
export function tabDe(pathname: string): string {
  if (pathname === "/proyectos") return "/proyectos";
  if (pathname.startsWith("/proyectos/nuevo")) return "/proyectos/nuevo";
  return "/proyectos/mios";
}

export default function TabsProyectos() {
  const pathname = usePathname();
  const activa = tabDe(pathname);

  return (
    <nav aria-label="Secciones de proyectos" className="border-b rule -mx-4 px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const aqui = t.href === activa;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={aqui ? "page" : undefined}
                className={`block mono text-xs px-3 py-2.5 border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  aqui
                    ? "border-[var(--solar)] text-[var(--bone)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--bone)]"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
