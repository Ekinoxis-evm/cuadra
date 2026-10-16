#!/usr/bin/env python3
"""
cali_inmuebles.py — Agregador de precios inmobiliarios de Cali (laptop edition)
Dos operaciones: ARRIENDO y VENTA. Fuentes: Fincaraíz (scrape) + Mercado Libre (API).
Storage: SQLite (cali_inmuebles.db) con first_seen/last_seen → time-on-market gratis.

Uso:
    pip install curl_cffi selectolax
    python cali_inmuebles.py scrape                     # arriendo + venta, aptos + casas
    python cali_inmuebles.py scrape --op venta --tipo apartamentos --pages 30
    python cali_inmuebles.py report                     # medianas por barrio x operación
"""

import argparse, csv, json, re, sqlite3, sys, time, unicodedata
from datetime import datetime, timezone
from statistics import median

from curl_cffi import requests as creq   # fingerprint TLS de Chrome real
from selectolax.parser import HTMLParser

DB = "cali_inmuebles.db"
DELAY = 1.5
FR_BASE = "https://www.fincaraiz.com.co"
TIPOS = ["apartamentos", "casas"]
OPS = ["arriendo", "venta"]

# Rangos de sanidad de precio (COP) para descartar basura
SANITY = {"arriendo": (300_000, 60_000_000), "venta": (60_000_000, 15_000_000_000)}

# Campos que solo existen en la pagina de detalle (un fetch extra por listing)
DETAIL_COLS = [
    ("lat", "REAL"), ("lng", "REAL"), ("estrato", "INTEGER"),
    ("comuna", "TEXT"), ("direccion", "TEXT"), ("descripcion", "TEXT"),
    ("amenidades", "TEXT"), ("parqueaderos", "INTEGER"), ("piso", "INTEGER"),
    ("antiguedad", "TEXT"), ("estado", "TEXT"), ("publicado", "TEXT"),
    ("owner_nombre", "TEXT"), ("owner_tipo", "TEXT"), ("imagen", "TEXT"),
    ("imagenes", "TEXT"), ("detail_at", "TEXT"),
]

# Lo que upsert_detalle y enrich pueden escribir: las de detalle más las del
# listado que el detalle corrige (título limpio, área estructurada, etc.).
COLUMNAS_DETALLE = {c for c, _ in DETAIL_COLS} | {
    "title", "habs", "banos", "area_m2", "admin_cop", "zona"}

# Mercado Libre: MCO1459 = Inmuebles. Filtramos operación por atributo en cada resultado.
MELI_URL = ("https://api.mercadolibre.com/sites/MCO/search"
            "?category=MCO1459&q={q}%20cali&limit=50&offset={offset}")


# ---------------------------------------------------------------- storage

