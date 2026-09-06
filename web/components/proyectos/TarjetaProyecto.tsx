import Image from "next/image";
import Link from "next/link";
import { fmtCOP } from "@/lib/types";
import {
  ETIQUETA_ESTADO,
  QUE_SIGUE,
  TITULO_PROVISIONAL,
  TRAMOS_PROYECTO,
  etiquetaEstadoObra,
  etiquetaTipo,
  tramoDe,
  type Documento,
  type ProyectoPublico,
} from "@/lib/proyectos";

/**
 * Tarjeta de un proyecto en cualquiera de las dos listas. No tiene acciones:
 * la tarjeta lleva a la página del proyecto, y ahí se edita, se manda a
 * revisión o se lee la respuesta. Meter botones en la tarjeta era tener dos
 * sitios distintos para decidir lo mismo.
 */
export default function TarjetaProyecto({
  p,
  href,
  propio,
}: {
  p: ProyectoPublico & { documentos?: Documento[] | null; nota_revision?: string | null };
  href: string;
  propio?: boolean;
}) {
  const pct = p.meta_cop ? Math.min(100, (p.recaudado_cop / p.meta_cop) * 100) : 0;
  const tramo = tramoDe(p.estado);
  const portada = p.imagenes?.[0];
  const sinTitulo = p.titulo === TITULO_PROVISIONAL;

  return (
    <Link href={href} className="block border rule hover:border-[var(--solar)] transition-colors">
      {portada && (
        <Image
          src={portada}
          alt=""
          width={640}
          height={200}
          className="w-full h-32 object-cover border-b rule"
        />
      )}
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm font-medium leading-snug ${sinTitulo ? "text-[var(--muted)] italic" : ""}`}>
            {p.titulo}
          </p>
          <span
            className={`mono text-[10px] shrink-0 ${
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

        <p className="mono text-[11px] text-[var(--muted)]">
          {[
            etiquetaTipo(p.tipo),
            etiquetaEstadoObra(p.estado_obra),
            p.barrio,
            p.area_m2 ? `${p.area_m2} m²` : null,
            p.plazo_meses ? `${p.plazo_meses} meses` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "sin detalles todavía"}
        </p>

        {propio && (
          <>
            <div className="flex items-center gap-1.5 pt-0.5">
              {TRAMOS_PROYECTO.map((t, i) => (
                <span
                  key={t.id}
                  className={`h-0.5 flex-1 ${
                    i < tramo || (i === tramo && tramo < 3) ? "bg-[var(--solar)]" : "bg-[var(--muted)]/25"
                  }`}
                />
              ))}
            </div>
            <p className="mono text-[10px] text-[var(--muted)] leading-relaxed">
              {p.nota_revision && p.estado === "rechazado"
                ? "Hay una nota de la revisión. Ábrelo para leerla."
                : QUE_SIGUE[p.estado] ?? ""}
            </p>
          </>
        )}

        {p.meta_cop ? (
          <div className="space-y-1 pt-1">
            <div className="h-0.5 bg-[var(--muted)]/30">
              <div className="h-full bg-[var(--solar)]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mono text-[11px]">
              {fmtCOP(p.recaudado_cop)}{" "}
              <span className="text-[var(--muted)]">de {fmtCOP(p.meta_cop)}</span>
            </p>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
