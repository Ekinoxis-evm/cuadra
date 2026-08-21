-- CUADRA · cifras agregadas para la landing
--
-- Antes la landing traia las filas y sumaba en JS, pero PostgREST corta en
-- 1.000 filas por defecto: el total de fotos salia subestimado y sin error.
-- Agregar en Postgres lo arregla y ademas deja la consulta en una sola fila.
create or replace view resumen_publico as
select
  count(*)::int                                as listings,
  count(distinct barrio)::int                  as barrios,
  coalesce(sum(cardinality(imagenes)), 0)::int as fotos
from listings
where active;

create or replace view fuentes_publicas as
select source, count(*)::int as n
from listings
where active
group by source;

-- Las vistas no heredan RLS de la tabla base; hay que conceder explicitamente.
-- Solo exponen agregados que ya se pueden derivar de listings, que tiene
-- lectura publica.
grant select on resumen_publico to anon, authenticated;
grant select on fuentes_publicas to anon, authenticated;
