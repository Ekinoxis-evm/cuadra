"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ConSesion from "@/components/proyectos/ConSesion";
import TarjetaProyecto from "@/components/proyectos/TarjetaProyecto";
import { LineaIdentidad } from "@/components/proyectos/Identidad";
import { useFetchConSesion, useKyc } from "@/components/proyectos/datos";
import type { ProyectoPropio } from "@/lib/proyectos";

/**
 * Lo tuyo. Cada proyecto lleva su avance en su tarjeta; la identidad va en una
 * línea aparte porque no es un tramo de ningún proyecto. La versión anterior
 * dibujaba una "ruta de cuatro tramos" por cuenta que sumaba las dos cosas y
 * decía "Revisión" con un solo borrador guardado.
 */
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

  const puedeProponer = !!kyc && kyc.estado !== "rechazado";

  return (
    <div className="max-w-2xl space-y-6">
      <LineaIdentidad kyc={kyc} />

      <div>
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <h2 className="mono text-[11px] text-[var(--muted)]">
            TUS PROYECTOS{mios.length ? ` · ${mios.length}` : ""}
          </h2>
          {puedeProponer && (
            <Link
              href="/proyectos/nuevo"
              className="mono text-[11px] text-[var(--muted)] hover:text-[var(--bone)]"
            >
              + proponer
            </Link>
          )}
        </div>

        {mios.length ? (
          <div className="space-y-3">
            {mios.map((p) => (
              <TarjetaProyecto key={p.id} p={p} href={`/proyectos/${p.id}`} propio />
            ))}
          </div>
        ) : (
          <div className="border rule p-5 space-y-2">
            <p className="mono text-xs text-[var(--muted)]">Todavía no has propuesto nada.</p>
            <p className="text-sm leading-relaxed">
              {puedeProponer ? (
                <>
                  <Link href="/proyectos/nuevo" className="underline underline-offset-4 hover:text-[var(--solar)]">
                    Propón tu primer proyecto
                  </Link>
                  . Queda como borrador hasta que lo mandes a revisión.
                </>
              ) : kyc ? (
                "Cuando la identidad quede resuelta podrás proponer."
              ) : (
                <>
                  Primero{" "}
                  <Link href="/proyectos/identidad" className="underline underline-offset-4 hover:text-[var(--solar)]">
                    verifica tu identidad
                  </Link>
                  ; después propones.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaginaMios() {
  return (
    <ConSesion mensaje="Para ver tus proyectos hace falta entrar a tu cuenta. La vitrina se ve sin ella.">
      <Mios />
    </ConSesion>
  );
}
