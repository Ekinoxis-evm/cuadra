"use client";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Pasos, { type Paso } from "@/components/Pasos";
import Campo, { claseCampo } from "@/components/Campo";
import Soportes from "./Soportes";
import Fotos from "./Fotos";
import { fmtCOP } from "@/lib/types";
import {
  ESTADOS_OBRA,
  PROPONENTES,
  TIPOS,
  etiquetaDocumento,
  etiquetaEstadoObra,
  faltaParaRevision,
  type Documento,
} from "@/lib/proyectos";

/**
 * Alta de proyecto en cuatro tramos.
 *
 * Antes era una sola hoja con un textarea que pedía tres cosas a la vez ("qué
 * se va a hacer, en qué estado está y para quién") y casi nadie contestaba más
 * de una. Ahora cada pregunta es su propio campo, con su ayuda al lado, y el
 * estado del espacio es una lista cerrada en vez de texto libre: así la
 * revisión puede comparar proyectos y no adivinar.
 */

const PASOS: Paso[] = [
  {
    id: "que",
    titulo: "Qué se va a hacer",
    nota: "La obra que propones y quién responde por ella.",
  },
  {
    id: "donde",
    titulo: "Dónde y cómo está",
    nota: "Dónde queda el espacio y en qué condición está hoy, antes de intervenirlo.",
  },
  {
    id: "soportes",
    titulo: "Fotos y soportes",
    nota: "Las fotos se ven en la vitrina; los peritajes, avalúos y evaluaciones solo los ve quien revisa.",
  },
  {
    id: "plata",
    titulo: "Plata y revisión",
    nota: "Cuánto necesitas, en cuánto tiempo, y una última mirada antes de guardar.",
  },
];

const MIN_DESCRIPCION = 40;

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b rule">
      <span className="mono text-[10px] text-[var(--muted)] shrink-0">{k}</span>
      <span className="mono text-[11px] text-right">{v}</span>
    </div>
  );
}

/** Lo que hace falta para reabrir una propuesta ya guardada. */
export interface ProyectoEditable {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  proponente: string;
  barrio: string | null;
  direccion: string | null;
  estado_obra: string | null;
  estado_detalle: string | null;
  area_m2: number | null;
  plazo_meses: number | null;
  meta_cop: number | null;
  documentos: Documento[] | null;
  imagenes: string[] | null;
}

