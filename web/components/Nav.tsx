"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";


/**
 * Navegación global. Vive en las dos páginas para que las funciones estén
 * siempre a la vista: antes el chat y la wallet solo se alcanzaban por un
 * enlace diminuto en el header y nadie los encontraba.
 */
const ITEMS = [
  { href: "/", label: "INICIO" },
  { href: "/buscar", label: "BUSCAR" },
  { href: "/cuenta?tab=intereses", label: "ASISTENTE", destacado: true },
  { href: "/cuenta?tab=favoritos", label: "GUARDADOS" },
  { href: "/cuenta?tab=wallet", label: "WALLET" },
  { href: "/cuenta?tab=proyectos", label: "PROYECTOS" },
  { href: "/cuenta?tab=perfil", label: "AJUSTES" },
];

export default function Nav({
  tabActiva,
  acciones,
}: {
  tabActiva?: string;
  /** Zona derecha del header. La landing pasa un enlace simple para no cargar
   *  Privy; las rutas con sesión pasan <AuthButton />. */
  acciones?: React.ReactNode;
}) {
  const pathname = usePathname();

  const esActivo = (href: string) => {
    const [ruta, query] = href.split("?");
    if (ruta !== pathname) return false;
    if (!query) return true;
    return query.split("=")[1] === tabActiva;
  };

  return (
    <header className="border-b rule">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between gap-4 py-4">
        <Link href="/" className="shrink-0">
          <span className="text-xl font-bold tracking-tight">CUADRA</span>
          <span className="mono text-[11px] text-[var(--muted)] hidden sm:block">
            precios inmobiliarios de cali · barrio por barrio
          </span>
        </Link>
        {acciones}
      </div>

      <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {ITEMS.map((it) => {
          const activo = esActivo(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`mono text-xs px-3 py-2.5 border-b-2 -mb-px whitespace-nowrap transition-colors ${
                activo
                  ? "border-[var(--solar)] text-[var(--bone)]"
                  : it.destacado
                    ? "border-transparent text-[var(--solar)] hover:text-[var(--bone)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--bone)]"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
