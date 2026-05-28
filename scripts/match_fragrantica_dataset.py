#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Matcher offline contra el dataset Fragrantica de Kaggle
==================================================================

En lugar de scrapear (que provoca bloqueos), descargamos UNA vez el
dataset Fragrantica de Kaggle (fra_cleaned.csv, 24k perfumes con la
URL de Fragrantica que incluye el ID numérico) y cruzamos localmente
con nuestro catálogo. Con el ID construimos la imagen limpia del CDN:

    https://fimgs.net/mdimg/perfume/375x500.{ID}.jpg

El CDN no bloquea (es estático) y las imágenes son frascos limpios
sin logo ni marca de agua.

Matching ESTRICTO por defecto: marca normalizada + nombre normalizado
idénticos. Así priorizamos imágenes correctas sobre cantidad.

Uso:
    # Dry-run (no escribe, solo reporta cuántos matches)
    python scripts/match_fragrantica_dataset.py --dry-run

    # Escribir al catálogo
    python scripts/match_fragrantica_dataset.py --write
"""
from __future__ import annotations
import argparse, csv, json, re, sys, unicodedata
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

CDN = "https://fimgs.net/mdimg/perfume/375x500.{}.jpg"

_CONC = re.compile(
    r'\b(?:eau\s+de\s+(?:parfum|toilette|cologne)|extrait(?:\s+de\s+parfum)?'
    r'|parfum\s+pour\s+cheveux|parfum|cologne|edp|edt|edc|hair\s+mist'
    r'|body\s+(?:lotion|cream|mist)|shower\s+gel|na)\b',
    re.IGNORECASE,
)
_YEAR = re.compile(r'\b(?:19|20)\d{2}\b')
_ID_RE = re.compile(r'-(\d{3,6})\.html')


def strip_accents(s: str) -> str:
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def norm(text: str) -> str:
    text = strip_accents(text or '').lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def norm_name(text: str) -> str:
    """Normaliza quitando año y concentración para el nombre del perfume."""
    text = strip_accents(text or '').lower()
    text = text.replace('-', ' ')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = _YEAR.sub(' ', text)
    text = _CONC.sub(' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def norm_full(text: str) -> str:
    """Como norm_name pero SIN quitar la concentración (para desambiguar)."""
    text = strip_accents(text or '').lower()
    text = text.replace('-', ' ')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = _YEAR.sub(' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def catalog_keys(p: dict) -> list[tuple[str, str, str]]:
    """Genera candidatos (brand_norm, core_name_norm, full_name_norm)."""
    casa = p.get('casa', '') or ''
    nombre = p.get('nombre', '') or ''
    conc = p.get('concentracion', '') or ''
    brand_n = norm(casa)

    # nombre suele venir como "{Core} {Brand} {Year} {Conc}"; quitamos la marca
    name = nombre
    if casa:
        name = re.sub(re.escape(casa), ' ', name, flags=re.IGNORECASE)
    core = norm_name(name)
    full = norm_full(name)
    # si la concentración viene en campo aparte y no está en el nombre, añádela
    if conc and conc.upper() != 'NA':
        cn = norm_full(conc)
        if cn and cn not in full:
            full = (full + ' ' + cn).strip()

    keys = []
    if brand_n and core:
        keys.append((brand_n, core, full))
    if ' - ' in nombre:
        right = nombre.split(' - ', 1)[1]
        if casa:
            right = re.sub(re.escape(casa), ' ', right, flags=re.IGNORECASE)
        rc = norm_name(right)
        rf = norm_full(right)
        if brand_n and rc and not any(k[1] == rc for k in keys):
            keys.append((brand_n, rc, rf))
    return keys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog', default='data/catalog.json')
    ap.add_argument('--dataset', default='data/fragrantica_dataset.csv',
                    help='CSV fra_cleaned de Kaggle (separador ;)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--field', default='imagen')
    ap.add_argument('--only-missing', action='store_true',
                    help='Solo asignar a los que no tienen imagen ya.')
    ap.add_argument('--strict-only', action='store_true',
                    help='Solo matches marca+nombre; descarta el fallback por nombre único.')
    args = ap.parse_args()

    # 1) Indexar dataset Fragrantica
    ds_path = Path(args.dataset)
    if not ds_path.exists():
        sys.exit(f'No existe el dataset {ds_path}. Descárgalo de Kaggle primero.')

    # (brand, core_name) -> list de (fid, full_name_norm)
    by_brand_name: dict[tuple[str, str], list[tuple[str, str]]] = {}
    by_name: dict[str, set[str]] = {}
    with ds_path.open(encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f, delimiter=';')
        next(reader)
        for r in reader:
            if len(r) < 3:
                continue
            m = _ID_RE.search(r[0])
            if not m:
                continue
            fid = m.group(1)
            core = norm_name(r[1])
            full = norm_full(r[1])
            pbrand = norm(r[2])
            if core and pbrand:
                by_brand_name.setdefault((pbrand, core), []).append((fid, full))
                by_name.setdefault(core, set()).add(fid)

    print(f'· Dataset indexado: {len(by_brand_name)} pares marca+nombre, '
          f'{len(by_name)} nombres únicos', flush=True)

    # 2) Cruzar con catálogo
    data = json.loads(Path(args.catalog).read_text(encoding='utf-8'))
    perfumes = data['perfumes']

    strict = 0       # match marca+nombre, no ambiguo (o desambiguado por conc.)
    name_unique = 0  # match solo por nombre, pero único en dataset
    ambiguous = 0    # marca+nombre coincide pero hay varias concentraciones
    none = 0
    assignments = []  # (idx, url, tipo)

    for i, p in enumerate(perfumes):
        if args.only_missing and p.get(args.field):
            continue
        keys = catalog_keys(p)
        fid = None
        kind = None
        amb = False
        for (bn, core, full) in keys:
            cands = by_brand_name.get((bn, core))
            if not cands:
                continue
            uniq = {c[0] for c in cands}
            if len(uniq) == 1:
                fid = cands[0][0]
                kind = 'strict'
                break
            # varias concentraciones: desambiguar por nombre completo
            exact = [c for c in cands if c[1] == full]
            exact_ids = {c[0] for c in exact}
            if len(exact_ids) == 1:
                fid = exact[0][0]
                kind = 'strict'
                break
            amb = True  # coincide pero no podemos elegir con seguridad
        if not fid and not amb and not args.strict_only:
            # fallback: nombre único en todo el dataset
            for (_b, core, _full) in keys:
                ids = by_name.get(core)
                if ids and len(ids) == 1:
                    fid = next(iter(ids))
                    kind = 'name_unique'
                    break
        if fid:
            assignments.append((i, CDN.format(fid), kind))
            if kind == 'strict':
                strict += 1
            else:
                name_unique += 1
        elif amb:
            ambiguous += 1
        else:
            none += 1

    print(f'· Matches estrictos (marca+nombre): {strict}', flush=True)
    print(f'· Matches por nombre único         : {name_unique}', flush=True)
    print(f'· Ambiguos (saltados por seguridad): {ambiguous}', flush=True)
    print(f'· Sin match                        : {none}', flush=True)
    print(f'· TOTAL asignables                 : {strict + name_unique}', flush=True)

    if args.write:
        for idx, url, _kind in assignments:
            perfumes[idx][args.field] = url
        tmp = Path(args.catalog).with_suffix('.json.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')),
                       encoding='utf-8')
        tmp.replace(Path(args.catalog))
        print(f'[OK] Escritas {len(assignments)} imágenes en {args.catalog}', flush=True)
    else:
        print('[dry-run] No se ha modificado el catálogo. Usa --write para aplicar.',
              flush=True)
        # Muestra 12 ejemplos de match estricto
        print('\nEjemplos de match estricto:')
        shown = 0
        for idx, url, kind in assignments:
            if kind == 'strict':
                p = perfumes[idx]
                print(f'  {p["nombre"][:45]:45} | {p["casa"][:20]:20} -> {url}')
                shown += 1
                if shown >= 12:
                    break
    return 0


if __name__ == '__main__':
    sys.exit(main())
