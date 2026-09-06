"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Pasos from "@/components/Pasos";
import ConSesion from "@/components/proyectos/ConSesion";
import TarjetaProyecto from "@/components/proyectos/TarjetaProyecto";
import { useFetchConSesion, useKyc } from "@/components/proyectos/datos";
import { RUTA_PUBLICAR, type ProyectoPropio } from "@/lib/proyectos";

function Mios() {
  const f = useFetchConSesion();
  const { kyc, cargando: cargandoKyc } = useKyc();
  const [mios, setMios] = useState<ProyectoPropio[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const r = await f("/api/proyectos");
    if (r.ok) setMios((await r.json()).mios ?? []);
    setCargando(false);
  }, [f]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando || cargandoKyc)
    return <p className="mono text-xs text-[var(--muted)]">···</p>;

  // En qué tramo de la ruta está esta cuenta.
  const publicado = mios.some((p) => p.estado === "publicado");
  const enCurso = mios.some((p) => ["borrador", "en_revision", "rechazado"].includes(p.estado));
  const tramo = !kyc ? 0 : publicado ? 3 : enCurso ? 2 : 1;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Ruta completa: qué queda hecho, dónde vas, qué falta. */}
      <div className="border rule p-4">
        <Pasos pasos={RUTA_PUBLICAR} actual={tramo} etiqueta="TRAMO" />
      </div>

      <div className="border rule p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="mono text-[11px] text-[var(--muted)]">IDENTIDAD</p>
          {kyc ? (
            <p className="mono text-xs mt-1">
              Documento {kyc.documento_enmascarado} ·{" "}
              <span
                className={
                  kyc.estado === "aprobado"
                    ? "text-[var(--alza)]"
                    : kyc.estado === "rechazado"
                      ? "text-[var(--solar)]"
                      : "text-[var(--muted)]"
                }
              >
                {kyc.estado}
              </span>
            </p>
          ) : (
            <p className="text-sm mt-1 leading-relaxed">
              Sin verificar. Hace falta para proponer.
            </p>
          )}
        </div>
        {!kyc ? (
          <Link
            href="/proyectos/verificacion"
            className="mono text-xs px-4 py-2.5 bg-[var(--solar)] text-[var(--petrol)] font-semibold"
          >
            VERIFICAR IDENTIDAD
          </Link>
        ) : kyc.estado !== "rechazado" ? (
          <Link
            href="/proyectos/nuevo"
            className="mono text-xs px-4 py-2.5 border rule hover:bg-[var(--petrol-2)]"
          >
            + PROPONER
          </Link>
        ) : null}
      </div>

      <div>
        <h2 className="mono text-[11px] text-[var(--muted)] mb-2">TUS PROYECTOS</h2>
        {mios.length ? (
          <div className="space-y-3">
            {mios.map((p) => (
              <TarjetaProyecto key={p.id} p={p} href={`/proyectos/${p.id}`} propio />
            ))}
          </div>
        ) : (
          <p className="mono text-xs text-[var(--muted)] leading-relaxed">
            Todavía no has propuesto nada.
            {kyc && kyc.estado !== "rechazado" && (
              <>
                {" "}
                <Link href="/proyectos/nuevo" className="underline underline-offset-4 hover:text-[var(--bone)]">
                  Empieza aquí
                </Link>
                .
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PaginaMios() {
  return (
    <ConSesion
      mensaje="Para ver tus proyectos hace falta entrar a tu cuenta. La vitrina se ve sin ella."
    >
      <Mios />
    </ConSesion>
  );
}