def db():
    conn = sqlite3.connect(DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS listings (
            source TEXT NOT NULL, source_id TEXT NOT NULL,
            operacion TEXT, tipo TEXT,
            url TEXT, title TEXT,
            price_cop INTEGER, admin_cop INTEGER,
            barrio TEXT, zona TEXT,
            habs INTEGER, banos INTEGER, area_m2 REAL,
            first_seen TEXT, last_seen TEXT, active INTEGER DEFAULT 1,
            PRIMARY KEY (source, source_id)
        )""")
    # Columnas de enriquecimiento (idempotente: SQLite no tiene ADD COLUMN IF NOT EXISTS)
    have = {r[1] for r in conn.execute("PRAGMA table_info(listings)")}
    for col, typ in DETAIL_COLS:
        if col not in have:
            conn.execute(f"ALTER TABLE listings ADD COLUMN {col} {typ}")
    conn.commit()
    return conn


def upsert(conn, row):
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    # Columnas con nombre: el INSERT posicional dejo de funcionar cuando
    # DETAIL_COLS agrego 17 columnas ("table has 33 columns but 16 values").
    conn.execute("""
        INSERT INTO listings
            (source,source_id,operacion,tipo,url,title,price_cop,admin_cop,
             barrio,zona,habs,banos,area_m2,first_seen,last_seen,active)
        VALUES
            (:source,:source_id,:operacion,:tipo,:url,:title,:price_cop,:admin_cop,
             :barrio,:zona,:habs,:banos,:area_m2,:now,:now,1)
        ON CONFLICT(source,source_id) DO UPDATE SET
            price_cop=excluded.price_cop, last_seen=excluded.last_seen, active=1
        """, {**row, "barrio": barrio_canon(row.get("barrio")), "now": now})


def upsert_detalle(conn, source, source_id, det):
    """Escribe lo que en Fincaraíz sale del fetch de detalle y en los otros
    portales ya viene en la búsqueda. Marca detail_at para que enrich() no
    los vuelva a pedir."""
    det = {k: v for k, v in det.items() if v not in (None, "", [])}
    for col in ("amenidades", "imagenes"):
        if isinstance(det.get(col), list):
            det[col] = json.dumps(det[col], ensure_ascii=False)
    det["detail_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    # Los nombres de columna van en el SQL; solo pasan los que conocemos.
    raras = set(det) - COLUMNAS_DETALLE
    if raras:
        raise ValueError(f"columnas desconocidas: {sorted(raras)}")
    sets = ", ".join(f"{k}=?" for k in det)
    conn.execute(f"UPDATE listings SET {sets} WHERE source=? AND source_id=?",
                 list(det.values()) + [source, source_id])


# ---------------------------------------------------------------- barrios

def _clave(nombre):
    """Llave para comparar barrios entre portales: sin tildes, sin
    mayúsculas, espacios colapsados. "VALLE DEL LILI", "Valle del Lili" y
    "Valle Del Lilí" son el mismo barrio."""
    s = unicodedata.normalize("NFKD", str(nombre))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.lower().split())


_CANON = {}


def cargar_barrios(conn):
    """Siembra el mapa de nombres con lo que ya hay, Fincaraíz primero.

    Sin esto cada portal escribe el barrio a su manera y barrio_stats parte
    un mismo barrio en dos filas, y el chat, que filtra por nombre, se pierde
    la mitad de los avisos."""
    for (b,) in conn.execute(
            "SELECT barrio FROM listings WHERE barrio IS NOT NULL "
            "ORDER BY source='fincaraiz' DESC, first_seen"):
        _CANON.setdefault(_clave(b), b)


def barrio_canon(nombre):
    if not nombre or not str(nombre).strip():
        return None
    n = " ".join(str(nombre).split()).title()
    return _CANON.setdefault(_clave(n), n)


def close_stale(conn, fuentes):
    """Cierra lo que no se ha visto en una semana, pero solo de las fuentes
    que esta corrida sí raspó con éxito. Si un portal cambia su HTML y
    devuelve cero, sus avisos no se dan por vendidos: se quedan como estaban
    y el aviso en la salida dice qué revisar."""
    if not fuentes:
        return
    marcas = ",".join("?" * len(fuentes))
    conn.execute("UPDATE listings SET active=0 "
                 "WHERE julianday('now')-julianday(last_seen) > 7 "
                 f"AND source IN ({marcas})", list(fuentes))


# ---------------------------------------------------------------- fincaraíz

def fr_fetch(url):
    r = creq.get(url, impersonate="chrome", timeout=30)
    r.raise_for_status()
    return r.text


def fr_parse_page(html, operacion, tipo):
    tree = HTMLParser(html)
    slug = "arriendo" if operacion == "arriendo" else "venta"

    # Path A: __NEXT_DATA__
    node = tree.css_first("script#__NEXT_DATA__")
    if node:
        try:
            hits = _find_listings_json(json.loads(node.text()))
            if hits:
                rows = [r for r in (_fr_from_json(x, operacion, tipo) for x in hits) if r]
                if rows:
                    return rows
        except (json.JSONDecodeError, KeyError):
            pass

    # Path B: DOM
    out = []
    for a in tree.css(f"a[href*='-en-{slug}-']"):
        text = a.text(separator=" ", strip=True)
        href = a.attributes.get("href", "")
        m_id = re.search(r"/(\d{6,})$", href)
        m_price = re.search(r"\$\s*([\d.]+)", text)
        if not (m_id and m_price):
            continue
        m_admin = re.search(r"\+\s*\$\s*([\d.]+)\s*admin", text)
        m_habs = re.search(r"(\d+)\s*Habs?", text)
        m_banos = re.search(r"(\d+)\s*Baño", text)
        m_area = re.search(r"([\d.]+)\s*m²", text)
        m_barrio = re.search(rf"{slug} en ([a-záéíóúñ\s]+?),?\s*cali", text, re.I)
        out.append({
            "source": "fincaraiz", "source_id": m_id.group(1),
            "operacion": operacion, "tipo": tipo,
            "url": href if href.startswith("http") else FR_BASE + href,
            "title": text[:120],
            "price_cop": int(m_price.group(1).replace(".", "")),
            "admin_cop": int(m_admin.group(1).replace(".", "")) if m_admin else None,
            "barrio": m_barrio.group(1).strip().title() if m_barrio else None,
            "zona": None,
            "habs": int(m_habs.group(1)) if m_habs else None,
            "banos": int(m_banos.group(1)) if m_banos else None,
            "area_m2": float(m_area.group(1)) if m_area else None,
        })
    return out


def _find_listings_json(obj, depth=0):
    if depth > 8:
        return None
    if isinstance(obj, list) and obj and isinstance(obj[0], dict):
        keys = set(obj[0].keys())
        if {"price", "id"} & keys or {"rent_price", "propertyId"} & keys:
            return obj
    if isinstance(obj, dict):
        for v in obj.values():
            f = _find_listings_json(v, depth + 1)
            if f:
                return f
    if isinstance(obj, list):
        for v in obj:
            f = _find_listings_json(v, depth + 1)
            if f:
                return f
    return None


def _fr_from_json(x, operacion, tipo):
    def g(*keys, default=None):
        for k in keys:
            if k in x and x[k] not in (None, ""):
                return x[k]
        return default
    price = g("price", "rent_price", "rentPrice", "sale_price", "salePrice")
    if isinstance(price, dict):
        price = price.get("amount")
    sid = g("id", "propertyId", "fr_property_id")
    if not (price and sid):
        return None
    loc = g("locations", "location", default={}) or {}
    barrio = None
    if isinstance(loc, dict):
        barrio = loc.get("neighbourhood") or loc.get("location_point") or loc.get("name")
        if isinstance(barrio, list) and barrio:
            barrio = barrio[0].get("name") if isinstance(barrio[0], dict) else barrio[0]
        if isinstance(barrio, dict):
            barrio = barrio.get("name")
    link = g("link", "url", default="")
    return {
        "source": "fincaraiz", "source_id": str(sid),
        "operacion": operacion, "tipo": tipo,
        "url": link if str(link).startswith("http") else FR_BASE + str(link),
        "title": str(g("title", "name", default=""))[:120],
        "price_cop": int(float(price)), "admin_cop": None,
        "barrio": str(barrio).strip().title() if barrio else None, "zona": None,
        "habs": g("rooms", "bedrooms"), "banos": g("bathrooms", "baths"),
        "area_m2": g("area", "m2", "surface"),
    }


def scrape_fincaraiz(conn, operacion, tipo, pages):
    base = f"{FR_BASE}/{operacion}/{tipo}/cali/valle-del-cauca"
    total = 0
    for p in range(1, pages + 1):
        url = base if p == 1 else f"{base}/pagina{p}"
        try:
            rows = fr_parse_page(fr_fetch(url), operacion, tipo)
        except Exception as e:
            print(f"  [fincaraiz {operacion}/{tipo}] pág {p} falló: {e}", file=sys.stderr)
            break
        if not rows:
            break
        for r in rows:
            upsert(conn, r)
        total += len(rows)
        conn.commit()
        time.sleep(DELAY)
    print(f"[fincaraiz] {operacion}/{tipo}: {total} listings")
    return total


# ---------------------------------------------------------------- mercado libre

def scrape_meli(conn, operacion, tipo, max_pages=20):
    q = f"{tipo[:-1]}%20{operacion}"          # "apartamento arriendo"
    want_venta = operacion == "venta"
    total, offset = 0, 0
    while offset < max_pages * 50:
        try:
            r = creq.get(MELI_URL.format(q=q, offset=offset),
                         impersonate="chrome", timeout=30)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  [meli] offset {offset} falló: {e}", file=sys.stderr)
            break
        results = data.get("results", [])
        if not results:
            break
        for x in results:
            attrs = {a["id"]: a.get("value_name") for a in x.get("attributes", [])}
            op_attr = (attrs.get("OPERATION") or "").lower()
            if op_attr and (("venta" in op_attr) != want_venta):
                continue
            addr = x.get("address") or {}
            if "cali" not in (addr.get("city_name") or "").lower():
                continue
            def _num(s):
                if not s:
                    return None
                m = re.search(r"[\d.]+", str(s).replace(",", "."))
                return float(m.group()) if m else None
            upsert(conn, {
                "source": "meli", "source_id": x["id"],
                "operacion": operacion, "tipo": tipo,
                "url": x.get("permalink"), "title": (x.get("title") or "")[:120],
                "price_cop": int(x.get("price") or 0), "admin_cop": None,
                "barrio": addr.get("neighborhood", {}).get("name")
                          if isinstance(addr.get("neighborhood"), dict)
                          else addr.get("area_name"),
                "zona": None,
                "habs": int(_num(attrs.get("BEDROOMS")) or 0) or None,
                "banos": int(_num(attrs.get("FULL_BATHROOMS")) or 0) or None,
                "area_m2": _num(attrs.get("TOTAL_AREA") or attrs.get("COVERED_AREA")),
            })
            total += 1
        conn.commit()
        offset += 50
        time.sleep(0.5)
    print(f"[meli] {operacion}/{tipo}: {total} listings")
    return total


# ---------------------------------------------------------------- comunes

def _num(v):
    try:
        f = float(str(v).replace(",", "."))
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def _entero(v):
    f = _num(v)
    return int(f) if f is not None else None


def _coord(v):
    """Coordenada: puede ser negativa (en Cali la longitud es -76,5), así que
    no sirve _num. Fuera de un rango plausible para Cali se descarta."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f and -80 < f < 13 else None


def _precio_ok(operacion, precio):
    lo, hi = SANITY[operacion]
    return precio is not None and lo <= precio <= hi


# ---------------------------------------------------------------- metrocuadrado
#
# La página de búsqueda trae la primera tanda en el HTML; el resto lo pide el
# navegador a /rest-search/search con una llave pública que viene en la
# configuración de la misma página. Se lee de ahí en cada corrida en vez de
# fijarla en el código: si la rotan, el scraper la toma sola. La búsqueda
# trae todo lo que en Fincaraíz exige un fetch de detalle (coordenadas,
# estrato, descripción, galería), así que no hace falta enriquecer.

MC_BASE = "https://www.metrocuadrado.com"
MC_TIPO = {"apartamentos": "apartamento", "casas": "casa"}
MC_PAGINA = 50     # la API rechaza otro tamaño: con size=5 devuelve 0 resultados

# Lo que Metrocuadrado marca con "S" en `featured`, con el nombre que usa
# Fincaraíz: el filtro de amenidades del chat compara por nombre exacto.
MC_AMENIDADES = {
    "conPiscina": "Piscina", "conGimnasio": "Gimnasio", "ascensor": "Ascensor",
    "enConjuntoCerrado": "En conjunto cerrado", "conSalonComunal": "Salón Comunal",
    "conZonaNinos": "Zona Infantil", "conZonasVerdes": "Zonas Verdes",
    "conZonaLavanderia": "Zona de lavandería",
    "cercaTransportePublico": "Trans. Público cercano",
    "cercaColegioUniversidad": "Colegios / Universidades",
    "conMuebles": "Amoblado", "sePermitenMascotas": "Mascotas permitidas",
}


def mc_llave():
    html = creq.get(f"{MC_BASE}/apartamentos/arriendo/cali/",
                    impersonate="chrome", timeout=30).text
    # El payload de Next viene escapado dentro de strings de JS.
    m = re.search(r'\\?"apiKey\\?":\\?"([A-Za-z0-9]+)', html)
    if not m:
        raise RuntimeError("no se encontró la llave de búsqueda en la página")
    return m.group(1)


def _mc_featured(x):
    out = {}
    for f in x.get("featured") or []:
        k, _, v = str(f).strip().partition(":")
        out[k] = v.strip()
    return out


def _mc_row(x, operacion, tipo):
    precio = _entero(x.get("mvalorarriendo") if operacion == "arriendo"
                     else x.get("mvalorventa"))
    if not _precio_ok(operacion, precio):
        return None, None
    if (x.get("mciudad") or {}).get("nombre", "").lower() != "cali":
        return None, None
    sid = x.get("midinmueble")
    if not sid:
        return None, None

    feat = _mc_featured(x)
    zona = (x.get("mzona") or {}).get("nombre")
    row = {
        "source": "metrocuadrado", "source_id": str(sid),
        "operacion": operacion, "tipo": tipo,
        "url": MC_BASE + str(x.get("link") or ""),
        "title": (x.get("title") or "")[:120],
        "price_cop": precio,
        "admin_cop": _entero((x.get("data") or {}).get("mvaloradministracion")),
        "barrio": x.get("mnombrecomunbarrio") or x.get("mbarrio"),
        "zona": None if zona in (None, "Otros") else zona,
        "habs": _entero(x.get("mnrocuartos")),
        "banos": _entero(x.get("mnrobanos")),
        "area_m2": _num(x.get("marea")) or _num(x.get("mareac")),
    }

    loc = x.get("localizacion") or {}
    fotos = [f"https://multimedia.metrocuadrado.com/{sid}/{f}_p.jpg"
             for f in (x.get("mgaleriainmueble") or [])]
    amen = [n for k, n in MC_AMENIDADES.items() if feat.get(k) == "S"]
    if feat.get("terrazaBalcon") in ("Balcón", "Terraza"):
        amen.append(feat["terrazaBalcon"])
    det = {
        "lat": _coord(loc.get("lat")), "lng": _coord(loc.get("lon")),
        "estrato": _entero(x.get("estrato")),
        "descripcion": x.get("comment"),
        "amenidades": amen,
        "parqueaderos": _entero(x.get("mnrogarajes")),
        "piso": _entero(feat.get("nroPiso")),
        "antiguedad": feat.get("tiempoConstruido"),
        "estado": x.get("mestadoinmueble"),
        # Sin nombre ni teléfono de quien publica: puede ser una persona.
        "owner_tipo": x.get("moferente"),
        "imagen": x.get("imageLink") or (fotos[0] if fotos else None),
        "imagenes": fotos,
    }
    return row, det


def scrape_metrocuadrado(conn, operacion, tipo, pages, llave):
    t = MC_TIPO[tipo]
    headers = {"x-api-key": llave,
               "referer": f"{MC_BASE}/{tipo}/{operacion}/cali/"}
    total = 0
    for p in range(pages):
        url = (f"{MC_BASE}/rest-search/search?realEstateTypeList={t}"
               f"&realEstateBusinessList={operacion}&city=cali"
               f"&from={p * MC_PAGINA}&size={MC_PAGINA}")
        try:
            r = creq.get(url, impersonate="chrome", headers=headers, timeout=30)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  [metrocuadrado {operacion}/{tipo}] pág {p + 1} falló: {e}",
                  file=sys.stderr)
            break
        resultados = data.get("results") or []
        if not resultados:
            break
        for x in resultados:
            row, det = _mc_row(x, operacion, tipo)
            if row:
                upsert(conn, row)
                upsert_detalle(conn, row["source"], row["source_id"], det)
                total += 1
        conn.commit()
        if (p + 1) * MC_PAGINA >= (data.get("totalHits") or 0):
            break
        time.sleep(DELAY)
    print(f"[metrocuadrado] {operacion}/{tipo}: {total} listings")
    return total


