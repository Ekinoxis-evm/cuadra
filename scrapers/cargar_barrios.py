#!/usr/bin/env python3
"""
cargar_barrios.py — Carga los barrios oficiales de Cali en Supabase.

Fuente: capa dapm:pdt_dpa_barrios_sectores del IDESC (Alcaldía de Cali),
servida por WFS en WGS84. Trae código, nombre, comuna y polígono de cada
barrio urbano. Se corre una vez, y otra vez si la Alcaldía actualiza la
DIVIPOLA; es idempotente (upsert por código).

    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...
    python cargar_barrios.py

Después: select refrescar_barrio_stats();  — reasigna los avisos y las medianas.
"""
import os, sys
import requests

WFS = (
    "https://ws-idesc.cali.gov.co/geoserver/dapm/ows?service=WFS&version=1.0.0"
    "&request=GetFeature&typeName=dapm:pdt_dpa_barrios_sectores"
    "&outputFormat=application/json&srsName=EPSG:4326"
)
LOTE = 40

# Sectores con muchos avisos que no están en la capa urbana: la zona de
# expansión del sur y corredores rurales. Sin polígono; existen para que
# "Bochalema", "Bochalema Sur" y "Ciudad Bochalema" sean un solo lugar.
SECTORES = [
    ("X01", "Bochalema"),
    ("X02", "Ciudad Pacífica"),
    ("X03", "Ciudad Meléndez"),
    ("X04", "Kachipay"),
    ("X05", "La Buitrera"),
    ("X06", "Dapa"),
    ("X07", "Tierralinda"),
]

# Nombre de portal → nombre del barrio (oficial o sector). Las llaves van como
# las deja clave_barrio(): sin tildes, minúsculas, sin "urbanización",
# "conjunto residencial", "parcelación"… delante.
ALIAS = {
    "valle del lili": "Lili",
    "valle de lili": "Lili",
    "valle del lili sur": "Lili",
    "bochalema sur": "Bochalema",
    "ciudad bochalema": "Bochalema",
    "hacienda kachipay": "Kachipay",
    "cachipay": "Kachipay",
    "cerros la buitrera": "La Buitrera",
    "alto melendez - la buitrera": "La Buitrera",
    "tierra linda": "Tierralinda",
}

url = os.environ.get("SUPABASE_URL", "").rstrip("/")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not url or not key:
    sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.")


def _anillo(coords):
    # 6 decimales son ~10 cm: de sobra para saber en qué barrio cae un punto.
    return "(" + ",".join(f"{x:.6f} {y:.6f}" for x, y, *_ in coords) + ")"


def ewkt(geom):
    """GeoJSON → EWKT, que PostGIS acepta como texto en una columna geometry."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    cuerpo = ",".join("(" + ",".join(_anillo(a) for a in p) + ")" for p in polys)
    return f"SRID=4326;MULTIPOLYGON({cuerpo})"


features = requests.get(WFS, timeout=120).json()["features"]
filas = []
for f in features:
    p = f["properties"]
    filas.append({
        "codigo": p["barcodigo"],
        "nombre": " ".join(p["barnombre"].split()),
        "comuna": int(p["barcomuna"]) if str(p.get("barcomuna") or "").isdigit() else None,
        "categoria": p.get("barcategor"),
        "geom": ewkt(f["geometry"]),
    })
print(f"{len(filas)} barrios desde el IDESC")
filas += [{"codigo": c, "nombre": n, "comuna": None, "categoria": "Sector CUADRA", "geom": None}
          for c, n in SECTORES]

headers = {
    "apikey": key, "Authorization": f"Bearer {key}",
    "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates",
}


def subir(tabla, conflicto, datos):
    for i in range(0, len(datos), LOTE):
        r = requests.post(f"{url}/rest/v1/{tabla}?on_conflict={conflicto}", headers=headers,
                          json=datos[i:i + LOTE], timeout=120)
        if r.status_code >= 300:
            sys.exit(f"Error {tabla} lote {i}: {r.status_code} {r.text[:300]}")


subir("barrios", "codigo", filas)

codigo_de = {f["nombre"]: f["codigo"] for f in filas}
faltan = sorted({n for n in ALIAS.values() if n not in codigo_de})
if faltan:
    sys.exit(f"Alias hacia barrios que no existen: {faltan}")
subir("barrio_alias", "clave", [{"clave": k, "codigo": codigo_de[n]} for k, n in ALIAS.items()])
print(f"{len(SECTORES)} sectores y {len(ALIAS)} alias. Ahora: select refrescar_barrio_stats();")
