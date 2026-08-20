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

### 2 · Scraper (5 min, desde laptop)
```bash
cd scrapers
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python cali_inmuebles.py scrape --skip-meli   # arriendo + venta, aptos + casas
.venv/bin/python cali_inmuebles.py report               # sanity check local

# Toma las llaves del .env.local ya lleno
set -a && . ../web/.env.local && set +a
export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
.venv/bin/python sync_supabase.py
```

> **MercadoLibre está fuera de servicio como fuente.** `api.mercadolibre.com/sites/MCO/search`
> responde **403**: ya exige OAuth para búsquedas anónimas. Por eso `--skip-meli`.
> Para revivirlo hay que registrar una app en MeLi y meter el flujo de token en
> `scrape_meli()`. Hoy el 100% de los datos viene de Fincaraíz.
Después del sync, en Supabase: `REFRESH MATERIALIZED VIEW barrio_stats;`
Repite diario (cron de laptop o GitHub Action después).

### 3 · Privy (3 min)
dashboard.privy.io → nueva app → habilita email + wallet + Google.
Copia App ID y App Secret.

### 4 · Web (5 min)
```bash
cd web
cp .env.example .env.local     # llena las 5 variables
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
Primera corrida real: **1.536 listings** activos, **215 barrios**.
Proyecto Supabase `cuadra` (`ffjvykbpqlrseskxuccq`, us-east-1), migración aplicada.
App verificada end-to-end en local: tablero y resultados con datos reales.

## Roadmap corto
- [ ] OAuth de MercadoLibre para reactivar esa fuente (hoy 403)
- [ ] Limpiar `title` en `fr_parse_page`: hoy guarda el texto crudo del ancla y
      repite el precio dentro del título
- [ ] Fetchers Metrocuadrado (Algolia) + Ciencuadras (trae comuna en la data)
- [ ] Yield bruto por barrio (mediana venta $/m² ÷ mediana arriendo $/m²)
- [ ] Mapa por comuna
- [ ] Alertas por email al bajar de precio (Privy email + cron)
