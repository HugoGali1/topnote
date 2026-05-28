#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Scraper de imágenes — Fragrantica por marca
======================================================

En lugar de buscar cada perfume en un motor de búsqueda, accede
directamente a las páginas de marca de Fragrantica para extraer
todos los IDs de perfumes de golpe.

Estrategia:
  1. Para cada marca única del catálogo, visita su página en
     Fragrantica (fragrantica.com/designers/{slug}.html)
  2. Extrae todos los pares nombre→ID de esa página
  3. Cruza con el catálogo local por similitud de nombre
  4. Construye URL CDN: https://fimgs.net/mdimg/perfume/{ID}.jpg

Ventajas:
  - ~1 petición HTTP por marca (no por perfume)
  - Sin motores de búsqueda → sin bloqueos
  - ~1330 marcas = ~45 min totales

EJEMPLOS
--------
  # Ejecutar completo (recomendado)
  python scripts/fetch_images_by_brand.py

  # Solo las N marcas con más perfumes
  python scripts/fetch_images_by_brand.py --top-brands 100

  # Solo marcas concretas
  python scripts/fetch_images_by_brand.py --brands "Dior,Chanel,Guerlain"

  # Sobreescribir imágenes existentes
  python scripts/fetch_images_by_brand.py --all
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, OSError):
        pass

CDN_URL = 'https://fimgs.net/mdimg/perfume/375x500.{id}.jpg'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Referer': 'https://www.fragrantica.com/',
}

# Regex para extraer href /perfume/Brand/Name-ID.html
PERFUME_RE = re.compile(
    r'href="(/perfume/([^/]+)/([^"]+?)-(\d{4,6})\.html)"',
    re.IGNORECASE,
)

# Sufijos de concentración a eliminar para normalizar nombres
_CONC = re.compile(
    r'\s+(?:eau\s+de\s+(?:parfum|toilette|cologne)|extrait(?:\s+de\s+parfum)?'
    r'|parfum|cologne|edp|edt|edc|parfum\s+pour\s+cheveux'
    r'|body\s+(?:lotion|cream|mist)|shower\s+gel|\bna\b)\s*$',
    re.IGNORECASE,
)
_YEAR = re.compile(r'\s+(?:19|20)\d{2}\s*$')


def normalize(text: str) -> str:
    """Normaliza nombre para comparación: minúsculas, sin acentos, sin chars especiales."""
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = _YEAR.sub('', text).strip()
    text = _CONC.sub('', text).strip()
    return text


def brand_to_slug(casa: str) -> list[str]:
    """Genera variantes de slug de Fragrantica a partir del nombre de marca."""
    # Normalizar: reemplazar caracteres especiales y acentos
    s = unicodedata.normalize('NFD', casa)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.strip()

    # Versión principal: espacios → guiones
    slug1 = re.sub(r'[^a-zA-Z0-9\-]', '-', s)
    slug1 = re.sub(r'-+', '-', slug1).strip('-')

    # Versión sin guiones intermedios (todo junto)
    slug2 = re.sub(r'[^a-zA-Z0-9]', '', s)

    # Versión con '+' para marcas como "Bath & Body Works"
    slug3 = re.sub(r'\s*&\s*', '-and-', s)
    slug3 = re.sub(r'[^a-zA-Z0-9\-]', '-', slug3)
    slug3 = re.sub(r'-+', '-', slug3).strip('-')

    slugs = []
    for sl in [slug1, slug2, slug3]:
        if sl and sl not in slugs:
            slugs.append(sl)
    return slugs


def get_brand_page(slug: str, timeout: float = 15.0) -> str | None:
    url = f'https://www.fragrantica.com/designers/{slug}.html'
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status == 200:
                    return r.read(500 * 1024).decode('utf-8', errors='ignore')
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 90 + attempt * 30
                print(f'    429 rate limit — esperando {wait}s…', flush=True)
                time.sleep(wait)
                continue
            if e.code not in (404, 403):
                print(f'    HTTP {e.code} para {slug}', flush=True)
            return None
        except Exception:
            return None
    return None


def parse_brand_perfumes(html: str) -> dict[str, str]:
    """Devuelve {normalized_name: frag_id} desde la página HTML de marca."""
    perfumes = {}
    for _href, _brand, name_slug, frag_id in PERFUME_RE.findall(html):
        # name_slug es algo como "Gris-Charnel-Extrait" → "gris charnel extrait"
        name = name_slug.replace('-', ' ')
        key = normalize(name)
        if key:
            perfumes[key] = frag_id
    return perfumes


