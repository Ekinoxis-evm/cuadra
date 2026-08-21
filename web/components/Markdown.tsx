import { Fragment, type ReactNode } from "react";

/**
 * Renderizador mínimo del markdown que produce el agente: negrita, viñetas y
 * párrafos. No es un parser general — no hay dependencia externa porque el
 * modelo solo emite estos tres casos y una librería completa pesaría más que
 * toda la pestaña.
 *
 * El texto viene del modelo, no del usuario, y se inserta como texto plano de
 * React (nunca dangerouslySetInnerHTML), así que no hay superficie de XSS.
 */

/** Parte una línea en fragmentos, poniendo en <strong> lo que va entre **. */
function conNegritas(linea: string): ReactNode[] {
  // split con grupo de captura conserva los delimitadores: los índices impares
  // son el contenido entre asteriscos.
  return linea.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-[var(--bone)]">
        {parte}
      </strong>
    ) : (
      <Fragment key={i}>{parte}</Fragment>
    ),
  );
}

export default function Markdown({ children }: { children: string }) {
  const lineas = children.split("\n");
  const bloques: ReactNode[] = [];
  let vinetas: string[] = [];

  const cerrarLista = () => {
    if (!vinetas.length) return;
    bloques.push(
      <ul key={`ul-${bloques.length}`} className="space-y-1 my-2">
        {vinetas.map((v, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-[var(--solar)] shrink-0">·</span>
            <span>{conNegritas(v)}</span>
          </li>
        ))}
      </ul>,
    );
    vinetas = [];
  };

  for (const linea of lineas) {
    const vineta = linea.match(/^\s*[-*]\s+(.*)$/);
    if (vineta) {
      vinetas.push(vineta[1]);
      continue;
    }
    cerrarLista();
    if (!linea.trim()) continue;
    bloques.push(
      <p key={`p-${bloques.length}`} className="my-2 first:mt-0 last:mb-0">
        {conNegritas(linea)}
      </p>,
    );
  }
  cerrarLista();

  return <div className="text-sm leading-relaxed">{bloques}</div>;
}
