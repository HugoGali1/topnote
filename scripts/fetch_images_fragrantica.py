#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Scraper de imágenes — Fragrantica (vía DuckDuckGo)
=============================================================

Busca cada perfume en Fragrantica usando DuckDuckGo HTML y extrae la
imagen oficial del frasco desde el CDN de Fragrantica (fimgs.net).
Las imágenes son fotos de prensa sin marcas de agua.

Estrategia (1 petición por perfume):
  1. Busca en DuckDuckGo HTML:  "fragrantica <nombre> <casa>"
  2. Extrae el primer link fragrantica.com/perfume/…
  3. Saca el ID numérico del final de la URL  (p.ej. -33519.html → 33519)
  4. Construye la URL del CDN:  https://fimgs.net/mdimg/perfume-social-cards/en-social-<ID>.jpeg

Ventajas frente al script de Parfumo:
  - Fotos de prensa HD, sin marcas de agua
  - Solo una petición HTTP por perfume
  - No accede directamente a Fragrantica (evita su Cloudflare)

EJEMPLOS
--------
  # Solo perfumes sin imagen aún (top 3000 por calidad)
  python scripts/fetch_images_fragrantica.py --limit 3000

  # Reemplazar TODAS las imágenes con las de Fragrantica
  python scripts/fetch_images_fragrantica.py --all

  # Guardar en campo separado sin tocar el campo "imagen"
  python scripts/fetch_images_fragrantica.py --field imagen_frag --limit 1000

  # Modo rápido (si DuckDuckGo no te rate-limita)
  python scripts/fetch_images_fragrantica.py --delay 1.0 --limit 500

NOTAS
-----
  - Delay mínimo recomendado: 1.0 s (DuckDuckGo es generoso pero no abuses).
  - Es resumible: re-ejecutar salta los que ya tienen imagen en el campo elegido.
  - Checkpoint cada 50 perfumes por si interrumpes con Ctrl-C.
  - Si DuckDuckGo devuelve 202 / CAPTCHA, sube el --delay o espera unos minutos.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# ── Codificación UTF-8 en Windows ──────────────────────────────────────────
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, OSError):
        pass

# ── Constantes ──────────────────────────────────────────────────────────────
DDG_URL  = 'https://html.duckduckgo.com/html/?q={query}'
CDN_URL  = 'https://fimgs.net/mdimg/perfume/{frag_id}.jpg'

# Regex para extraer links /perfume/…<id>.html de la página de DDG
FRAG_HREF_RE = re.compile(
    r'fragrantica\.com(?:%2F|/)'      # dominio
    r'perfume(?:%2F|/)'               # /perfume/
    r'[^"\'\s<>&?]+'                   # brand/name
    r'[/-](\d{3,6})'                  # -<ID>
    r'(?:%2E|\.)'                     # .
    r'html',                          # html
    re.IGNORECASE,
)

# Sufijos de concentración que aparecen al final del nombre en el catálogo
_CONC_SUFFIXES = re.compile(
    r'\s+(?:eau\s+de\s+(?:parfum|toilette|cologne)|extrait(?:\s+de\s+parfum)?'
    r'|parfum\s+pour\s+cheveux|parfum|cologne|edp|edt|edc|hair\s+mist'
    r'|body\s+(?:lotion|cream|mist)|shower\s+gel|soap|candle|solid'
    r'|oil|perfume\s+oil|rollerball|travel\s+spray'
    r'|\bna\b)\s*$',
    re.IGNORECASE,
)
# Años de cuatro dígitos (1900-2099) al final del nombre
_YEAR_RE = re.compile(r'\s+(?:19|20)\d{2}\s*$')


