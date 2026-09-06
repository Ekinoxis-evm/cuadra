import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CAMPOS_PUBLICOS, type ProyectoPublico } from "@/lib/proyectos";
import TarjetaProyecto from "@/components/proyectos/TarjetaProyecto";

/**
 * La vitrina: lo publicado, para cualquiera.
 *
 * Server Component con el cliente anónimo, igual que la página de cada
 * proyecto: sin sesión, sin Privy en el camino, y leyendo por RLS solo las
 * columnas que la migración 008 dejó públicas. Se regenera cada minuto: una
 * publicación nueva no tiene que esperar a un deploy.
 */
export const revalidate = 60;

export default async function Vitrina() {
  const { data } = await supabase
    .from("proyectos")
    .select(CAMPOS_PUBLICOS)
    .eq("estado", "publicado")
    .order("updated_at", { ascending: false })
    .limit(50);
  const publicos = (data ?? []) as unknown as ProyectoPublico[];

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-[var(--muted)] leading-relaxed">
        Cada proyecto de aquí pasó por verificación de identidad y por revisión
        antes de publicarse. Personas, empresas y entidades públicas pueden
        proponer y participar.
      </p>

      {publicos.length ? (
        <div className="space-y-3">
          {publicos.map((p) => (
            <TarjetaProyecto key={p.id} p={p} href={`/proyecto/${p.id}`} />
          ))}
        </div>
      ) : (
        <div className="border rule p-5 space-y-2">
          <p className="mono text-xs text-[var(--muted)]">
            Todavía no hay proyectos publicados.
          </p>
          <p className="text-sm leading-relaxed">
            ¿Tienes una obra que financiar?{" "}
            <Link href="/proyectos/nuevo" className="underline underline-offset-4 hover:text-[var(--solar)]">
              Propón la primera
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
