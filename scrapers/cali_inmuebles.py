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

import argparse, csv, json, re, sqlite3, sys, time
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
    return conn


def upsert(conn, row):
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    conn.execute("""
        INSERT INTO listings VALUES
            (:source,:source_id,:operacion,:tipo,:url,:title,:price_cop,:admin_cop,
             :barrio,:zona,:habs,:banos,:area_m2,:now,:now,1)
        ON CONFLICT(source,source_id) DO UPDATE SET
            price_cop=excluded.price_cop, last_seen=excluded.last_seen, active=1
        """, {**row, "now": now})


def close_stale(conn):
    conn.execute("UPDATE listings SET active=0 "
                 "WHERE julianday('now')-julianday(last_seen) > 7")


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
    ap.add_argument("cmd", choices=["scrape", "report"])
    ap.add_argument("--op", choices=OPS + ["both"], default="both")
    ap.add_argument("--tipo", default="apartamentos,casas",
                    help="coma-separado: apartamentos,casas")
    ap.add_argument("--pages", type=int, default=20)
    ap.add_argument("--skip-meli", action="store_true")
    args = ap.parse_args()

    conn = db()
    if args.cmd == "scrape":
        ops = OPS if args.op == "both" else [args.op]
        tipos = [t.strip() for t in args.tipo.split(",") if t.strip() in TIPOS]
        for op in ops:
            for tipo in tipos:
                scrape_fincaraiz(conn, op, tipo, args.pages)
                if not args.skip_meli:
                    scrape_meli(conn, op, tipo)
        close_stale(conn)
        conn.commit()
        for op in OPS:
            n = conn.execute("SELECT COUNT(*) FROM listings WHERE active=1 "
                             "AND operacion=?", (op,)).fetchone()[0]
            print(f"Activos {op}: {n}")
    else:
        report(conn)