def _clean_nombre(nombre: str, casa: str) -> str:
    """
    Limpia el nombre del perfume para optimizar la búsqueda en DDG:
      - Elimina el año del final: "Gris Charnel 2022 Extrait" → "Gris Charnel Extrait"
      - Elimina la concentración: "Bouquet Ideale Eau de Parfum" → "Bouquet Ideale"
      - Elimina el nombre de la casa si aparece dentro del nombre
        (ocurre cuando Parfumo lo incluye): "Gris Charnel bdk Parfums" → "Gris Charnel"
      - Elimina guiones/dash decorativos al inicio: "Casamorati - Bouquet" → "Bouquet"
    """
    n = nombre.strip()

    # Quitar "Casa - Nombre" si empieza con algo parecido a la casa
    # p.ej. "Casamorati - Bouquet Ideale XerJoff 2009 Eau de Parfum"
    if ' - ' in n:
        parts = n.split(' - ', 1)
        # Quedarse con la parte más larga (el nombre real)
        n = max(parts, key=len).strip()

    # Quitar año
    n = _YEAR_RE.sub('', n).strip()

    # Quitar concentración al final
    n = _CONC_SUFFIXES.sub('', n).strip()

    # Quitar nombre de la casa si está dentro del nombre (insensible)
    # Fragrantica no lo incluye en el slug, así que lo quitamos para el match
    casa_words = re.escape(casa.strip())
    n = re.sub(r'\s+' + casa_words + r'\s*$', '', n, flags=re.IGNORECASE).strip()

    return n or nombre  # fallback al original si quedó vacío

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'identity',
}


# ── Helpers ─────────────────────────────────────────────────────────────────

