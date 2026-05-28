#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Recuperar imágenes faltantes (brand_core)
====================================================

Pasada adicional sobre los perfumes SIN imagen, usando la normalización
de marca tolerante (brand_core: ignora sufijos 'perfumes/parfums/...').
Solo asigna cuando el match (marca+nombre) es ÚNICO en el dataset, para
no introducir imágenes incorrectas.

Uso:
    python scripts/recover_missing_images.py --dry-run
    python scripts/recover_missing_images.py --write
"""
from __future__ import annotations
import argparse, csv, json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from add_perfumes_from_dataset import brand_core, name_core

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

CDN = "https://fimgs.net/mdimg/perfume/375x500.{}.jpg"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog', default='data/catalog.json')
    ap.add_argument('--dataset', default='data/fragrantica_dataset.csv')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    idx: dict[tuple[str, str], set] = {}
    with open(args.dataset, encoding='utf-8', errors='ignore') as f:
        r = csv.reader(f, delimiter=';')
        h = next(r)
        c = {n: i for i, n in enumerate(h)}
        for row in r:
            if len(row) < len(h):
                continue
            m = re.search(r'-(\d{3,6})$', row[c['url']].rsplit('/', 1)[-1].replace('.html', ''))
            if not m:
                continue
            bc = brand_core(row[c['Brand']])
            nc = name_core(row[c['Perfume']])
            if bc and nc:
                idx.setdefault((bc, nc), set()).add(m.group(1))

    data = json.loads(Path(args.catalog).read_text(encoding='utf-8'))
    perfumes = data['perfumes']
    recovered = 0
    for p in perfumes:
        if p.get('imagen'):
            continue
        bc = brand_core(p.get('casa', ''))
        nc = name_core(p.get('nombre', ''), p.get('casa', ''))
        ids = idx.get((bc, nc))
        if ids and len(ids) == 1:
            p['imagen'] = CDN.format(next(iter(ids)))
            recovered += 1

    print(f'· Imágenes recuperadas: {recovered}', flush=True)
    if args.write:
        tmp = Path(args.catalog).with_suffix('.json.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        tmp.replace(Path(args.catalog))
        print(f'[OK] Catálogo actualizado.', flush=True)
    else:
        print('[dry-run] sin cambios.', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
