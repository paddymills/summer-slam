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
            ['Paid',     fmtBool(entry.paid)],
            ['Signed',   fmtBool(entry.appSigned)],
          ].map(([label, val]) => (
            <tr key={label}>
              <td style={{ color: 'var(--header-bg)', paddingBottom: 3, paddingRight: 12, whiteSpace: 'nowrap' }}>{label}</td>
              <td style={{ color: 'var(--white)', fontWeight: 600 }}>{val}</td>
            </tr>
          ))}
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

function computeMerge(keeper, other) {
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
  if (otherBuyIn > keeperBuyIn) {
    updates.buyIn = otherBuyIn;
    changes.push(`Buy-In: ${fmtMoney(otherBuyIn)}`);
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
  const [keeperId, setKeeperId] = useState(entryA.id);

  const keeper = keeperId === entryA.id ? entryA : entryB;
  const other  = keeperId === entryA.id ? entryB : entryA;
  const { updates, changes } = computeMerge(keeper, other);

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
