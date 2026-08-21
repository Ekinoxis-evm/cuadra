#!/usr/bin/env python3
"""
sync_supabase.py — Sube el SQLite local a Supabase (upsert por source+source_id).
Uso:
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...
    python sync_supabase.py
Luego: REFRESH MATERIALIZED VIEW barrio_stats;  (SQL editor o via MCP)
"""
import json, os, sqlite3, sys, time
import requests

DB = "cali_inmuebles.db"
# 100 y no 500: con la galeria completa cada fila lleva ~20 URLs, y los lotes
# grandes hacian que la conexion TLS se cayera a mitad del POST.
BATCH = int(os.environ.get("SYNC_BATCH", "100"))
REINTENTOS = 4

url = os.environ.get("SUPABASE_URL", "").rstrip("/")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not (url and key):
    sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.")

# busqueda es columna generada en Postgres: no se envia
GENERADAS = {"busqueda"}

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
rows = []
for r in conn.execute("SELECT * FROM listings"):
    d = {k: v for k, v in dict(r).items() if k not in GENERADAS}
    d["active"] = bool(d.get("active"))
    # SQLite guarda estas como string JSON; Postgres las espera como text[]
    for col in ("amenidades", "imagenes"):
        if d.get(col):
            try:
                d[col] = json.loads(d[col])
            except (TypeError, ValueError):
                d[col] = None
    rows.append(d)

n_det = sum(1 for r in rows if r.get("detail_at"))
print(f"Subiendo {len(rows)} listings a Supabase ({n_det} con detalle)...")

endpoint = f"{url}/rest/v1/listings?on_conflict=source,source_id"
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}
for i in range(0, len(rows), BATCH):
    batch = rows[i:i + BATCH]
    # Los cortes de TLS a mitad de POST son transitorios: reintentamos con
    # backoff en vez de perder toda la corrida por un lote.
    for intento in range(1, REINTENTOS + 1):
        try:
            resp = requests.post(endpoint, headers=headers, json=batch, timeout=120)
            if resp.status_code >= 300:
                sys.exit(f"Error batch {i}: {resp.status_code} {resp.text[:300]}")
            break
        except requests.exceptions.RequestException as e:
            if intento == REINTENTOS:
                sys.exit(f"Error batch {i} tras {REINTENTOS} intentos: {e}")
            espera = 2 ** intento
            print(f"  batch {i}: {type(e).__name__}, reintento {intento} en {espera}s")
            time.sleep(espera)
    print(f"  {i + len(batch)}/{len(rows)}")

print("Listo. Ahora: REFRESH MATERIALIZED VIEW barrio_stats;")
