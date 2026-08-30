"""
Baja los listings de Supabase al SQLite local.

Existe por el estado. El scraper guarda en SQLite cosas que NO se pueden
recalcular raspando: `first_seen` (desde cuándo existe el aviso), `active` y
`detail_at` (hasta dónde llegó el enriquecimiento). Sobre una base vacía, una
corrida completa haría dos destrozos silenciosos:

  - todos los avisos quedarían con first_seen = hoy, y se pierde la historia
    de cuánto lleva publicado cada inmueble;
  - `close_stale` no marcaría inactivo nada, porque no hay nada viejo que
    comparar, y los avisos que ya salieron del mercado se quedarían vivos en
    Supabase para siempre — la vitrina mostrando cosas que no existen.

Por eso el orden en CI es pull → scrape → enrich → sync, y no scrape → sync.
Local sirve para lo mismo si se pierde el .db.

    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...
    python pull_supabase.py
"""

import json, os, sqlite3, sys
import requests

DB = os.path.join(os.path.dirname(__file__), "cali_inmuebles.db")

# PostgREST corta en 1.000 filas por respuesta, sin avisar. Pedir "todo" y
# confiar en lo que llegue es como se pierden 500 avisos sin que nadie lo note.
PAGINA = 1000

url = os.environ.get("SUPABASE_URL", "").rstrip("/")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not url or not key:
    sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.")

# La columna generada no se puede escribir de vuelta.
GENERADAS = {"busqueda", "precio_m2"}

headers = {"apikey": key, "Authorization": f"Bearer {key}"}

filas = []
desde = 0
while True:
    r = requests.get(
        f"{url}/rest/v1/listings",
        headers={**headers, "Range-Unit": "items",
                 "Range": f"{desde}-{desde + PAGINA - 1}"},
        params={"select": "*", "order": "source,source_id"},
        timeout=120,
    )
    if r.status_code >= 300:
        sys.exit(f"Error bajando desde {desde}: {r.status_code} {r.text[:300]}")
    lote = r.json()
    filas.extend(lote)
    print(f"  {len(filas)} bajados")
    if len(lote) < PAGINA:
        break
    desde += PAGINA

if not filas:
    print("Supabase no tiene listings. Nada que sembrar.")
    sys.exit(0)

conn = sqlite3.connect(DB)
# Reusa el esquema del scraper para no duplicar la definición de columnas.
sys.path.insert(0, os.path.dirname(__file__))
from cali_inmuebles import db as crear_db  # noqa: E402

conn.close()
conn = crear_db()

cols = [c[1] for c in conn.execute("PRAGMA table_info(listings)")]
utiles = [c for c in cols if c not in GENERADAS]

n = 0
for f in filas:
    d = {}
    for c in utiles:
        v = f.get(c)
        # SQLite no tiene arreglos: en local viven como JSON, igual que los
        # deja el scraper. El sync los vuelve a convertir al subir.
        if isinstance(v, (list, dict)):
            v = json.dumps(v, ensure_ascii=False)
        elif isinstance(v, bool):
            v = int(v)
        d[c] = v
    marcas = ",".join("?" for _ in utiles)
    conn.execute(
        f"INSERT OR REPLACE INTO listings ({','.join(utiles)}) VALUES ({marcas})",
        [d[c] for c in utiles],
    )
    n += 1

conn.commit()
activos = conn.execute("SELECT COUNT(*) FROM listings WHERE active=1").fetchone()[0]
con_det = conn.execute("SELECT COUNT(*) FROM listings WHERE detail_at IS NOT NULL").fetchone()[0]
print(f"Sembrados {n} listings ({activos} activos, {con_det} con detalle) en {DB}")
