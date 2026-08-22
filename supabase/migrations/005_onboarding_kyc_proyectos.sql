-- CUADRA · onboarding, KYC básico y proyectos tokenizados

-- ---------------------------------------------------------------- onboarding
-- Datos que pedimos al entrar. El teléfono va partido en indicativo y número
-- para poder validar por país y no terminar con "+57 300..." libre en un texto.
alter table profiles
  add column if not exists nombre           text,
  add column if not exists apellido         text,
  add column if not exists telefono_pais    text,
  add column if not exists telefono_numero  text,
  add column if not exists intereses        text[],
  add column if not exists onboarding_at    timestamptz;

-- ---------------------------------------------------------------- KYC
-- Tabla aparte y no columnas en profiles: el documento de identidad es el dato
-- más sensible del sistema, y separarlo limita el radio de impacto si una
-- consulta sobre profiles se filtra por error.
create table if not exists kyc (
  privy_did       text primary key references profiles on delete cascade,
  tipo_documento  text not null default 'CC'
                    check (tipo_documento in ('CC', 'CE', 'NIT', 'PA')),
  documento       text not null,
  nombre          text not null,
  apellido        text not null,
  telefono_pais   text not null,
  telefono_numero text not null,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'aprobado', 'rechazado')),
  revisado_at     timestamptz,
  creado_at       timestamptz not null default now()
);

-- Un documento no puede pertenecer a dos cuentas.
create unique index if not exists idx_kyc_documento
  on kyc (tipo_documento, documento);

-- ---------------------------------------------------------------- proyectos
create table if not exists proyectos (
  id             uuid primary key default gen_random_uuid(),
  privy_did      text not null references profiles on delete cascade,
  titulo         text not null,
  descripcion    text,
  -- reconstruccion: arreglar una vivienda existente.
  -- nuevo: levantar un proyecto desde cero.
  tipo           text not null check (tipo in ('reconstruccion', 'nuevo')),
  proponente     text not null default 'persona'
                   check (proponente in ('persona', 'empresa', 'gobierno')),
  barrio         text,
  direccion      text,
  meta_cop       bigint check (meta_cop > 0),
  recaudado_cop  bigint not null default 0,
  -- borrador: lo edita el dueño. en_revision: esperando validación.
  -- publicado: visible y recibe fondos. rechazado / cerrado: terminal.
  estado         text not null default 'borrador'
                   check (estado in ('borrador', 'en_revision', 'publicado',
                                     'rechazado', 'cerrado')),
  imagenes       text[],
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_proyectos_dueno on proyectos (privy_did, updated_at desc);
-- Índice parcial: la vitrina pública solo consulta los publicados.
create index if not exists idx_proyectos_publicos
  on proyectos (updated_at desc) where estado = 'publicado';

-- ---------------------------------------------------------------- RLS
alter table kyc       enable row level security;
alter table proyectos enable row level security;

-- kyc queda sin políticas a propósito: ni anon ni authenticated lo tocan nunca
-- desde el navegador. Solo las rutas de API con service role, que verifican el
-- token de Privy antes de leer o escribir.

-- Los proyectos publicados sí son vitrina pública; los borradores no.
drop policy if exists "proyectos publicados visibles" on proyectos;
create policy "proyectos publicados visibles" on proyectos
  for select using (estado = 'publicado');
