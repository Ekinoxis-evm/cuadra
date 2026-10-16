-- CUADRA · la memoria del usuario entra al hilo como mensaje de sistema
--
-- Las preferencias guardadas se mandaban en el `system` de cada petición y se
-- releían en cada turno. Cuando el agente llamaba a guardar_preferencias, el
-- turno siguiente salía con otro `system`: eso tumba el caché de todo el
-- historial y, en los modelos con "preserved thinking" (Opus 5.5 en
-- adelante), invalida los bloques de razonamiento ya guardados.
--
-- Ahora la memoria se toma una vez, al abrir la conversación, y se guarda en
-- el hilo como un mensaje `role: "system"` a mitad de conversación. De ahí en
-- adelante se reenvía idéntica y el prefijo no cambia. Lo que el agente
-- aprende después ya queda en el hilo, en sus propias llamadas a la
-- herramienta.

alter table mensajes drop constraint if exists mensajes_rol_check;
alter table mensajes
  add constraint mensajes_rol_check check (rol in ('user', 'assistant', 'system'));
