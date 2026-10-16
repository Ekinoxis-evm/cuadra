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
  { href: "/cuenta/asistente", label: "ASISTENTE", destacado: true },
  { href: "/cuenta/guardados", label: "GUARDADOS" },
  { href: "/cuenta/wallet", label: "WALLET" },
  { href: "/proyectos", label: "PROYECTOS" },
  { href: "/cuenta/ajustes", label: "AJUSTES" },
];

export default function Nav({
  acciones,
}: {
  /** Zona derecha del header. La landing pasa un enlace simple para no cargar
   *  Privy; las rutas con sesión pasan <AuthButton />. */
  acciones?: React.ReactNode;
}) {
  const pathname = usePathname();

  // Una sección con subpáginas (/cuenta/wallet/enviar) sigue siendo la misma
  // sección: la pestaña se resalta por prefijo.
  const esActivo = (href: string) =>
    href === pathname || (href !== "/" && pathname.startsWith(`${href}/`));

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

      <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto sin-barra">
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