# ---------------------------------------------------------------- ciencuadras
#
# Ciencuadras pagina con una API que exige token y pasa por el reto de
# Cloudflare. Eso no se fuerza. Lo que sí sirve es la página renderizada en el
# servidor: trae 20 avisos y el total de la búsqueda. Una búsqueda por comuna
# (22) cubre completas las que tienen 20 o menos; en las que pasan de 20, se
# baja a búsquedas por barrio, que en Cali casi nunca pasan de 20.

CC_BASE = "https://www.ciencuadras.com"
CC_TIPO = {"apartamentos": "apartamento", "casas": "casa"}
CC_POR_PAGINA = 20


def _slug(nombre):
    return re.sub(r"[^a-z0-9]+", "-", _clave(nombre)).strip("-")


def cc_buscar(path):
    """Resultados de la página server-side, o None si no hay estado."""
    html = creq.get(CC_BASE + path, impersonate="chrome", timeout=30).text
    m = re.search(r'<script id="result-state" type="application/json">(.*?)</script>',
                  html, re.S)
    if not m:
        return None
    raw = m.group(1)
    # Angular escapa el TransferState con entidades propias.
    for a, b in (("&q;", '"'), ("&s;", "'"), ("&l;", "<"), ("&g;", ">"), ("&a;", "&")):
        raw = raw.replace(a, b)
    estado = json.loads(raw)
    clave = next((k for k in estado if k.startswith("results-")), None)
    return (estado[clave] or {}).get("data") if clave else None


