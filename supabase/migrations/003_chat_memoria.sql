-- CUADRA · galería completa + memoria del chat de intereses
--
-- Tres cosas:
--   1. imagenes[]: Fincaraíz ya entregaba la galería entera y el scraper botaba
--      todo menos la primera foto. Ahora se guardan todas.
--   2. conversaciones/mensajes: log de la conversación tal como se le manda al
--      modelo, para poder retomarla en otra sesión sin perder el contexto.
--   3. preferencias: lo que el agente va aprendiendo del usuario pregunta a
--      pregunta. Es lo que hace que la búsqueda mejore entre sesiones.

-- ---------------------------------------------------------------- galería
-- Columna nullable sin default: es cambio de catálogo, no reescribe la tabla.
alter table listings
  add column if not exists imagenes text[];

-- ---------------------------------------------------------------- chat
create table if not exists conversaciones (
  id         uuid primary key default gen_random_uuid(),
  privy_did  text not null references profiles on delete cascade,
  titulo     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listar "mis conversaciones, la más reciente primero" sin ordenar en memoria.
create index if not exists idx_conversaciones_usuario
  on conversaciones (privy_did, updated_at desc);

create table if not exists mensajes (
  id              bigint generated always as identity primary key,
  conversacion_id uuid not null references conversaciones on delete cascade,
  rol             text not null check (rol in ('user', 'assistant')),
  -- Los content blocks de Anthropic tal cual (texto + imágenes + tool_use).
  -- Guardarlos crudos permite replay exacto; un text plano perdería las fotos.
  contenido       jsonb not null,
  created_at      timestamptz not null default now()
);

-- Replay de un hilo: filtra por conversación y ordena por llegada.
create index if not exists idx_mensajes_hilo
  on mensajes (conversacion_id, id);

-- ---------------------------------------------------------------- preferencias
-- Una fila por usuario. El agente la actualiza a medida que pregunta.
create table if not exists preferencias (
  privy_did       text primary key references profiles on delete cascade,
  operacion       text check (operacion in ('arriendo', 'venta')),
  barrios         text[],
  presupuesto_min bigint,
  presupuesto_max bigint,
  habs_min        int,
  banos_min       int,
  area_min        numeric,
  estrato_min     int,
  estrato_max     int,
  amenidades      text[],
  -- Lo que no cabe en columnas: "quiere luz natural", "le importa el ruido".
  notas           text,
  actualizado_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
-- Mismo patrón que profiles/favoritos: RLS prendido y sin políticas para anon,
-- así el anon key no ve nada. La escritura pasa por las rutas de API con el
-- service role, que salta RLS y valida el dueño contra el token de Privy.
alter table conversaciones enable row level security;
alter table mensajes       enable row level security;
alter table preferencias   enable row level security;
