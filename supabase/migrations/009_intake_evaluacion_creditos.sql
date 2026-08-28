-- CUADRA · intake por tipo de proponente, evaluación con rúbrica y créditos
--
-- Tres huecos que se tapan juntos porque dependen uno del otro:
--
--   1. El formulario preguntaba lo mismo a todo el mundo. Lo que acredita a
--      una persona (su cédula y su relación con el predio) no es lo que
--      acredita a una empresa (NIT, cámara de comercio, representación legal)
--      ni a una fundación (personería jurídica, RTE ante la DIAN). Ahora cada
--      tipo tiene su guion, y las respuestas viven en `respuestas` en vez de
--      obligar a una columna por pregunta.
--
--   2. La evaluación no existía: un borrador esperaba a que alguien lo mirara
--      en SQL. Ahora hay veredicto con puntaje por eje y la versión de rúbrica
--      con que se produjo, para poder releer un fallo viejo.
--
--   3. No se medía el gasto del modelo. Sin eso no hay créditos posibles: la
--      tarifa sería un número inventado. `consumo` guarda el usage exacto de
--      cada llamada y `creditos_mes` lleva el saldo.

-- ------------------------------------------------------------------- intake
alter table proyectos
  -- 'sin_animo_lucro' es nuevo. Una ESAL no es "una empresa": se acredita con
  -- personería jurídica, su objeto social limita lo que puede proponer, y el
  -- Régimen Tributario Especial decide si el aporte es deducible para quien
  -- dona. Meterla en 'empresa' borraba las tres cosas.
  drop constraint if exists proyectos_proponente_check;

alter table proyectos
  add constraint proyectos_proponente_check
    check (proponente in ('persona', 'empresa', 'sin_animo_lucro', 'gobierno'));

alter table proyectos
  -- Las respuestas del guion, con las claves de web/lib/intake.ts. Van en
  -- jsonb y no en columnas porque el set depende del tipo y crece: una
  -- columna por pregunta serían cuarenta columnas casi siempre nulas, y cada
  -- pregunta nueva una migración.
  add column if not exists respuestas jsonb not null default '{}'::jsonb,
  -- 'donacion' o 'valores'. El Decreto 1357 de 2018 regula la financiación
  -- colaborativa SOLO por emisión de valores (deuda o participación) y exige
  -- entidad autorizada por la Superintendencia Financiera. La donación y la
  -- recompensa quedaron expresamente fuera. CUADRA opera hoy en donación; la
  -- restricción deja constancia de que la otra vía existe y está cerrada.
  add column if not exists regimen text not null default 'donacion'
    check (regimen in ('donacion', 'valores')),
  add column if not exists intake_completo_at timestamptz;

-- --------------------------------------------------------------- evaluación
create table if not exists evaluaciones (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references proyectos on delete cascade,
  -- Con qué rúbrica se juzgó. Sin esto, cambiar un peso vuelve ilegibles
  -- todos los fallos anteriores.
  rubrica       int  not null,
  modelo        text not null,
  esfuerzo      text not null,
  puntaje       int  not null check (puntaje between 0 and 100),
  -- Qué proporción de la rúbrica se pudo evaluar de verdad. Un 90 con
  -- cobertura 0,4 es un 90 sobre menos de la mitad del examen, y la cola
  -- tiene que poder distinguirlos.
  cobertura     numeric not null check (cobertura between 0 and 1),
  banda         text not null check (banda in ('recomendado', 'gris', 'devuelto')),
  -- [{eje, puntaje, evaluable, sustento}] y [{gravedad, asunto, detalle}]
  ejes          jsonb not null default '[]'::jsonb,
  senales       jsonb not null default '[]'::jsonb,
  resumen       text,
  para_quien_propone text,
  costo_usd     numeric(10, 6) not null default 0,
  creado_at     timestamptz not null default now()
);

-- La cola de revisión ordena por lo más reciente de cada proyecto.
create index if not exists idx_evaluaciones_proyecto
  on evaluaciones (proyecto_id, creado_at desc);
-- Y el triage mira primero lo que tiene senales graves, sin importar puntaje.
create index if not exists idx_evaluaciones_banda
  on evaluaciones (banda, creado_at desc);