def _cc_row(x, operacion, tipo):
    # Un barrio sin casas no devuelve vacío: Ciencuadras amplía la búsqueda y
    # mezcla locales, oficinas y apartamentos. Solo entra lo que calza.
    if _clave(x.get("realEstateType", "")) != CC_TIPO[tipo]:
        return None, None
    if operacion not in _clave(x.get("offerType", "")):
        return None, None
    precio = _entero(x.get("rentPrice") if operacion == "arriendo" else x.get("salePrice"))
    if not _precio_ok(operacion, precio) or str(x.get("city", "")).lower() != "cali":
        return None, None
    coords = x.get("coordinates") or {}
    amen = [n for k, n in (("gym", "Gimnasio"), ("communalPool", "Piscina"),
                           ("privatePool", "Piscina privada")) if str(x.get(k)) == "1"]
    barrio = x.get("neighborhood") or x.get("neighborhood_integrator")
    row = {
        "source": "ciencuadras", "source_id": str(x["id"]),
        "operacion": operacion, "tipo": tipo,
        "url": CC_BASE + str(x.get("url") or ""),
        "title": f"{x.get('realEstateType', '')} en {operacion} en {barrio}, Cali"[:120],
        "price_cop": precio,
        "admin_cop": _entero(x.get("adminValue")),
        "barrio": barrio, "zona": None,
        "habs": _entero(x.get("rooms")), "banos": _entero(x.get("baths")),
        "area_m2": _num(x.get("area")) or _num(x.get("privateArea")),
    }
    det = {
        "lat": _coord(coords.get("latitude")), "lng": _coord(coords.get("longitude")),
        "estrato": _entero(x.get("stratum")),
        "comuna": x.get("locality"),
        "direccion": x.get("address"),
        "amenidades": amen,
        "parqueaderos": _entero(x.get("garages")),
        "antiguedad": x.get("antiquity"),
        "publicado": x.get("createdAt"),
        "owner_tipo": x.get("userType"),
        "imagen": x.get("image"),
        "imagenes": [x["image"]] if x.get("image") else None,
    }
    return row, det


