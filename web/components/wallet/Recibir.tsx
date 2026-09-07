"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ACTIVOS, CADENAS } from "@/lib/activos";

/**
 * Recibir: el QR, la dirección para copiar y compartir, y en qué redes sirve.
 * Lo último no es decoración — un depósito por una red que no leemos no
 * aparece en los saldos, y la primera pregunta de soporte es "mandé y no llegó".
 */
export default function Recibir({ direccion }: { direccion: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(direccion, {
      margin: 1,
      width: 512,
      color: { dark: "#101715", light: "#ede6d6" },
    }).then(setQr).catch(() => setQr(null));
  }, [direccion]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(direccion);
      avisar("dirección copiada");
    } catch {
      avisar("selecciona y copia el texto");
    }
  }

  async function compartir() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mi dirección en CUADRA", text: direccion });
        return;
      } catch {
        // Cerró el diálogo: no es un error.
        return;
      }
    }
    await copiar();
  }

  function avisar(t: string) {
    setAviso(t);
    setTimeout(() => setAviso(null), 1800);
  }

  const redes = [...new Set(ACTIVOS.map((a) => a.chainId))];

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR de ${direccion}`} width={224} height={224} className="border rule" />
        ) : (
          <div className="w-56 h-56 border rule flex items-center justify-center mono text-xs text-[var(--muted)]">···</div>
        )}
      </div>

      <button
        type="button"
        onClick={copiar}
        className="mono text-xs break-all border rule px-3 py-2.5 w-full text-left hover:bg-[var(--petrol-2)]"
      >
        {direccion}
      </button>

      <div className="flex gap-2">
        <button type="button" onClick={copiar} className="mono text-xs px-4 py-3 border rule hover:bg-[var(--petrol-2)] flex-1">
          copiar
        </button>
        <button
          type="button"
          onClick={compartir}
          className="mono text-xs px-4 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold flex-1"
        >
          COMPARTIR
        </button>
      </div>
      {aviso && <p className="mono text-[11px] text-[var(--alza)] text-center">{aviso}</p>}

      <div className="border rule p-3 space-y-1.5">
        <p className="mono text-[10px] text-[var(--muted)]">SIRVE PARA RECIBIR</p>
        {redes.map((id) => (
          <p key={id} className="mono text-[11px]">
            <span className="text-[var(--bone)]">
              {ACTIVOS.filter((a) => a.chainId === id).map((a) => a.simbolo).join(", ")}
            </span>
            <span className="text-[var(--muted)]"> por {CADENAS[id].nombre}</span>
          </p>
        ))}
        <p className="mono text-[10px] text-[var(--muted)] leading-relaxed pt-1">
          Es la misma dirección en las dos redes. Lo que llegue por otra red o
          en otro token no aparece aquí.
        </p>
      </div>
    </div>
  );
}
