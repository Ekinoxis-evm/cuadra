import NavApp from "@/components/NavApp";
import TabsProyectos from "@/components/proyectos/TabsProyectos";

/**
 * La sección de proyectos.
 *
 * Antes era una pestaña dentro de la cuenta, y dentro de esa pestaña un solo
 * componente cambiaba de vista por dentro: lista, verificación, formulario,
 * entrevista, edición. Ninguna de esas vistas tenía URL, "atrás" te sacaba de
 * la sección, recargar perdía lo que mirabas y una entrevista a medias no se
 * podía retomar. Ahora cada cosa es una página: la vitrina, lo tuyo, proponer,
 * y una página por proyecto con sus propias pestañas.
 */
export default function LayoutProyectos({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavApp />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="font-semibold">Proyectos tokenizados</h1>
          <p className="mono text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
            Reconstruir una vivienda o levantar una nueva, financiada entre varios.
          </p>
        </div>
        <TabsProyectos />
        {children}
      </main>
    </>
  );
}
