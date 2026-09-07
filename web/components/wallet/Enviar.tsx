"use client";
import { useEffect, useRef, useState } from "react";
import { useSendTransaction, useWallets } from "@privy-io/react-auth";
import {
  ACTIVOS,
  CADENAS,
  abreviarDireccion,
  codificarTransfer,
  esDireccion,
  formatearUnidades,
  parsearUnidades,
  urlTx,
  type Activo,
} from "@/lib/activos";
import type { Saldo } from "./tipos";

/**
 * Enviar, en cinco pantallas: qué, por qué red, a quién y cuánto, resumen, y
 * el comprobante. Cada pantalla decide una sola cosa; la anterior siempre se
 * puede deshacer con "atrás" hasta que se firma.
 *
 * La red se escoge aunque hoy cada activo viva en una sola: es el sitio donde
 * mañana aparece la segunda, y decir en qué red va a salir la plata antes de
 * firmar es lo mínimo que se le debe a quien envía.
 */
const PASOS = ["ACTIVO", "RED", "DESTINO", "RESUMEN", "LISTO"] as const;

function Paso({ n, de }: { n: number; de: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: de }).map((_, i) => (
        <span key={i} className={`h-0.5 flex-1 ${i <= n ? "bg-[var(--solar)]" : "bg-[var(--muted)]/25"}`} />
      ))}
    </div>
  );
}

const botonPrimario =
  "mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold w-full disabled:opacity-40 disabled:bg-transparent disabled:text-[var(--muted)] disabled:border disabled:rule";
const botonSecundario = "mono text-xs px-4 py-3 border rule hover:bg-[var(--petrol-2)]";
const opcion = (activa: boolean) =>
  `w-full text-left border rule p-3 flex items-center justify-between gap-3 ${
    activa ? "border-[var(--solar)] bg-[var(--petrol-2)]" : "hover:bg-[var(--petrol-2)]"
  }`;

/**
 * Lector de QR con la cámara, usando BarcodeDetector del navegador. Sin
 * librería: donde no existe (Firefox, Safari viejo) se dice y se pega la
 * dirección a mano, que es lo que la mayoría hace de todas formas.
 */
function EscanerQR({ onLeido, onCerrar }: { onLeido: (v: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector })
      .BarcodeDetector;
    if (!Ctor) {
      setError("Este navegador no puede leer QR. Pega la dirección.");
      return;
    }
    let stream: MediaStream | null = null;
    let vivo = true;
    const detector = new Ctor({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (!vivo || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) { onLeido(codes[0].rawValue); return; }
          } catch { /* un frame sin leer no es un error */ }
          setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError("No se pudo abrir la cámara. Pega la dirección.");
      }
    })();
    return () => {
      vivo = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onLeido]);

  return (
    <div className="space-y-3">
      {error ? (
        <p className="mono text-[11px] text-[var(--solar)]">{error}</p>
      ) : (
        <video ref={video} muted playsInline className="w-full aspect-square object-cover border rule bg-black" />
      )}
      <button type="button" onClick={onCerrar} className={`${botonSecundario} w-full`}>
        {error ? "volver" : "cancelar"}
      </button>
    </div>
  );
}

/** Acepta "0x…", "ethereum:0x…@1" y variantes con parámetros. */
function direccionDeQR(v: string): string | null {
  const m = v.trim().match(/(0x[0-9a-fA-F]{40})/);
  return m ? m[1] : null;
}

