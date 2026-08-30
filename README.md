# CUADRA
Agregador de precios inmobiliarios de Cali — arriendo y venta, barrio por barrio.
Stack: Python scrapers (laptop) → Supabase → Next.js 15 + Privy → Vercel.

## Arquitectura
```
[Fincaraíz + MeLi] --curl_cffi--> SQLite (laptop)
                                   │  sync_supabase.py
                                   ▼
                              Supabase (listings, barrio_stats, profiles, favoritos)
                                   │  anon read (RLS) / service role via API
                                   ▼
                     Next.js en Vercel + Privy (perfil, favoritos)
```

## Launch sequence

### 1 · Supabase (2 min)
Corre `supabase/migrations/001_init.sql` en el SQL editor (o vía Supabase MCP:
"aplica esta migración en mi proyecto X"). Copia URL + anon key + service role key.

### 2 · Scraper

**En automático (recomendado).** `.github/workflows/scrape.yml` corre diario a
las 03:10 de Cali y también a mano desde la pestaña Actions. Necesita dos
secretos del repo: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

El orden de los pasos no es negociable: **pull antes de scrape**. El scraper
guarda en SQLite cosas que no se pueden recalcular raspando — `first_seen`,
`active`, `detail_at` — y CI arranca con disco limpio. Sin el pull, cada
corrida pondría `first_seen = hoy` en los 1.536 avisos (adiós a la historia de
cuánto lleva publicado cada inmueble) y `close_stale` no marcaría inactivo
nada, dejando en la vitrina inmuebles que ya salieron del mercado. Verificado:
el viaje pull → sync deja la base con huella idéntica.

**A mano, desde el portátil:**
```bash
cd scrapers
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

set -a && . ../web/.env.local && set +a
export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"

.venv/bin/python pull_supabase.py                        # siembra el .db
.venv/bin/python cali_inmuebles.py scrape --skip-meli    # arriendo + venta
.venv/bin/python cali_inmuebles.py enrich                # detalle, reanudable
.venv/bin/python sync_supabase.py                        # sube
```
`pull_supabase.py` también sirve para recuperar el `.db` si se pierde.

Después del sync hay que refrescar la vista materializada, o el tablero, el
chat y el evaluador siguen leyendo las medianas de ayer — y el evaluador juzga
presupuestos contra ese $/m², así que un refresco olvidado se vuelve un
veredicto peor. La Action lo hace sola; a mano:
```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/refrescar_barrio_stats" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d '{}'
```

> **MercadoLibre está fuera de servicio como fuente.** `api.mercadolibre.com/sites/MCO/search`
> responde **403**: ya exige OAuth para búsquedas anónimas. Por eso `--skip-meli`.
> Hoy el 100% de los datos viene de Fincaraíz, que es un punto único de falla.

### 3 · Privy (3 min)
dashboard.privy.io → nueva app → habilita email + wallet + Google.
Copia App ID y App Secret.

### 4 · Web (5 min)
```bash
cd web
cp .env.example .env.local     # Supabase ×3, Privy ×2, Anthropic
npm install
npm run dev                    # http://localhost:3000
```

### 5 · Deploy
Vercel MCP o CLI: importa `web/`, pega las mismas env vars, deploy.
Dominio sugerido: cuadra.com.co / cuadra.co

## Diseño
Tokens en `web/app/globals.css`: petrol #101715, hueso #EDE6D6,
solar #FF7A45 (un acento por vista), alza #7BC950. Display: Space Grotesk.
Data: IBM Plex Mono con números tabulares. Elemento firma: el **Tablero de
barrios** — mediana y $/m² clickeable que filtra los resultados.

## Estado actual
Primera corrida real: **1.536 listings** activos (1.534 con detalle), **303 barrios**.
Proyecto Supabase `cuadra` (`ffjvykbpqlrseskxuccq`, us-east-1), migraciones 001–009
aplicadas. Los datos son del último scrape: revisa `max(last_seen)` antes de sacar
conclusiones de frescura.

### Marco legal — léelo antes de tocar el flujo de plata
El **Decreto 1357 de 2018** regula la financiación colaborativa **solo cuando se emiten
valores**: títulos de deuda o de participación. Esa modalidad exige entidad autorizada
por la Superintendencia Financiera, receptor persona jurídica y proyecto productivo.
La financiación por **donación o recompensa quedó expresamente fuera** del decreto.

CUADRA opera hoy en la vía de donación. Por eso `espera_retorno` no es una pregunta más
del formulario: es la que decide si la propuesta se puede recibir. Está en el intake
(`web/lib/intake.ts`) y corta la entrevista en el momento, no al final.

Consecuencia para los vaults: **si una participación da derecho a retorno, es un valor
en Colombia.** El mercado de préstamos con colateral cae entero en la vía regulada.

### Cómo se propone un proyecto
Dos toques —quién propone y qué tipo de obra— y de ahí una entrevista conversacional
(`/api/intake`). Cada tipo de proponente tiene su guion, porque lo que acredita a cada
uno es distinto: a una persona su cédula y su relación con el predio; a una empresa el
certificado de existencia y representación; a una ESAL su personería jurídica y si está
en el Régimen Tributario Especial.

