/**
 * Test de búsqueda end-to-end con el catálogo real.
 * Replica el prefilter del frontend (concept expansion + perfume detection)
 * y llama al endpoint /api/recommendations/rank.
 *
 *   node scripts/test-search.mjs "tu query aquí"
 *   node scripts/test-search.mjs  # corre el set de queries de ejemplo
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(__dirname, '../../data/catalog.json');
const API = 'http://localhost:3000/api';

const STOPWORDS_ES = new Set(['de','la','el','los','las','un','una','unos','unas','y','o','con','sin','para','que','como','algo','en','por','del','al','su','sus','muy','mas','menos','pero','me','mi','tu','lo','le','les','este','esta','estos','estas','ese','esa','esos','esas','quiero','busco','dame','necesito','similar','similares','parecido','perfume','perfumes','fragancia','fragancias','aroma','colonia','olor','algun','alguna','tipo','estilo','manera','forma','clase','ser','tener','quiere','quieres']);

const QUERY_CONCEPTS = {
  'oficina': ['fresh','clean','citrus','aromatic','soft','musky','linen','wood'],
  'trabajo': ['fresh','clean','citrus','aromatic','soft'],
  'cita': ['sweet','floral','soft','powdery','sensual','vanilla','rose'],
  'noche': ['amber','oud','oriental','intense','smoky','sensual','warm','leather'],
  'cena': ['oriental','amber','warm','sensual','wood','leather'],
  'casual': ['fresh','citrus','light','aromatic','clean'],
  'diario': ['fresh','clean','citrus','aromatic','light'],
  'evento': ['intense','oud','oriental','leather','smoky','amber'],
  'fiesta': ['sweet','gourmand','intense','sensual','warm'],
  'gym': ['fresh','aquatic','citrus','sport'],
  'deporte': ['fresh','aquatic','citrus','sport','aromatic'],
  'playa': ['fresh','aquatic','marine','citrus','coconut','tropical'],
  'verano': ['fresh','aquatic','citrus','green','marine','cologne','tropical'],
  'invierno': ['amber','gourmand','woody','spicy','smoky','warm','sweet','oud'],
  'primavera': ['floral','green','citrus','fresh','soft','rose','jasmine'],
  'otono': ['woody','amber','spicy','leather','tobacco','warm'],
  'dulce': ['sweet','gourmand','vanilla','caramel','honey','sugar'],
  'fresco': ['fresh','citrus','aquatic','green','marine','aromatic'],
  'elegante': ['woody','iris','leather','amber','refined','aldehydic'],
  'sofisticado': ['woody','iris','leather','amber','smoky','refined'],
  'discreto': ['soft','powdery','clean','light','musky'],
  'suave': ['soft','powdery','floral','clean','musky','vanilla'],
  'intenso': ['intense','amber','oud','oriental','smoky','leather'],
  'fuerte': ['intense','strong','amber','oud','smoky','spicy'],
  'profundo': ['amber','oud','woody','smoky','dark','intense'],
  'sensual': ['amber','vanilla','oud','musky','warm','sweet','rose'],
  'limpio': ['clean','soap','musky','aldehydic','fresh'],
  'aromatico': ['aromatic','herbal','green','lavender'],
  'amargo': ['bitter','tobacco','green'],
  'citrico': ['citrus','fresh','aromatic','bergamot','lemon','orange'],
  'amaderado': ['woody','sandalwood','cedar','vetiver','oud'],
  'maduro': ['leather','tobacco','amber','oud','woody','rum'],
  'juvenil': ['fresh','citrus','sweet','aquatic','sport'],
  'masculino': ['woody','leather','tobacco','aromatic','spicy','animalic'],
  'femenino': ['floral','sweet','powdery','rose','jasmine','tuberose'],
  'caliente': ['warm','amber','spicy','oud'],
  'calido': ['warm','amber','spicy','oud','vanilla','tobacco'],
  'frio': ['fresh','aquatic','mint','cold','marine'],
  'romantico': ['floral','rose','sweet','sensual','powdery','vanilla'],
  'misterioso': ['oud','smoky','dark','incense','leather','amber','intense'],
  'gourmand': ['gourmand','sweet','vanilla','caramel','chocolate','honey'],
  'oriental': ['amber','oriental','spicy','resin','incense'],
  'humo': ['smoky','smoke','incense','tobacco'],
  'vainilla': ['vanilla'], 'rosa': ['rose'], 'jazmin': ['jasmine'],
  'sandalo': ['sandalwood'], 'cedro': ['cedar'], 'oud': ['oud','agarwood'],
  'tabaco': ['tobacco'], 'cuero': ['leather'], 'incienso': ['incense','frankincense'],
  'ambar': ['amber'], 'cafe': ['coffee'], 'cacao': ['chocolate','cacao'],
  'chocolate': ['chocolate','cacao'], 'bergamota': ['bergamot'],
  'lavanda': ['lavender'], 'menta': ['mint','peppermint'], 'pimienta': ['pepper'],
  'azafran': ['saffron'], 'almizcle': ['musk'], 'caramelo': ['caramel','toffee'],
  'miel': ['honey'], 'frutal': ['fruity','peach','apple','pear'],
  'verde': ['green','grass','leaf'],
  'especiado': ['spicy','pepper','cinnamon','cardamom','saffron','clove'],
  'patchouli': ['patchouli'], 'pachuli': ['patchouli'],
  'iris': ['iris','orris'], 'mirra': ['myrrh'], 'rum': ['rum'], 'ron': ['rum'],
  'coco': ['coconut'], 'tonka': ['tonka'], 'almendra': ['almond'],
  'cardamomo': ['cardamom'], 'canela': ['cinnamon'],
};

const NORM = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MAX_PER_CASA = 3;
const CAP = 80;

const BRAND_ALIASES = {
  'ysl': 'yves saint laurent', 'tf': 'tom ford', 'ga': 'giorgio armani',
  'ck': 'calvin klein', 'jpg': 'jean paul gaultier',
  'mfk': 'maison francis kurkdjian', 'pdm': 'parfums de marly',
  'dg': 'dolce gabbana', 'cdg': 'comme des garcons', 'lv': 'louis vuitton',
  'mb': 'montblanc', 'bvl': 'bvlgari',
  'armani': 'giorgio armani', 'kurkdjian': 'maison francis kurkdjian',
  'marly': 'parfums de marly', 'vuitton': 'louis vuitton',
  'rabanne': 'paco rabanne', 'paco': 'paco rabanne',
  'mugler': 'thierry mugler', 'rodriguez': 'narciso rodriguez',
  'narciso': 'narciso rodriguez',
  'penhaligon': 'penhaligons', 'penhaligons': 'penhaligons',
};

function expandBrandAliases(qNorm) {
  let out = qNorm;
  for (const [alias, full] of Object.entries(BRAND_ALIASES)) {
    if (alias === full) continue;
    const re = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'g');
    out = out.replace(re, (_m, pre, post) => `${pre}${full}${post}`);
  }
  return out;
}

function tokenize(q) {
  return NORM(q).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS_ES.has(t));
}

function expand(tokens) {
  const out = new Set();
  for (const t of tokens) {
    out.add(t);
    const c = QUERY_CONCEPTS[t];
    if (c) for (const k of c) out.add(k);
  }
  return out;
}

function buildIndex(catalog) {
  for (const p of catalog) {
    const parts = [
      p.nombre, p.casa, p.familia,
      ...(p.notas?.salida || []),
      ...(p.notas?.corazon || []),
      ...(p.notas?.fondo || []),
      ...(p.acordes || []),
      ...(p.perfumistas || []),
    ];
    p.__blob = NORM(parts.join(' '));
    p.__quality = (p.rating || 0) * Math.log1p(p.rating_count || 0);
  }
}

function detectMentioned(query, catalog) {
  const qRaw = NORM(query);
  if (qRaw.length < 4) return [];
  const q = expandBrandAliases(qRaw);
  const famous = catalog.slice().sort((a, b) => (b.__quality || 0) - (a.__quality || 0)).slice(0, 400)
    .map((p) => ({ p, n: NORM(p.nombre) })).filter((x) => x.n.length >= 4);
  const out = []; const seen = new Set();
  for (const { p, n } of famous) {
    if (seen.has(p.id)) continue;
    const re = new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
    if (re.test(q)) { out.push(p); seen.add(p.id); if (out.length >= 5) break; }
  }
  // Pattern "NAME de BRAND"
  const re2 = /(?:^|[^a-z0-9])([a-z0-9]{1,12})\s+(?:de|by|of)\s+([a-z][a-z\s]{2,30})/g;
  re2.lastIndex = 0;
  let m;
  const STOP = new Set(['como','algo','que','para','con','sin','muy','mas','menos','pero']);
  while ((m = re2.exec(q)) !== null) {
    const nameQ = m[1].trim();
    const brandQ = m[2].trim().split(/\s+/).slice(0, 4).join(' ');
    if (!nameQ || !brandQ || STOP.has(nameQ)) continue;
    const cands = catalog.filter((p) => {
      const c = NORM(p.casa); const n = NORM(p.nombre);
      const brandMatch = c.includes(brandQ) || brandQ.includes(c);
      if (!brandMatch) return false;
      return n === nameQ || n.startsWith(nameQ + ' ');
    });
    cands.sort((a, b) => (b.__quality || 0) - (a.__quality || 0));
    for (const p of cands) {
      if (!seen.has(p.id)) { out.push(p); seen.add(p.id); }
    }
  }
  return out.slice(0, 20);
}

function prefilter(query, filters, catalog) {
  const baseTokens = tokenize(query);
  const expanded = expand(baseTokens);

  // Alias de marca → keywords expandidas (substring multi-palabra contra el blob)
  const qExpanded = expandBrandAliases(NORM(query));
  for (const [alias, full] of Object.entries(BRAND_ALIASES)) {
    const reAlias = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
    if (reAlias.test(NORM(query)) || qExpanded.includes(full)) expanded.add(full);
  }

  const mentioned = detectMentioned(query, catalog);
  const excludeIds = new Set();
  for (const ref of mentioned) {
    excludeIds.add(ref.id);
    for (const a of (ref.acordes || [])) expanded.add(NORM(a));
    for (const n of (ref.notas?.salida || []))  expanded.add(NORM(n));
    for (const n of (ref.notas?.corazon || [])) expanded.add(NORM(n));
    for (const n of (ref.notas?.fondo || []))   expanded.add(NORM(n));
    if (ref.familia) expanded.add(NORM(ref.familia));
  }
  const expArr = Array.from(expanded).filter((k) => k.length >= 3);
  const lessCommon = /poco\s*com[uú]n|menos\s*com[uú]n|raro|nicho/i.test(query || '');

  let pool = catalog;
  if (filters?.familia) pool = pool.filter((p) => p.familia === filters.familia);
  if (filters?.gender)  pool = pool.filter((p) => p.genero === filters.gender || p.genero === 'unisex');
  if (filters?.season)  pool = pool.filter((p) => (p.temporada || []).includes(filters.season));
  if (excludeIds.size)  pool = pool.filter((p) => !excludeIds.has(p.id));

  const scored = [];
  for (const p of pool) {
    let s = 0;
    for (const t of baseTokens) if (p.__blob.indexOf(t) !== -1) s += 1.5;
    for (const k of expArr) if (p.__blob.indexOf(k) !== -1) s += 2.0;
    const qPrior = 0.04 * (p.__quality || 0);
    s += lessCommon ? -qPrior * 0.5 : qPrior;
    scored.push([s, p]);
  }
  scored.sort((a, b) => b[0] - a[0]);

  const out = [];
  const cnt = new Map();
  for (const [score, p] of scored) {
    const casa = p.casa || 'unknown';
    const n = cnt.get(casa) || 0;
    if (n >= MAX_PER_CASA) continue;
    cnt.set(casa, n + 1);
    out.push({ p, score });
    if (out.length >= CAP) break;
  }
  return { candidates: out, mentioned, expandedSize: expArr.length };
}

async function rankWithClaude(query, filters, candidates) {
  const compact = candidates.map(({ p }) => ({
    id: p.id, nombre: p.nombre, casa: p.casa, ano: p['año'] ?? p.ano,
    notas: p.notas, familia: p.familia, acordes: p.acordes, temporada: p.temporada,
    genero: p.genero, rating: p.rating, rating_count: p.rating_count,
  }));
  const res = await fetch(`${API}/recommendations/rank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, filters, candidates: compact }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const d = await res.json();
  return d.results || [];
}

async function runQuery(query, filters = {}, catalog) {
  console.log('\n' + '═'.repeat(80));
  console.log(`QUERY: "${query}"`);
  if (Object.keys(filters).length) console.log(`FILTROS: ${JSON.stringify(filters)}`);
  console.log('─'.repeat(80));

  const { candidates, mentioned, expandedSize } = prefilter(query, filters, catalog);
  if (mentioned.length) {
    console.log(`MENCIONADOS: ${mentioned.map((m) => m.nombre).join(', ')}`);
  }
  console.log(`Expanded keywords: ${expandedSize}, candidatos prefiltrados: ${candidates.length}`);
  console.log(`Top 5 del prefiltro:`);
  for (const { p, score } of candidates.slice(0, 5)) {
    console.log(`  [${score.toFixed(2)}] ${p.nombre} · ${p.casa} (${p.familia})`);
  }

  console.log('\nClaude rankea…');
  const t0 = Date.now();
  const ranked = await rankWithClaude(query, filters, candidates);
  const ms = Date.now() - t0;

  console.log(`\nRESULTADO (${ms}ms):`);
  for (const r of ranked) {
    const p = candidates.find((c) => c.p.id === r.id)?.p;
    if (!p) continue;
    console.log(`\n  [${r.score}%] ${p.nombre} · ${p.casa} (${p.familia})`);
    console.log(`    Acordes: ${(p.acordes || []).join(', ')}`);
    console.log(`    → ${r.reasoning}`);
  }
}

const RAW = fs.readFileSync(CATALOG, 'utf-8');
const catalog = JSON.parse(RAW).perfumes || JSON.parse(RAW);
console.log(`Catálogo cargado: ${catalog.length} perfumes`);
buildIndex(catalog);

const arg = process.argv.slice(2).join(' ').trim();
const queries = arg ? [arg] : [
  ['Algo dulce y cálido para invierno, gourmand de vainilla', { season: 'invierno' }],
  ['Perfume elegante y discreto para oficina, fresco pero con presencia', {}],
  ['Algo como Sauvage pero más maduro y menos común', {}],
  ['Un oriental especiado con incienso para noches frías', { season: 'invierno' }],
  ['Floral ligero para primera cita en primavera, sin ser empalagoso', { season: 'primavera' }],
];

for (const q of queries) {
  const [query, filters] = Array.isArray(q) ? q : [q, {}];
  try { await runQuery(query, filters, catalog); }
  catch (e) { console.log(`  ERROR: ${e.message}`); }
}
