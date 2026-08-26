-- CUADRA · revisión de proyectos y vitrina pública
--
-- La ruta que ve el usuario (identidad → propuesta → revisión → vitrina) tenía
-- los dos últimos tramos sin maquinaria: un borrador se quedaba en borrador
-- para siempre, no había cómo mandarlo a revisar ni cómo enterarse de por qué
-- lo rechazaron, y un proyecto publicado no tenía página que compartir.

-- ------------------------------------------------------------------ revisión
alter table proyectos
  -- Por qué se rechazó, o qué falta. Sin esto, "te escribimos si falta algo"
  -- es una promesa que la app no puede cumplir.
  add column if not exists nota_revision       text,
  add column if not exists revisado_por        text,
  add column if not exists revisado_at         timestamptz,
  add column if not exists enviado_revision_at timestamptz;

-- La cola de revisión: lo que espera respuesta, lo más viejo primero.
create index if not exists idx_proyectos_en_revision
  on proyectos (enviado_revision_at) where estado = 'en_revision';

-- ------------------------------------------------------------- fotos públicas
-- Las fotos del proyecto NO pueden vivir en el bucket de soportes: ese es
-- privado porque guarda peritajes con dirección y cédula del dueño, y una
-- vitrina sin una sola imagen no es una vitrina. Van a un bucket público y su
-- URL queda en `imagenes`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proyectos', 'proyectos', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------- columnas que se ven
-- La política de RLS deja leer las FILAS publicadas, pero no dice nada de las
-- columnas: con el anon key se podían pedir `direccion`, `privy_did`, las rutas
-- de los soportes o la nota interna de revisión de cualquier proyecto público.
-- Los permisos por columna cierran eso: la vitrina lee lo que la vitrina
-- muestra, y nada más.
--
-- OJO: una columna nueva NO queda visible sola. Si mañana se agrega algo que
-- deba salir en la vitrina, hay que sumarlo a este grant a mano.
revoke select on proyectos from anon, authenticated;
grant select (
  id, titulo, descripcion, tipo, proponente, barrio, estado_obra,
  estado_detalle, area_m2, plazo_meses, meta_cop, recaudado_cop,
  imagenes, estado, created_at, updated_at
) on proyectos to anon, authenticated;
