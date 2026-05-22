import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

const vars = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const client = createClient({ url: vars.TURSO_DATABASE_URL, authToken: vars.TURSO_AUTH_TOKEN });

const SUFFIX_RE = /\s+(jr\.?|sr\.?|iv|iii|ii|v)\.?$/i;

function normalizeSuffix(raw) {
  const s = raw.trim().toUpperCase().replace(/\.$/, '');
  if (s === 'JR') return 'Jr.';
  if (s === 'SR') return 'Sr.';
  return s;
}

function extractSuffix(last) {
  const m = (last || '').match(SUFFIX_RE);
  if (!m) return null;
  return { base: last.slice(0, m.index).trim(), suffix: normalizeSuffix(m[1]) };
}

async function addColumn(table, colDef) {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    console.log(`  ✓ Added ${colDef.split(' ')[0]} to ${table}`);
  } catch (e) {
    if (e.message?.includes('duplicate') || e.message?.includes('already exists')) {
      console.log(`  · ${colDef.split(' ')[0]} already exists in ${table}`);
    } else throw e;
  }
}

async function run() {
  console.log('\n── Step 1: Add suffix columns ──');
  await addColumn('entries',  "boater_suffix TEXT DEFAULT ''");
  await addColumn('entries',  "co_angler_suffix TEXT DEFAULT ''");
  await addColumn('contacts', "suffix TEXT DEFAULT ''");
  await addColumn('archives', "boater_suffix TEXT DEFAULT ''");
  await addColumn('archives', "co_angler_suffix TEXT DEFAULT ''");

  console.log('\n── Step 2: Fix typos ──');
  for (const [from, to, table, col] of [
    ['Limkey', 'Linkey', 'contacts', 'last_name'],
    ['Limkey', 'Linkey', 'entries',  'boater_last'],
    ['Limkey', 'Linkey', 'entries',  'co_angler_last'],
    ['Limkey', 'Linkey', 'archives', 'boater_last'],
    ['Limkey', 'Linkey', 'archives', 'co_angler_last'],
    ['Ree',    'Rea',    'contacts', 'last_name'],
    ['Ree',    'Rea',    'entries',  'boater_last'],
    ['Ree',    'Rea',    'entries',  'co_angler_last'],
    ['Ree',    'Rea',    'archives', 'boater_last'],
    ['Ree',    'Rea',    'archives', 'co_angler_last'],
  ]) {
    const r = await client.execute({ sql: `UPDATE ${table} SET ${col}=? WHERE ${col}=? COLLATE NOCASE`, args: [to, from] });
    if (r.rowsAffected > 0) console.log(`  ✓ ${r.rowsAffected} row(s): ${table}.${col} "${from}" → "${to}"`);
  }

  // ── Step 3: Rebuild contacts table with new UNIQUE(first_name, last_name, suffix, phone) ──
  console.log('\n── Step 3: Rebuild contacts table with suffix-aware unique constraint ──');

  const contactRows = await client.execute('SELECT * FROM contacts ORDER BY id ASC');
  console.log(`  Read ${contactRows.rows.length} contact(s) from DB`);

  // Compute clean last_name and suffix for each contact
  const cleaned = contactRows.rows.map(r => {
    const s = extractSuffix(r.last_name);
    return {
      id:         r.id,
      first_name: r.first_name,
      last_name:  s ? s.base : (r.last_name ?? ''),
      suffix:     s ? s.suffix : (r.suffix ?? ''),
      phone:      r.phone ?? '',
      email:      r.email ?? '',
      last_seen:  r.last_seen ?? null,
    };
  });

  // Check for logical duplicates (same first, last, suffix, phone) before rebuilding
  const seen = new Map();
  const dupes = [];
  for (const c of cleaned) {
    const key = `${c.first_name.toLowerCase()}|${c.last_name.toLowerCase()}|${c.suffix.toLowerCase()}|${(c.phone || '').replace(/\D/g, '')}`;
    if (seen.has(key)) {
      dupes.push({ keep: seen.get(key), drop: c });
    } else {
      seen.set(key, c);
    }
  }
  if (dupes.length > 0) {
    console.log(`  ⚠ ${dupes.length} logical duplicate(s) — keeping higher last_seen, dropping:`);
    dupes.forEach(d => console.log(`    DROP id=${d.drop.id} ${d.drop.first_name} ${d.drop.last_name} ${d.drop.suffix}`));
  }
  const dropIds = new Set(dupes.map(d => d.drop.id));
  const toInsert = cleaned.filter(c => !dropIds.has(c.id));

  // Rebuild
  const rebuildStmts = [
    `DROP TABLE IF EXISTS contacts_new`,
    `CREATE TABLE contacts_new (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL COLLATE NOCASE,
      last_name  TEXT NOT NULL COLLATE NOCASE,
      suffix     TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
      phone      TEXT DEFAULT '',
      email      TEXT DEFAULT '',
      last_seen  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(first_name, last_name, suffix, phone)
    )`,
    ...toInsert.map(c => ({
      sql:  `INSERT INTO contacts_new (id, first_name, last_name, suffix, phone, email, last_seen) VALUES (?,?,?,?,?,?,?)`,
      args: [c.id, c.first_name, c.last_name, c.suffix, c.phone, c.email, c.last_seen],
    })),
    `DROP TABLE contacts`,
    `ALTER TABLE contacts_new RENAME TO contacts`,
  ];
  await client.batch(rebuildStmts, 'write');
  console.log(`  ✓ contacts rebuilt: ${toInsert.length} rows, new UNIQUE(first_name, last_name, suffix, phone)`);

  // ── Step 4: Migrate entries and archives (no unique constraint) ──
  console.log('\n── Step 4: Migrate entries ──');
  const entries = await client.execute('SELECT id, boater_last, co_angler_last FROM entries');
  const entryStmts = [];
  for (const r of entries.rows) {
    const b = extractSuffix(r.boater_last);
    if (b) entryStmts.push({ sql: 'UPDATE entries SET boater_last=?, boater_suffix=? WHERE id=?', args: [b.base, b.suffix, r.id] });
    const c = extractSuffix(r.co_angler_last);
    if (c) entryStmts.push({ sql: 'UPDATE entries SET co_angler_last=?, co_angler_suffix=? WHERE id=?', args: [c.base, c.suffix, r.id] });
  }
  if (entryStmts.length) {
    await client.batch(entryStmts, 'write');
    console.log(`  ✓ ${entryStmts.length} entry field(s) updated`);
  } else {
    console.log('  · No entry fields needed migration');
  }

  console.log('\n── Step 5: Migrate archives ──');
  const archives = await client.execute('SELECT id, boater_last, co_angler_last FROM archives');
  const archiveStmts = [];
  for (const r of archives.rows) {
    const b = extractSuffix(r.boater_last);
    if (b) archiveStmts.push({ sql: 'UPDATE archives SET boater_last=?, boater_suffix=? WHERE id=?', args: [b.base, b.suffix, r.id] });
    const c = extractSuffix(r.co_angler_last);
    if (c) archiveStmts.push({ sql: 'UPDATE archives SET co_angler_last=?, co_angler_suffix=? WHERE id=?', args: [c.base, c.suffix, r.id] });
  }
  if (archiveStmts.length) {
    await client.batch(archiveStmts, 'write');
    console.log(`  ✓ ${archiveStmts.length} archive field(s) updated`);
  } else {
    console.log('  · No archive fields needed migration');
  }

  console.log('\n── Step 6: Verify ──');
  const remaining = await client.execute(`
    SELECT COUNT(*) as c FROM (
      SELECT boater_last as n FROM entries WHERE boater_last LIKE '% Jr%' OR boater_last LIKE '% Sr%'
        OR boater_last LIKE '% II' OR boater_last LIKE '% III' OR boater_last LIKE '% IV'
      UNION ALL SELECT co_angler_last FROM entries WHERE co_angler_last LIKE '% Jr%' OR co_angler_last LIKE '% Sr%'
        OR co_angler_last LIKE '% II' OR co_angler_last LIKE '% III' OR co_angler_last LIKE '% IV'
      UNION ALL SELECT last_name FROM contacts WHERE last_name LIKE '% Jr%' OR last_name LIKE '% Sr%'
        OR last_name LIKE '% II' OR last_name LIKE '% III' OR last_name LIKE '% IV'
    )
  `);
  const n = Number(remaining.rows[0]?.c ?? 0);
  console.log(n === 0 ? '  ✓ Migration complete — no embedded suffixes remain' : `  ⚠ ${n} rows still have embedded suffixes`);

  // Sample suffix data
  const sample = await client.execute(`SELECT first_name, last_name, suffix FROM contacts WHERE suffix != '' ORDER BY last_name LIMIT 20`);
  console.log(`\n  Sample contacts with suffix field set:`);
  for (const r of sample.rows) console.log(`    ${r.first_name} ${r.last_name} [${r.suffix}]`);
}

run().catch(e => { console.error(e); process.exit(1); });
