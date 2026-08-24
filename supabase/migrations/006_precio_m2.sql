-- CUADRA · precio por metro cuadrado unificado
--
-- Dos problemas que arregla:
--   1. El selector de orden ofrecia "$/m2 ascendente" pero por debajo ordenaba
--      por price_cop: la opcion mentia. PostgREST no ordena por expresiones,
--      asi que la division se materializa en una columna generada.
--   2. El scraper trae areas basura ocasionales (un arriendo de $900.000 con
--      900.000 m2). Son 4 de 1.536, pero una caia de primera en ese orden, que
--      es la posicion mas visible. Fuera de 15..2000 m2 no hay vivienda urbana
--      real en Cali, asi que el $/m2 queda null y nullsFirst:false los manda al
--      final en vez de al principio.
alter table listings drop column if exists precio_m2;

alter table listings
  add column precio_m2 numeric
  generated always as (
    case when area_m2 between 15 and 2000
      then price_cop::numeric / area_m2
    end
  ) stored;

create index if not exists idx_listings_precio_m2
  on listings (operacion, precio_m2) where active;

-- La vista hacia su propia division, asi que el tablero y el orden podian
-- discrepar. Ahora los dos salen de precio_m2. Las medianas no se movieron:
-- percentile_cont ya era robusto a 4 atipicos.
drop materialized view if exists barrio_stats;
create materialized view barrio_stats as
select
  operacion, barrio,
  count(*)::int as n,
  percentile_cont(0.5) within group (order by price_cop)::bigint as median_cop,
  min(price_cop) as min_cop,
  max(price_cop) as max_cop,
  percentile_cont(0.5) within group (order by precio_m2)::bigint as median_m2
from listings
where active and barrio is not null
group by operacion, barrio;

create unique index idx_barrio_stats on barrio_stats (operacion, barrio);
grant select on barrio_stats to anon, authenticated;
