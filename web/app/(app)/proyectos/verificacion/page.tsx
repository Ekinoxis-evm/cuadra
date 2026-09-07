"use client";
import ConSesion from "@/components/proyectos/ConSesion";
import VerificacionCuenta from "@/components/cuenta/Verificacion";

/**
 * La verificación es de la cuenta y se hace una vez, pero es el paso previo a
 * proponer: por eso tiene pestaña propia aquí, a la vista, antes de PROPONER.
 * Esconderla dentro de Ajustes hacía que la gente llegara a proponer sin
 * saber que le faltaba algo.
 */
export default function PaginaVerificacion() {
  return (
    <ConSesion mensaje="Para verificar tu cuenta hace falta entrar primero.">
      <VerificacionCuenta />
    </ConSesion>
  );
}