def save_atomic(data: dict, path: Path) -> None:
    tmp = path.with_suffix(path.suffix + '.tmp')
    with tmp.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    tmp.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser(
        description='Scraper de imágenes Fragrantica por marca para Top Note.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument('--catalog', default='data/catalog.json')
    ap.add_argument('--out', default=None)
    ap.add_argument('--field', default='imagen')
    ap.add_argument('--all', dest='replace_all', action='store_true',
                    help='Sobreescribir imágenes ya existentes.')
    ap.add_argument('--top-brands', type=int, default=0,
                    help='Procesar solo las N marcas con más perfumes.')
    ap.add_argument('--brands', default='',
                    help='Lista de marcas separadas por coma.')
    ap.add_argument('--delay', type=float, default=2.5,
                    help='Delay entre peticiones a Fragrantica (default 2.5s).')
    ap.add_argument('--checkpoint', type=int, default=200)
    args = ap.parse_args()

    catalog_path = Path(args.catalog)
    out_path = Path(args.out) if args.out else catalog_path

    if not catalog_path.exists():
        sys.exit(f'ERROR: no se encuentra {catalog_path}')

    print(f'· Leyendo {catalog_path}…', flush=True)
    with catalog_path.open('r', encoding='utf-8') as f:
        data = json.load(f)

    perfumes = data.get('perfumes', [])

    # Agrupar perfumes por marca
    by_brand: dict[str, list[int]] = {}
    for i, p in enumerate(perfumes):
        if args.replace_all or not p.get(args.field):
            casa = p.get('casa', '')
            if casa:
                by_brand.setdefault(casa, []).append(i)

    # Filtrar marcas si se especificó
    if args.brands:
        wanted = {b.strip() for b in args.brands.split(',')}
        by_brand = {k: v for k, v in by_brand.items() if k in wanted}

    # Ordenar por número de perfumes (de mayor a menor)
    brand_list = sorted(by_brand.items(), key=lambda x: -len(x[1]))
    if args.top_brands > 0:
        brand_list = brand_list[:args.top_brands]

    total_brands = len(brand_list)
    total_perfumes = sum(len(v) for _, v in brand_list)
    eta_min = total_brands * args.delay / 60.0

    print(f'· Marcas a procesar : {total_brands}', flush=True)
    print(f'· Perfumes sin imagen: {total_perfumes}', flush=True)
    print(f'· ETA aprox.        : ~{eta_min:.0f} min', flush=True)
    print(f'· Campo destino     : {args.field}', flush=True)
    print('', flush=True)

    ok_brands = 0
    fail_brands = 0
    ok_images = 0
    processed = 0
    last_save = 0

    for brand_n, (casa, perf_indices) in enumerate(brand_list):
        slugs = brand_to_slug(casa)
        html = None
        used_slug = None

        for slug in slugs:
            html = get_brand_page(slug)
            if html:
                used_slug = slug
                break
            time.sleep(0.3)

        if not html:
            fail_brands += 1
            pct = 100 * (brand_n + 1) // total_brands
            print(f'  [{pct:3d}%] {casa}: sin página en Fragrantica', flush=True)
            continue

        # Extraer perfumes de la página de marca
        brand_perfumes = parse_brand_perfumes(html)
        ok_brands += 1

        # Cruzar con nuestro catálogo
        matched = 0
        for idx in perf_indices:
            p = perfumes[idx]
            nombre_raw = p.get('nombre', '')
            # Eliminar el nombre de la casa del nombre del perfume si aparece
            nombre_clean = re.sub(re.escape(casa), '', nombre_raw, flags=re.IGNORECASE).strip()
            key = normalize(nombre_clean)

            frag_id = brand_perfumes.get(key)

            # Si no coincide exacto, buscar por similitud (starts_with)
            if not frag_id:
                for bkey, bid in brand_perfumes.items():
                    if key and bkey and (bkey.startswith(key) or key.startswith(bkey)):
                        frag_id = bid
                        break

            if frag_id:
                p[args.field] = CDN_URL.format(id=frag_id)
                ok_images += 1
                matched += 1

        processed += 1
        pct = 100 * (brand_n + 1) // total_brands
        print(
            f'  [{pct:3d}%] {casa} ({used_slug}): '
            f'{len(brand_perfumes)} en Fragrantica, '
            f'{matched}/{len(perf_indices)} matched',
            flush=True,
        )

        # Checkpoint
        if processed - last_save >= args.checkpoint // 10:
            save_atomic(data, out_path)
            last_save = processed

        time.sleep(args.delay + random.uniform(-0.5, 0.5))

    save_atomic(data, out_path)
    print(f'\n[OK] Terminado.', flush=True)
    print(f'  Marcas procesadas : {ok_brands}/{total_brands}', flush=True)
    print(f'  Imágenes asignadas: {ok_images}', flush=True)
    print(f'  Escrito en        : {out_path}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
