#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Fusionar duplicados cruzados Parfumo (pf_) ↔ Fragrantica (fr_)
=========================================================================

Mismo perfume que existe dos veces porque Parfumo y Fragrantica lo
nombran distinto (p.ej. Parfumo "Million" vs Fragrantica "1 Million").
El alta ya evita duplicados con nombre normalizado idéntico, así que
aquí usamos un nombre "laxo": quitamos el número/artículo inicial.

Estrategia conservadora — solo fusiona grupos que contienen a la vez
una entrada pf_ y una fr_ (duplicado cruzado claro):
  · gana la entrada con MÁS votos (rating_count)
  · se le rellena la imagen desde cualquiera del grupo si le falta
  · las demás se eliminan
  · se remapean las referencias en `similares_a` al id ganador

Uso:
    python scripts/dedupe_cross_source.py --dry-run
    python scripts/dedupe_cross_source.py --write
"""
from __future__ import annotations
import argparse, json, re, sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from add_perfumes_from_dataset import brand_core, name_core

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Solo quitamos un dígito SUELTO inicial (1-9) o número en palabra; nunca años
# multi-dígito (1872) ni letras/artículos (L, Le), para no fundir productos
# distintos de líneas tipo Clive Christian ("1872 for Men" vs "L for Men").
_LEADING = re.compile(r'^(?:[1-9]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+')


def loose_name(nombre: str, casa: str) -> str:
    nc = name_core(nombre, casa)
    # quita un token inicial (número/artículo) solo si queda nombre detrás
    prev = None
    while prev != nc:
        prev = nc
        m = _LEADING.match(nc)
        if m and nc[m.end():].strip():
            nc = nc[m.end():].strip()
    return nc


def votes(p: dict) -> int:
    return p.get('rating_count') or 0


# Concentraciones que name_core elimina y que, por tanto, podrían colapsar
# perfumes distintos en un mismo grupo. Las detectamos para no fusionar
# variantes de concentración diferentes (p.ej. Dior Homme EDT vs Parfum).
def get_conc(p: dict) -> str:
    txt = ((p.get('nombre') or '') + ' ' + (p.get('concentracion') or '')).lower()
    for key, val in [('eau de parfum', 'edp'), ('eau de toilette', 'edt'),
                     ('eau de cologne', 'edc'), ('extrait', 'extrait'),
                     ('eau fraiche', 'fraiche'), ('eau fraîche', 'fraiche')]:
        if key in txt:
            return val
    for tok, val in [(' edp', 'edp'), (' edt', 'edt'), (' edc', 'edc'),
                     ('parfum', 'parfum'), ('cologne', 'cologne')]:
        if tok in txt:
            return val
    return 'none'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog', default='data/catalog.json')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    data = json.loads(Path(args.catalog).read_text(encoding='utf-8'))
    perfumes = data['perfumes']

    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for i, p in enumerate(perfumes):
        bc = brand_core(p.get('casa', ''))
        ln = loose_name(p.get('nombre', ''), p.get('casa', ''))
        if bc and ln:
            groups[(bc, ln)].append(i)

    remove = set()
    id_remap: dict[str, str] = {}
    examples = []
    dup_groups = 0

    for key, idxs in groups.items():
        if len(idxs) < 2:
            continue
        srcs = {('pf' if perfumes[i]['id'].startswith('pf_') else 'fr') for i in idxs}
        # solo duplicados CRUZADOS (a la vez pf_ y fr_)
        if srcs != {'pf', 'fr'}:
            continue
        # seguridad: si el grupo mezcla 2+ concentraciones explícitas distintas
        # (EDP/EDT/Cologne/Parfum...), son perfumes diferentes → no fusionar.
        concs = {get_conc(perfumes[i]) for i in idxs}
        explicit = concs - {'none'}
        if len(explicit) >= 2:
            continue
        # parfum/extrait suelen ser flankers distintos de la base: no dejar que
        # una entrada sin concentración los absorba.
        if explicit & {'parfum', 'extrait'} and 'none' in concs:
            continue
        dup_groups += 1
        winner = max(idxs, key=lambda i: votes(perfumes[i]))
        win_p = perfumes[winner]
        # rellenar imagen del ganador si le falta
        if not win_p.get('imagen'):
            for i in idxs:
                if perfumes[i].get('imagen'):
                    win_p['imagen'] = perfumes[i]['imagen']
                    break
        for i in idxs:
            if i == winner:
                continue
            id_remap[perfumes[i]['id']] = win_p['id']
            remove.add(i)
        if len(examples) < 15:
            examples.append((
                win_p['casa'],
                [(perfumes[i]['nombre'], votes(perfumes[i]),
                  'WIN' if i == winner else 'del') for i in idxs],
            ))

    print(f'· Grupos de duplicado cruzado: {dup_groups}', flush=True)
    print(f'· Entradas a eliminar        : {len(remove)}', flush=True)
    print(f'· Catálogo: {len(perfumes)} → {len(perfumes) - len(remove)}', flush=True)

    # remapear similares_a
    remap_hits = 0
    for p in perfumes:
        sa = p.get('similares_a')
        if sa:
            new = [id_remap.get(x, x) for x in sa]
            # quitar duplicados y autorreferencias
            seen = set(); out = []
            for x in new:
                if x != p['id'] and x not in seen:
                    seen.add(x); out.append(x)
            if out != sa:
                remap_hits += 1
            p['similares_a'] = out
    print(f'· Entradas con similares_a remapeadas: {remap_hits}', flush=True)

    if args.dry_run:
        print('\n[dry-run] Ejemplos de fusión:')
        for casa, items in examples:
            print(f'  {casa}:')
            for nombre, v, tag in items:
                print(f'      [{tag}] {nombre[:48]:48} votos={v}')
        return 0

    if args.write:
        data['perfumes'] = [p for i, p in enumerate(perfumes) if i not in remove]
        tmp = Path(args.catalog).with_suffix('.json.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        tmp.replace(Path(args.catalog))
        print(f'[OK] Fusionados. Catálogo: {len(data["perfumes"])} perfumes.', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
