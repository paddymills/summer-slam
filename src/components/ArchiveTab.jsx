import { useState, useEffect } from 'react';
import { fetchArchiveYears, fetchArchive } from '../utils/api';
import { exportHTML } from '../utils/exportHtml';
import { viewArchivedWaiver } from '../utils/printWaivers';
import { useConfirm } from '../hooks/useConfirm';

export default function ArchiveTab({ isUnlocked, rosterCount, onLoadArchive, settings, isAdmin }) {
  const [years, setYears]       = useState([]);
  const [activeYear, setActiveYear] = useState(null);
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError]       = useState(null);
  const { confirm: showConfirm, confirmDialog } = useConfirm();

  useEffect(() => {
    fetchArchiveYears()
      .then(data => {
        setYears(data);
        if (data.length > 0) setActiveYear(data[0]);
      })
      .catch(() => setError('Failed to load archive years'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeYear) return;
    setLoadingEntries(true);
    fetchArchive(activeYear)
      .then(setEntries)
      .catch(() => setError(`Failed to load ${activeYear} archive`))
      .finally(() => setLoadingEntries(false));
  }, [activeYear, isAdmin]);

  if (loading) {
    return (
      <div className="tab-panel active" style={{ textAlign: 'center', padding: 60, color: 'var(--header-bg)' }}>
        Loading archive…
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-panel active" style={{ textAlign: 'center', padding: 60, color: '#ff9090' }}>
        {error}
      </div>
    );
  }

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold-light)' }}>
          🗂️ Tournament Archive
        </span>

        <div style={{ flex: 1 }} />

        {years.length > 0 && (
          <>
            <label htmlFor="archive-year" style={{ color: 'var(--header-bg)', fontSize: 14 }}>Year:</label>
            <select
              id="archive-year"
              name="year"
              value={activeYear ?? ''}
              onChange={e => setActiveYear(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(139,180,225,0.35)',
                borderRadius: 8,
                color: 'var(--white)',
                fontSize: 14,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {isUnlocked && (
              <button
                className="btn btn-primary"
                disabled={rosterCount > 0}
                title={rosterCount > 0 ? 'Clear the roster before loading an archive' : `Load ${activeYear} entries into the roster for editing`}
                onClick={async () => {
                  if (!(await showConfirm(`Load ${entries.length} entries from ${activeYear} into the roster? You can edit them there and re-archive when done.`, { confirmLabel: 'Load' }))) return;
                  onLoadArchive(entries);
                }}
              >
                ↩ Load into Roster
              </button>
            )}
            <button
              className="btn btn-outline"
              onClick={() => {
                const ranked = entries.map(e => ({ ...e, _rank: e.place }));
                exportHTML(ranked, `Summer Slam ${activeYear} Results`);
              }}
            >
              📄 Export HTML
            </button>
          </>
        )}
      </div>

      {years.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--header-bg)' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No archives yet.</p>
          <p style={{ fontSize: 14 }}>Use the "Archive Year" button on the Roster tab to save a season's results.</p>
        </div>
      ) : (
        <>
          <div style={{ maxWidth: 900, margin: '0 auto 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--header-bg)', fontSize: 13 }}>
              <strong style={{ color: 'var(--gold-light)' }}>{entries.length}</strong> entries
            </span>
            <span style={{ color: 'var(--header-bg)', fontSize: 12, opacity: 0.6 }}>— read only</span>
            {isUnlocked && rosterCount > 0 && (
              <span style={{ fontSize: 12, color: '#ffb450', marginLeft: 8 }}>
                ⚠️ Clear the roster ({rosterCount} {rosterCount === 1 ? 'entry' : 'entries'}) before loading an archive
              </span>
            )}
          </div>

          {loadingEntries ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--header-bg)' }}>Loading…</div>
          ) : (
            <div className="table-wrapper">
              <table className="roster-table archive-roster-table" style={{ tableLayout: 'fixed', minWidth: 760 }}>
                <colgroup>
                  <col style={{ width: 60 }} />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col className="art-hide-mobile" style={{ width: 72 }} />
                  <col className="art-hide-mobile" style={{ width: 96 }} />
                  <col className="art-hide-mobile" style={{ width: 64 }} />
                  <col style={{ width: 110 }} />
                  {isAdmin && <col className="art-hide-mobile" style={{ width: 80 }} />}
                  <col className="art-hide-mobile" style={{ width: 80 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Place</th>
                    <th style={{ textAlign: 'left' }}>Boater First</th>
                    <th style={{ textAlign: 'left' }}>Boater Last</th>
                    <th style={{ textAlign: 'left' }}>Co-Angler First</th>
                    <th style={{ textAlign: 'left' }}>Co-Angler Last</th>
                    <th className="art-hide-mobile" style={{ textAlign: 'left' }}>Boat #</th>
                    <th className="art-hide-mobile" style={{ textAlign: 'right' }}>Lunker (lbs)</th>
                    <th className="art-hide-mobile" style={{ textAlign: 'center' }}># Fish</th>
                    <th style={{ textAlign: 'right' }}>Total Wt (lbs)</th>
                    {isAdmin && <th className="art-hide-mobile" style={{ textAlign: 'right' }}>Buy-In</th>}
                    <th className="art-hide-mobile" style={{ textAlign: 'center' }}>Waiver</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(row => {
                    const rank = row.place;
                    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
                    const hasSig = !!(row.boaterSignature || row.coAnglerSignature);
                    return (
                      <tr key={row.id}>
                        <td className={`rank-cell ${rankClass}`}>{rank ?? ''}</td>
                        <td className="td-name">{row.boaterFirst}</td>
                        <td className="td-name">{row.boaterLast}</td>
                        <td className="td-name">{row.coAnglerFirst}</td>
                        <td className="td-name">{row.coAnglerLast}</td>
                        <td className="art-hide-mobile" style={{ padding: '8px 12px' }}>{row.boatNo}</td>
                        <td className="art-hide-mobile" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '—'}
                        </td>
                        <td className="art-hide-mobile" style={{ textAlign: 'center' }}>
                          {row.numFish > 0 ? row.numFish : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#e8c876' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            {parseFloat(row.totalWeight) > 0 ? parseFloat(row.totalWeight).toFixed(2) : '—'}
                            {row.rawWeight > 0 && (
                              <span style={{ fontSize: 11, background: 'rgba(255,107,107,0.25)', color: '#ff9090', borderRadius: 4, padding: '1px 5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                −{(row.rawWeight - parseFloat(row.totalWeight)).toFixed(2)}
                              </span>
                            )}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="art-hide-mobile" style={{ textAlign: 'right', padding: '8px 12px' }}>
                            {row.buyIn > 0 ? `$${Number(row.buyIn).toFixed(2)}` : '—'}
                          </td>
                        )}
                        <td className="art-hide-mobile" style={{ textAlign: 'center', padding: '6px 8px' }}>
                          {hasSig ? (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => {
                                const snap = row.waiverSnapshot ? JSON.parse(row.waiverSnapshot) : {};
                                const sigDate = row.appSignedAt ?? null;
                                viewArchivedWaiver(
                                  row,
                                  row.boaterSignature    ? { signature: row.boaterSignature,    signedAt: sigDate } : null,
                                  row.coAnglerSignature  ? { signature: row.coAnglerSignature,  signedAt: sigDate } : null,
                                  { ...settings, tournamentDate: snap.tournamentDate ?? settings?.tournamentDate, tournamentLocation: snap.tournamentLocation ?? settings?.tournamentLocation },
                                );
                              }}
                            >
                              View
                            </button>
                          ) : (
                            <span style={{ color: 'var(--header-bg)', fontSize: 11 }}>
                              {row.appSigned ? 'Paper' : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {isAdmin && entries.length > 0 && !loadingEntries && (
        <AdminArchiveLog entries={entries} year={activeYear} />
      )}

      {confirmDialog}
    </div>
  );
}

function AdminArchiveLog({ entries, year }) {
  const [open, setOpen] = useState(false);

  const events = [];
  const name = e => [e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || `Boat #${e.boatNo || '?'}`;

  for (const e of entries) {
    if (e.signedUpAt)   events.push({ ts: e.signedUpAt,   label: `${name(e)} signed up`,                                                         boat: e.boatNo });
    if (e.checkedInAt)  events.push({ ts: e.checkedInAt,  label: `${name(e)} checked in`,                                                          boat: e.boatNo });
    if (e.offWaterAt)   events.push({ ts: e.offWaterAt,   label: `${name(e)} off water`,                                                            boat: e.boatNo });
    if (e.weighedAt)    events.push({ ts: e.weighedAt,    label: `${name(e)} weighed in${parseFloat(e.totalWeight) > 0 ? ` — ${parseFloat(e.totalWeight).toFixed(2)} lbs` : ''}`, boat: e.boatNo });
  }

  events.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const fmt = ts => {
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div style={{ maxWidth: 900, margin: '24px auto 0', borderTop: '1px solid rgba(139,180,225,0.15)', paddingTop: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', color: 'var(--gold-light)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {open ? '▾' : '▸'} Admin — Activity Log ({events.length} events)
      </button>

      {open && (
        <div style={{ marginTop: 12, maxHeight: 400, overflowY: 'auto', fontSize: 12, color: 'var(--header-bg)' }}>
          {events.length === 0 ? (
            <p style={{ padding: '8px 0', opacity: 0.6 }}>No timestamped events in this archive.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(139,180,225,0.2)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: 'var(--gold-light)', whiteSpace: 'nowrap' }}>Time</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600, color: 'var(--gold-light)', width: 56 }}>Boat</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: 'var(--gold-light)' }}>Event</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', opacity: 0.75 }}>{fmt(ev.ts)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', opacity: 0.6 }}>{ev.boat || '—'}</td>
                    <td style={{ padding: '4px 8px' }}>{ev.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
