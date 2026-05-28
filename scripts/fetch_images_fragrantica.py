#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Scraper de imágenes — Fragrantica (vía Bing + DuckDuckGo)
====================================================================

Busca cada perfume en Fragrantica usando Bing HTML (primario) con
fallback a DuckDuckGo. Extrae el ID numérico del CDN de Fragrantica
(fimgs.net) — fotos de frasco sin marcas de agua.

Estrategia:
  1. Busca en Bing:  "fragrantica <nombre> <casa>"
  2. Si falla, busca en DuckDuckGo
  3. Extrae el ID numérico del link fragrantica.com/perfume/…-<ID>.html
  4. Construye:  https://fimgs.net/mdimg/perfume/<ID>.jpg

EJEMPLOS
--------
  # Top 500 perfumes sin imagen (recomendado para empezar)
  python scripts/fetch_images_fragrantica.py --limit 500

  # Reemplazar TODAS las imágenes con las de Fragrantica
  python scripts/fetch_images_fragrantica.py --all

  # Guardar en campo separado
  python scripts/fetch_images_fragrantica.py --field imagen_frag --limit 1000

NOTAS
-----
  - Delay aleatorio entre 2-4 s por defecto para evitar bloqueos.
  - Detecta bloqueos automáticamente y hace pausa larga.
  - Es resumible: re-ejecutar salta los que ya tienen imagen.
  - Checkpoint cada 50 perfumes.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, OSError):
        pass

# ── URLs de búsqueda ─────────────────────────────────────────────────────────
BING_URL = 'https://www.bing.com/search?q={query}&format=rss'
DDG_URL  = 'https://html.duckduckgo.com/html/?q={query}'
CDN_URL  = 'https://fimgs.net/mdimg/perfume/375x500.{frag_id}.jpg'

FRAG_HREF_RE = re.compile(
    r'fragrantica\.com(?:%2F|/)'
    r'perfume(?:%2F|/)'
    r'[^"\'\s<>&?]+'
    r'[/-](\d{3,6})'
    r'(?:%2E|\.)'
    r'html',
    re.IGNORECASE,
)

_CONC_SUFFIXES = re.compile(
    r'\s+(?:eau\s+de\s+(?:parfum|toilette|cologne)|extrait(?:\s+de\s+parfum)?'
    r'|parfum\s+pour\s+cheveux|parfum|cologne|edp|edt|edc|hair\s+mist'
    r'|body\s+(?:lotion|cream|mist)|shower\s+gel|soap|candle|solid'
    r'|oil|perfume\s+oil|rollerball|travel\s+spray|\bna\b)\s*$',
    re.IGNORECASE,
)
_YEAR_RE = re.compile(r'\s+(?:19|20)\d{2}\s*$')

# User-agents rotativos para evitar detección
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]

# Estado de bloqueo por motor de búsqueda
_blocked = {'bing': False, 'ddg': False}
_block_until = {'bing': 0.0, 'ddg': 0.0}


def _headers(referer: str = '') -> dict:
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Referer': referer,
    }


