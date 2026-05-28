#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Corregir el campo `genero` desde el dataset Fragrantica
==================================================================

El catálogo original tenía ~88% 'unisex' (dato pobre), lo que hace
inútil filtrar por sexo. El dataset Fragrantica trae buen dato de
género. Esta pasada actualiza `genero` para cada perfume que case con
el dataset (marca+nombre, match único), usando el mapeo corregido.

Uso:
    python scripts/fix_gender.py --dry-run
    python scripts/fix_gender.py --write
"""
from __future__ import annotations
import argparse, csv, json, re, sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from add_perfumes_from_dataset import brand_core, name_core, map_gender

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog', default='data/catalog.json')
    ap.add_argument('--dataset', default='data/fragrantica_dataset.csv')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    # (bc,nc) -> Counter de géneros mapeados del dataset
    idx: dict[tuple[str, str], Counter] = {}
    with open(args.dataset, encoding='utf-8', errors='ignore') as f:
        r = csv.reader(f, delimiter=';')
        h = next(r)
        c = {n: i for i, n in enumerate(h)}
        for row in r:
            if len(row) < len(h):
                continue
            bc = brand_core(row[c['Brand']])
            nc = name_core(row[c['Perfume']])
            if bc and nc:
                idx.setdefault((bc, nc), Counter())[map_gender(row[c['Gender']])] += 1

    data = json.loads(Path(args.catalog).read_text(encoding='utf-8'))
    perfumes = data['perfumes']
    before = Counter(p.get('genero') for p in perfumes)

    changed = 0
    for p in perfumes:
        bc = brand_core(p.get('casa', ''))
        nc = name_core(p.get('nombre', ''), p.get('casa', ''))
        ctr = idx.get((bc, nc))
        if not ctr:
            continue
        # género dominante del dataset para ese (marca, nombre)
        g = ctr.most_common(1)[0][0]
        if p.get('genero') != g:
            p['genero'] = g
            changed += 1

    after = Counter(p.get('genero') for p in perfumes)
    print(f'· Géneros corregidos: {changed}', flush=True)
    print(f'· Antes : {dict(before)}', flush=True)
    print(f'· Después: {dict(after)}', flush=True)

    if args.write:
        tmp = Path(args.catalog).with_suffix('.json.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        tmp.replace(Path(args.catalog))
        print('[OK] Catálogo actualizado.', flush=True)
    else:
        print('[dry-run] sin cambios.', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
