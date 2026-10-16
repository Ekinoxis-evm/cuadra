import { Fragment, type ReactNode } from "react";

/**
 * Renderizador mínimo del markdown que produce el agente: negrita, enlaces,
 * viñetas y párrafos. No es un parser general — no hay dependencia externa porque el
 * modelo solo emite estos tres casos y una librería completa pesaría más que
 * toda la pestaña.
 *
 * El texto viene del modelo, no del usuario, y se inserta como texto plano de
 * React (nunca dangerouslySetInnerHTML), así que no hay superficie de XSS.
 */

/**
 * Enlaces [texto](url). Solo http(s): una url `javascript:` que el modelo
 * copiara de una descripción de aviso no puede terminar en un href.
 */
function conEnlaces(texto: string, clave: number): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    partes.push(
      <a
        key={`${clave}-${m.index}`}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--solar)] underline underline-offset-2 hover:no-underline"
      >
        {m[1]}
      </a>,
    );
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Parte una línea en fragmentos: <strong> lo que va entre ** y enlaces. */
function conNegritas(linea: string): ReactNode[] {
  // split con grupo de captura conserva los delimitadores: los índices impares
  // son el contenido entre asteriscos.
  return linea.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-[var(--bone)]">
        {conEnlaces(parte, i)}
      </strong>
    ) : (
      <Fragment key={i}>{conEnlaces(parte, i)}</Fragment>
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