def scrape_ciencuadras(conn, operacion, tipo):
    base = f"/{operacion}/{CC_TIPO[tipo]}/cali"
    vistos, barrios_truncados = set(), set()

    def guardar(data):
        for x in (data or {}).get("results") or []:
            row, det = _cc_row(x, operacion, tipo)
            if row and row["source_id"] not in vistos:
                vistos.add(row["source_id"])
                upsert(conn, row)
                upsert_detalle(conn, row["source"], row["source_id"], det)
        conn.commit()

    def pedir(path):
        try:
            return cc_buscar(path)
        except Exception as e:
            print(f"  [ciencuadras] {path} falló: {e}", file=sys.stderr)
            return None
        finally:
            time.sleep(DELAY)

    general = pedir(base)
    if not general:
        print(f"[ciencuadras] {operacion}/{tipo}: sin respuesta")
        return 0
    guardar(general)
    esperado = general.get("total") or 0

    truncadas = []
    if esperado > CC_POR_PAGINA:
        for n in range(1, 23):
            data = pedir(f"{base}/comuna-{n}")
            guardar(data)
            if data and (data.get("total") or 0) > CC_POR_PAGINA:
                truncadas.append(f"Comuna {n}")
                barrios_truncados.update(
                    x.get("neighborhood") for x in data.get("results") or []
                    if x.get("neighborhood"))

    # Barrios a revisar: los que se vieron en comunas truncadas, más los que
    # ya conocemos de esas comunas por los otros portales.
    if truncadas:
        marcas = ",".join("?" * len(truncadas))
        barrios_truncados.update(b for (b,) in conn.execute(
            f"SELECT DISTINCT barrio FROM listings WHERE comuna IN ({marcas}) "
            f"AND barrio IS NOT NULL", truncadas))
        for slug in sorted({_slug(b) for b in barrios_truncados if b}):
            data = pedir(f"{base}/{slug}")
            # Un barrio que el portal no reconoce devuelve la búsqueda de toda
            # la ciudad: mismo total, nada nuevo.
            if data and (data.get("total") or 0) < esperado:
                guardar(data)

    print(f"[ciencuadras] {operacion}/{tipo}: {len(vistos)} de {esperado} listings")
    return len(vistos)