export default function Enviar({
  saldos,
  desde,
  onEnviado,
  onCerrar,
}: {
  saldos: Saldo[] | null;
  /** La dirección de la wallet embebida, que es la que firma. */
  desde: string;
  onEnviado: () => void;
  onCerrar: () => void;
}) {
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();

  const [paso, setPaso] = useState(0);
  const [activo, setActivo] = useState<Activo | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [destino, setDestino] = useState("");
  const [monto, setMonto] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saldoDe = (a: Activo) => {
    const s = saldos?.find((x) => x.id === a.id);
    return s?.bruto != null ? BigInt(s.bruto) : null;
  };

  // Un mismo símbolo puede vivir en varias redes; hoy cada uno en una.
  const redes = activo
    ? ACTIVOS.filter((a) => a.simbolo === activo.simbolo).map((a) => a.chainId)
    : [];
  const activoEnRed = activo && chainId
    ? ACTIVOS.find((a) => a.simbolo === activo.simbolo && a.chainId === chainId) ?? activo
    : activo;

  const bruto = activoEnRed ? parsearUnidades(monto, activoEnRed.decimales) : null;
  const saldo = activoEnRed ? saldoDe(activoEnRed) : null;
  const excede = bruto !== null && saldo !== null && bruto > saldo;
  const destinoOk = esDireccion(destino);
  const esMiMisma = destinoOk && destino.trim().toLowerCase() === desde.toLowerCase();
  const puedeSeguir = destinoOk && !esMiMisma && bruto !== null && bruto > 0n && !excede;

  async function pegar() {
    try {
      const t = await navigator.clipboard.readText();
      const d = direccionDeQR(t);
      if (d) setDestino(d);
      else setError("Lo que hay en el portapapeles no es una dirección.");
    } catch {
      setError("El navegador no dejó leer el portapapeles. Pega con Ctrl+V / ⌘V en el campo.");
    }
  }

  async function firmar() {
    if (!activoEnRed || !chainId || bruto === null) return;
    setError(null);
    setEnviando(true);
    try {
      const wallet =
        wallets.find((w) => w.address.toLowerCase() === desde.toLowerCase()) ??
        wallets.find((w) => w.walletClientType === "privy");
      if (!wallet) throw new Error("No encontramos tu wallet en este navegador. Recarga la página.");
      // La wallet embebida no cambia de red sola: sin esto, un envío de COPm
      // sale por Ethereum contra un contrato que allá no existe.
      await wallet.switchChain(chainId);

      const tx = activoEnRed.contrato
        ? { to: activoEnRed.contrato, data: codificarTransfer(destino, bruto), value: "0x0", chainId }
        : { to: destino.trim(), value: `0x${bruto.toString(16)}`, chainId };

      const r = await sendTransaction(tx, {
        address: wallet.address,
        uiOptions: {
          description: `Enviar ${monto} ${activoEnRed.simbolo} a ${abreviarDireccion(destino)}`,
          buttonText: "Enviar",
        },
      });
      setHash(r.hash);
      setPaso(4);
      onEnviado();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo enviar";
      setError(/reject|denied|cancel/i.test(msg) ? "Cancelaste la firma. No se envió nada." : msg);
    } finally {
      setEnviando(false);
    }
  }

  const red = chainId ? CADENAS[chainId] : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Paso n={paso} de={PASOS.length} />
        <p className="mono text-[10px] text-[var(--muted)]">
          {paso + 1} DE {PASOS.length} · {PASOS[paso]}
        </p>
      </div>

      {/* ------------------------------------------------------- 1 · activo */}
      {paso === 0 && (
        <div className="space-y-3">
          <p className="text-sm">¿Qué vas a enviar?</p>
          <div className="space-y-2">
            {ACTIVOS.map((a) => {
              const s = saldoDe(a);
              const vacio = s !== null && s === 0n;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={vacio}
                  onClick={() => { setActivo(a); setChainId(null); setError(null); setPaso(1); }}
                  className={`${opcion(activo?.id === a.id)} disabled:opacity-40`}
                >
                  <span>
                    <span className="mono text-xs font-semibold block">{a.simbolo}</span>
                    <span className="mono text-[10px] text-[var(--muted)]">{a.nombre}</span>
                  </span>
                  <span className="mono text-xs text-right">
                    {s === null ? <span className="text-[var(--muted)]">···</span> : formatearUnidades(s, a.decimales)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- 2 · red */}
      {paso === 1 && activo && (
        <div className="space-y-3">
          <p className="text-sm">¿Por qué red sale?</p>
          <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
            Quien recibe tiene que estar en la misma red. Si no estás seguro,
            pregúntale antes de enviar: un envío por la red equivocada no se
            puede deshacer.
          </p>
          <div className="space-y-2">
            {redes.map((id) => (
              <button key={id} type="button" onClick={() => { setChainId(id); setPaso(2); }} className={opcion(chainId === id)}>
                <span>
                  <span className="mono text-xs font-semibold block">{CADENAS[id].nombre}</span>
                  <span className="mono text-[10px] text-[var(--muted)]">comisión en {CADENAS[id].gas}</span>
                </span>
                <span className="mono text-[11px] text-[var(--muted)]">{redes.length === 1 ? "única disponible" : ""}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setPaso(0)} className={botonSecundario}>atrás</button>
        </div>
      )}

      {/* --------------------------------------------------- 3 · destino y monto */}
      {paso === 2 && activoEnRed && red && (
        escaneando ? (
          <EscanerQR
            onLeido={(v) => {
              const d = direccionDeQR(v);
              if (d) { setDestino(d); setEscaneando(false); setError(null); }
              else setError("Ese QR no trae una dirección.");
            }}
            onCerrar={() => setEscaneando(false)}
          />
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="mono text-[10px] text-[var(--muted)]">A QUIÉN · dirección en {red.nombre}</span>
              <input
                value={destino}
                onChange={(e) => { setDestino(e.target.value); setError(null); }}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                className="mono text-xs bg-transparent border rule px-3 py-2.5 w-full mt-1.5 focus:outline-none focus:border-[var(--solar)]"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={pegar} className={`${botonSecundario} flex-1`}>pegar</button>
              <button type="button" onClick={() => setEscaneando(true)} className={`${botonSecundario} flex-1`}>escanear QR</button>
            </div>
            {destino && !destinoOk && (
              <p className="mono text-[10px] text-[var(--solar)]">Eso no parece una dirección (0x y 40 caracteres).</p>
            )}
            {esMiMisma && (
              <p className="mono text-[10px] text-[var(--solar)]">Esa es tu propia dirección.</p>
            )}

            <label className="block">
              <span className="mono text-[10px] text-[var(--muted)]">CUÁNTO · {activoEnRed.simbolo}</span>
              <div className="flex gap-2 mt-1.5">
                <input
                  value={monto}
                  onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, ""))}
                  inputMode="decimal"
                  placeholder="0"
                  className="mono text-xs bg-transparent border rule px-3 py-2.5 w-full focus:outline-none focus:border-[var(--solar)]"
                />
                {saldo !== null && saldo > 0n && (
                  <button
                    type="button"
                    onClick={() => setMonto(formatearUnidades(saldo, activoEnRed.decimales, activoEnRed.decimales).replace(/\./g, "").replace(",", "."))}
                    className={botonSecundario}
                  >
                    todo
                  </button>
                )}
              </div>
              <span className="mono text-[10px] text-[var(--muted)] block mt-1.5">
                disponible: {saldo === null ? "···" : formatearUnidades(saldo, activoEnRed.decimales)}
                {activoEnRed.contrato === null && " · deja algo para la comisión"}
              </span>
            </label>
            {monto && bruto === null && (
              <p className="mono text-[10px] text-[var(--solar)]">Monto inválido o con demasiados decimales.</p>
            )}
            {excede && <p className="mono text-[10px] text-[var(--solar)]">Es más de lo que tienes.</p>}
            {error && <p className="mono text-[11px] text-[var(--solar)]" role="alert">{error}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setPaso(1)} className={botonSecundario}>atrás</button>
              <button type="button" disabled={!puedeSeguir} onClick={() => setPaso(3)} className={botonPrimario}>
                REVISAR
              </button>
            </div>
          </div>
        )
      )}

      {/* ------------------------------------------------------ 4 · resumen */}
      {paso === 3 && activoEnRed && red && bruto !== null && (
        <div className="space-y-4">
          <div className="border rule p-4 space-y-2">
            <p className="text-2xl font-semibold tabular-nums">
              {formatearUnidades(bruto, activoEnRed.decimales, 6)}{" "}
              <span className="mono text-sm text-[var(--muted)]">{activoEnRed.simbolo}</span>
            </p>
            <Fila k="a" v={<span className="break-all">{destino.trim()}</span>} />
            <Fila k="red" v={red.nombre} />
            <Fila k="comisión" v={`se paga en ${red.gas}, la muestra la firma`} />
            <Fila k="desde" v={abreviarDireccion(desde)} />
          </div>
          <p className="mono text-[10px] text-[var(--muted)] leading-relaxed">
            Al confirmar se abre la firma. Un envío en la cadena no se puede
            deshacer: revisa la dirección completa, no solo el principio.
          </p>
          {error && <p className="mono text-[11px] text-[var(--solar)]" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={enviando} onClick={() => setPaso(2)} className={botonSecundario}>atrás</button>
            <button type="button" disabled={enviando} onClick={firmar} className={botonPrimario}>
              {enviando ? "firmando…" : "ENVIAR"}
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- 5 · listo */}
      {paso === 4 && hash && chainId && activoEnRed && bruto !== null && (
        <div className="space-y-4">
          <div className="border rule border-[var(--alza)] p-4">
            <p className="mono text-[11px] text-[var(--alza)]">ENVIADO</p>
            <p className="text-sm mt-2 leading-relaxed">
              {formatearUnidades(bruto, activoEnRed.decimales, 6)} {activoEnRed.simbolo} salieron hacia{" "}
              <span className="mono break-all">{abreviarDireccion(destino.trim())}</span>. La red lo confirma
              en unos segundos; el historial lo muestra apenas el explorador lo indexe.
            </p>
            <a
              href={urlTx(chainId, hash)}
              target="_blank"
              rel="noreferrer"
              className="mono text-[11px] underline underline-offset-4 hover:text-[var(--solar)] inline-block mt-3 break-all"
            >
              ver la transacción →
            </a>
          </div>
          <button type="button" onClick={onCerrar} className={botonPrimario}>LISTO</button>
        </div>
      )}
    </div>
  );
}

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 border-b rule last:border-0">
      <span className="mono text-[10px] text-[var(--muted)] shrink-0">{k}</span>
      <span className="mono text-[11px] text-right">{v}</span>
    </div>
  );
}