El reparto es deliberado: **el modelo pone el tono, el código pone el guion.** Cuáles
preguntas aplican y cuándo se acabó salen de `intake.ts`. Si el modelo decidiera cuándo
terminó, dos propuestas idénticas recorrerían preguntas distintas y la rúbrica dejaría
de poder compararlas. `normalizar()` en `intake-agente.ts` es la aduana: solo entra lo
que el guion conoce y con el tipo que declara.

### Evaluación
Rúbrica de cinco ejes con pesos por tipo de proponente, en `web/lib/evaluacion.ts`.
Los pesos viven en código versionado y `RUBRICA_VERSION` se guarda con cada veredicto,
para poder releer un fallo viejo con la rúbrica que lo produjo.

Lo que la hace defendible: el eje de presupuesto **no se juzga a ojo**. El evaluador
está obligado a llamar `estadisticas_barrio` y comparar la meta contra el área y el
$/m² real de ese barrio. Sin ese dato el eje va como `evaluable: false` — un eje sin
datos no puntúa cero, porque cero significa "lo evalué y está mal".

> ⚠️ La rúbrica y el esquema están escritos, pero **la llamada al evaluador todavía no
> existe**. Ninguna propuesta se ha evaluado.

### Créditos
No se puede cobrar lo que no se mide: `consumo` guarda el `usage` exacto de cada
llamada y de ahí salen los créditos. **1 crédito = USD 0,01** de costo nuestro.
60 gratis al mes, que se renuevan solos porque el período está en la llave primaria
de `creditos_mes` y no hay cron que mantener.

Costos medidos contra la API, no estimados:

| | USD |
|---|---|
| Sesión de chat, 12 turnos, **sin** caché | 1,0363 |
| Sesión de chat, 12 turnos, **con** caché | 0,2110 |
| Evaluar un proyecto (Fable 5, effort low) | 0,17 – 0,51 |

El caché del historial (`conCache` en `agente.ts`) es 4,9× más barato sin tocar el
prompt. La búsqueda, no la evaluación, es lo que hay que acotar.

## Revisar proyectos
La cola vive en **`/revision`**, ordenada por urgencia y no por antigüedad:
primero lo que tiene señales de gravedad alta, después lo que la rúbrica
recomienda publicar (son las decisiones rápidas y desatascan), y al final por
antigüedad para que nada se quede olvidado abajo. Ordenar por puntaje solo
sería peor: un 80 con señal grave es más urgente que un 45 limpio.

El veredicto llega al lado de cada propuesta, pero **decide una persona**.
Publicar es plata de terceros sobre una obra real, y automatizar el sí con una
herramienta que puntúa sobre lo *declarado* sería confundir "coherente" con
"verificado". La nota de devolución viene precargada con lo que la rúbrica le
escribió al proponente: casi siempre sirve, y se puede editar antes de mandarla.

Para entrar hay que estar en `ADMIN_DIDS` (DIDs de Privy separados por coma).
**Falla cerrado**: sin esa variable no revisa nadie. Con un solo revisor no
compensa una tabla de roles; cuando sean varios, sí.

Publicar exige KYC aprobado, y se revalida en el momento de publicar y no solo
al proponer: entre una cosa y otra el KYC pudo cambiar, y esta es la puerta por
la que se sale a recibir dinero.

```sql
-- Sigue siendo útil para el KYC, que no tiene pantalla todavía.
select privy_did, tipo_documento, documento, nombre, apellido, estado from kyc;
update kyc set estado = 'aprobado', revisado_at = now() where privy_did = '...';
```

Los soportes (peritajes, avalúos) están en el bucket privado `soportes`; se
abren desde el dashboard de Supabase o con una URL firmada. Las fotos del
proyecto viven en el bucket público `proyectos` y son las únicas que salen en
la vitrina.

## Roadmap corto
Lo siguiente, en orden de lo que desbloquea más:
- [ ] Pantalla de KYC: es lo único del flujo que sigue siendo SQL a mano
- [ ] Cómo se ven tablas y listings dentro del chat
- [ ] Contratos ERC-7540 (vaults por proyecto, COPm en Celo) con las participaciones
      pensadas desde el diseño para servir de colateral
- [ ] Comprar créditos de verdad: `PAQUETES` existe, no hay pasarela
- [ ] Aportes de verdad: hoy `recaudado_cop` no lo escribe nadie

Más adelante:
- [ ] OAuth de MercadoLibre para reactivar esa fuente (hoy 403)
- [ ] Limpiar `title` en `fr_parse_page`: guarda el texto crudo del ancla y repite
      el precio dentro del título
- [ ] Fetchers Metrocuadrado (Algolia) + Ciencuadras (trae comuna en la data)
- [ ] Yield bruto por barrio (mediana venta $/m² ÷ mediana arriendo $/m²)
- [ ] Mapa por comuna
- [ ] Alertas por email al bajar de precio (Privy email + cron)
- [ ] KYC contra la Registraduría y cifrar `kyc.documento` en reposo
