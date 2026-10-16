-- CUADRA · barrios oficiales de Cali
--
-- Cada portal escribe el barrio como quiere: "Ciudad Jardín", "Urbanización
-- Ciudad Jardín", "Cdad Jardin", o solo "Cali" cuando el anunciante no dijo
-- nada. Con tres portales eso eran 769 nombres para los 342 barrios que tiene
-- la ciudad, y barrio_stats partía un mismo barrio en varias filas.
--
-- La referencia es la capa dapm:pdt_dpa_barrios_sectores del IDESC (Alcaldía,
-- acuerdo DIVIPOLA 0636 de 2026): código, nombre, comuna y polígono. La carga
-- `scrapers/cargar_barrios.py`, que se puede volver a correr si la Alcaldía
-- actualiza la capa.
--
-- Cada aviso se asigna así, en este orden:
--   1. por nombre: el que escribió el portal, normalizado, contra el nombre
--      oficial o un alias conocido. Es la intención del anunciante.
--   2. por ubicación: el polígono que contiene el punto. Solo si el punto es
--      preciso: los portales tiran al centro de la ciudad los avisos sin
--      dirección, y un punto compartido por avisos de 3+ barrios distintos
--      no dice nada del barrio.
--   3. sin barrio: se conserva el nombre del portal, salvo que sea solo la
--      ciudad o un "Sur", que se vuelve null.
--
-- La zona de expansión del sur (Bochalema, Ciudad Pacífica, Kachipay…) y los
-- corregimientos no están en la capa urbana. cargar_barrios.py los agrega
-- como "Sector CUADRA", sin polígono, más una tabla de alias, para que sus
-- variantes de nombre también se unan.
--
-- `barrio` sigue siendo la columna que leen la vitrina, el chat y
-- barrio_stats, ahora con el nombre oficial; lo que escribió el portal queda
-- en `barrio_portal`.

create extension if not exists postgis with schema extensions;

