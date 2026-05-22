import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
const vars = Object.fromEntries(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const db = createClient({ url: vars.TURSO_DATABASE_URL, authToken: vars.TURSO_AUTH_TOKEN });

const r1 = await db.execute("SELECT id,first_name,last_name,suffix FROM contacts WHERE last_name='Limkey' OR last_name='Ree' OR last_name LIKE 'Limkey%' OR last_name LIKE 'Ree %'");
console.log('Contacts with Limkey or Ree last names:', r1.rows.length);
r1.rows.forEach(r => console.log(' ', r.id, r.first_name, r.last_name, '[' + r.suffix + ']'));

const r2 = await db.execute("SELECT id,first_name,last_name,suffix FROM contacts WHERE first_name='Thomas' OR (first_name='Michael' AND last_name='Rea') OR (first_name='Michael' AND last_name='Ree')");
console.log('\nThomas / Michael Rea contacts:');
r2.rows.forEach(r => console.log(' ', r.id, r.first_name, r.last_name, '[' + r.suffix + ']'));
