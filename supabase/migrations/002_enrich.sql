-- CUADRA · enriquecimiento desde la página de detalle de Fincaraíz
alter table listings
  add column if not exists lat           double precision,
  add column if not exists lng           double precision,
  add column if not exists estrato       int,
  add column if not exists comuna        text,
  add column if not exists direccion     text,
  add column if not exists descripcion   text,
  add column if not exists amenidades    text[],
  add column if not exists parqueaderos  int,
  add column if not exists piso          int,
  add column if not exists antiguedad    text,
  add column if not exists estado        text,
  add column if not exists publicado     date,
  add column if not exists owner_nombre  text,
  add column if not exists owner_tipo    text,
  add column if not exists imagen        text,
  add column if not exists detail_at     timestamptz;

-- array_to_string(anyarray, text) es STABLE (el output del tipo de elemento puede
-- serlo), así que una columna generada lo rechaza. Para text[] sí es inmutable:
-- text_out lo es. Este wrapper acota la firma a text[] y lo declara como tal.
create or replace function join_amenidades(text[])
  returns text language sql immutable parallel safe strict
  as $$ select array_to_string($1, ' ') $$;

-- Búsqueda full-text en español. to_tsvector necesita 'spanish'::regconfig
-- explícito: el literal sin castear resuelve a la variante stable.
alter table listings
  add column if not exists busqueda tsvector
  generated always as (
    setweight(to_tsvector('spanish'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(join_amenidades(amenidades), '')), 'B') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(barrio, '')), 'B') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(descripcion, '')), 'C')
  ) stored;

create index if not exists idx_listings_busqueda  on listings using gin (busqueda);
create index if not exists idx_listings_amenidades on listings using gin (amenidades);
create index if not exists idx_listings_geo      on listings (lat, lng) where lat is not null;
create index if not exists idx_listings_estrato   on listings (operacion, estrato) where active;