# ---------------------------------------------------------------- detalle

def _first_name(loc, key):
    """locations.commune / .zone vienen como lista de {id,name,slug}."""
    v = (loc or {}).get(key) or []
    if isinstance(v, list) and v:
        return v[0].get("name") if isinstance(v[0], dict) else str(v[0])
    return None


def _int(v):
    try:
        return int(float(str(v)))
    except (TypeError, ValueError):
        return None


def _img_url(x):
    """Un elemento de images[] puede ser la URL suelta o un dict que la envuelve."""
    if isinstance(x, str):
        return x or None
    if isinstance(x, dict):
        return x.get("image") or x.get("url") or None
    return None


def parse_detail(html):
    """Extrae de __NEXT_DATA__ lo que la pagina de listado no trae."""
    node = HTMLParser(html).css_first("script#__NEXT_DATA__")
    if not node:
        return None
    d = json.loads(node.text())["props"]["pageProps"]["data"]
    loc = d.get("locations") or {}
    facilities = [f["name"] for f in (d.get("facilities") or [])
                  if isinstance(f, dict) and f.get("name")]
    # La galeria entera viene en __NEXT_DATA__; antes se guardaba solo la [0].
    # Los elementos son str o dict segun el listing, asi que se normalizan.
    imgs = [u for u in (_img_url(x) for x in (d.get("images") or [])) if u]
    owner = d.get("owner") or {}
    ce = (d.get("commonExpenses") or {}).get("amount")
    out = {
        "lat": float(d["latitude"]) if d.get("latitude") else None,
        "lng": float(d["longitude"]) if d.get("longitude") else None,
        "estrato": _int(d.get("stratum")),
        "comuna": _first_name(loc, "commune"),
        "zona": _first_name(loc, "zone"),
        "direccion": d.get("address") if str(d.get("showAddress")) == "True" else None,
        "descripcion": d.get("description"),
        "amenidades": json.dumps(facilities, ensure_ascii=False) if facilities else None,
        "parqueaderos": _int(d.get("garage")),
        "piso": _int(d.get("floor")),
        "antiguedad": next((t["value"] for t in (d.get("technicalSheet") or [])
                            if t.get("field") == "constructionYear"), None),
        "estado": next((t["value"] for t in (d.get("technicalSheet") or [])
                        if t.get("field") == "construction_state_name"), None),
        "publicado": d.get("created_at"),
        "owner_nombre": owner.get("name"),
        "owner_tipo": owner.get("type"),
        # imagen se mantiene: es la portada que ya usan las tarjetas
        "imagen": imgs[0] if imgs else None,
        "imagenes": json.dumps(imgs, ensure_ascii=False) if imgs else None,
        # El listado deja el texto crudo del ancla; el detalle trae el titulo limpio
        "title": d.get("title"),
        # Campos estructurados, mas confiables que los regex del listado
        "habs": _int(d.get("bedrooms")),
        "banos": _int(d.get("bathrooms")),
        "area_m2": float(d["m2Built"]) if d.get("m2Built") else None,
        "admin_cop": _int(ce) or None,
    }
    return {k: v for k, v in out.items() if v not in (None, "")}


