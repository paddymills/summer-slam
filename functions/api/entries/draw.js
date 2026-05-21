import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db   = getDb(env);
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || 'redraw'; // 'redraw' | 'missing'

    const result  = await db.execute('SELECT id, boat_no FROM entries WHERE paid = 1 AND app_signed = 1');
    const entries = result.rows;

    if (entries.length === 0) return Response.json({ count: 0, mode });

    let statements = [];
    let count = 0;

    if (mode === 'missing') {
      const without = entries.filter(e => !e.boat_no || e.boat_no.trim() === '');
      if (without.length === 0) return Response.json({ count: 0, mode });

      // Build a set of all numeric boat numbers already in use
      const usedNos = new Set(
        entries
          .filter(e => e.boat_no && e.boat_no.trim() !== '')
          .map(e => parseInt(e.boat_no, 10))
          .filter(n => !isNaN(n))
      );

      // Fill from 1 upward, skipping any already-used numbers
      let candidate = 1;
      for (const e of without) {
        while (usedNos.has(candidate)) candidate++;
        usedNos.add(candidate);
        statements.push({
          sql:  'UPDATE entries SET boat_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          args: [String(candidate), e.id],
        });
        candidate++;
      }
      count = without.length;
    } else {
      // redraw — shuffle all eligible entries and assign 1-N
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      statements = shuffled.map((e, i) => ({
        sql:  'UPDATE entries SET boat_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [String(i + 1), e.id],
      }));
      count = shuffled.length;
    }

    // Execute all updates atomically — no partial state on failure
    await db.batch(statements);

    try {
      await db.execute('CREATE TABLE IF NOT EXISTS event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, entry_id INTEGER, boat_no TEXT, boater_name TEXT, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      await db.execute({ sql: 'INSERT INTO event_log (event_type, value) VALUES (?,?)', args: ['boat_draw', JSON.stringify({ mode, count })] });
    } catch (_) {}

    return Response.json({ count, mode });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
