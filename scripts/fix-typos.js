import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
const vars = Object.fromEntries(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const db = createClient({ url: vars.TURSO_DATABASE_URL, authToken: vars.TURSO_AUTH_TOKEN });

// Contact 249 (Thomas Linkey Sr., phone="") is a duplicate artifact from the old "Limkey" typo.
// Contact 829 (Thomas Linkey Sr., phone="443-206-2013") is the real contact.
// Safe to delete 249 — no entries or archives reference it (none had "Limkey" in name fields).
const r = await db.execute({ sql: 'DELETE FROM contacts WHERE id=249', args: [] });
console.log(`Deleted contact 249 (Thomas Linkey Sr., no phone — typo artifact): ${r.rowsAffected} row`);

// Final state
const linkey = await db.execute("SELECT id,first_name,last_name,suffix,phone FROM contacts WHERE last_name='Linkey'");
console.log('Thomas Linkey contacts now:', linkey.rows.map(r=>`id=${r.id} [${r.suffix}] ph="${r.phone}"`).join(', '));