export default function FormularioProyecto({
  onListo,
  onCancelar,
  proyecto,
}: {
  /** Recibe el id de la propuesta guardada, para aterrizar en su página. */
  onListo: (id: string) => void;
  onCancelar?: () => void;
  /** Si viene, se edita esa propuesta en vez de crear una nueva. */
  proyecto?: ProyectoEditable;
}) {
  const { getAccessToken } = usePrivy();
  const editando = !!proyecto;
  const [paso, setPaso] = useState(0);

  const [titulo, setTitulo] = useState(proyecto?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(proyecto?.descripcion ?? "");
  const [tipo, setTipo] = useState<string>(proyecto?.tipo ?? "reconstruccion");
  const [proponente, setProponente] = useState<string>(proyecto?.proponente ?? "persona");
  const [barrio, setBarrio] = useState(proyecto?.barrio ?? "");
  const [direccion, setDireccion] = useState(proyecto?.direccion ?? "");
  const [estadoObra, setEstadoObra] = useState(proyecto?.estado_obra ?? "");
  const [estadoDetalle, setEstadoDetalle] = useState(proyecto?.estado_detalle ?? "");
  const [area, setArea] = useState(proyecto?.area_m2 ? String(proyecto.area_m2) : "");
  const [plazo, setPlazo] = useState(proyecto?.plazo_meses ? String(proyecto.plazo_meses) : "");
  const [meta, setMeta] = useState(proyecto?.meta_cop ? String(proyecto.meta_cop) : "");
  const [docs, setDocs] = useState<Documento[]>(proyecto?.documentos ?? []);
  const [fotos, setFotos] = useState<string[]>(proyecto?.imagenes ?? []);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Las opciones de estado dependen del tipo: a un lote vacío no tiene sentido
  // ofrecerle "habitable pero deteriorada".
  const estados = ESTADOS_OBRA.filter((e) =>
    (e.aplica as readonly string[]).includes(tipo),
  );

  function cambiarTipo(nuevo: string) {
    setTipo(nuevo);
    // Si el estado escogido no aplica al nuevo tipo, se limpia en vez de
    // quedarse en un valor que la lista ya no muestra.
    const sigueValiendo = ESTADOS_OBRA.some(
      (e) => e.id === estadoObra && (e.aplica as readonly string[]).includes(nuevo),
    );
    if (!sigueValiendo) setEstadoObra("");
  }

  const faltanCaracteres = Math.max(0, MIN_DESCRIPCION - descripcion.trim().length);
  const completo = [
    titulo.trim().length >= 6 && descripcion.trim().length >= MIN_DESCRIPCION,
    !!estadoObra,
    true, // los soportes son opcionales
    Number(meta) > 0,
  ];

  function siguiente() {
    setError(null);
    if (!completo[paso]) return;
    setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    // Enter en cualquier campo avanza de tramo en vez de crear a medias.
    if (paso < PASOS.length - 1) return siguiente();

    setError(null);
    setEnviando(true);
    try {
      const token = await getAccessToken();
      const r = await fetch(
        editando ? `/api/proyectos/${proyecto!.id}` : "/api/proyectos",
        {
        method: editando ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          descripcion,
          tipo,
          proponente,
          barrio,
          direccion,
          estado_obra: estadoObra,
          estado_detalle: estadoDetalle,
          area_m2: area || null,
          plazo_meses: plazo || null,
          documentos: docs,
          imagenes: fotos,
          meta_cop: Number(meta),
        }),
      },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo guardar");
      onListo(editando ? proyecto!.id : String(j.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="max-w-lg space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">
            {editando ? "Editar propuesta" : "Nuevo proyecto"}
          </h3>
          <p className="mono text-[11px] text-[var(--muted)] mt-1.5 leading-relaxed">
            {editando
              ? "Vuelve a quedar como borrador. Cuando esté lista, la mandas a revisión desde su página."
              : "Queda como borrador. Sale a la vitrina pública solo después de la revisión, y hasta entonces no recibe aportes."}
          </p>
        </div>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="mono text-[11px] text-[var(--muted)] hover:text-[var(--bone)] shrink-0"
          >
            cancelar
          </button>
        )}
      </div>

      <Pasos pasos={PASOS} actual={paso} onIr={setPaso} />

      {/* ------------------------------------------------ 1 · qué se va a hacer */}
      {paso === 0 && (
        <div className="space-y-5">
          <div>
            <span className="mono text-[10px] text-[var(--muted)]">
              TIPO DE PROYECTO
            </span>
            <div className="space-y-2 mt-1.5">
              {TIPOS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => cambiarTipo(t.id)}
                  aria-pressed={tipo === t.id}
                  className={`border rule p-3 w-full text-left flex items-start gap-3 ${
                    tipo === t.id
                      ? "border-[var(--solar)] bg-[var(--petrol-2)]"
                      : "hover:bg-[var(--petrol-2)]"
                  }`}
                >
                  <span
                    className={`mono text-xs mt-0.5 ${
                      tipo === t.id ? "text-[var(--solar)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {tipo === t.id ? "◉" : "○"}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{t.titulo}</span>
                    <span className="mono text-[11px] text-[var(--muted)]">
                      {t.detalle}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Campo
            etiqueta="TÍTULO"
            ayuda="Una línea que diga qué es y dónde. Es lo que se ve en la vitrina."
          >
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              minLength={6}
              placeholder="Reforzamiento estructural de vivienda en El Retiro"
              className={claseCampo}
            />
          </Campo>

          <Campo
            etiqueta="¿QUÉ SE VA A HACER?"
            ayuda="La obra concreta: qué se interviene, con qué alcance y quién se beneficia. Ejemplo: «Reforzar la placa del segundo piso, cambiar la cubierta de zinc por teja térmica y rehacer la red eléctrica. Vive una familia de cinco personas.»"
          >
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={5}
              placeholder="Describe la obra, no la necesidad."
              className={`${claseCampo} resize-y`}
            />
          </Campo>
          <p
            className={`mono text-[10px] -mt-3 ${
              faltanCaracteres ? "text-[var(--muted)]" : "text-[var(--alza)]"
            }`}
          >
            {faltanCaracteres
              ? `faltan ${faltanCaracteres} caracteres`
              : "✓ suficiente para revisar"}
          </p>

          <div>
            <span className="mono text-[10px] text-[var(--muted)]">QUIÉN PROPONE</span>
            <span className="mono text-[11px] text-[var(--muted)] block mt-1 leading-relaxed">
              Quién responde por la obra y recibe los fondos. Debe coincidir con
              la identidad que verificaste.
            </span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {PROPONENTES.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setProponente(p.id)}
                  aria-pressed={proponente === p.id}
                  title={p.detalle}
                  className={`mono text-[11px] border rule px-3 py-1.5 ${
                    proponente === p.id
                      ? "bg-[var(--solar)] text-[var(--petrol)] font-semibold"
                      : "text-[var(--muted)] hover:text-[var(--bone)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mono text-[11px] text-[var(--muted)] mt-2">
              {PROPONENTES.find((p) => p.id === proponente)?.detalle}
            </p>
          </div>
        </div>
      )}

      {/* --------------------------------------------- 2 · dónde y en qué estado */}
      {paso === 1 && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo etiqueta="BARRIO" ayuda="Como lo conoce la gente en Cali." opcional>
              <input
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                placeholder="El Retiro"
                className={claseCampo}
              />
            </Campo>
            <Campo
              etiqueta="DIRECCIÓN"
              ayuda="No se muestra en la vitrina; solo la ve quien revisa."
              opcional
            >
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle 00 # 00-00"
                className={claseCampo}
              />
            </Campo>
          </div>

          <div>
            <span className="mono text-[10px] text-[var(--muted)]">
              ¿EN QUÉ ESTADO ESTÁ HOY?
            </span>
            <span className="mono text-[11px] text-[var(--muted)] block mt-1 leading-relaxed">
              La condición del espacio antes de la obra. Escoge la que más se
              parezca; el matiz lo cuentas abajo.
            </span>
            <div className="space-y-2 mt-1.5">
              {estados.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => setEstadoObra(e.id)}
                  aria-pressed={estadoObra === e.id}
                  className={`border rule p-3 w-full text-left flex items-start gap-3 ${
                    estadoObra === e.id
                      ? "border-[var(--solar)] bg-[var(--petrol-2)]"
                      : "hover:bg-[var(--petrol-2)]"
                  }`}
                >
                  <span
                    className={`mono text-xs mt-0.5 ${
                      estadoObra === e.id ? "text-[var(--solar)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {estadoObra === e.id ? "◉" : "○"}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{e.titulo}</span>
                    <span className="mono text-[11px] text-[var(--muted)]">
                      {e.detalle}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Campo
            etiqueta="DETALLE DEL ESTADO"
            ayuda="Daños concretos, cuándo aparecieron, si hay riesgo. Ejemplo: «Grietas en el muro medianero desde el sismo de 2024; el baño lleva un año sin servicio.»"
            opcional
          >
            <textarea
              value={estadoDetalle}
              onChange={(e) => setEstadoDetalle(e.target.value)}
              rows={4}
              className={`${claseCampo} resize-y`}
            />
          </Campo>

          <Campo
            etiqueta="ÁREA (M²)"
            ayuda="Área construida, o del lote si todavía no hay nada. Sirve para comparar el costo por metro con los precios del tablero."
            opcional
          >
            <input
              value={area}
              onChange={(e) => setArea(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              placeholder="72"
              className={claseCampo}
            />
          </Campo>
        </div>
      )}

      {/* ------------------------------------------------------- 3 · soportes */}
      {paso === 2 && (
        <div className="space-y-5">
          <div className="border rule p-3 bg-[var(--petrol-2)]">
            <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
              Puedes guardar el borrador sin nada de esto, pero para mandarlo a
              revisión hace falta al menos un soporte técnico: peritaje, avalúo
              o evaluación del espacio.
            </p>
          </div>

          <Fotos fotos={fotos} onCambio={setFotos} />

          <div className="border-t rule pt-5">
            <Soportes docs={docs} onCambio={setDocs} />
          </div>
        </div>
      )}

      {/* ------------------------------------------------ 4 · plata y revisión */}
      {paso === 3 && (
        <div className="space-y-5">
          <Campo
            etiqueta="META DE RECAUDO (COP)"
            ayuda="Cuánto cuesta la obra completa. Si adjuntaste presupuesto, que coincida con él."
          >
            <input
              value={meta}
              onChange={(e) => setMeta(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="50000000"
              className={claseCampo}
            />
          </Campo>
          {meta && (
            <p className="mono text-[11px] text-[var(--alza)] -mt-3">
              {fmtCOP(Number(meta))}
              {area && Number(area) > 0 && (
                <span className="text-[var(--muted)]">
                  {" "}
                  · {fmtCOP(Math.round(Number(meta) / Number(area)))} por m²
                </span>
              )}
            </p>
          )}

          <Campo
            etiqueta="PLAZO DE OBRA (MESES)"
            ayuda="Desde que se completa el recaudo hasta la entrega."
            opcional
          >
            <input
              value={plazo}
              onChange={(e) => setPlazo(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="8"
              className={claseCampo}
            />
          </Campo>

          <div className="border rule p-4">
            <p className="mono text-[10px] text-[var(--muted)] mb-2">
              ASÍ QUEDA
            </p>
            <p className="text-sm font-medium leading-snug mb-2">
              {titulo || "—"}
            </p>
            <Fila k="tipo" v={TIPOS.find((t) => t.id === tipo)?.titulo} />
            <Fila
              k="propone"
              v={PROPONENTES.find((p) => p.id === proponente)?.label}
            />
            <Fila k="estado hoy" v={etiquetaEstadoObra(estadoObra) ?? "—"} />
            <Fila k="dónde" v={[barrio, direccion].filter(Boolean).join(" · ") || "—"} />
            <Fila k="área" v={area ? `${area} m²` : "—"} />
            <Fila k="meta" v={meta ? fmtCOP(Number(meta)) : "—"} />
            <Fila k="plazo" v={plazo ? `${plazo} meses` : "—"} />
            <Fila
              k="soportes"
              v={
                docs.length
                  ? docs.map((d) => etiquetaDocumento(d.tipo)).join(", ")
                  : "ninguno"
              }
            />
            <Fila k="fotos" v={fotos.length ? `${fotos.length}` : "ninguna"} />
          </div>

          {/* Se guarda igual, pero que no sea una sorpresa al mandarla. */}
          {faltaParaRevision({ documentos: docs }) && (
            <p className="mono text-[11px] text-[var(--muted)] leading-relaxed">
              Se guarda como borrador, pero todavía no se puede mandar a
              revisión: {faltaParaRevision({ documentos: docs })!.toLowerCase()}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mono text-[11px] text-[var(--solar)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        {paso > 0 && (
          <button
            type="button"
            onClick={() => setPaso((p) => p - 1)}
            className="mono text-xs px-4 py-3 border rule hover:bg-[var(--petrol-2)]"
          >
            ATRÁS
          </button>
        )}
        {paso < PASOS.length - 1 ? (
          <button
            type="button"
            onClick={siguiente}
            disabled={!completo[paso]}
            className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold disabled:opacity-40 disabled:bg-transparent disabled:text-[var(--muted)] disabled:border disabled:rule"
          >
            CONTINUAR
          </button>
        ) : (
          <button
            type="submit"
            disabled={enviando || !completo[3]}
            className="mono text-xs px-5 py-3 bg-[var(--solar)] text-[var(--petrol)] font-semibold disabled:opacity-40 disabled:bg-transparent disabled:text-[var(--muted)] disabled:border disabled:rule"
          >
            {enviando
              ? "guardando…"
              : editando
                ? "GUARDAR CAMBIOS"
                : "GUARDAR BORRADOR"}
          </button>
        )}
      </div>
    </form>
  );
}