-- Llave de comparación: sin tildes, minúsculas, sin prefijos que no son
-- parte del nombre. translate y no unaccent porque esta tiene que ser
-- immutable para usarse en columnas generadas e índices.
create or replace function clave_barrio(t text) returns text
language sql immutable parallel safe as $$
  select nullif(btrim(regexp_replace(regexp_replace(
    translate(lower(coalesce(t, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou'),
    '^(urbanizacion|urb\.?|barrio|br\.?|conjunto residencial|conjunto|sector|parcelacion(es)?)\s+', ''),
    '\s+', ' ', 'g')), '')
$$;

create table if not exists barrios (
  codigo    text primary key,
  nombre    text not null,
  comuna    smallint,
  categoria text,
  -- null en los sectores que no están en la capa urbana (zona de expansión
  -- sur, corregimientos): existen para que sus variantes de nombre se unan.
  geom      extensions.geometry(MultiPolygon, 4326),
  clave     text generated always as (clave_barrio(nombre)) stored
);
create index if not exists idx_barrios_geom on barrios using gist (geom);
create index if not exists idx_barrios_clave on barrios (clave);

-- Nombres de portal que no coinciden con el oficial pero son ese barrio.
create table if not exists barrio_alias (
  clave  text primary key,
  codigo text not null references barrios (codigo) on delete cascade
);

alter table barrios enable row level security;
alter table barrio_alias enable row level security;
create policy "barrios legibles" on barrios for select using (true);
create policy "alias legibles" on barrio_alias for select using (true);
grant select on barrios, barrio_alias to anon, authenticated;

alter table listings
  add column if not exists barrio_portal text,
  add column if not exists barrio_codigo text references barrios (codigo);
-- Hasta hoy `barrio` era lo del portal: es el punto de partida.
update listings set barrio_portal = barrio where barrio_portal is null;
create index if not exists idx_listings_barrio_codigo on listings (barrio_codigo);
create index if not exists idx_listings_comuna on listings (comuna);

-- El sync sube `barrio` tal como lo escribió el portal. Si no es un nombre
-- oficial, eso es lo del portal y se guarda aparte antes de que
-- asignar_barrios lo reemplace. Si ya es oficial (el aviso vino del pull y no
-- se volvió a ver), barrio_portal no se toca.
create or replace function guardar_barrio_portal() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.barrio is not null
     and (tg_op = 'INSERT' or new.barrio is distinct from old.barrio)
     and not exists (select 1 from barrios b where b.nombre = new.barrio) then
    new.barrio_portal := new.barrio;
  elsif tg_op = 'INSERT' then
    new.barrio_portal := coalesce(new.barrio_portal, new.barrio);
  end if;
  return new;
end $$;

drop trigger if exists trg_barrio_portal on listings;
create trigger trg_barrio_portal before insert or update of barrio on listings
  for each row execute function guardar_barrio_portal();

create or replace function asignar_barrios() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  with imprecisos as (
    select lat, lng from listings
    where lat is not null and lng is not null
    group by lat, lng
    having count(distinct clave_barrio(barrio_portal)) >= 3
  ),
  -- Hay nombres oficiales que chocan al quitar el prefijo: "La Flora" y
  -- "Urbanización La Flora", "La Merced" y "Urbanización La Merced" (a 4 km).
  -- Entre candidatos gana el que contiene el punto, luego el que coincide
  -- con el nombre completo, luego el más cercano.
  por_nombre as (
    select l.source, l.source_id,
      coalesce(
        (select b.codigo from barrios b
          where b.clave = clave_barrio(l.barrio_portal)
          order by
            (l.lat is not null and b.geom is not null
              and st_contains(b.geom, st_setsrid(st_makepoint(l.lng, l.lat), 4326))) desc,
            translate(lower(b.nombre), 'áéíóúüñ', 'aeiouun')
              = translate(lower(btrim(l.barrio_portal)), 'áéíóúüñ', 'aeiouun') desc,
            case when l.lat is not null and b.geom is not null
              then st_distance(b.geom, st_setsrid(st_makepoint(l.lng, l.lat), 4326)) end
              asc nulls last
          limit 1),
        (select a.codigo from barrio_alias a where a.clave = clave_barrio(l.barrio_portal))
      ) as codigo
    from listings l
  ),
  por_punto as (
    select l.source, l.source_id,
      (select b.codigo from barrios b
        where st_contains(b.geom, st_setsrid(st_makepoint(l.lng, l.lat), 4326))
        limit 1) as codigo
    from listings l
    where l.lat is not null and l.lng is not null
      and not exists (select 1 from imprecisos i where i.lat = l.lat and i.lng = l.lng)
  ),
  final as (
    select l.source, l.source_id,
      coalesce(n.codigo, p.codigo) as codigo,
      l.barrio_portal, l.comuna
    from listings l
    join por_nombre n using (source, source_id)
    left join por_punto p using (source, source_id)
  ),
  nuevo as (
    -- `comuna` ya la llenan los portales como "Comuna 2"; con barrio
    -- oficial se toma la de la Alcaldía, en el mismo formato.
    select f.source, f.source_id, f.codigo,
      coalesce('Comuna ' || b.comuna, f.comuna) as comuna,
      case
        when b.nombre is not null then b.nombre
        -- Lo que no es un barrio: la ciudad, un punto cardinal, un vacío.
        when clave_barrio(f.barrio_portal) in ('cali', 'santiago de cali', 'valle del cauca',
          'valle', 'n.n.', 'nn', 'none', 'sur', 'norte', 'oeste', 'oriente', 'centro', 'sin barrio')
          then null
        else f.barrio_portal
      end as barrio
    from final f left join barrios b on b.codigo = f.codigo
  )
  update listings l
     set barrio_codigo = x.codigo, comuna = x.comuna, barrio = x.barrio
    from nuevo x
   where l.source = x.source and l.source_id = x.source_id
     and (l.barrio_codigo is distinct from x.codigo
          or l.barrio is distinct from x.barrio
          or l.comuna is distinct from x.comuna);
  get diagnostics n = row_count;
  return n;
end $$;

-- El refresco de cada corrida asigna primero: así el workflow no cambia.
create or replace function refrescar_barrio_stats() returns text
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  n := asignar_barrios();
  refresh materialized view barrio_stats;
  return format('barrio_stats refrescada (%s avisos reasignados)', n);
end $$;

revoke execute on function asignar_barrios() from public, anon, authenticated;

-- Lo que la persona escribe en el chat ("ciudad jardin", "valle del lili",
-- "san fernando") a los nombres que hay en `listings.barrio`. Devuelve todos
-- los candidatos: quien pide "La Flora" piensa en la zona, y la Alcaldía
-- tiene "La Flora" y "Urbanización La Flora". Sin coincidencia exacta ni
-- alias, sirve el comienzo del nombre ("San Fernando" → Viejo y Nuevo) si
-- tiene 5+ letras; "El" no puede traer media ciudad. Lo demás vuelve tal cual.
create or replace function resolver_barrios(nombres text[]) returns setof text
language sql stable security definer set search_path = public as $$
  with entradas as (select n, clave_barrio(n) k from unnest(nombres) n),
  exactos as (
    select e.n, b.nombre from entradas e join barrios b on b.clave = e.k
    union
    select e.n, b.nombre from entradas e
      join barrio_alias a on a.clave = e.k join barrios b using (codigo)
  ),
  prefijos as (
    select e.n, b.nombre from entradas e join barrios b on b.clave like e.k || ' %'
    where length(e.k) >= 5 and not exists (select 1 from exactos x where x.n = e.n)
  ),
  todos as (select * from exactos union select * from prefijos)
  select nombre from todos
  union
  select e.n from entradas e where not exists (select 1 from todos t where t.n = e.n)
$$;
grant execute on function resolver_barrios(text[]) to anon, authenticated;
