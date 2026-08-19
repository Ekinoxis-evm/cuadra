-- CUADRA · schema inicial
create table if not exists listings (
  source      text not null,
  source_id   text not null,
  operacion   text check (operacion in ('arriendo','venta')),
  tipo        text,
  url         text,
  title       text,
  price_cop   bigint,
  admin_cop   bigint,
  barrio      text,
  zona        text,
  habs        int,
  banos       int,
  area_m2     numeric,
  first_seen  timestamptz,
  last_seen   timestamptz,
  active      boolean default true,
  primary key (source, source_id)
);
create index if not exists idx_listings_browse
  on listings (operacion, barrio, price_cop) where active;

-- Stats por barrio (refrescar después de cada sync)
create materialized view if not exists barrio_stats as
select
  operacion, barrio,
  count(*)::int as n,
  percentile_cont(0.5) within group (order by price_cop)::bigint as median_cop,
  min(price_cop) as min_cop,
  max(price_cop) as max_cop,
  percentile_cont(0.5) within group (order by price_cop / nullif(area_m2, 0))::bigint as median_m2
from listings
where active and barrio is not null
group by operacion, barrio;
create unique index if not exists idx_barrio_stats on barrio_stats (operacion, barrio);

-- Perfiles Privy + favoritos (escritura solo vía API server-side con service role)
create table if not exists profiles (
  privy_did  text primary key,
  email      text,
  created_at timestamptz default now()
);
create table if not exists favoritos (
  privy_did  text references profiles on delete cascade,
  source     text not null,
  source_id  text not null,
  created_at timestamptz default now(),
  primary key (privy_did, source, source_id)
);

-- RLS: lectura pública de listings y stats; perfiles/favoritos cerrados al anon
alter table listings  enable row level security;
alter table profiles  enable row level security;
alter table favoritos enable row level security;
create policy "lectura publica" on listings for select using (true);
-- barrio_stats es una materialized view: no respeta RLS y PostgREST no la expone
-- sin grant explícito. Lectura pública (mismos datos agregados que listings).
grant select on barrio_stats to anon, authenticated;
