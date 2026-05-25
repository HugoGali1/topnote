# -*- coding: utf-8 -*-
"""
Ingest del dataset Parfumo (Kaggle) -> data/catalog.json del proyecto Top Note.

Uso:
    python scripts/ingest_parfumo.py [--input PATH] [--output PATH]
                                     [--min-votes N] [--limit N]

Por defecto:
    --input  data/parfumo_data.csv  (descárgalo de Kaggle, ver README.md)
    --output data/catalog.json
    --min-votes 20

El script:
    1. Lee el CSV de Parfumo (12 columnas).
    2. Filtra entradas con Rating_Count < min-votes (datos pobres).
    3. Filtra entradas sin notas (todas vacías).
    4. Traduce notas y acordes EN -> ES vía translations.py.
    5. Deriva: familia (del primer acorde), género (regex sobre nombre),
       temporada (heurística por familia).
    6. Computa `similares_a` (top-3 Jaccard sobre notas, misma familia).
    7. Escribe data/catalog.json en el schema que consume index.html.

Sólo depende de la librería estándar (csv, json, re, argparse, math, pathlib,
collections). No requiere pandas.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

# Asegura stdout UTF-8 en consolas Windows (cp1252 por defecto rompe en ñ, ·, ✓).
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, OSError):
        pass

# Permitir ejecutar como `python scripts/ingest_parfumo.py` desde la raíz.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from translations import (  # noqa: E402
    NOTE_TRANSLATIONS,
    family_from_accords,
    infer_gender,
    SEASON_BY_FAMILY,
    translate_note,
)

# CSV de Parfumo puede traer "N/A" como ausente.
_NA_TOKENS = {'', 'n/a', 'na', 'null', 'none', '-'}


def parse_list(cell: str) -> list[str]:
    """Parsea una celda con notas/acordes separados por comas.
    Devuelve lista vacía si la celda es nula o "N/A"."""
    if not cell or cell.strip().lower() in _NA_TOKENS:
        return []
    parts = [p.strip() for p in cell.split(',')]
    return [p for p in parts if p and p.lower() not in _NA_TOKENS]


def safe_int(cell: str) -> int | None:
    if not cell or cell.strip().lower() in _NA_TOKENS:
        return None
    try:
        return int(float(cell))
    except (ValueError, TypeError):
        return None


def safe_float(cell: str) -> float | None:
    if not cell or cell.strip().lower() in _NA_TOKENS:
        return None
    try:
        return float(cell)
    except (ValueError, TypeError):
        return None


def slugify(text: str) -> str:
    text = re.sub(r'[^a-zA-Z0-9]+', '_', text.lower()).strip('_')
    return text[:48]


def translate_notes(en_list: list[str]) -> list[str]:
    """Traduce una lista preservando orden y eliminando duplicados."""
    out, seen = [], set()
    for n in en_list:
        es = translate_note(n)
        if es and es not in seen:
            seen.add(es)
            out.append(es)
    return out


def quality_score(rating: float | None, votes: int | None) -> float:
    """Prior de calidad: rating × log(votes+1). Sirve para ordenar al final
    y para empate al elegir `similares_a`."""
    r = rating if rating is not None else 0.0
    v = votes if votes is not None else 0
    return r * math.log1p(v)


def compute_similares(perfumes: list[dict], top_k: int = 3) -> None:
    """Para cada perfume, asigna similares_a con los top_k perfumes de su
    misma familia con mayor solapamiento de notas (Jaccard).

    Usa un índice invertido nota -> ids para evitar el O(n²) ingenuo.
    """
    print(f'  · Calculando similares_a (top-{top_k}) para {len(perfumes)} perfumes…',
          flush=True)
    by_id = {p['id']: p for p in perfumes}
    # Índice invertido: nota -> set(ids), limitado a misma familia para acelerar.
    inv_by_family: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    notes_set_by_id: dict[str, set] = {}
    for p in perfumes:
        all_notes = set(p['notas']['salida']) | set(p['notas']['corazon']) | set(p['notas']['fondo'])
        notes_set_by_id[p['id']] = all_notes
        for n in all_notes:
            inv_by_family[p['familia']][n].add(p['id'])

    progress_step = max(1, len(perfumes) // 20)
    for i, p in enumerate(perfumes):
        if i % progress_step == 0:
            pct = 100 * i // len(perfumes)
            print(f'    {pct}% ({i}/{len(perfumes)})', flush=True)

        own_notes = notes_set_by_id[p['id']]
        if not own_notes:
            p['similares_a'] = []
            continue

        candidates: dict[str, int] = defaultdict(int)
        family_inv = inv_by_family[p['familia']]
        for n in own_notes:
            for cid in family_inv.get(n, ()):
                if cid != p['id']:
                    candidates[cid] += 1

        if not candidates:
            p['similares_a'] = []
            continue

        scored = []
        for cid, overlap in candidates.items():
            cnotes = notes_set_by_id[cid]
            union = len(own_notes | cnotes)
            jaccard = overlap / union if union else 0.0
            scored.append((jaccard, quality_score(by_id[cid].get('rating'),
                                                 by_id[cid].get('rating_count')), cid))
        scored.sort(reverse=True)
        p['similares_a'] = [cid for _, _, cid in scored[:top_k]]


def process_row(row: dict, used_ids: set) -> dict | None:
    """Transforma una fila del CSV de Parfumo al schema del catálogo.
    Devuelve None si la entrada debe descartarse."""
    name = (row.get('Name') or '').strip()
    brand = (row.get('Brand') or '').strip()
    if not name or not brand:
        return None

    top_en = parse_list(row.get('Top_Notes', ''))
    mid_en = parse_list(row.get('Middle_Notes', ''))
    base_en = parse_list(row.get('Base_Notes', ''))
    if not (top_en or mid_en or base_en):
        return None

    accords_en = parse_list(row.get('Main_Accords', ''))
    familia = family_from_accords(accords_en)

    # ID estable basado en Number si existe, si no en slug nombre+casa
    number = (row.get('Number') or '').strip()
    if number and number.lower() not in _NA_TOKENS:
        pid = f'pf_{slugify(number)}'
    else:
        pid = f'pf_{slugify(brand)}_{slugify(name)}'
    # Evita colisiones con sufijo numérico
    base_id = pid
    suffix = 2
    while pid in used_ids:
        pid = f'{base_id}_{suffix}'
        suffix += 1
    used_ids.add(pid)

    rating = safe_float(row.get('Rating_Value', ''))
    votes = safe_int(row.get('Rating_Count', ''))
    year = safe_int(row.get('Release_Year', ''))
    concentracion = (row.get('Concentration') or '').strip() or None
    perfumistas = parse_list(row.get('Perfumers', ''))
    url = (row.get('URL') or '').strip() or None

    return {
        'id': pid,
        'nombre': name,
        'casa': brand,
        'año': year,
        'concentracion': concentracion,
        'notas': {
            'salida': translate_notes(top_en),
            'corazon': translate_notes(mid_en),
            'fondo': translate_notes(base_en),
        },
        'familia': familia,
        'acordes': [a.lower() for a in accords_en[:5]],   # para prefilter
        'temporada': SEASON_BY_FAMILY.get(familia, []),
        'genero': infer_gender(name),
        'perfumistas': perfumistas,
        'rating': rating,
        'rating_count': votes,
        'url': url,
        'similares_a': [],  # se rellena después
    }


def main():
    p = argparse.ArgumentParser()
    root = Path(__file__).resolve().parent.parent
    p.add_argument('--input', default=str(root / 'data' / 'parfumo_data.csv'),
                   help='CSV de Parfumo descargado de Kaggle.')
    p.add_argument('--output', default=str(root / 'data' / 'catalog.json'),
                   help='Destino del catálogo en JSON.')
    p.add_argument('--min-votes', type=int, default=20,
                   help='Filtra perfumes con Rating_Count < N (default 20).')
    p.add_argument('--limit', type=int, default=0,
                   help='Limita a N perfumes (0 = sin límite). Útil para tests.')
    args = p.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    if not in_path.exists():
        sys.exit(
            f'ERROR: no se encuentra el CSV en {in_path}\n'
            'Descárgalo de Kaggle (ver README.md):\n'
            '  https://www.kaggle.com/datasets/olgagmiufana1/parfumo-fragrance-dataset'
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f'· Leyendo {in_path}…', flush=True)
    perfumes: list[dict] = []
    used_ids: set[str] = set()
    seen_rows = 0
    kept_rows = 0
    skipped_low_votes = 0
    skipped_no_notes = 0

    with in_path.open('r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            seen_rows += 1
            votes = safe_int(row.get('Rating_Count', '')) or 0
            perfumers = parse_list(row.get('Perfumers', ''))
            # Fallback: muchos clásicos (BR540, Sauvage, Aventus) tienen Rating_Count=NA
            # en el CSV de TidyTuesday pero traen perfumistas y pirámide completa.
            # Los conservamos vía signal cualitativo en vez de votos.
            has_quality_signal = (
                bool(perfumers)
                and bool(parse_list(row.get('Top_Notes', '')))
                and bool(parse_list(row.get('Base_Notes', '')))
            )
            if votes < args.min_votes and not has_quality_signal:
                skipped_low_votes += 1
                continue
            obj = process_row(row, used_ids)
            if obj is None:
                skipped_no_notes += 1
                continue
            perfumes.append(obj)
            kept_rows += 1
            if args.limit and kept_rows >= args.limit:
                break

    print(f'· Filas leídas       : {seen_rows}', flush=True)
    print(f'· Descartadas (votos): {skipped_low_votes}', flush=True)
    print(f'· Descartadas (notas): {skipped_no_notes}', flush=True)
    print(f'· Conservadas        : {kept_rows}', flush=True)

    if not perfumes:
        sys.exit('ERROR: no quedó ningún perfume tras el filtrado.')

    compute_similares(perfumes, top_k=3)

    # Orden global por prior de calidad: ayuda al prefilter en el cliente.
    perfumes.sort(
        key=lambda p: quality_score(p.get('rating'), p.get('rating_count')),
        reverse=True,
    )

    out = {
        'version': 'parfumo-1.0',
        'generated_from': 'parfumo-fragrance-dataset (Kaggle)',
        'count': len(perfumes),
        'min_votes': args.min_votes,
        'perfumes': perfumes,
    }

    print(f'· Escribiendo {out_path}…', flush=True)
    with out_path.open('w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f'[OK] Listo. {len(perfumes)} perfumes - {size_mb:.1f} MB', flush=True)


if __name__ == '__main__':
    main()
