"use client";

/**
 * Campo de formulario con su ayuda a la vista.
 *
 * La regla que impone: no se pide un dato sin decir para qué sirve. Un
 * placeholder no alcanza — desaparece apenas escribes, y era justo donde
 * estaban las instrucciones.
 */
export default function Campo({
  etiqueta,
  ayuda,
  opcional,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mono text-[10px] text-[var(--muted)]">
        {etiqueta}
        {opcional && <span className="text-[var(--muted)]/70"> · opcional</span>}
      </span>
      {ayuda && (
        <span className="mono text-[11px] text-[var(--muted)] block mt-1 leading-relaxed">
          {ayuda}
        </span>
      )}
      {children}
    </label>
  );
}

/** Clase común de los inputs, para que todos los formularios se vean igual. */
export const claseCampo =
  "mono text-xs bg-transparent border rule px-3 py-2.5 w-full mt-1.5 focus:outline-none focus:border-[var(--solar)]";
