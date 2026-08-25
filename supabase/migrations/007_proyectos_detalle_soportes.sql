-- CUADRA · detalle del proyecto y soportes documentales
--
-- El formulario pedía una sola "descripción" y esperaba que ahí cupieran tres
-- preguntas distintas (qué se va a hacer, en qué estado está, para quién). En
-- la práctica la gente contestaba una sola y la revisión quedaba sin material
-- para decidir. Aquí se separan las preguntas en columnas propias y se abre la
-- puerta a adjuntar peritajes, avalúos y evaluaciones recientes del espacio.

alter table proyectos
  -- Estado físico del espacio hoy, antes de la intervención. Cerrado a una
  -- lista para poder filtrar y comparar; el matiz va en estado_detalle.
  add column if not exists estado_obra    text
    check (estado_obra in ('lote', 'cimientos', 'obra_gris',
                           'habitable_deteriorada', 'inhabitable', 'en_uso')),
  add column if not exists estado_detalle text,
  add column if not exists area_m2        numeric check (area_m2 > 0),
  add column if not exists plazo_meses    int check (plazo_meses between 1 and 120),
  -- [{tipo, nombre, ruta, bytes, mime, subido_at}] — la ruta apunta al bucket
  -- privado "soportes"; el archivo nunca se sirve directo, solo por URL firmada.
  add column if not exists documentos     jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------- soportes
-- Bucket privado: un peritaje trae dirección, linderos y a veces la cédula del
-- propietario. Mismo criterio que la tabla kyc — sin políticas, así que ni anon
-- ni authenticated lo alcanzan desde el navegador; solo las rutas de API con
-- service role, después de validar el token de Privy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'soportes', 'soportes', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
