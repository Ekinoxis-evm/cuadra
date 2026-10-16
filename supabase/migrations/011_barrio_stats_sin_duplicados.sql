-- CUADRA · las medianas cuentan cada inmueble una vez, no una por portal
--
-- Con Metrocuadrado y Ciencuadras entrando junto a Fincaraíz, la misma
-- inmobiliaria publica el mismo apartamento en dos o tres portales. Sin esto
-- ese apartamento pesa doble o triple en la mediana del barrio, y esa mediana
-- es la que usan el tablero, el chat y el evaluador de presupuestos.
--
-- Se considera el mismo aviso si coinciden operación, barrio, precio exacto,
-- área redondeada y habitaciones. Es deliberadamente estricto: preferimos
-- dejar pasar algún duplicado a fusionar dos inmuebles distintos del mismo
-- edificio que casualmente cuestan casi lo mismo. Entre duplicados se queda
-- el de Fincaraíz, que tiene la historia más larga.
--
-- `listings` no cambia: la vitrina y el chat siguen mostrando cada aviso con
-- su enlace, porque el usuario puede preferir un portal u otro.

drop materialized view if exists barrio_stats;
create materialized view barrio_stats as
with unicos as (
  select distinct on (
    operacion, barrio, price_cop,
    round(coalesce(area_m2, 0)), coalesce(habs, -1)
  )
    operacion, barrio, price_cop, precio_m2
  from listings
  where active and barrio is not null
  order by
    operacion, barrio, price_cop,
    round(coalesce(area_m2, 0)), coalesce(habs, -1),
    (source = 'fincaraiz') desc, first_seen
)
select
  operacion, barrio,
  count(*)::int as n,
  percentile_cont(0.5) within group (order by price_cop)::bigint as median_cop,
  min(price_cop) as min_cop,
  max(price_cop) as max_cop,
  percentile_cont(0.5) within group (order by precio_m2)::bigint as median_m2
from unicos
group by operacion, barrio;

create unique index idx_barrio_stats on barrio_stats (operacion, barrio);
grant select on barrio_stats to anon, authenticated;
