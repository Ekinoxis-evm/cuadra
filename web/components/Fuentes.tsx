import { CATALOGO_FUENTES, faviconDe } from "@/lib/fuentes";
import { resumen } from "@/lib/resumen";

/**
 * Sección de fuentes. El estado de cada portal sale del conteo real en la base,
 * no de una bandera escrita a mano: no se anuncia como fuente activa algo de lo
 * que no tenemos inventario.
 */
export default async function Fuentes() {
  const { porFuente } = await resumen();

  return (
    <section className="py-16 border-t rule">
      <h2 className="mono text-xs text-[var(--muted)] mb-3">DE DÓNDE SALEN LOS DATOS</h2>
      <p className="text-sm text-[var(--muted)] max-w-2xl leading-relaxed mb-8">
        Recogemos los avisos que estos portales publican de forma abierta y los
        normalizamos para poder compararlos entre sí. No alojamos inmuebles ni
        intermediamos: el aviso, las fotos y el contacto siguen siendo del portal
        de origen, y cada tarjeta enlaza allá.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {CATALOGO_FUENTES.map((f) => {
          const n = porFuente[f.id] ?? 0;
          const favicon = faviconDe(f.id, f.sitio);
          return (
            <a
              key={f.id}
              href={f.sitio}
              target="_blank"
              rel="noopener noreferrer"
              className="border rule p-4 flex gap-3 hover:bg-[var(--petrol-2)]"
            >
              {favicon && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={favicon} alt="" aria-hidden="true"
                  className="w-5 h-5 rounded-sm object-contain shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm flex items-center gap-2">
                  {f.nombre}
                  {n > 0 ? (
                    <span className="mono text-[10px] text-[var(--alza)]">
                      {n.toLocaleString("es-CO")} activos
                    </span>
                  ) : (
                    <span className="mono text-[10px] text-[var(--muted)]">próximamente</span>
                  )}
                </p>
                <p className="mono text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
                  {f.nota}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
