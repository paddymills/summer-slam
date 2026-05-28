import { createClient } from '@libsql/client/web';
import { checkAuth, checkOperatorAuth } from '../_auth.js';

function getDb(env) {
  return createClient({
    url:       env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

function toTitleCase(s) {
  return (s ?? '').trim().split(/\s+/)
    .map(w => w.split('-').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '').join('-'))
    .join(' ');
}

function toJS(row) {
  return {
    id:             Number(row.id),
    boaterFirst:    row.boater_first     ?? '',
    boaterLast:     row.boater_last      ?? '',
    boaterSuffix:   row.boater_suffix    ?? '',
    boaterPhone:    row.boater_phone     ?? '',
    boaterEmail:    row.boater_email     ?? '',
    coAnglerFirst:  row.co_angler_first  ?? '',
    coAnglerLast:   row.co_angler_last   ?? '',
    coAnglerSuffix: row.co_angler_suffix ?? '',
    coAnglerPhone:  row.co_angler_phone  ?? '',
    coAnglerEmail:  row.co_angler_email  ?? '',
    boatNo:         row.boat_no         ?? '',
    numFish:        row.num_fish        ?? 0,
    lunkerWeight:   row.lunker_weight   ?? 0,
    totalWeight:    row.total_weight    ?? 0,
    lunker:         row.lunker          ?? 0,
    option:         row.option_field    ?? 0,
    paid:           row.paid            ?? 0,
    appSigned:      row.app_signed      ?? 0,
    buyIn:          row.buy_in          ?? 0,
    rawWeight:      row.raw_weight      ?? null,
    deadFish:       row.dead_fish       ?? 0,
    shortFish:      row.short_fish      ?? 0,
    needsAttention: Boolean(row.needs_attention),
    weighedAt:      row.weighed_at      ?? null,
    updatedAt:      row.updated_at      ?? null,
    signedUpAt:     row.signed_up_at    ?? null,
    checkedInAt:    row.checked_in_at   ?? null,
    offWaterAt:       row.off_water_at       ?? null,
    appSignedAt:      row.app_signed_at      ?? null,
    boaterOrderNo:    row.boater_order_no    ?? '',
    coAnglerOrderNo:  row.co_angler_order_no ?? '',
    feeVerified:      row.fee_verified       ?? null,
    boaterSig:        row.boater_sig         ?? null,
    coAnglerSig:      row.co_angler_sig      ?? null,
  };
}

export async function onRequestPut({ params, request, env }) {
  if (!checkOperatorAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^\d+$/.test(params.id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const db   = getDb(env);
    try { await db.execute("ALTER TABLE entries ADD COLUMN fee_verified INTEGER"); } catch (_) {}
    const body = await request.json();
    const t    = v => (v ?? '').trim();

    const newTotalWeight    = Number(body.totalWeight) || 0;
    const preserveWeighTime = body.preserveWeighTime ? 1 : 0;
    const clientWeighedAt   = body.weighedAt  ? String(body.weighedAt)  : null;
    const clientUpdatedAt   = body.updatedAt  ? String(body.updatedAt)  : null;

    // Snapshot before state for event comparison
    const beforeResult = await db.execute({ sql: 'SELECT boat_no, total_weight, off_water_at, checked_in_at, app_signed FROM entries WHERE id=?', args: [params.id] });
    const before = beforeResult.rows[0] ?? {};

    const result = await db.execute({
      sql: `UPDATE entries SET
              boater_first=?, boater_last=?, boater_suffix=?, boater_phone=?, boater_email=?,
              co_angler_first=?, co_angler_last=?, co_angler_suffix=?, co_angler_phone=?, co_angler_email=?,
              boat_no=?, num_fish=?, lunker_weight=?, total_weight=?,
              lunker=?, option_field=?, paid=?, app_signed=?, buy_in=?,
              raw_weight=?, dead_fish=?, short_fish=?, needs_attention=?,
              boater_order_no=?, co_angler_order_no=?,
              fee_verified  = CASE WHEN ? IS NOT NULL THEN ? ELSE fee_verified END,
              signed_up_at  = CASE WHEN signed_up_at IS NULL AND ? != '' THEN CURRENT_TIMESTAMP ELSE signed_up_at END,
              weighed_at   = CASE WHEN ? > 0 AND ? = 0 THEN COALESCE(?, CURRENT_TIMESTAMP) ELSE weighed_at END,
              checked_in_at = CASE WHEN ? = 1 AND checked_in_at IS NULL THEN CURRENT_TIMESTAMP ELSE checked_in_at END,
              off_water_at  = CASE WHEN ? = 1 THEN NULLIF(?, '') WHEN ? = 1 THEN COALESCE(off_water_at, CURRENT_TIMESTAMP) WHEN ? = 0 THEN NULL ELSE off_water_at END,
              app_signed_at = CASE WHEN ? = 1 AND app_signed_at IS NULL THEN CURRENT_TIMESTAMP WHEN ? = 0 THEN NULL ELSE app_signed_at END,
              updated_at   = CURRENT_TIMESTAMP
            WHERE id=? AND (? IS NULL OR updated_at = ?)`,
      args: [
        toTitleCase(body.boaterFirst),   toTitleCase(body.boaterLast),   t(body.boaterSuffix ?? ''),   t(body.boaterPhone),   t(body.boaterEmail),
        toTitleCase(body.coAnglerFirst), toTitleCase(body.coAnglerLast), t(body.coAnglerSuffix ?? ''), t(body.coAnglerPhone), t(body.coAnglerEmail),
        t(body.boatNo),
        Number(body.numFish)      || 0,
        Number(body.lunkerWeight) || 0,
        newTotalWeight,
        body.lunker    === '' ? null : Number(body.lunker),
        body.option    === '' ? null : Number(body.option),
        body.paid      === '' ? null : Number(body.paid),
        body.appSigned === '' ? null : Number(body.appSigned),
        Number(body.buyIn) || 0,
        body.rawWeight != null ? Number(body.rawWeight) : null,
        Number(body.deadFish)  || 0,
        Number(body.shortFish) || 0,
        body.needsAttention ? 1 : 0,
        t(body.boaterOrderNo   ?? ''),
        t(body.coAnglerOrderNo ?? ''),
        body.feeVerified != null ? Number(body.feeVerified) : null,
        body.feeVerified != null ? Number(body.feeVerified) : null,
        t(body.boaterFirst),
        newTotalWeight, preserveWeighTime, clientWeighedAt,
        body.markCheckedIn ? 1 : 0,
        body.offWaterAtDirect ? 1 : 0,
        body.offWaterAtDirect ? (body.offWaterAt || '') : '',
        body.offWater === true ? 1 : body.offWater === false ? 0 : -1,
        body.offWater === true ? 1 : body.offWater === false ? 0 : -1,
        body.appSigned === '' ? 0 : Number(body.appSigned),
        body.appSigned === '' ? 0 : Number(body.appSigned),
        params.id, clientUpdatedAt, clientUpdatedAt,
      ],
    });

    if (result.rowsAffected === 0) {
      const check = await db.execute({ sql: 'SELECT id FROM entries WHERE id=?', args: [params.id] });
      if (!check.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ error: 'conflict' }, { status: 409 });
    }

    const updated = await db.execute({ sql: 'SELECT * FROM entries WHERE id = ?', args: [params.id] });
    let after = updated.rows[0];

    // Auto-assign next boat number if draw has run and entry is now paid + signed without a number
    if ((!after.boat_no || after.boat_no.trim() === '') && Number(after.paid) === 1 && Number(after.app_signed) === 1) {
      try {
        const drawCheck = await db.execute(
          `SELECT MAX(CAST(boat_no AS REAL)) as maxNo FROM entries WHERE boat_no IS NOT NULL AND boat_no != '' AND id != ?`,
          [params.id]
        );
        const maxNo = drawCheck.rows[0]?.maxNo;
        if (maxNo != null && maxNo > 0) {
          const nextNo = Math.floor(maxNo) + 1;
          await db.execute({ sql: 'UPDATE entries SET boat_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', args: [String(nextNo), params.id] });
          const refreshed = await db.execute({ sql: 'SELECT * FROM entries WHERE id = ?', args: [params.id] });
          after = refreshed.rows[0];
        }
      } catch (_) {}
    }

    const boaterName = [after.boater_first, after.boater_last, after.boater_suffix].filter(Boolean).join(' ');
    const afterBoat  = after.boat_no ?? '';

    // Write lifecycle events (best-effort)
    try {
      await db.execute('CREATE TABLE IF NOT EXISTS event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, entry_id INTEGER, boat_no TEXT, boater_name TEXT, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      const events = [];

      // Check-in: physical arrival marked from check-in tab
      if (body.markCheckedIn && !before.checked_in_at) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['checkin', params.id, afterBoat, boaterName, 'arrived'] });
      }
      // Signed: appSigned newly set to 1
      const wasUnsigned = Number(before.app_signed) !== 1;
      if (wasUnsigned && Number(body.appSigned) === 1) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['signed', params.id, afterBoat, boaterName, 'signed'] });
      }
      // Boat# assigned or changed (draw / manual edit)
      const newBoatNo = t(body.boatNo);
      if (newBoatNo && (before.boat_no ?? '') !== newBoatNo) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['boatdraw', params.id, newBoatNo, boaterName, newBoatNo] });
      }

      // Check-out: off-water toggled either direction
      if (body.offWater === true) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['checkout', params.id, afterBoat, boaterName, 'checked out'] });
      } else if (body.offWater === false) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['checkout', params.id, afterBoat, boaterName, 'returned to water'] });
      }

      // Weigh-in: weight intentionally set (weighedAt provided by client)
      if (clientWeighedAt && newTotalWeight > 0) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['weighin', params.id, afterBoat, boaterName, String(newTotalWeight)] });
      }

      if (events.length > 0) await db.batch(events);
    } catch (_) {}

    return Response.json(toJS(after));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// No auth required — angler self-signs. Only works on unsigned entries; fee is flagged for operator verification.
