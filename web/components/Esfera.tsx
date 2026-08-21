"use client";

export type EstadoEsfera = "reposo" | "pensando" | "hablando";

/**
 * La esfera del agente: anillos orbitales con un núcleo que respira.
 *
 * El efecto 3D no usa rotateY — las transformaciones 3D sobre elementos SVG no
 * son confiables entre navegadores y colapsan el elemento. En vez de eso cada
 * anillo anima su `ry` (radio vertical) de 44 a casi 0 y de vuelta: visualmente
 * es un aro girando y atravesando el plano de la pantalla, y `ry` como propiedad
 * CSS sí está soportada de forma pareja.
 *
 * Los tres anillos van desfasados para que nunca se aplanen a la vez.
 * `prefers-reduced-motion` lo cubre globals.css: apaga toda animación y la
 * esfera queda quieta pero legible.
 */
export default function Esfera({
  estado = "reposo",
  size = 128,
}: {
  estado?: EstadoEsfera;
  size?: number;
}) {
  return (
    <div
      className={`esfera esfera--${estado}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        estado === "pensando"
          ? "El asistente está buscando"
          : estado === "hablando"
            ? "El asistente está respondiendo"
            : "Asistente en espera"
      }
    >
      <svg viewBox="-60 -60 120 120" width={size} height={size} aria-hidden="true">
        <defs>
          <radialGradient id="cuadra-nucleo">
            <stop offset="0%" stopColor="var(--solar)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--solar)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--solar)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle className="halo" r="44" fill="url(#cuadra-nucleo)" />

        {/* rotate() como atributo SVG: inclinación fija de cada plano orbital. */}
        <g fill="none" strokeWidth="1.25" stroke="var(--solar)">
          <g transform="rotate(0)">
            <ellipse className="anillo a1" rx="45" ry="45" />
          </g>
          <g transform="rotate(60)">
            <ellipse className="anillo a2" rx="45" ry="45" />
          </g>
          <g transform="rotate(-60)">
            <ellipse className="anillo a3" rx="45" ry="45" />
          </g>
        </g>

        {/* Meridiano estático: ancla la silueta esférica. */}
        <circle
          r="45"
          fill="none"
          strokeWidth="1"
          stroke="color-mix(in srgb, var(--muted) 55%, transparent)"
        />

        <circle className="centro" r="4.5" fill="var(--solar)" />
      </svg>

      <style jsx>{`
        .esfera {
          display: grid;
          place-items: center;
          transition: opacity 0.4s ease;
        }
        .anillo {
          animation: aplanar var(--vel) ease-in-out infinite;
        }
        /* Un tercio de ciclo de desfase entre anillos. */
        .a1 { opacity: 0.9; animation-delay: 0s; }
        .a2 { opacity: 0.6; animation-delay: calc(var(--vel) / -3); }
        .a3 { opacity: 0.4; animation-delay: calc(var(--vel) / -1.5); }

        .halo {
          animation: respirar calc(var(--vel) * 0.7) ease-in-out infinite;
          transform-origin: center;
        }
        .centro {
          animation: latir calc(var(--vel) * 0.5) ease-in-out infinite;
        }

        @keyframes aplanar {
          0%, 100% { ry: 45; }
          50%      { ry: 3; }
        }
        @keyframes respirar {
          0%, 100% { opacity: 0.45; transform: scale(0.92); }
          50%      { opacity: 0.85; transform: scale(1.05); }
        }
        @keyframes latir {
          0%, 100% { r: 3.5; opacity: 0.7; }
          50%      { r: 5.5; opacity: 1; }
        }

        /* El estado solo cambia ritmo e intensidad, nunca la estructura,
           así el cambio entre estados no reinicia la animación. */
        .esfera--reposo   { --vel: 7s;   opacity: 0.65; }
        .esfera--pensando { --vel: 1.8s; opacity: 1; }
        .esfera--hablando { --vel: 3.6s; opacity: 0.9; }
      `}</style>
    </div>
  );
}
