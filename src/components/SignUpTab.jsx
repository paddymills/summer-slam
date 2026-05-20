import { useState, useRef } from 'react';
import ContactSuggest from './ContactSuggest';
import EmailInput from './EmailInput';
import WaiverModal from './WaiverModal';
import { formatPhone } from '../utils/phone';
import { fetchContactsWithSignatures } from '../utils/api';
import { printAllWaivers, viewWaiverForEntry, contactsToSigs } from '../utils/printWaivers';

const FIELD = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8,
  color: 'var(--white)',
  fontSize: 16,
  padding: '10px 14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  minHeight: 44,
};

const LABEL = {
  fontSize: 12, fontWeight: 700, color: 'var(--header-bg)',
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 5, display: 'block',
};

const SECTION = {
  fontSize: 13, fontWeight: 700, color: 'var(--gold-light)',
  textTransform: 'uppercase', letterSpacing: 1,
  marginBottom: 10, paddingBottom: 6,
  borderBottom: '1px solid rgba(168,200,160,0.25)',
};

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'VI'];
const SUFFIX_STYLE = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8, color: 'var(--white)', fontSize: 16, padding: '10px 12px',
  width: '100%', boxSizing: 'border-box', outline: 'none', cursor: 'pointer', minHeight: 44,
};

const EMPTY = {
  boaterFirst: '', boaterLast: '', boaterSuffix: '', boaterPhone: '', boaterEmail: '',
  coAnglerFirst: '', coAnglerLast: '', coAnglerSuffix: '', coAnglerPhone: '', coAnglerEmail: '',
};