export async function onRequestPatch({ params, request, env }) {
  if (!/^\d+$/.test(params.id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const db   = getDb(env);
    try { await db.execute("ALTER TABLE entries ADD COLUMN fee_verified INTEGER"); } catch (_) {}
    try { await db.execute("ALTER TABLE entries ADD COLUMN boater_sig TEXT"); } catch (_) {}
    try { await db.execute("ALTER TABLE entries ADD COLUMN co_angler_sig TEXT"); } catch (_) {}
    const body = await request.json();
    if (!body.customerSign) return Response.json({ error: 'Missing customerSign flag' }, { status: 400 });

    // Guard: only unsigned entries can be customer-signed
    const check = await db.execute({ sql: 'SELECT app_signed FROM entries WHERE id=?', args: [params.id] });
    if (!check.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    if (Number(check.rows[0].app_signed) === 1) return Response.json({ error: 'Already signed' }, { status: 409 });

    await db.execute({
      sql: `UPDATE entries SET
              app_signed=1, fee_verified=0, buy_in=?, lunker=?, option_field=?, paid=0,
              app_signed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP,
              boater_sig     = COALESCE(?, boater_sig),
              co_angler_sig  = COALESCE(?, co_angler_sig),
              boater_phone   = CASE WHEN (boater_phone   IS NULL OR boater_phone   = '') AND ? != '' THEN ? ELSE boater_phone   END,
              co_angler_phone= CASE WHEN (co_angler_phone IS NULL OR co_angler_phone= '') AND ? != '' THEN ? ELSE co_angler_phone END,
              boater_order_no    = CASE WHEN ? != '' THEN ? ELSE boater_order_no    END,
              co_angler_order_no = CASE WHEN ? != '' THEN ? ELSE co_angler_order_no END
            WHERE id=?`,
      args: [
        Number(body.buyIn) || 0,
        Number(body.lunker) || 0,
        Number(body.option) || 0,
        body.boaterSig    ?? null,
        body.coAnglerSig  ?? null,
        body.boaterPhone ?? '', body.boaterPhone ?? '',
        body.coAnglerPhone ?? '', body.coAnglerPhone ?? '',
        (body.boaterOrderNo    ?? '').trim(), (body.boaterOrderNo    ?? '').trim(),
        (body.coAnglerOrderNo  ?? '').trim(), (body.coAnglerOrderNo  ?? '').trim(),
        params.id,
      ],
    });

    // Log the sign event
    try {
      await db.execute('CREATE TABLE IF NOT EXISTS event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, entry_id INTEGER, boat_no TEXT, boater_name TEXT, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      const entry = (await db.execute({ sql: 'SELECT boater_first, boater_last, boater_suffix, boat_no FROM entries WHERE id=?', args: [params.id] })).rows[0];
      const name  = [entry?.boater_first, entry?.boater_last, entry?.boater_suffix].filter(Boolean).join(' ');
      await db.execute({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['signed', params.id, entry?.boat_no ?? '', name, 'customer-signed'] });
    } catch (_) {}

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ params, request, env }) {
  const isAdmin    = checkAuth(request, env);
  const isOperator = checkOperatorAuth(request, env);
  if (!isOperator) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^\d+$/.test(params.id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const db = getDb(env);

    // Read entry before deleting so we can clean up contact waiver data
    const entryResult = await db.execute({
      sql: 'SELECT boater_first, boater_last, boater_phone, co_angler_first, co_angler_last, co_angler_phone, app_signed FROM entries WHERE id=?',
      args: [params.id],
    });
    const entry = entryResult.rows[0];

    // Operators can only delete unsigned (pending) entries; admin can delete any
    if (!isAdmin && Number(entry?.app_signed) === 1) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.execute({ sql: 'DELETE FROM entries WHERE id = ?', args: [params.id] });

    // If the entry had a signed application, clear the waiver data from the associated contacts
    if (entry?.app_signed === 1) {
      const norm = s => (s || '').toLowerCase().trim();
      const clearWaiver = async (first, last) => {
        if (!first && !last) return;
        const rows = await db.execute({
          sql: 'SELECT id FROM contacts WHERE LOWER(TRIM(first_name))=? AND LOWER(TRIM(last_name))=?',
          args: [norm(first), norm(last)],
        });
        for (const row of rows.rows) {
          await db.execute({
            sql: 'UPDATE contacts SET signature=NULL, signed_at=NULL, waiver_year=NULL, waiver_snapshot=NULL WHERE id=?',
            args: [row.id],
          });
        }
      };
      await clearWaiver(entry.boater_first, entry.boater_last);
      if (entry.co_angler_first || entry.co_angler_last) {
        await clearWaiver(entry.co_angler_first, entry.co_angler_last);
      }
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
