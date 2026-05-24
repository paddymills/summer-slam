import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

const vars = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const client = createClient({ url: vars.TURSO_DATABASE_URL, authToken: vars.TURSO_AUTH_TOKEN });

const SUFFIX_RE = /\b(jr\.?|sr\.?|ii|iii|iv|v)\.?$/i;

function extractSuffix(last) {
  const m = last.match(SUFFIX_RE);
  return m ? { base: last.slice(0, m.index).trim(), suffix: m[0].replace(/\.$/, '').toUpperCase().replace('JR', 'Jr.').replace('SR', 'Sr.') } : null;
}

async function run() {
  const [entries, contacts, archives] = await Promise.all([
    client.execute('SELECT id, boater_first, boater_last, co_angler_first, co_angler_last FROM entries ORDER BY boater_last'),
    client.execute('SELECT id, first_name, last_name FROM contacts ORDER BY last_name'),
    client.execute('SELECT id, boater_first, boater_last, co_angler_first, co_angler_last, year FROM archives ORDER BY boater_last'),
  ]);

  const hits = [];

  for (const r of entries.rows) {
    const b = extractSuffix(r.boater_last || '');
    if (b) hits.push({ table: 'entries', id: r.id, role: 'boater', first: r.boater_first, last: r.boater_last, baseLast: b.base, suffix: b.suffix });
    const c = extractSuffix(r.co_angler_last || '');
    if (c) hits.push({ table: 'entries', id: r.id, role: 'co_angler', first: r.co_angler_first, last: r.co_angler_last, baseLast: c.base, suffix: c.suffix });
  }

  for (const r of contacts.rows) {
    const s = extractSuffix(r.last_name || '');
    if (s) hits.push({ table: 'contacts', id: r.id, role: 'contact', first: r.first_name, last: r.last_name, baseLast: s.base, suffix: s.suffix });
  }

  for (const r of archives.rows) {
    const b = extractSuffix(r.boater_last || '');
    if (b) hits.push({ table: 'archives', id: r.id, year: r.year, role: 'boater', first: r.boater_first, last: r.boater_last, baseLast: b.base, suffix: b.suffix });
    const c = extractSuffix(r.co_angler_last || '');
    if (c) hits.push({ table: 'archives', id: r.id, year: r.year, role: 'co_angler', first: r.co_angler_first, last: r.co_angler_last, baseLast: c.base, suffix: c.suffix });
  }

  if (hits.length === 0) {
    console.log('No suffix patterns found in any name fields.');
    return;
  }

  console.log(`\nFound ${hits.length} name(s) with embedded suffixes:\n`);
  console.log('TABLE       | ID   | ROLE       | CURRENT NAME              | PROPOSED SPLIT');
  console.log('------------|------|------------|---------------------------|--------------------------------');
  for (const h of hits) {
    const cur = `${h.first} ${h.last}`.padEnd(25);
    const prop = `${h.first} ${h.baseLast} [${h.suffix}]`;
    const loc = h.year ? `${h.table}/${h.year}` : h.table;
    console.log(`${loc.padEnd(11)} | ${String(h.id).padEnd(4)} | ${h.role.padEnd(10)} | ${cur} | ${prop}`);
  }
  console.log('\nReview the above and confirm before running the migration.');
}

run().catch(e => { console.error(e); process.exit(1); });