def enrich(conn, limit=None, redo=False):
    """Un fetch por listing. Reanudable: salta los que ya tienen detail_at."""
    q = "SELECT source, source_id, url FROM listings WHERE source='fincaraiz' AND active=1"
    if not redo:
        q += " AND detail_at IS NULL"
    q += " ORDER BY last_seen DESC"
    if limit:
        q += f" LIMIT {int(limit)}"
    rows = conn.execute(q).fetchall()
    print(f"Enriqueciendo {len(rows)} listings (~{len(rows) * DELAY / 60:.0f} min)...")
    ok = fail = 0
    for i, (source, sid, url) in enumerate(rows, 1):
        try:
            det = parse_detail(fr_fetch(url))
            if not det:
                raise ValueError("sin __NEXT_DATA__")
        except Exception as e:
            fail += 1
            print(f"  [{i}/{len(rows)}] {sid} fallo: {e}", file=sys.stderr)
            time.sleep(DELAY)
            continue
        det["detail_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        sets = ", ".join(f"{k}=?" for k in det)
        conn.execute(f"UPDATE listings SET {sets} WHERE source=? AND source_id=?",
                     list(det.values()) + [source, sid])
        ok += 1
        if i % 25 == 0:
            conn.commit()
            print(f"  {i}/{len(rows)}  ok={ok} fallos={fail}")
        time.sleep(DELAY)
    conn.commit()
    print(f"Listo: {ok} enriquecidos, {fail} fallos")


# ---------------------------------------------------------------- report

def report(conn):
    for op in OPS:
        lo, hi = SANITY[op]
        cur = conn.execute("""
            SELECT barrio, price_cop, area_m2 FROM listings
            WHERE active=1 AND operacion=? AND barrio IS NOT NULL
              AND price_cop BETWEEN ? AND ?""", (op, lo, hi))
        by_barrio = {}
        for barrio, price, area in cur:
            by_barrio.setdefault(barrio, []).append((price, area))
        rows = []
        for barrio, items in by_barrio.items():
            prices = [p for p, _ in items]
            per_m2 = [p / a for p, a in items if a and a > 10]
            rows.append({
                "operacion": op, "barrio": barrio, "n": len(items),
                "median_cop": int(median(prices)),
                "min_cop": min(prices), "max_cop": max(prices),
                "median_per_m2": int(median(per_m2)) if per_m2 else None,
            })
        rows.sort(key=lambda r: -r["n"])
        out = f"cali_{op}_report.csv"
        with open(out, "w", newline="") as f:
            if rows:
                w = csv.DictWriter(f, fieldnames=rows[0].keys())
                w.writeheader()
                w.writerows(rows)
        print(f"\n=== {op.upper()} ===  ({sum(r['n'] for r in rows)} listings)")
        print(f"{'BARRIO':<28}{'N':>4}  {'MEDIANA':>15}  {'$/m²':>11}")
        for r in rows[:25]:
            pm2 = f"{r['median_per_m2']:,}" if r["median_per_m2"] else "—"
            print(f"{r['barrio']:<28}{r['n']:>4}  {r['median_cop']:>15,}  {pm2:>11}")
        print(f"→ {out}")


# ---------------------------------------------------------------- main

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["scrape", "report", "enrich"])
    ap.add_argument("--op", choices=OPS + ["both"], default="both")
    ap.add_argument("--tipo", default="apartamentos,casas",
                    help="coma-separado: apartamentos,casas")
    ap.add_argument("--pages", type=int, default=20)
    ap.add_argument("--fuentes", default="fincaraiz,metrocuadrado,ciencuadras",
                    help="coma-separado: fincaraiz,metrocuadrado,ciencuadras,meli")
    ap.add_argument("--skip-meli", action="store_true",
                    help="obsoleto: meli ya no está en las fuentes por defecto (403)")
    ap.add_argument("--limit", type=int, help="enrich: solo N listings")
    ap.add_argument("--redo", action="store_true", help="enrich: rehacer los ya hechos")
    args = ap.parse_args()

    conn = db()
    if args.cmd == "scrape":
        ops = OPS if args.op == "both" else [args.op]
        tipos = [t.strip() for t in args.tipo.split(",") if t.strip() in TIPOS]
        fuentes = [f.strip() for f in args.fuentes.split(",") if f.strip()]
        if args.skip_meli and "meli" in fuentes:
            fuentes.remove("meli")
        cargar_barrios(conn)

        llave_mc = None
        if "metrocuadrado" in fuentes:
            try:
                llave_mc = mc_llave()
            except Exception as e:
                print(f"[metrocuadrado] sin llave de búsqueda: {e}", file=sys.stderr)

        vistos = {f: 0 for f in fuentes}
        for op in ops:
            for tipo in tipos:
                if "fincaraiz" in fuentes:
                    vistos["fincaraiz"] += scrape_fincaraiz(conn, op, tipo, args.pages)
                if "metrocuadrado" in fuentes and llave_mc:
                    vistos["metrocuadrado"] += scrape_metrocuadrado(
                        conn, op, tipo, args.pages, llave_mc)
                if "ciencuadras" in fuentes:
                    vistos["ciencuadras"] += scrape_ciencuadras(conn, op, tipo)
                if "meli" in fuentes:
                    vistos["meli"] += scrape_meli(conn, op, tipo)

        for f, n in vistos.items():
            if not n:
                print(f"AVISO: {f} devolvió 0 avisos; no se cierra nada suyo. "
                      "Revisa si cambió el portal.", file=sys.stderr)
        close_stale(conn, [f for f, n in vistos.items() if n])
        conn.commit()
        for op in OPS:
            n = conn.execute("SELECT COUNT(*) FROM listings WHERE active=1 "
                             "AND operacion=?", (op,)).fetchone()[0]
            print(f"Activos {op}: {n}")
    elif args.cmd == "enrich":
        enrich(conn, args.limit, args.redo)
    else:
        report(conn)