def _get(url: str, timeout: float = 15.0) -> str | None:
    req = urllib.request.Request(url, headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            if r.status == 202:
                return None  # bloqueo / challenge
            return r.read(300 * 1024).decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        if e.code in (202, 403, 429):
            return None
        return None
    except Exception:
        return None


def _is_blocked(html: str | None) -> bool:
    if html is None:
        return True
    low = html.lower()
    return any(s in low for s in ('captcha', 'are you a human', 'unusual traffic', 'robot', 'access denied'))


def _clean_nombre(nombre: str, casa: str) -> str:
    n = nombre.strip()
    if ' - ' in n:
        n = max(n.split(' - ', 1), key=len).strip()
    n = _YEAR_RE.sub('', n).strip()
    n = _CONC_SUFFIXES.sub('', n).strip()
    n = re.sub(r'\s+' + re.escape(casa.strip()) + r'\s*$', '', n, flags=re.IGNORECASE).strip()
    return n or nombre


def _search_bing(nombre: str, casa: str) -> str | None:
    if time.time() < _block_until['bing']:
        return None
    nombre_clean = _clean_nombre(nombre, casa)
    for query_raw in [f'fragrantica {nombre_clean} {casa}', f'fragrantica {nombre_clean}']:
        query = urllib.parse.quote_plus(query_raw)
        html = _get(BING_URL.format(query=query))
        if _is_blocked(html):
            _block_until['bing'] = time.time() + 300  # pausa 5 min
            print('  [!] Bing bloqueado, pausa 5 min', flush=True)
            return None
        if html:
            m = FRAG_HREF_RE.search(html)
            if m:
                return m.group(1)
        time.sleep(random.uniform(0.5, 1.0))
    return None


def _search_ddg(nombre: str, casa: str) -> str | None:
    if time.time() < _block_until['ddg']:
        return None
    nombre_clean = _clean_nombre(nombre, casa)
    for query_raw in [f'fragrantica {nombre_clean} {casa}', f'fragrantica {nombre_clean}']:
        query = urllib.parse.quote_plus(query_raw)
        html = _get(DDG_URL.format(query=query))
        if _is_blocked(html):
            _block_until['ddg'] = time.time() + 300
            print('  [!] DuckDuckGo bloqueado, pausa 5 min', flush=True)
            return None
        if html:
            m = FRAG_HREF_RE.search(html)
            if m:
                return m.group(1)
        time.sleep(random.uniform(0.5, 1.0))
    return None


def find_fragrantica_id(nombre: str, casa: str) -> str | None:
    frag_id = _search_bing(nombre, casa)
    if frag_id:
        return frag_id
    time.sleep(random.uniform(0.5, 1.2))
    return _search_ddg(nombre, casa)


def _head_ok(url: str, timeout: float = 10.0) -> bool:
    req = urllib.request.Request(url, method='HEAD', headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def save_atomic(data: dict, path: Path) -> None:
    tmp = path.with_suffix(path.suffix + '.tmp')
    with tmp.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    tmp.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser(
        description='Scraper de imágenes Fragrantica (Bing + DDG) para Top Note.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument('--catalog', default='data/catalog.json')
    ap.add_argument('--out', default=None)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--delay', type=float, default=2.5,
                    help='Delay base entre búsquedas en segundos (default 2.5, se añade jitter ±1s).')
    ap.add_argument('--checkpoint', type=int, default=50)
    ap.add_argument('--all', dest='replace_all', action='store_true',
                    help='Reemplaza imágenes ya existentes.')
    ap.add_argument('--field', default='imagen')
    ap.add_argument('--verify', action='store_true',
                    help='Verifica con HEAD que la imagen existe antes de guardar.')
    args = ap.parse_args()
    args.delay = max(args.delay, 1.5)

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
    todo = list(range(total)) if args.replace_all else [
        i for i, p in enumerate(perfumes) if not p.get(args.field)
    ]
    if args.limit > 0:
        todo = todo[:args.limit]

    if not todo:
        print(f'  Nada por procesar. Todos ya tienen imagen en "{args.field}". Usa --all para sobreescribir.')
        return 0

    eta_min = len(todo) * args.delay / 60.0
    print(f'· Total        : {total}', flush=True)
    print(f'· Ya con imagen: {already_done}', flush=True)
    print(f'· A procesar   : {len(todo)}', flush=True)
    print(f'· Campo destino: {args.field}', flush=True)
    print(f'· Delay base   : {args.delay}s ± 1s (aleatorio)', flush=True)
    print(f'· ETA          : ~{eta_min:.0f} min ({eta_min/60:.1f} h)', flush=True)
    print(f'· Motores      : Bing (primario) → DuckDuckGo (fallback)', flush=True)
    print('', flush=True)

    ok = fail = 0
    last_save = 0

    try:
        for n, perfume_idx in enumerate(todo):
            p = perfumes[perfume_idx]
            nombre = p.get('nombre', '')
            casa   = p.get('casa', '')

            frag_id = find_fragrantica_id(nombre, casa)
            img = None

            if frag_id:
                candidate = CDN_URL.format(frag_id=frag_id)
                if args.verify:
                    if _head_ok(candidate):
                        img = candidate
                else:
                    img = candidate

            if img:
                p[args.field] = img
                ok += 1
            else:
                fail += 1

            if (n + 1) % 20 == 0 or (n + 1) == len(todo):
                pct = 100 * (n + 1) // len(todo)
                bing_status = 'OK' if time.time() >= _block_until['bing'] else 'PAUSA'
                ddg_status  = 'OK' if time.time() >= _block_until['ddg']  else 'PAUSA'
                print(
                    f'  {pct:3d}%  ({n+1}/{len(todo)})'
                    f'  ok:{ok}  fail:{fail}'
                    f'  [Bing:{bing_status} DDG:{ddg_status}]',
                    flush=True,
                )

            if (n + 1) - last_save >= args.checkpoint:
                save_atomic(data, out_path)
                last_save = n + 1

            if n + 1 < len(todo):
                jitter = random.uniform(-1.0, 1.0)
                time.sleep(max(1.0, args.delay + jitter))

    except KeyboardInterrupt:
        print('\n  ! Interrumpido. Guardando progreso…', flush=True)

    save_atomic(data, out_path)
    print(f'\n[OK] Terminado.  ok:{ok}  fail:{fail}  → {out_path}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
