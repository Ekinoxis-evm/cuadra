"use client";
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { ProyectoPropio } from "@/lib/proyectos";

/** fetch con el token de Privy puesto. */
export function useFetchConSesion() {
  const { getAccessToken } = usePrivy();
  return useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getAccessToken();
      return fetch(url, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
      });
    },
    [getAccessToken],
  );
}

export interface EstadoKyc {
  documento_enmascarado: string;
  estado: "pendiente" | "aprobado" | "rechazado";
}

/** La verificación de identidad de la cuenta, o null si nunca la envió. */
export function useKyc() {
  const f = useFetchConSesion();
  const [kyc, setKyc] = useState<EstadoKyc | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const r = await f("/api/perfil");
    setKyc(r.ok ? ((await r.json()).kyc ?? null) : null);
    setCargando(false);
  }, [f]);

  useEffect(() => { recargar(); }, [recargar]);
  return { kyc, cargando, recargar };
}

/** Una propuesta propia, completa. Solo se usa dentro de <ConSesion>. */
export function useProyectoPropio(id: string) {
  const f = useFetchConSesion();
  const [p, setP] = useState<ProyectoPropio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const r = await f(`/api/proyectos/${id}`);
    if (!r.ok) {
      setP(null);
      setError(
        r.status === 404
          ? "No encontramos este proyecto entre los tuyos."
          : "No se pudo cargar el proyecto.",
      );
    } else {
      setP((await r.json()) as ProyectoPropio);
      setError(null);
    }
    setCargando(false);
  }, [f, id]);

  useEffect(() => { recargar(); }, [recargar]);
  return { p, cargando, error, recargar };
}
