import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __d = path.dirname(fileURLToPath(import.meta.url));
const RAW = fs.readFileSync(path.resolve(__d, '../../data/catalog.json'), 'utf-8');
const cat = JSON.parse(RAW).perfumes || JSON.parse(RAW);

console.log(`Catálogo: ${cat.length} perfumes\n`);

console.log('=== Búsqueda de Y de YSL ===');
const yLike = cat.filter((p) => /yves saint laurent/i.test(p.casa || '') && /^y( |$)/i.test(p.nombre || ''));
for (const p of yLike.slice(0, 15)) {
  const q = (p.rating || 0) * Math.log1p(p.rating_count || 0);
  console.log(`  "${p.nombre}" | casa: ${p.casa} | rating: ${p.rating} (${p.rating_count}) | q=${q.toFixed(2)}`);
}

console.log('\n=== ¿Contiene "ysl" en el blob? ===');
const yslMatches = cat.filter((p) => {
  const blob = [
    p.nombre, p.casa, p.familia,
    ...(p.notas?.salida || []), ...(p.notas?.corazon || []), ...(p.notas?.fondo || []),
    ...(p.acordes || []), ...(p.perfumistas || []),
  ].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return blob.includes('ysl');
});
console.log(`  Perfumes con "ysl" en algún campo: ${yslMatches.length}`);
for (const p of yslMatches.slice(0, 5)) console.log(`    "${p.nombre}" · ${p.casa}`);

console.log('\n=== Stronger With You ===');
const sw = cat.filter((p) => /stronger with you/i.test(p.nombre || ''));
for (const p of sw.slice(0, 5)) {
  const q = (p.rating || 0) * Math.log1p(p.rating_count || 0);
  console.log(`  "${p.nombre}" · ${p.casa} | rating: ${p.rating} (${p.rating_count}) | q=${q.toFixed(2)}`);
}

console.log('\n=== Top 5 perfumes por quality (sin filtros) ===');
const top = cat.slice().sort((a, b) => {
  const qa = (a.rating || 0) * Math.log1p(a.rating_count || 0);
  const qb = (b.rating || 0) * Math.log1p(b.rating_count || 0);
  return qb - qa;
}).slice(0, 8);
for (const p of top) {
  const q = (p.rating || 0) * Math.log1p(p.rating_count || 0);
  console.log(`  q=${q.toFixed(2)} · "${p.nombre}" · ${p.casa}`);
}
