#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top Note · Alta de perfumes desde el dataset Fragrantica de Kaggle
==================================================================

Añade al catálogo los perfumes del dataset Fragrantica (fra_cleaned.csv)
que NO estén ya presentes (dedup por marca+nombre). Cada nuevo perfume
trae notas (traducidas al ES), acordes, familia/temporada derivadas,
rating, perfumistas e imagen limpia del CDN fimgs.net.

Uso:
    python scripts/add_perfumes_from_dataset.py --dry-run
    python scripts/add_perfumes_from_dataset.py --write
    python scripts/add_perfumes_from_dataset.py --dry-run --arab-only
"""
from __future__ import annotations
import argparse, csv, json, re, sys, unicodedata
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from notes_es import translate_note

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

CDN = "https://fimgs.net/mdimg/perfume/375x500.{}.jpg"
_ID_RE = re.compile(r'-(\d{3,6})$')

_CONC = re.compile(r'\b(?:eau de parfum|eau de toilette|eau de cologne|extrait de parfum'
                   r'|extrait|parfum|cologne|edp|edt|edc|na)\b', re.IGNORECASE)
_YEAR = re.compile(r'\b(?:19|20)\d{2}\b')
_BRAND_SUFFIX = re.compile(r'\b(?:perfumes?|parfums?|fragrances?|paris|london|milano)\b', re.IGNORECASE)

ARAB_BRANDS = {'lattafa','armaf','rasasi','swiss arabian','al haramain','ajmal','arabian oud',
    'abdul samad','nabeel','afnan','khadlaj','ard al','asgharali','naseem','junaid',
    'my perfumes','orientica','maison alhambra','al rehab','surrati','nusuk','hamidi',
    'paris corner','fragrance world','khalis','al wataniah','zimaya','sapil','rasasi',
    'anfar','al-rehab','khalis','otoori','manasik','asdaaf','dirham','nylaa','wadi al khaleej'}

FAMILIA_BY_ACCORD = {
    'woody': 'amaderada', 'mossy': 'chipre', 'chypre': 'chipre', 'leather': 'oriental',
    'citrus': 'cítrica', 'fresh': 'cítrica', 'aquatic': 'cítrica', 'fresh spicy': 'cítrica',
    'green': 'cítrica', 'fruity': 'cítrica', 'marine': 'cítrica', 'ozonic': 'cítrica',
    'sweet': 'gourmand', 'vanilla': 'gourmand', 'gourmand': 'gourmand', 'caramel': 'gourmand',
    'chocolate': 'gourmand', 'honey': 'gourmand', 'cacao': 'gourmand',
    'floral': 'floral', 'white floral': 'floral', 'yellow floral': 'floral', 'rose': 'floral',
    'tuberose': 'floral', 'violet': 'floral', 'powdery': 'floral', 'iris': 'floral', 'soft floral': 'floral',
    'oriental': 'oriental', 'amber': 'oriental', 'warm spicy': 'oriental', 'spicy': 'oriental',
    'animalic': 'oriental', 'smoky': 'oriental', 'balsamic': 'oriental', 'resinous': 'oriental',
    'aromatic': 'fougère', 'lavender': 'fougère', 'herbal': 'fougère', 'conifer': 'fougère',
}
WARM = {'woody','oriental','amber','warm spicy','spicy','sweet','gourmand','vanilla','leather',
        'smoky','balsamic','animalic','tobacco','oud','resinous','caramel','chocolate','honey','cinnamon'}
FRESH = {'citrus','fresh','aquatic','green','aromatic','fruity','marine','ozonic','fresh spicy','herbal'}


def strip_accents(s: str) -> str:
    s = unicodedata.normalize('NFD', s or '')
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def norm(text: str) -> str:
    text = strip_accents(text or '').lower().replace('-', ' ')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def brand_core(casa: str) -> str:
    b = norm(casa)
    b = _BRAND_SUFFIX.sub(' ', b)
    return re.sub(r'\s+', ' ', b).strip()


def name_core(nombre: str, casa: str = '') -> str:
    n = nombre
    if casa:
        n = re.sub(re.escape(casa), ' ', n, flags=re.IGNORECASE)
    n = strip_accents(n).lower().replace('-', ' ')
    n = re.sub(r'[^a-z0-9\s]', ' ', n)
    n = _YEAR.sub(' ', n)
    n = _CONC.sub(' ', n)
    return re.sub(r'\s+', ' ', n).strip()


def title_name(slug: str) -> str:
    words = slug.replace('-', ' ').split()
    out = []
    for w in words:
        if w.lower() in ('de', 'la', 'le', 'du', 'des', 'el', 'al', 'and', 'of', 'pour'):
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:])
    s = ' '.join(out)
    return s[:1].upper() + s[1:] if s else slug


def detect_conc(slug: str) -> str:
    s = ' ' + slug.replace('-', ' ').lower() + ' '
    for key, val in [('eau de parfum', 'Eau de Parfum'), ('eau de toilette', 'Eau de Toilette'),
                     ('eau de cologne', 'Eau de Cologne'), ('extrait', 'Extrait'),
                     ('elixir', 'Elixir'), (' parfum ', 'Parfum'), (' cologne ', 'Cologne')]:
        if key in s:
            return val
    return 'NA'


def derive_familia(accords: list[str]) -> str:
    for a in accords:
        if a in FAMILIA_BY_ACCORD:
            return FAMILIA_BY_ACCORD[a]
    return 'amaderada'


def derive_temporada(accords: list[str]) -> list[str]:
    seasons = set()
    for a in accords:
        if a in WARM:
            seasons.update(['otoño', 'invierno'])
        if a in FRESH:
            seasons.update(['primavera', 'verano'])
        if a in ('floral', 'white floral', 'rose'):
            seasons.add('primavera')
    if not seasons:
        seasons = {'otoño', 'invierno'}
    order = ['primavera', 'verano', 'otoño', 'invierno']
    return [s for s in order if s in seasons]


def map_gender(g: str) -> str:
    g = (g or '').strip().lower()
    if 'unisex' in g:
        return 'unisex'
    # ojo: 'women' contiene 'men' como substring; lo eliminamos para detectar 'men' aislado
    has_women = 'women' in g or 'woman' in g or 'female' in g
    g_no_women = g.replace('women', '').replace('woman', '')
    has_men = 'men' in g_no_women or 'male' in g.replace('female', '')
    if has_women and has_men:
        return 'unisex'
    if has_women:
        return 'femenino'
    if has_men:
        return 'masculino'
    return 'unisex'


def split_notes(cell: str) -> list[str]:
    return [translate_note(x) for x in cell.split(',') if x.strip()]


def parse_float(s: str):
    try:
        return round(float((s or '').replace(',', '.')), 2)
    except ValueError:
        return 0.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--catalog', default='data/catalog.json')
    ap.add_argument('--dataset', default='data/fragrantica_dataset.csv')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--arab-only', action='store_true')
    args = ap.parse_args()

    data = json.loads(Path(args.catalog).read_text(encoding='utf-8'))
    perfumes = data['perfumes']

    # Index de dedup + mapa de nombre de marca para consistencia
    have = set()
    brand_display: dict[str, str] = {}
    bc_counts: dict[str, Counter] = {}
    for p in perfumes:
        bc = brand_core(p.get('casa', ''))
        nc = name_core(p.get('nombre', ''), p.get('casa', ''))
        if bc and nc:
            have.add((bc, nc))
        if bc:
            bc_counts.setdefault(bc, Counter())[p.get('casa', '')] += 1
    for bc, ctr in bc_counts.items():
        brand_display[bc] = ctr.most_common(1)[0][0]

    print(f'· Catálogo actual: {len(perfumes)} perfumes', flush=True)

    # Pasada 1: por (marca, nombre) quedarse con la fila de MÁS votos.
    # Evita que una reedición poco votada eclipse al original icónico
    # (p.ej. dos "1-million" de Paco Rabanne: 149 vs 19107 votos).
    best: dict[tuple[str, str], tuple[int, list, str]] = {}
    with open(args.dataset, encoding='utf-8', errors='ignore') as f:
        r = csv.reader(f, delimiter=';')
        h = next(r)
        col = {name: i for i, name in enumerate(h)}
        for row in r:
            if len(row) < len(h):
                continue
            m = _ID_RE.search(row[col['url']].rsplit('/', 1)[-1].replace('.html', ''))
            if not m:
                continue
            bc = brand_core(row[col['Brand']])
            nc = name_core(row[col['Perfume']])
            if not bc or not nc:
                continue
            votes = int(row[col['Rating Count']]) if row[col['Rating Count']].strip().isdigit() else 0
            prev = best.get((bc, nc))
            if prev is None or votes > prev[0]:
                best[(bc, nc)] = (votes, row, m.group(1))

    # Pasada 2: construir entradas para los que no estén ya en el catálogo.
    new_entries = []
    arab_count = 0
    for (bc, nc), (votes, row, fid) in best.items():
        if (bc, nc) in have:
            continue
        is_arab = any(a in bc for a in ARAB_BRANDS)
        if args.arab_only and not is_arab:
            continue

        slug = row[col['Perfume']]
        accords = [row[col[f'mainaccord{i}']].strip().lower()
                   for i in range(1, 6) if row[col[f'mainaccord{i}']].strip()]
        perfumers = [x for x in (row[col['Perfumer1']], row[col['Perfumer2']])
                     if x.strip() and x.strip().lower() != 'unknown']
        casa = brand_display.get(bc, title_name(row[col['Brand']]))
        year = 0
        try:
            year = int(row[col['Year']])
        except (ValueError, KeyError):
            pass

        entry = {
            'id': f'fr_{fid}',
            'nombre': title_name(slug),
            'casa': casa,
            'año': year,
            'concentracion': detect_conc(slug),
            'notas': {
                'salida': split_notes(row[col['Top']]),
                'corazon': split_notes(row[col['Middle']]),
                'fondo': split_notes(row[col['Base']]),
            },
            'familia': derive_familia(accords),
            'acordes': accords,
            'temporada': derive_temporada(accords),
            'genero': map_gender(row[col['Gender']]),
            'perfumistas': perfumers,
            'rating': round(parse_float(row[col['Rating Value']]) * 2, 1),  # Fragrantica 0-5 → catálogo 0-10
            'rating_count': votes,
            'url': row[col['url']],
            'similares_a': [],
            'imagen': CDN.format(fid),
        }
        new_entries.append(entry)
        if is_arab:
            arab_count += 1

    print(f'· Nuevos perfumes a añadir: {len(new_entries)}', flush=True)
    print(f'  · de los cuales árabes   : {arab_count}', flush=True)
    print(f'· Catálogo resultante     : {len(perfumes) + len(new_entries)}', flush=True)

    if args.write:
        perfumes.extend(new_entries)
        tmp = Path(args.catalog).with_suffix('.json.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        tmp.replace(Path(args.catalog))
        print(f'[OK] Añadidos {len(new_entries)} perfumes. Total: {len(perfumes)}', flush=True)
    else:
        print('\n[dry-run] Ejemplos de nuevos perfumes:')
        for e in new_entries[:8]:
            print(f'  {e["casa"]} · {e["nombre"]} ({e["año"]}) [{e["familia"]}] '
                  f'★{e["rating"]} salida={e["notas"]["salida"][:3]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
