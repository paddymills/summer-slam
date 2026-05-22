import { useState } from 'react';

const fmt = v => v || '—';
const fmtBool = v => (v === 1 || v === '1') ? 'YES' : 'NO';
const fmtMoney = v => parseFloat(v || 0) > 0 ? `$${parseFloat(v).toFixed(2)}` : '—';

function fullName(e, role) {
  const first  = e[`${role}First`]  || '';
  const last   = e[`${role}Last`]   || '';
  const suffix = e[`${role}Suffix`] || '';
  return [first, last, suffix].filter(Boolean).join(' ') || '—';
}

function EntryCard({ entry, isKeeper, onKeep }) {
  return (
    <div style={{
      flex: 1,
      border: `2px solid ${isKeeper ? 'rgba(139,180,225,0.7)' : 'rgba(139,180,225,0.2)'}`,
      borderRadius: 10,
      padding: '14px 16px',
      background: isKeeper ? 'rgba(139,180,225,0.07)' : 'transparent',
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--white)' }}>
          Boater: {fullName(entry, 'boater')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--header-bg)', marginTop: 2 }}>
          Co-Angler: {fullName(entry, 'coAngler')}
        </div>
      </div>
      <table style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {[
            ['Boat #',   fmt(entry.boatNo)],
            ['Buy-In',   fmtMoney(entry.buyIn)],
            ['Paid',     entry.paid === 1 || entry.paid === '1'],
            ['Signed',   entry.appSigned === 1 || entry.appSigned === '1'],
            ['Lunker',   entry.lunker === 1 || entry.lunker === '1'],
            ['Option',   entry.option === 1 || entry.option === '1'],
          ].map(([label, val]) => {
            const isBool = typeof val === 'boolean';
            return (
              <tr key={label}>
                <td style={{ color: 'var(--header-bg)', paddingBottom: 3, paddingRight: 12, whiteSpace: 'nowrap' }}>{label}</td>
                <td style={{
                  fontWeight: 600,
                  color: isBool ? (val ? '#4CAF50' : '#ff9090') : 'var(--white)',
                }}>
                  {isBool ? (val ? 'YES' : 'NO') : val}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        className={isKeeper ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
        style={{ marginTop: 12, width: '100%' }}
        onClick={onKeep}
      >
        {isKeeper ? '✓ Keeping This' : 'Keep This'}
      </button>
    </div>
  );
}

function computeMerge(keeper, other, combineBuyIn) {
  const changes = [];
  const updates = {};

  const coMissing = !keeper.coAnglerFirst && !keeper.coAnglerLast;
  if (coMissing && (other.coAnglerFirst || other.coAnglerLast)) {
    updates.coAnglerFirst  = other.coAnglerFirst  || '';
    updates.coAnglerLast   = other.coAnglerLast   || '';
    updates.coAnglerSuffix = other.coAnglerSuffix || '';
    updates.coAnglerPhone  = other.coAnglerPhone  || '';
    updates.coAnglerEmail  = other.coAnglerEmail  || '';
    changes.push(`Co-angler: ${fullName(other, 'coAngler')}`);
  }

  if (!keeper.boatNo && other.boatNo) {
    updates.boatNo = other.boatNo;
    changes.push(`Boat #: ${other.boatNo}`);
  }

  const keeperBuyIn = parseFloat(keeper.buyIn || 0);
  const otherBuyIn  = parseFloat(other.buyIn  || 0);
  if (combineBuyIn && otherBuyIn > 0) {
    updates.buyIn = keeperBuyIn + otherBuyIn;
    changes.push(`Buy-In: ${fmtMoney(keeperBuyIn)} + ${fmtMoney(otherBuyIn)} = ${fmtMoney(keeperBuyIn + otherBuyIn)}`);
  } else if (otherBuyIn > keeperBuyIn) {
    updates.buyIn = otherBuyIn;
    changes.push(`Buy-In: ${fmtMoney(otherBuyIn)} (higher of the two)`);
  }

  if (!keeper.paid && other.paid) {
    updates.paid = 1;
    changes.push('Paid: YES');
  }

  if (Number(other.lunker) > Number(keeper.lunker || 0)) {
    updates.lunker = other.lunker;
    changes.push('Lunker: YES');
  }
  if (Number(other.option) > Number(keeper.option || 0)) {
    updates.option = other.option;
    changes.push('Option: YES');
  }

  return { updates, changes };
}

export default function MergeModal({ entryA, entryB, onMerge, onCancel }) {
  const [keeperId, setKeeperId]       = useState(entryA.id);
  const [combineBuyIn, setCombine]    = useState(false);

  const keeper = keeperId === entryA.id ? entryA : entryB;
  const other  = keeperId === entryA.id ? entryB : entryA;

  const keeperBuyIn = parseFloat(keeper.buyIn || 0);
  const otherBuyIn  = parseFloat(other.buyIn  || 0);
  const bothHaveBuyIn = keeperBuyIn > 0 && otherBuyIn > 0;

  const { updates, changes } = computeMerge(keeper, other, combineBuyIn);

  return (
    <div className="edit-overlay" onPointerDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="edit-panel" style={{ maxWidth: 580 }}>
        <div className="edit-panel-inner">
          <div className="edit-panel-header">
            <h3>Merge Duplicate Entries</h3>
            <button className="edit-panel-close" onClick={onCancel}>✕</button>
          </div>

          <p style={{ color: 'var(--header-bg)', fontSize: 13, marginBottom: 16 }}>
            Pick which entry to <strong style={{ color: 'var(--white)' }}>keep</strong>. The other will be deleted. Useful data from the deleted entry will be transferred automatically.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <EntryCard entry={entryA} isKeeper={keeperId === entryA.id} onKeep={() => setKeeperId(entryA.id)} />
            <EntryCard entry={entryB} isKeeper={keeperId === entryB.id} onKeep={() => setKeeperId(entryB.id)} />
          </div>

          {bothHaveBuyIn && (
            <div style={{
              background: 'rgba(240,173,78,0.07)',
              border: '1px solid rgba(240,173,78,0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 12,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{ color: 'var(--header-bg)', flex: 1 }}>
                Both entries have a buy-in ({fmtMoney(keeperBuyIn)} + {fmtMoney(otherBuyIn)}). Combine them?
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={combineBuyIn}
                  onChange={e => setCombine(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ color: combineBuyIn ? 'var(--white)' : 'var(--header-bg)', fontWeight: combineBuyIn ? 700 : 400 }}>
                  Add together ({fmtMoney(keeperBuyIn + otherBuyIn)})
                </span>
              </label>
            </div>
          )}

          <div style={{
            background: 'rgba(168,200,160,0.07)',
            border: '1px solid rgba(168,200,160,0.2)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
          }}>
            {changes.length > 0 ? (
              <>
                <div style={{ color: 'var(--header-bg)', marginBottom: 6 }}>Will transfer from deleted entry:</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {changes.map(c => <li key={c} style={{ color: 'var(--white)', marginBottom: 2 }}>{c}</li>)}
                </ul>
              </>
            ) : (
              <span style={{ color: 'var(--header-bg)' }}>No data to transfer — keeper already has everything.</span>
            )}
          </div>

          <div className="edit-panel-actions">
            <button className="btn btn-outline btn-lg" onClick={onCancel}>Cancel</button>
            <button
              className="btn btn-danger btn-lg"
              onClick={() => onMerge(keeper, other, updates)}
            >
              Merge &amp; Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
