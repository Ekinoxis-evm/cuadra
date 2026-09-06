import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { supabase } from "@/lib/supabase";
import { fmtCOP } from "@/lib/types";
import { etiquetaEstadoObra, etiquetaTipo, PROPONENTES } from "@/lib/proyectos";

/**
 * Página pública de un proyecto.
 *
 * Server Component y con el cliente anónimo a propósito: no trae Privy, y lee
 * por RLS lo mismo que vería cualquiera. Los permisos por columna (migración
 * 008) hacen el resto — desde aquí no hay forma de pedir la dirección, las
 * rutas de los soportes ni la nota interna de revisión, aunque uno se
 * equivoque al escribir el select.
 *
 * Una vitrina donde los proyectos no se pueden enlazar no es una vitrina: esto
 * es lo que se comparte por WhatsApp.
 */

const CAMPOS =
  "id, titulo, descripcion, tipo, proponente, barrio, estado_obra, " +
  "estado_detalle, area_m2, plazo_meses, meta_cop, recaudado_cop, imagenes";

interface ProyectoPublico {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  proponente: string;
  barrio: string | null;
  estado_obra: string | null;
  estado_detalle: string | null;
  area_m2: number | null;
  plazo_meses: number | null;
  meta_cop: number | null;
  recaudado_cop: number;
  imagenes: string[] | null;
}

async function traer(id: string): Promise<ProyectoPublico | null> {
  // Un uuid inválido revienta la consulta con 22P02 en vez de devolver vacío.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase
    .from("proyectos")
    .select(CAMPOS)
    .eq("id", id)
    .eq("estado", "publicado")
    .maybeSingle();
  // El cliente no tiene tipos generados del esquema: el select se declara aquí.
  return (data as ProyectoPublico | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const p = await traer((await params).id);
  if (!p) return { title: "Proyecto no encontrado · CUADRA" };

  const meta = p.meta_cop ? ` · meta ${fmtCOP(p.meta_cop)}` : "";
  return {
    title: `${p.titulo} · CUADRA`,
    description: (p.descripcion ?? "").slice(0, 155),
    openGraph: {
      title: p.titulo,
      description: `${[etiquetaTipo(p.tipo), p.barrio].filter(Boolean).join(" · ")}${meta}`,
      images: p.imagenes?.length ? [p.imagenes[0]] : undefined,
      type: "article",
    },
  };
}

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b rule">
      <span className="mono text-[11px] text-[var(--muted)]">{k}</span>
      <span className="mono text-xs text-right">{v}</span>
    </div>
  );
}

export default async function ProyectoPublico({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await traer((await params).id);
  if (!p) notFound();

  const pct = p.meta_cop ? Math.min(100, (p.recaudado_cop / p.meta_cop) * 100) : 0;
  const porM2 =
    p.meta_cop && p.area_m2 ? Math.round(p.meta_cop / Number(p.area_m2)) : null;
  const fotos: string[] = p.imagenes ?? [];

  return (
    <>
      <Nav
        acciones={
          <Link
            href="/entrar"
            className="mono text-xs px-4 py-2 bg-[var(--solar)] text-[var(--petrol)] font-semibold"
          >
            CREAR CUENTA
          </Link>
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <div>
          <p className="mono text-[11px] text-[var(--muted)]">
            PROYECTO TOKENIZADO ·{" "}
            {[etiquetaTipo(p.tipo), p.barrio].filter(Boolean).join(" · ")}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.15] mt-3">
            {p.titulo}
          </h1>
        </div>

        {fotos.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {fotos.map((url, i) => (
              <Image
                key={url}
                src={url}
                alt={`${p.titulo} — foto ${i + 1}`}
                width={900}
                height={600}
                priority={i === 0}
                className={`w-full object-cover border rule ${
                  i === 0 ? "sm:col-span-2 h-64 sm:h-80" : "h-40"
                }`}
              />
            ))}
          </div>
        )}

        <section>
          <h2 className="mono text-[11px] text-[var(--muted)] mb-2">RECAUDO</h2>
          <div className="h-1 bg-[var(--muted)]/25">
            <div className="h-full bg-[var(--solar)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-lg">
            {fmtCOP(p.recaudado_cop)}{" "}
            <span className="mono text-sm text-[var(--muted)]">
              de {p.meta_cop ? fmtCOP(p.meta_cop) : "—"}
            </span>
          </p>
          <p className="mono text-[11px] text-[var(--muted)] mt-1">
            {pct === 0
              ? "Todavía no ha recibido aportes."
              : `${Math.round(pct)}% de la meta`}
          </p>
        </section>

        <section>
          <h2 className="mono text-[11px] text-[var(--muted)] mb-2">
            QUÉ SE VA A HACER
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {p.descripcion}
          </p>
        </section>

        {p.estado_detalle && (
          <section>
            <h2 className="mono text-[11px] text-[var(--muted)] mb-2">
              EN QUÉ ESTADO ESTÁ HOY
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {p.estado_detalle}
            </p>
          </section>
        )}

        <section>
          <h2 className="mono text-[11px] text-[var(--muted)] mb-2">FICHA</h2>
          <Fila k="tipo" v={etiquetaTipo(p.tipo)} />
          <Fila k="estado del espacio" v={etiquetaEstadoObra(p.estado_obra) ?? "—"} />
          <Fila k="barrio" v={p.barrio ?? "—"} />
          <Fila k="área" v={p.area_m2 ? `${p.area_m2} m²` : "—"} />
          <Fila k="plazo de obra" v={p.plazo_meses ? `${p.plazo_meses} meses` : "—"} />
          <Fila
            k="costo por m²"
            v={porM2 ? fmtCOP(porM2) : "—"}
          />
          <Fila
            k="propone"
            v={PROPONENTES.find((x) => x.id === p.proponente)?.label ?? p.proponente}
          />
        </section>

        <section className="border rule p-4">
          <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
            La identidad de quien propone está verificada y la propuesta pasó
            por revisión antes de publicarse. Los soportes técnicos —peritajes,
            avalúos y evaluaciones— no se publican: contienen datos personales y
            la dirección exacta del inmueble.
          </p>
        </section>

        <footer className="mono text-[11px] text-[var(--muted)] py-8 border-t rule leading-relaxed">
          CUADRA · Cali, Colombia. Revisar una propuesta no es una recomendación
          de inversión ni una garantía de que la obra se ejecute.{" "}
          <Link href="/proyectos" className="underline underline-offset-4">
            Ver todos los proyectos
          </Link>
          .
        </footer>
      </main>
    </>
  );
}
