import { resumen } from "@/lib/resumen";

const fmt = (n: number) => n.toLocaleString("es-CO");

export default async function Cifras() {
  const { listings, barrios, fotos } = await resumen();
  if (!listings) return null;

  const items = [
    { n: fmt(listings), label: "inmuebles activos" },
    { n: fmt(barrios), label: "barrios de Cali" },
    { n: fmt(fotos), label: "fotos indexadas" },
  ];

  return (
    <section className="grid grid-cols-3 gap-6 py-10 border-t rule">
      {items.map((i) => (
        <div key={i.label}>
          <p className="mono text-2xl md:text-3xl font-semibold">{i.n}</p>
          <p className="mono text-[11px] text-[var(--muted)] mt-1">{i.label}</p>
        </div>
      ))}
    </section>
  );
}