def _get(url: str, timeout: float = 15.0) -> str | None:
    """Descarga URL y devuelve HTML/texto, o None si falla."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(250 * 1024).decode('utf-8', errors='ignore')
    except Exception:
        return None


def _ddg_search_fragrantica_id(nombre: str, casa: str) -> str | None:
    """
    Busca en DuckDuckGo 'fragrantica <nombre_limpio> <casa>' y devuelve
    el ID numérico del primer resultado de Fragrantica.
    Si falla, reintenta con una query más corta (solo palabras principales).
    Devuelve None si no encuentra nada.
    """
    nombre_clean = _clean_nombre(nombre, casa)

    queries = [
        f'fragrantica {nombre_clean} {casa}',       # query principal (limpia)
        f'fragrantica {nombre_clean}',               # sin casa (más amplio)
        f'site:fragrantica.com {nombre_clean} {casa}',  # con operador site:
    ]

    for query_raw in queries:
        query = urllib.parse.quote_plus(query_raw)
        url = DDG_URL.format(query=query)
        html = _get(url)
        if html:
            m = FRAG_HREF_RE.search(html)
            if m:
                return m.group(1)
        time.sleep(0.5)   # pequeña pausa entre reintentos de query

    return None


def _image_url(frag_id: str) -> str:
    return CDN_URL.format(frag_id=frag_id)


def _head_ok(url: str, timeout: float = 10.0) -> bool:
    """Comprueba que la URL devuelve 200 (HEAD request)."""
    req = urllib.request.Request(url, method='HEAD', headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def save_atomic(data: dict, path: Path) -> None:
    """Escribe JSON de forma atómica para evitar corrupción en Ctrl-C."""
    tmp = path.with_suffix(path.suffix + '.tmp')
    with tmp.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    tmp.replace(path)


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(
        description='Scraper de imágenes Fragrantica (vía DuckDuckGo) para Top Note.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument(
        '--catalog', default='data/catalog.json',
        help='Ruta al catalog.json (default: data/catalog.json).',
    )
    ap.add_argument(
        '--out', default=None,
        help='Fichero de salida. Si se omite, escribe in-place sobre --catalog.',
    )
    ap.add_argument(
        '--limit', type=int, default=0,
        help='Procesa solo los primeros N perfumes pendientes. 0 = sin límite.',
    )
    ap.add_argument(
        '--delay', type=float, default=1.5,
        help='Segundos entre peticiones a DuckDuckGo (default 1.5, min 1.0).',
    )
    ap.add_argument(
        '--retry', type=int, default=2,
        help='Reintentos por perfume si falla la búsqueda.',
    )
    ap.add_argument(
        '--checkpoint', type=int, default=50,
        help='Guarda progreso cada N perfumes (default 50).',
    )
    ap.add_argument(
        '--all', dest='replace_all', action='store_true',
        help='Reemplaza imágenes ya existentes. Por defecto solo rellena vacías.',
    )
    ap.add_argument(
        '--field', default='imagen',
        help='Campo del JSON donde guardar la imagen (default: imagen).',
    )
    ap.add_argument(
        '--verify', action='store_true',
        help='Hace un HEAD request para confirmar que la imagen existe antes de guardar.',
    )
    args = ap.parse_args()
    args.delay = max(args.delay, 1.0)   # respetar DDG

    catalog_path = Path(args.catalog)
    out_path = Path(args.out) if args.out else catalog_path

    if not catalog_path.exists():
        sys.exit(f'ERROR: no se encuentra {catalog_path}')

    print(f'· Leyendo {catalog_path}…', flush=True)
    with catalog_path.open('r', encoding='utf-8') as f:
        data = json.load(f)

    perfumes = data.get('perfumes')
    if not isinstance(perfumes, list):
        sys.exit('ERROR: el JSON no contiene un array "perfumes".')

    total = len(perfumes)
    already_done = sum(1 for p in perfumes if p.get(args.field))

    if args.replace_all:
        todo = list(range(total))
    else:
        todo = [i for i, p in enumerate(perfumes) if not p.get(args.field)]

    if args.limit > 0:
        todo = todo[:args.limit]

    if not todo:
        print('  Nada por procesar. Todos ya tienen imagen en el campo '
              f'"{args.field}". Usa --all para sobreescribir.')
        return 0

    # ETA: 1 petición DDG por perfume (más opcional HEAD)
    req_per = 1 + (1 if args.verify else 0)
    eta_min = len(todo) * args.delay * req_per / 60.0

    print(f'· Total en catálogo : {total}', flush=True)
    print(f'· Ya con imagen     : {already_done}', flush=True)
    print(f'· A procesar        : {len(todo)}', flush=True)
    print(f'· Campo destino     : {args.field}', flush=True)
    print(f'· Delay/petición    : {args.delay}s', flush=True)
    print(f'· ETA aproximada    : ~{eta_min:.0f} min ({eta_min/60:.1f} h)', flush=True)
    print('', flush=True)

    ok = fail = 0
    last_save = 0

    try:
        for n, perfume_idx in enumerate(todo):
            p = perfumes[perfume_idx]
            nombre = p.get('nombre', '')
            casa   = p.get('casa', '')

            frag_id = None
            img     = None

            for attempt in range(args.retry + 1):
                frag_id = _ddg_search_fragrantica_id(nombre, casa)
                if frag_id:
                    break
                if attempt < args.retry:
                    time.sleep(args.delay * 2)   # backoff extra

            if frag_id:
                candidate = _image_url(frag_id)
                if args.verify:
                    time.sleep(args.delay * 0.5)
                    if _head_ok(candidate):
                        img = candidate
                else:
                    img = candidate

            if img:
                p[args.field] = img
                ok += 1
            else:
                fail += 1

            # Progreso cada 20 perfumes
            if (n + 1) % 20 == 0 or (n + 1) == len(todo):
                pct = 100 * (n + 1) // len(todo)
                print(
                    f'  {pct:3d}%  ({n+1}/{len(todo)})'
                    f'  ok: {ok}  fail: {fail}',
                    flush=True,
                )

            # Checkpoint
            if (n + 1) - last_save >= args.checkpoint:
                save_atomic(data, out_path)
                last_save = n + 1

            # Pausa entre peticiones
            if n + 1 < len(todo):
                time.sleep(args.delay)

    except KeyboardInterrupt:
        print('\n  ! Interrumpido por usuario. Guardando progreso…', flush=True)

    save_atomic(data, out_path)
    print(
        f'\n[OK] Terminado.  ok: {ok}  ·  fail: {fail}'
        f'  ·  escrito en {out_path}',
        flush=True,
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