export default function SignUpTab({ onAddEntry, settings, entries = [], onEntriesRefresh }) {
  const entryFee = parseFloat(settings?.fees?.entryFee) || 250;
  const lunkerFee = parseFloat(settings?.fees?.lunkerFee) || 10;
  const optFee    = parseFloat(settings?.fees?.optFee)    || 20;

  const [form, setForm]         = useState({ ...EMPTY });
  const [errors, setErrors]     = useState({});
  const [recent, setRecent]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingWaiver,  setPendingWaiver]  = useState(null);
  const [printing,       setPrinting]       = useState(false);
  const [openingWaiver,  setOpeningWaiver]  = useState(null); // entry id being loaded

  // Entry fee fields (shared by paper copy and digital pre-fill)
  const [feeAmount, setFeeAmount] = useState('');
  const [feeLunker, setFeeLunker] = useState(false);
  const [feeOption, setFeeOption] = useState(false);
  const [paperCopy, setPaperCopy] = useState(false);

  const boaterFirstRef      = useRef(null);
  const boaterContactIdRef  = useRef(null);
  const coAnglerContactIdRef = useRef(null);

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  }

  function validate() {
    const errs = {};
    if (!form.boaterFirst.trim()) errs.boaterFirst = 'Required';
    if (!form.boaterLast.trim())  errs.boaterLast  = 'Required';
    if (!form.boaterPhone.trim()) errs.boaterPhone  = 'Required';
    const hasCoAngler = form.coAnglerFirst.trim() || form.coAnglerLast.trim();
    if (hasCoAngler) {
      if (!form.coAnglerFirst.trim()) errs.coAnglerFirst = 'Required';
      if (!form.coAnglerLast.trim())  errs.coAnglerLast  = 'Required';
      if (!form.coAnglerPhone.trim()) errs.coAnglerPhone  = 'Required';
    }
    if (paperCopy && (!feeAmount || parseFloat(feeAmount) <= 0)) errs.feeAmount = 'Required for paper copy';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const boaterCid    = boaterContactIdRef.current;
    const coAnglerCid  = coAnglerContactIdRef.current;

    const buyInNum = parseFloat(feeAmount) || 0;
    const paid     = buyInNum >= entryFee ? 1 : 0;

    const entry = {
      boaterFirst:    form.boaterFirst.trim(),
      boaterLast:     form.boaterLast.trim(),
      boaterSuffix:   form.boaterSuffix,
      boaterPhone:    formatPhone(form.boaterPhone.trim()),
      boaterEmail:    form.boaterEmail.trim(),
      coAnglerFirst:  form.coAnglerFirst.trim(),
      coAnglerLast:   form.coAnglerLast.trim(),
      coAnglerSuffix: form.coAnglerSuffix,
      coAnglerPhone:  formatPhone(form.coAnglerPhone.trim()),
      coAnglerEmail:  form.coAnglerEmail.trim(),
      lunker: feeLunker ? 1 : 0,
      option: feeOption ? 1 : 0,
      paid:      paperCopy ? paid : 0,
      appSigned: paperCopy ? 1    : 0,
      buyIn: buyInNum,
      boatNo: '', numFish: 0, lunkerWeight: 0, totalWeight: 0,
      boaterContactId:   boaterCid  ?? null,
      coAnglerContactId: coAnglerCid ?? null,
    };

    setSubmitting(true);
    const created = await onAddEntry(entry);
    setSubmitting(false);

    if (created) {
      setRecent(prev => [{ ...entry, id: created.id }, ...prev].slice(0, 10));
      setForm({ ...EMPTY });
      setErrors({});
      setFeeAmount('');
      setFeeLunker(false);
      setFeeOption(false);
      setPaperCopy(false);
      boaterContactIdRef.current  = null;
      coAnglerContactIdRef.current = null;
      if (!paperCopy) {
        setPendingWaiver({
          entry:            created,
          boaterContactId:  boaterCid,
          coAnglerContactId: coAnglerCid,
        });
      }
    }
  }

  function handleClear() {
    setForm({ ...EMPTY });
    setErrors({});
    setFeeAmount('');
    setFeeLunker(false);
    setFeeOption(false);
    setPaperCopy(false);
    boaterContactIdRef.current  = null;
    coAnglerContactIdRef.current = null;
    setTimeout(() => boaterFirstRef.current?.focus(), 0);
  }

  async function openSignApplication(entry) {
    setOpeningWaiver(entry.id);
    try {
      const contacts = await fetchContactsWithSignatures();
      const { boaterSig, coaSig } = contactsToSigs(entry, contacts);
      setPendingWaiver({
        entry,
        boaterContactId: null,
        coAnglerContactId: null,
        prefillSigs: { boater: boaterSig, coAngler: coaSig },
      });
    } finally {
      setOpeningWaiver(null);
    }
  }

  const err = (field) => errors[field]
    ? <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 3 }}>{errors[field]}</div>
    : null;

  const fieldBorder = (field) => errors[field]
    ? { ...FIELD, borderColor: '#ff6b6b' }
    : FIELD;

  return (
    <div className="tab-panel active">
      <div className="tab-scroll">
      <div className="toolbar">
        <h2 style={{ color: 'var(--gold-light)', fontSize: 18, fontWeight: 800 }}>📝 Sign Up</h2>
        {entries.some(e => e.appSigned === 1) && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={printing}
            onClick={async () => {
              setPrinting(true);
              try {
                const contacts = await fetchContactsWithSignatures();
                const signed = entries.filter(e => e.appSigned === 1);
                printAllWaivers(signed, contacts, settings);
              } finally {
                setPrinting(false);
              }
            }}
            style={{ fontSize: 13 }}
          >
            {printing ? 'Loading…' : '🖨 Print All Applications'}
          </button>
        )}
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 16 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>

        {/* ── Boater ── */}
        <div>
          <div style={SECTION}>Boater</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 10 }}>
            <div>
              <label htmlFor="su-boater-first" style={LABEL}>First Name *</label>
              <input ref={boaterFirstRef} id="su-boater-first" name="boaterFirst" type="text" value={form.boaterFirst} placeholder="First"
                     onChange={e => { boaterContactIdRef.current = null; set('boaterFirst', e.target.value); }}
                     style={fieldBorder('boaterFirst')} />
              {err('boaterFirst')}
            </div>
            <div>
              <label htmlFor="su-boater-last" style={LABEL}>Last Name *</label>
              <ContactSuggest
                value={form.boaterLast}
                placeholder="Last"
                onChange={v => { boaterContactIdRef.current = null; set('boaterLast', v); }}
                onSelect={c => { boaterContactIdRef.current = c.id; setForm(p => ({ ...p, boaterFirst: c.firstName, boaterLast: c.lastName, boaterSuffix: c.suffix || '', boaterPhone: c.phone, boaterEmail: c.email || p.boaterEmail })); }}
                inputProps={{ id: 'su-boater-last', name: 'boaterLast', style: fieldBorder('boaterLast') }}
              />
              {err('boaterLast')}
            </div>
            <div>
              <label style={LABEL}>Suffix</label>
              <select value={form.boaterSuffix} onChange={e => set('boaterSuffix', e.target.value)} style={SUFFIX_STYLE}>
                {SUFFIX_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="su-boater-email" style={LABEL}>Email</label>
            <EmailInput id="su-boater-email" name="boaterEmail" value={form.boaterEmail} onChange={v => set('boaterEmail', v)} style={FIELD} />
          </div>
          <div>
            <label htmlFor="su-boater-phone" style={LABEL}>Phone *</label>
            <ContactSuggest
              value={form.boaterPhone}
              placeholder="555-123-4567"
              onChange={v => set('boaterPhone', v)}
              onSelect={c => { boaterContactIdRef.current = c.id; setForm(p => ({ ...p, boaterFirst: c.firstName, boaterLast: c.lastName, boaterSuffix: c.suffix || '', boaterPhone: c.phone, boaterEmail: c.email || p.boaterEmail })); }}
              onBlur={e => set('boaterPhone', formatPhone(e.target.value))}
              inputProps={{ id: 'su-boater-phone', name: 'boaterPhone', style: fieldBorder('boaterPhone'), type: 'tel' }}
            />
            {err('boaterPhone')}
          </div>
        </div>

        {/* ── Co-Angler ── */}
        <div>
          <div style={SECTION}>
            Co-Angler{' '}
            <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 10 }}>
            <div>
              <label htmlFor="su-co-first" style={LABEL}>First Name</label>
              <input id="su-co-first" name="coAnglerFirst" type="text" value={form.coAnglerFirst} placeholder="First"
                     onChange={e => { coAnglerContactIdRef.current = null; set('coAnglerFirst', e.target.value); }}
                     style={fieldBorder('coAnglerFirst')} />
              {err('coAnglerFirst')}
            </div>
            <div>
              <label htmlFor="su-co-last" style={LABEL}>Last Name</label>
              <ContactSuggest
                value={form.coAnglerLast}
                placeholder="Last"
                onChange={v => { coAnglerContactIdRef.current = null; set('coAnglerLast', v); }}
                onSelect={c => { coAnglerContactIdRef.current = c.id; setForm(p => ({ ...p, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerSuffix: c.suffix || '', coAnglerPhone: c.phone, coAnglerEmail: c.email || p.coAnglerEmail })); }}
                inputProps={{ id: 'su-co-last', name: 'coAnglerLast', style: fieldBorder('coAnglerLast') }}
              />
              {err('coAnglerLast')}
            </div>
            <div>
              <label style={LABEL}>Suffix</label>
              <select value={form.coAnglerSuffix} onChange={e => set('coAnglerSuffix', e.target.value)} style={SUFFIX_STYLE}>
                {SUFFIX_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="su-co-email" style={LABEL}>Email</label>
            <EmailInput id="su-co-email" name="coAnglerEmail" value={form.coAnglerEmail} onChange={v => set('coAnglerEmail', v)} style={FIELD} />
          </div>
          <div>
            <label htmlFor="su-co-phone" style={LABEL}>
              Phone{(form.coAnglerFirst || form.coAnglerLast) ? ' *' : ''}
            </label>
            <ContactSuggest
              value={form.coAnglerPhone}
              placeholder="555-123-4567"
              onChange={v => set('coAnglerPhone', v)}
              onSelect={c => { coAnglerContactIdRef.current = c.id; setForm(p => ({ ...p, coAnglerFirst: c.firstName, coAnglerLast: c.lastName, coAnglerSuffix: c.suffix || '', coAnglerPhone: c.phone, coAnglerEmail: c.email || p.coAnglerEmail })); }}
              onBlur={e => set('coAnglerPhone', formatPhone(e.target.value))}
              inputProps={{ id: 'su-co-phone', name: 'coAnglerPhone', style: fieldBorder('coAnglerPhone'), type: 'tel' }}
            />
            {err('coAnglerPhone')}
          </div>
        </div>

        {/* ── Entry Fees ── */}
        <div style={{ borderRadius: 8, border: '1px solid rgba(139,180,225,0.25)', background: 'rgba(255,255,255,0.03)', padding: '14px 16px' }}>
          <div style={{ ...SECTION, marginBottom: 12 }}>Entry Fees</div>

          {/* Paper copy toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={paperCopy}
              onChange={e => setPaperCopy(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#e8c876' }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: paperCopy ? 'var(--gold-light)' : 'var(--header-bg)' }}>
              Paper Application on File
            </span>
            {paperCopy && (
              <span style={{ fontSize: 11, color: 'var(--gold-light)', opacity: 0.8 }}>— no digital signature needed</span>
            )}
          </label>

          {/* Fee fields */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={LABEL}>
                Buy-In Amount ($){paperCopy ? ' *' : ''}
                {!paperCopy && <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 4 }}>(optional — pre-fills digital app)</span>}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={feeAmount}
                placeholder={paperCopy ? 'Required' : '0.00'}
                min="0"
                step="0.01"
                onChange={e => { setFeeAmount(e.target.value); if (errors.feeAmount) setErrors(p => ({ ...p, feeAmount: null })); }}
                style={{
                  ...FIELD,
                  borderColor: errors.feeAmount ? '#ff6b6b' : feeAmount ? 'rgba(139,180,225,0.5)' : undefined,
                  color: feeAmount ? 'var(--white)' : undefined,
                }}
              />
              {errors.feeAmount && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 3 }}>{errors.feeAmount}</div>}
              {feeAmount > 0 && (
                <div style={{ fontSize: 11, color: parseFloat(feeAmount) >= entryFee ? '#6fcf97' : '#f0ad4e', marginTop: 3 }}>
                  {parseFloat(feeAmount) >= entryFee ? '✓ Paid in Full' : `Partial — min $${entryFee}`}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, paddingBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none', color: 'var(--white)' }}>
                <input type="checkbox" checked={feeLunker} onChange={e => setFeeLunker(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#e8c876' }} />
                Lunker (${lunkerFee})
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none', color: 'var(--white)' }}>
                <input type="checkbox" checked={feeOption} onChange={e => setFeeOption(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#e8c876' }} />
                Option (${optFee})
              </label>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-gold" disabled={submitting}
                  style={{ flex: 1, fontSize: 16, padding: '12px 0' }}>
            {submitting ? 'Saving…' : paperCopy ? '+ Sign Up (Paper)' : '+ Sign Up'}
          </button>
          <button type="button" className="btn btn-outline" onClick={handleClear}
                  style={{ padding: '12px 20px' }}>
            Clear
          </button>
        </div>
      </form>

      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(139,180,225,0.07)', border: '1px solid rgba(139,180,225,0.2)', fontSize: 12, color: 'var(--header-bg)', lineHeight: 1.6 }}>
        💡 <strong style={{ color: 'var(--white)' }}>Correcting a name?</strong> If an angler's name autofills from a saved contact and needs to be corrected, go to the <strong style={{ color: 'var(--white)' }}>Contacts tab</strong> and use the ✏️ Edit button to update the contact there.
      </div>

      {/* ── Recently Signed Up ── */}
      {recent.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ color: 'var(--header-bg)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Recently Signed Up
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                padding: '8px 12px', fontSize: 13,
              }}>
                <span style={{ fontWeight: 700, color: 'var(--white)' }}>
                  {[r.boaterFirst, r.boaterLast, r.boaterSuffix].filter(Boolean).join(' ')}
                </span>
                {(r.coAnglerFirst || r.coAnglerLast) && (
                  <span style={{ flex: 1, color: 'var(--header-bg)', marginLeft: 8 }}>
                    / {[r.coAnglerFirst, r.coAnglerLast, r.coAnglerSuffix].filter(Boolean).join(' ')}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                  {r.appSigned === 1 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--gold-light)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        ✓ Signed{r.buyIn > 0 ? `  ·  $${parseFloat(r.buyIn).toFixed(2)}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => viewWaiverForEntry(r, settings, fetchContactsWithSignatures)}
                        style={{ padding: '3px 10px', fontSize: 11, cursor: 'pointer', background: 'rgba(139,180,225,0.15)', color: 'var(--header-bg)', border: '1px solid rgba(139,180,225,0.3)', borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        View
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ color: '#f0ad4e', fontSize: 12, whiteSpace: 'nowrap' }}>— Pending</span>
                      <button
                        type="button"
                        disabled={openingWaiver === r.id}
                        onClick={() => openSignApplication(r)}
                        style={{
                          padding: '3px 10px', fontSize: 11, cursor: openingWaiver === r.id ? 'not-allowed' : 'pointer',
                          background: '#1a5276', color: '#fff', border: 'none',
                          borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap', opacity: openingWaiver === r.id ? 0.6 : 1,
                        }}
                      >
                        {openingWaiver === r.id ? 'Loading…' : 'Sign Application'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── Fees Needed (signed but not paid — fee entry pending) ── */}
      {(() => {
        const recentIds  = new Set(recent.map(r => r.id));
        const feesNeeded = entries
          .filter(e => e.appSigned === 1 && !(e.paid === 1 || e.paid === '1') && !recentIds.has(e.id))
          .sort((a, b) => (b.signedUpAt ?? '').localeCompare(a.signedUpAt ?? ''));
        if (!feesNeeded.length) return null;
        return (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ color: '#f0ad4e', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              ⚠ Fees Needed ({feesNeeded.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {feesNeeded.map(r => (
                <div key={r.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(240,173,78,0.07)', borderRadius: 8,
                  border: '1px solid rgba(240,173,78,0.35)',
                  padding: '8px 12px', fontSize: 13,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 700, color: 'var(--white)' }}>
                      {[r.boaterFirst, r.boaterLast, r.boaterSuffix].filter(Boolean).join(' ')}
                    </span>
                    {(r.coAnglerFirst || r.coAnglerLast) && (
                      <span style={{ color: 'var(--header-bg)', fontSize: 12 }}>
                        / {[r.coAnglerFirst, r.coAnglerLast, r.coAnglerSuffix].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={openingWaiver === r.id}
                    onClick={() => openSignApplication(r)}
                    style={{
                      padding: '4px 12px', fontSize: 11, cursor: openingWaiver === r.id ? 'not-allowed' : 'pointer',
                      background: '#c67c00', color: '#fff', border: 'none',
                      borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8,
                      opacity: openingWaiver === r.id ? 0.6 : 1,
                    }}
                  >
                    {openingWaiver === r.id ? 'Loading…' : 'Enter Fee'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Pending Applications (DB-backed, survives refresh) ── */}
      {(() => {
        const recentIds = new Set(recent.map(r => r.id));
        const pendingDb = entries
          .filter(e => e.appSigned === 0 && !recentIds.has(e.id))
          .sort((a, b) => (b.signedUpAt ?? '').localeCompare(a.signedUpAt ?? ''));
        if (!pendingDb.length) return null;
        return (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ color: '#f0ad4e', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Pending Applications ({pendingDb.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendingDb.map(r => (
                <div key={r.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(240,173,78,0.07)', borderRadius: 8,
                  border: '1px solid rgba(240,173,78,0.25)',
                  padding: '8px 12px', fontSize: 13,
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--white)' }}>
                    {[r.boaterFirst, r.boaterLast, r.boaterSuffix].filter(Boolean).join(' ')}
                  </span>
                  {(r.coAnglerFirst || r.coAnglerLast) && (
                    <span style={{ flex: 1, color: 'var(--header-bg)', marginLeft: 8 }}>
                      / {[r.coAnglerFirst, r.coAnglerLast, r.coAnglerSuffix].filter(Boolean).join(' ')}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={openingWaiver === r.id}
                    onClick={() => openSignApplication(r)}
                    style={{
                      padding: '4px 12px', fontSize: 11, cursor: openingWaiver === r.id ? 'not-allowed' : 'pointer',
                      background: '#1a5276', color: '#fff', border: 'none',
                      borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8,
                      opacity: openingWaiver === r.id ? 0.6 : 1,
                    }}
                  >
                    {openingWaiver === r.id ? 'Loading…' : 'Sign Application'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      </div>
      </div>

      {pendingWaiver && (
        <WaiverModal
          entry={pendingWaiver.entry}
          boaterContactId={pendingWaiver.boaterContactId}
          coAnglerContactId={pendingWaiver.coAnglerContactId}
          prefillSigs={pendingWaiver.prefillSigs ?? null}
          settings={settings}
          onClose={(result) => {
            if (result?.appSigned) {
              setRecent(prev => prev.map(r =>
                r.id === pendingWaiver.entry.id ? { ...r, appSigned: 1, buyIn: result.buyIn, lunker: result.lunker, option: result.option, paid: result.paid } : r
              ));
              onEntriesRefresh?.();
            }
            setPendingWaiver(null);
          }}
        />
      )}
    </div>
  );
}