-- ------------------------------------------------------------------ consumo
-- Una fila por llamada al modelo. Es la fuente de verdad del gasto: los
-- créditos se descuentan de aquí y no de una estimación.
create table if not exists consumo (
  id           bigserial primary key,
  privy_did    text not null references profiles on delete cascade,
  -- 'chat' | 'evaluacion' | 'intake'
  concepto     text not null,
  modelo       text not null,
  entrada      int not null default 0,
  salida       int not null default 0,
  cache_escritura int not null default 0,
  cache_lectura   int not null default 0,
  costo_usd    numeric(10, 6) not null,
  creditos     int not null,
  -- A qué se refería: conversación o proyecto. Sin FK porque apunta a tablas
  -- distintas según el concepto.
  referencia   text,
  creado_at    timestamptz not null default now()
);

create index if not exists idx_consumo_usuario
  on consumo (privy_did, creado_at desc);

-- ----------------------------------------------------------------- créditos
-- Saldo por usuario y por mes. El período en la llave primaria hace que la
-- bolsa gratis se renueve sola: el primer consumo de un mes nuevo crea la
-- fila con el otorgado del mes, sin cron que mantener.
create table if not exists creditos_mes (
  privy_did   text not null references profiles on delete cascade,
  -- 'AAAA-MM' en UTC.
  periodo     text not null,
  otorgados   int  not null default 60,
  gastados    int  not null default 0,
  creado_at   timestamptz not null default now(),
  primary key (privy_did, periodo)
);

-- Los comprados no caducan y no dependen del mes, así que van aparte del
-- saldo mensual en vez de mezclarse con la bolsa gratis.
create table if not exists creditos_comprados (
  privy_did   text primary key references profiles on delete cascade,
  saldo       int not null default 0 check (saldo >= 0),
  actualizado_at timestamptz not null default now()
);

-- --------------------------------------------------------------------- RLS
alter table evaluaciones       enable row level security;
alter table consumo            enable row level security;
alter table creditos_mes       enable row level security;
alter table creditos_comprados enable row level security;

-- Las cuatro quedan sin políticas, igual que `kyc`: ni anon ni authenticated
-- las tocan desde el navegador. Un veredicto trae el sustento interno de por
-- qué se rechazó algo, y el consumo es el historial de uso de una persona.
-- Solo las rutas de API con service role, después de verificar el token de
-- Privy.

-- --------------------------------------------------------------- el cobro
-- Descontar créditos es leer-modificar-escribir sobre dos tablas: hecho desde
-- la app, dos pestañas abiertas se pisan y el saldo queda mal. Aquí es una
-- sola sentencia atómica que gasta primero la bolsa gratis del mes y solo
-- después toca lo comprado.
create or replace function cobrar_creditos(
  p_did text,
  p_creditos int,
  p_periodo text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_libres    int;
  v_comprados int;
  v_del_mes   int;
  v_resto     int;
begin
  insert into creditos_mes (privy_did, periodo)
  values (p_did, p_periodo)
  on conflict (privy_did, periodo) do nothing;

  -- Las dos filas se bloquean en el mismo orden en todas las rutas: el mes y
  -- despues lo comprado. Invertirlo en alguna abriria un interbloqueo.
  select greatest(otorgados - gastados, 0) into v_libres
    from creditos_mes
   where privy_did = p_did and periodo = p_periodo
     for update;

  select saldo into v_comprados
    from creditos_comprados
   where privy_did = p_did
     for update;
  v_comprados := coalesce(v_comprados, 0);

  -- Todo o nada, y la comprobacion va ANTES de tocar nada. La primera version
  -- descontaba la parte que alcanzaba y ademas devolvia el faltante: la
  -- llamada se rechazaba, el usuario no recibia nada, y de todos modos se le
  -- habian ido los creditos. Se detecto probando la funcion contra el
  -- proyecto real, no leyendola.
  if v_libres + v_comprados < p_creditos then
    return -(p_creditos - v_libres - v_comprados);
  end if;

  v_del_mes := least(v_libres, p_creditos);
  v_resto   := p_creditos - v_del_mes;

  update creditos_mes
     set gastados = gastados + v_del_mes
   where privy_did = p_did and periodo = p_periodo;

  if v_resto > 0 then
    update creditos_comprados
       set saldo = saldo - v_resto, actualizado_at = now()
     where privy_did = p_did;
  end if;

  return p_creditos;
end;
$$;

revoke all on function cobrar_creditos(text, int, text) from public, anon, authenticated;
