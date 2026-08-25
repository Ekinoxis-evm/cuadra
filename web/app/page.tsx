import Link from "next/link";
import Nav from "@/components/Nav";
import Fuentes from "@/components/Fuentes";
import Cifras from "@/components/Cifras";

/**
 * Landing. Server Component a propósito: no trae Privy ni supabase-js al
 * cliente, así que pesa una fracción de lo que pesa la app de búsqueda.
 */

const FEATURES = [
  {
    titulo: "Tablero por barrio",
    texto:
      "Mediana y $/m² de cada barrio de Cali, ordenable por cualquier columna. " +
      "Marca varios barrios y compara sin salir de la vista.",
  },
  {
    titulo: "Asistente que aprende",
    texto:
      "Cuéntale qué buscas en tus palabras, o mándale la foto de un espacio que " +
      "te guste. Recuerda tu presupuesto y tus barrios entre sesiones.",
  },
  {
    titulo: "Filtros de verdad",
    texto:
      "Precio, habitaciones, baños, parqueaderos, área, estrato, tipo y " +
      "amenidades. Búsqueda de texto en español sobre la descripción completa.",
  },
  {
    titulo: "Siempre a la fuente",
    texto:
      "Cada inmueble enlaza al portal donde está publicado. No intermediamos ni " +
      "cobramos comisión: la negociación es directa con quien publica.",
  },
];

export default function Landing() {
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

      <main className="max-w-5xl mx-auto px-4">
        <section className="py-20 md:py-28 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
            Cuánto cuesta vivir en cada barrio de Cali.
          </h1>
          <p className="mt-5 text-[var(--muted)] leading-relaxed">
            CUADRA reúne el arriendo y la venta publicados en los portales del
            país y los convierte en algo comparable: mediana y precio por metro
            cuadrado, barrio por barrio.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/buscar"
              className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold"
            >
              VER EL TABLERO
            </Link>
            <Link
              href="/cuenta?tab=intereses"
              className="mono text-xs px-5 py-3 border rule hover:bg-[var(--petrol-2)]"
            >
              HABLAR CON EL ASISTENTE
            </Link>
          </div>
        </section>

        <Cifras />

        <section className="py-16 border-t rule">
          <h2 className="mono text-xs text-[var(--muted)] mb-8">QUÉ HACE</h2>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {FEATURES.map((f) => (
              <div key={f.titulo}>
                <h3 className="font-semibold mb-2">{f.titulo}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{f.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <Fuentes />

        <section className="py-16 border-t rule">
          <h2 className="text-2xl font-bold tracking-tight">
            Empieza por tu barrio.
          </h2>
          <p className="mt-3 text-sm text-[var(--muted)] max-w-lg leading-relaxed">
            No hay que registrarse para mirar precios. La cuenta solo hace falta
            para guardar inmuebles y para que el asistente te recuerde.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/buscar"
              className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold"
            >
              VER EL TABLERO
            </Link>
            <Link
              href="/entrar"
              className="mono text-xs px-5 py-3 border rule hover:bg-[var(--petrol-2)]"
            >
              CREAR CUENTA
            </Link>
          </div>
        </section>

        <footer className="mono text-[11px] text-[var(--muted)] py-8 border-t rule leading-relaxed">
          CUADRA · Cali, Colombia. Los precios son los publicados por cada portal
          y pueden estar desactualizados. Verifica siempre en la fuente antes de
          decidir.
        </footer>
      </main>
    </>
  );
}
