#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Scraper de imágenes
==============================

Recorre los perfumes de data/catalog.json y, para cada uno con URL de Parfumo,
extrae la imagen oficial (meta og:image) y la guarda en el campo `imagen` del
mismo JSON.

ATENCIÓN
--------
- Hace UNA petición HTTP por perfume contra parfumo.com. Con 50k perfumes a
  1 req/segundo, eso son ~14 horas. Usa --limit para empezar por los más
  populares (ya están ordenados por calidad en catalog.json).
- Sé respetuoso: no bajes --delay por debajo de 0.5s ni paralelices.
- Re-ejecuciones saltan perfumes que ya tienen `imagen` -> es resumible.
- Hace checkpoint cada N perfumes para que un Ctrl-C no pierda el progreso.

USO EN OTRO EQUIPO
------------------
Este script es self-contained (solo stdlib de Python 3.6+). Para usarlo en
otra máquina:

  1. Copia este archivo + data/catalog.json a la otra máquina.
  2. Asegúrate de tener Python 3.6 o superior:  python --version
  3. Ejecuta:
        python fetch_images.py --catalog catalog.json --limit 3000
     (o sin --limit para procesar todo)
  4. Cuando termine, copia el catalog.json actualizado de vuelta al
     proyecto, en data/catalog.json.

EJEMPLOS
--------
  # Top 3000 por calidad (50-60 min a 1 req/s)
  python scripts/fetch_images.py --limit 3000

  # Catalog específico, salida a otro fichero
  python scripts/fetch_images.py --catalog mi_cat.json --out mi_cat_imgs.json

  # Reanudar tras una interrupción (salta los que ya tienen imagen)
  python scripts/fetch_images.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# stdout UTF-8 para que la consola de Windows no pete con caracteres unicode.
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, OSError):
        pass

USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)

# <meta property="og:image" content="https://..."> (admite comillas " o ')
OG_IMAGE_RE = re.compile(
    r'<meta\s+(?:[^>]*?\s+)?property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
# Fallback: <meta name="twitter:image" ...>
TW_IMAGE_RE = re.compile(
    r'<meta\s+(?:[^>]*?\s+)?name=["\']twitter:image["\']\s+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)

# Patrón sospechoso de imagen genérica de Parfumo (logo / fallback) que NO
# queremos guardar como foto del perfume.
GENERIC_URL_SUBSTRINGS = ('favicon', 'logo', 'placeholder', 'noimage', 'no-image')


def looks_like_real_image(url: str) -> bool:
    if not url:
        return False
    lu = url.lower()
    if any(s in lu for s in GENERIC_URL_SUBSTRINGS):
        return False
    return lu.startswith('http')


def fetch_image_url(url: str, timeout: float = 15.0) -> str | None:
    """Descarga la página y extrae og:image (con fallback a twitter:image).
    Devuelve None si falla la red, la página no la encuentra, o no hay og.
    """
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Accept-Encoding': 'identity',  # evita gzip que urllib no descomprime
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            # Solo necesitamos el <head>, así que cortamos a 200 KB.
            raw = resp.read(200 * 1024)
            html = raw.decode('utf-8', errors='ignore')
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        return None

    m = OG_IMAGE_RE.search(html)
    if not m:
        m = TW_IMAGE_RE.search(html)
    if not m:
        return None
    cand = m.group(1).strip()
    return cand if looks_like_real_image(cand) else None


def save_atomic(data: dict, path: Path) -> None:
    """Escribe el JSON a un fichero temporal y lo renombra. Evita corrupción
    si el proceso muere a mitad de escritura."""
    tmp = path.with_suffix(path.suffix + '.tmp')
    with tmp.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    tmp.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser(
        description='Scraper de imágenes oficiales de Parfumo para Top Note.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument(
        '--catalog',
        default='data/catalog.json',
        help='Ruta al catalog.json (default: data/catalog.json).',
    )
    ap.add_argument(
        '--out',
        default=None,
        help='Ruta de salida. Si no se indica, escribe in-place sobre --catalog.',
    )
    ap.add_argument(
        '--limit',
        type=int,
        default=0,
        help='Procesa solo los primeros N perfumes que aún no tienen imagen '
             '(están ordenados por calidad). 0 = sin límite.',
    )
    ap.add_argument(
        '--delay',
        type=float,
        default=1.0,
        help='Segundos entre peticiones. Sé respetuoso: >= 0.5s recomendado.',
    )
    ap.add_argument(
        '--retry',
        type=int,
        default=2,
        help='Reintentos por perfume tras fallo de red.',
    )
    ap.add_argument(
        '--checkpoint',
        type=int,
        default=100,
        help='Guarda progreso cada N perfumes procesados.',
    )
    ap.add_argument(
        '--workers',
        type=int,
        default=1,
        help='Número de workers en paralelo (default 1).',
    )
    args = ap.parse_args()

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
    already_done = sum(1 for p in perfumes if p.get('imagen'))
    todo_indices = [
        i for i, p in enumerate(perfumes)
        if p.get('url') and not p.get('imagen')
    ]
    if args.limit and args.limit > 0:
        todo_indices = todo_indices[: args.limit]

    if not todo_indices:
        print('  Nada por procesar. Todos los perfumes con URL ya tienen imagen.')
        return 0

    workers = max(1, args.workers)
    eta_min = len(todo_indices) * args.delay / 60.0 / workers
    print(f'· Total en catálogo : {total}', flush=True)
    print(f'· Ya con imagen     : {already_done}', flush=True)
    print(f'· A procesar        : {len(todo_indices)}', flush=True)
    print(f'· Workers           : {workers}', flush=True)
    print(f'· Delay/worker      : {args.delay}s', flush=True)
    print(f'· ETA               : ~{eta_min:.0f} min ({eta_min/60:.1f} h)', flush=True)
    print('', flush=True)

    lock = threading.Lock()
    counters = {'success': 0, 'fail': 0, 'done': 0, 'last_save': 0}

    def process(perfume_i: int) -> None:
        perfume = perfumes[perfume_i]
        url = perfume['url']
        img = None
        for attempt in range(args.retry + 1):
            img = fetch_image_url(url)
            if img:
                break
            if attempt < args.retry:
                time.sleep(args.delay * 2)

        with lock:
            if img:
                perfume['imagen'] = img
                counters['success'] += 1
            else:
                counters['fail'] += 1
                perfume['imagen_intentos'] = (perfume.get('imagen_intentos', 0) or 0) + 1

            counters['done'] += 1
            done = counters['done']
            total_todo = len(todo_indices)

            if done % 20 == 0 or done == total_todo:
                pct = 100 * done // total_todo
                print(
                    f'  {pct:3d}% ({done}/{total_todo}) '
                    f'· ok: {counters["success"]} · fail: {counters["fail"]}',
                    flush=True,
                )

            if done - counters['last_save'] >= args.checkpoint:
                save_atomic(data, out_path)
                counters['last_save'] = done

        time.sleep(args.delay)

    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(process, i) for i in todo_indices]
            for f in as_completed(futures):
                f.result()
    except KeyboardInterrupt:
        print('\n  ! Interrumpido por usuario. Guardando progreso…', flush=True)

    save_atomic(data, out_path)
    print(
        f'\n[OK] Hecho. ok: {counters["success"]} · fail: {counters["fail"]} · escrito en {out_path}',
        flush=True,
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
