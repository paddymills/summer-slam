import { useState, useRef, useEffect } from 'react';
import ContactSuggest from './ContactSuggest';
import EmailInput from './EmailInput';
import WaiverModal from './WaiverModal';
import { formatPhone } from '../utils/phone';
import { evalMath } from '../utils/evalMath';
import { fetchContactsWithSignatures, saveContactWaiver, lookupContactId, createPublicEntry } from '../utils/api';
import { printAllWaivers, viewWaiverForEntry, contactsToSigs, printBlankApplication, shareBlankApplication, LEGAL_CLAUSES } from '../utils/printWaivers';

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
  boaterOrderNo: '', coAnglerOrderNo: '',
};

function PublicSignUpView({ settings, entries = [], onEntriesRefresh }) {
  const [form, setForm]               = useState({ ...EMPTY });
  const [searchName, setSearchName]   = useState('');
  const [customerWaiver, setCustomerWaiver] = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })); }

  async function handleSubmitAndSign() {
    if (!form.boaterFirst.trim() || !form.boaterLast.trim()) {
      setSubmitError('First and last name are required.');
      return;
    }
    if (!form.boaterPhone.trim()) {
      setSubmitError('Boater phone number is required.');
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const created = await createPublicEntry({
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
        boaterOrderNo:  form.boaterOrderNo.trim(),
        coAnglerOrderNo: form.coAnglerOrderNo.trim(),
      });
      setForm({ ...EMPTY });
      setCustomerWaiver(created);
    } catch (e) {
      setSubmitError(e.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const norm = s => (s || '').toLowerCase().trim();
  const matchingEntries = searchName.trim().length >= 2
    ? entries.filter(e => {
        const q = norm(searchName);
        const boaterFull = norm(`${e.boaterFirst} ${e.boaterLast}`);
        const coaFull    = norm(`${e.coAnglerFirst} ${e.coAnglerLast}`);
        return boaterFull.includes(q) || coaFull.includes(q)
          || norm(e.boaterLast).startsWith(q) || norm(e.coAnglerLast).startsWith(q);
      })
    : [];

  return (
    <div className="tab-panel active">
      <div className="tab-scroll">
        <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 16 }}>
          <div className="toolbar" style={{ marginBottom: 16, paddingLeft: 0, paddingRight: 0 }}>
            <h2 style={{ color: 'var(--gold-light)', fontSize: 18, fontWeight: 800 }}>📝 Entry Form</h2>
            <button
              type="button"
              className="btn btn-gold"
              style={{ fontSize: 14 }}
              onClick={() => printBlankApplication(settings, form)}
            >
              🖨 Print Application
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--header-bg)', marginBottom: 20, lineHeight: 1.6 }}>
            Fill in your information below, then tap <strong style={{ color: 'var(--white)' }}>Print Application</strong> to generate a paper form, or <strong style={{ color: 'var(--white)' }}>Share / Email PDF</strong> to send it to yourself. Sign and return to tournament staff.
          </p>

          {/* Legal text */}
          <div style={{ marginBottom: 20, borderRadius: 8, border: '1px solid rgba(139,180,225,0.2)', background: 'rgba(255,255,255,0.03)', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-light)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Participant Agreement, Release and Acknowledgment of Risk
            </div>
            <div style={{ fontSize: 12, color: 'var(--header-bg)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LEGAL_CLAUSES.map((clause, i) => (
                <p key={i} style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: clause }} />
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', border: '2px solid rgba(139,180,225,0.4)', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', textAlign: 'center', letterSpacing: 0.5 }}>
              THIS SIGNED WAIVER IS IN EFFECT FOR ANY SUSQUEHANNA FISHING TACKLE, INC. TOURNAMENT IN {new Date().getFullYear()}
            </div>
          </div>

          <form onSubmit={e => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>

            {/* Boater */}
            <div>
              <div style={SECTION}>Boater</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={LABEL}>First Name</label>
                  <input type="text" value={form.boaterFirst} placeholder="First" onChange={e => set('boaterFirst', e.target.value)} style={FIELD} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={LABEL}>Last Name</label>
                  <input type="text" value={form.boaterLast} placeholder="Last" onChange={e => set('boaterLast', e.target.value)} style={FIELD} />
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <label style={LABEL}>Suffix</label>
                  <select value={form.boaterSuffix} onChange={e => set('boaterSuffix', e.target.value)} style={SUFFIX_STYLE}>
                    {SUFFIX_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={LABEL}>Phone</label>
                <input type="tel" value={form.boaterPhone} placeholder="555-123-4567" onChange={e => set('boaterPhone', e.target.value)} onBlur={e => set('boaterPhone', formatPhone(e.target.value))} style={FIELD} />
              </div>
              <div>
                <label style={LABEL}>Email</label>
                <EmailInput value={form.boaterEmail} onChange={v => set('boaterEmail', v)} style={FIELD} />
              </div>
            </div>

            {/* Co-Angler */}
            <div>
              <div style={SECTION}>
                Co-Angler{' '}
                <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={LABEL}>First Name</label>
                  <input type="text" value={form.coAnglerFirst} placeholder="First" onChange={e => set('coAnglerFirst', e.target.value)} style={FIELD} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={LABEL}>Last Name</label>
                  <input type="text" value={form.coAnglerLast} placeholder="Last" onChange={e => set('coAnglerLast', e.target.value)} style={FIELD} />
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <label style={LABEL}>Suffix</label>
                  <select value={form.coAnglerSuffix} onChange={e => set('coAnglerSuffix', e.target.value)} style={SUFFIX_STYLE}>
                    {SUFFIX_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={LABEL}>Phone</label>
                <input type="tel" value={form.coAnglerPhone} placeholder="555-123-4567" onChange={e => set('coAnglerPhone', e.target.value)} onBlur={e => set('coAnglerPhone', formatPhone(e.target.value))} style={FIELD} />
              </div>
              <div>
                <label style={LABEL}>Email</label>
                <EmailInput value={form.coAnglerEmail} onChange={v => set('coAnglerEmail', v)} style={FIELD} />
              </div>
            </div>

            {/* Order #s */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={LABEL}>Boater Order # <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input type="text" value={form.boaterOrderNo} placeholder="Online order #" onChange={e => set('boaterOrderNo', e.target.value)} style={FIELD} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL}>Co-Angler Order # <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input type="text" value={form.coAnglerOrderNo} placeholder="Online order #" onChange={e => set('coAnglerOrderNo', e.target.value)} style={FIELD} />
              </div>
            </div>

            {/* Submit & Sign Online */}
            {submitError && (
              <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0, textAlign: 'center' }}>{submitError}</p>
            )}
            <button
              type="button"
              className="btn btn-gold"
              style={{ fontSize: 16, padding: '14px 0', fontWeight: 800 }}
              disabled={submitting}
              onClick={handleSubmitAndSign}
            >
              {submitting ? 'Submitting…' : '✍ Submit & Sign Online'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--header-bg)', textAlign: 'center', marginTop: -6 }}>
              Signs your application digitally. Your buy-in amount will be self-reported and verified by staff.
            </p>

            {/* Print / Share buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, fontSize: 14, padding: '11px 0' }}
                onClick={() => printBlankApplication(settings, form)}
              >
                🖨 Print Application
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, fontSize: 14, padding: '11px 0' }}
                onClick={async () => { try { await shareBlankApplication(settings, form); } catch (err) { if (err?.name !== 'AbortError') alert('Could not share PDF: ' + err?.message); } }}
              >
                📤 Share / Email PDF
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--header-bg)', textAlign: 'center', marginTop: -6 }}>
              Paper form — email to <strong style={{ color: 'var(--white)' }}>info@sfttackle.com</strong>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: 14 }}
              onClick={() => { setForm({ ...EMPTY }); setSubmitError(''); }}
            >
              Clear
            </button>

          </form>

          {/* ── Find My Entry (digital self-sign) ── */}
          <div style={{ marginTop: 36, borderTop: '1px solid rgba(139,180,225,0.2)', paddingTop: 24 }}>
            <h3 style={{ color: 'var(--gold-light)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              Already signed up? Sign digitally.
            </h3>
            <p style={{ fontSize: 13, color: 'var(--header-bg)', marginBottom: 14, lineHeight: 1.6 }}>
              Search for your name, then tap <strong style={{ color: 'var(--white)' }}>Sign Application</strong> to sign digitally on your device.
              Your buy-in amount will be self-reported and verified by tournament staff.
            </p>
            <input
              type="text"
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              placeholder="Search by last name…"
              style={{ ...FIELD, marginBottom: 10 }}
            />
            {searchName.trim().length >= 2 && matchingEntries.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--header-bg)', textAlign: 'center', padding: '12px 0' }}>
                No entries found. Check spelling or contact tournament staff.
              </p>
            )}
            {matchingEntries.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matchingEntries.map(e => {
                  const boaterName = [e.boaterFirst, e.boaterLast, e.boaterSuffix].filter(Boolean).join(' ');
                  const coaName    = [e.coAnglerFirst, e.coAnglerLast, e.coAnglerSuffix].filter(Boolean).join(' ');
                  const isSigned   = e.appSigned === 1 || e.appSigned === '1';
                  return (
                    <div key={e.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255,255,255,0.05)', borderRadius: 8,
                      border: '1px solid rgba(139,180,225,0.2)',
                      padding: '10px 14px', gap: 12,
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: 14 }}>{boaterName}</div>
                        {coaName && <div style={{ fontSize: 12, color: 'var(--header-bg)', marginTop: 2 }}>/ {coaName}</div>}
                      </div>
                      {isSigned ? (
                        <span style={{ fontSize: 12, color: '#6fcf97', whiteSpace: 'nowrap', fontWeight: 600 }}>✓ Already signed</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-gold"
                          style={{ fontSize: 13, padding: '8px 16px', whiteSpace: 'nowrap' }}
                          onClick={() => setCustomerWaiver(e)}
                        >
                          Sign Application
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
      {customerWaiver && (
        <WaiverModal
          entry={customerWaiver}
          settings={settings}
          customerMode={true}
          onClose={(result) => {
            setCustomerWaiver(null);
            setSearchName('');
            if (result?.appSigned) onEntriesRefresh?.();
          }}
        />
      )}
    </div>
  );
}

function FindAndEdit({ entries, onEdit }) {
  const [query, setQuery] = useState('');
  const norm = s => (s || '').toLowerCase().trim();
  const matches = query.trim().length >= 2
    ? entries.filter(e => {
        const q = norm(query);
        return norm(`${e.boaterFirst} ${e.boaterLast}`).includes(q)
          || norm(`${e.coAnglerFirst} ${e.coAnglerLast}`).includes(q)
          || norm(e.boaterLast).startsWith(q)
          || norm(e.coAnglerLast).startsWith(q);
      })
    : [];

  return (
    <div style={{ marginTop: 36, borderTop: '1px solid rgba(139,180,225,0.2)', paddingTop: 24 }}>
      <h3 style={{ color: 'var(--gold-light)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
        Find &amp; Edit Existing Entry
      </h3>
      <p style={{ fontSize: 13, color: 'var(--header-bg)', marginBottom: 14, lineHeight: 1.6 }}>
        Search for an existing entry to edit it — e.g., to add a co-angler, update fees, or correct information.
      </p>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by last name…"
        style={{ ...FIELD, marginBottom: 10 }}
      />
      {query.trim().length >= 2 && matches.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--header-bg)', textAlign: 'center', padding: '12px 0' }}>
          No entries found.
        </p>
      )}
      {matches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map(e => {
            const boaterName = [e.boaterFirst, e.boaterLast, e.boaterSuffix].filter(Boolean).join(' ');
            const coaName    = [e.coAnglerFirst, e.coAnglerLast, e.coAnglerSuffix].filter(Boolean).join(' ');
            const isPaid     = e.paid === 1 || e.paid === '1';
            const isSigned   = e.appSigned === 1 || e.appSigned === '1';
            return (
              <div key={e.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.05)', borderRadius: 8,
                border: '1px solid rgba(139,180,225,0.2)',
                padding: '10px 14px', gap: 12,
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: 14 }}>{boaterName}</div>
                  {coaName
                    ? <div style={{ fontSize: 12, color: 'var(--header-bg)', marginTop: 2 }}>/ {coaName}</div>
                    : <div style={{ fontSize: 12, color: '#f0ad4e', marginTop: 2 }}>No co-angler</div>
                  }
                  <div style={{ fontSize: 11, color: 'var(--header-bg)', marginTop: 3, display: 'flex', gap: 8 }}>
                    {e.boatNo && <span>Boat #{e.boatNo}</span>}
                    <span style={{ color: isSigned ? '#6fcf97' : '#f0ad4e' }}>{isSigned ? '✓ Signed' : 'Not signed'}</span>
                    <span style={{ color: isPaid ? '#6fcf97' : '#f0ad4e' }}>{isPaid ? '✓ Paid' : 'Not paid'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: 13, padding: '8px 16px', whiteSpace: 'nowrap' }}
                  onClick={() => { onEdit(e); setQuery(''); }}
                >
                  Edit
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SignUpTab({ onAddEntry, onDeleteEntry, onEdit, settings, entries = [], onEntriesRefresh, isOperator = false }) {
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
  const feeAmountRef = useRef('');
  const [feeLunker, setFeeLunker] = useState(false);
  const [feeOption, setFeeOption] = useState(false);
  const [paperCopy, setPaperCopy] = useState(false);

  // Operator PIN for paper copy authorization
  const [paperPinUnlocked,  setPaperPinUnlocked]  = useState(false);
  const [paperPin,          setPaperPin]          = useState('');
  const [paperPinError,     setPaperPinError]     = useState('');
  const [showPaperPin,      setShowPaperPin]      = useState(false);
  const paperPinRef = useRef(null);

  useEffect(() => {
    if (showPaperPin) setTimeout(() => paperPinRef.current?.focus(), 50);
  }, [showPaperPin]);

  const boaterFirstRef      = useRef(null);
  const boaterContactIdRef  = useRef(null);
  const coAnglerContactIdRef = useRef(null);

  function tryPaperPin() {
    if (paperPin === '227737' || paperPin === '2277') {
      setPaperPinUnlocked(true);
      setShowPaperPin(false);
      setPaperPinError('');
      setPaperPin('');
      handleSubmit();
    } else {
      setPaperPinError('Incorrect PIN');
    }
  }

  function resetPaperPin() {
    setPaperPinUnlocked(false);
    setPaperPin('');
    setPaperPinError('');
    setShowPaperPin(false);
  }

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
    if (paperCopy && (!feeAmount || parseFloat(evalMath(String(feeAmount))) <= 0)) errs.feeAmount = 'Required for paper copy';
    return errs;
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const boaterCid    = boaterContactIdRef.current;
    const coAnglerCid  = coAnglerContactIdRef.current;

    const buyInNum = parseFloat(evalMath(String(feeAmount))) || 0;
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
      boaterOrderNo:   form.boaterOrderNo.trim(),
      coAnglerOrderNo: form.coAnglerOrderNo.trim(),
    };

    setSubmitting(true);
    const created = await onAddEntry(entry);

    // Paper copy: write 'paper' sentinel to contacts so viewing the app shows "Paper Application"
    // instead of any older digital signature stored on the contact record.
    if (created && paperCopy) {
      try {
        const now      = new Date().toISOString();
        const yr       = new Date().getFullYear();
        const snapshot = JSON.stringify({ year: yr, tournamentDate: settings?.tournamentDate, tournamentLocation: settings?.tournamentLocation });
        let bCid = boaterContactIdRef.current;
        if (!bCid) bCid = await lookupContactId(form.boaterFirst.trim(), form.boaterLast.trim(), formatPhone(form.boaterPhone.trim()));
        if (bCid) await saveContactWaiver(bCid, { signature: 'paper', signedAt: now, waiverYear: yr, waiverSnapshot: snapshot });
        if (form.coAnglerFirst.trim() && form.coAnglerLast.trim()) {
          let cCid = coAnglerContactIdRef.current;
          if (!cCid) cCid = await lookupContactId(form.coAnglerFirst.trim(), form.coAnglerLast.trim(), formatPhone(form.coAnglerPhone.trim()));
          if (cCid) await saveContactWaiver(cCid, { signature: 'paper', signedAt: now, waiverYear: yr, waiverSnapshot: snapshot });
        }
      } catch (_) {}
    }

    setSubmitting(false);

    if (created) {
      setRecent(prev => [{ ...entry, id: created.id }, ...prev].slice(0, 10));
      setForm({ ...EMPTY });
      setErrors({});
      setFeeAmount('');
      setFeeLunker(false);
      setFeeOption(false);
      setPaperCopy(false);
      resetPaperPin();
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
    resetPaperPin();
    boaterContactIdRef.current  = null;
    coAnglerContactIdRef.current = null;
    setTimeout(() => boaterFirstRef.current?.focus(), 0);
  }

  async function handleSaveForLater() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const buyInNum = parseFloat(evalMath(String(feeAmountRef.current ?? feeAmount))) || 0;
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
      paid,
      appSigned: 0,
      buyIn: buyInNum,
      boatNo: '', numFish: 0, lunkerWeight: 0, totalWeight: 0,
      boaterContactId:   boaterContactIdRef.current ?? null,
      coAnglerContactId: coAnglerContactIdRef.current ?? null,
      boaterOrderNo:   form.boaterOrderNo.trim(),
      coAnglerOrderNo: form.coAnglerOrderNo.trim(),
    };

    setSubmitting(true);
    const created = await onAddEntry(entry);
    setSubmitting(false);

    if (created) {
      setRecent(prev => [{ ...entry, id: created.id }, ...prev].slice(0, 10));
      setForm({ ...EMPTY });
      setErrors({});
      feeAmountRef.current = '';
      setFeeAmount('');
      setFeeLunker(false);
      setFeeOption(false);
      boaterContactIdRef.current  = null;
      coAnglerContactIdRef.current = null;
      setTimeout(() => boaterFirstRef.current?.focus(), 0);
    }
  }

  async function openSignApplication(entry) {
    setOpeningWaiver(entry.id);
    try {
      const contacts = await fetchContactsWithSignatures();
      const { boaterSig: contactBoaterSig, coaSig: contactCoaSig } = contactsToSigs(entry, contacts);
      // Fall back to sigs stored on the entry from customer self-sign
      const boaterSig = contactBoaterSig ?? (entry.boaterSig   ? { signature: entry.boaterSig,   signedAt: entry.appSignedAt } : null);
      const coaSig    = contactCoaSig    ?? (entry.coAnglerSig ? { signature: entry.coAnglerSig, signedAt: entry.appSignedAt } : null);
      setPendingWaiver({
        entry,
        boaterContactId: null,
        coAnglerContactId: null,
        prefillSigs: {
          boater:   boaterSig,
          coAngler: entry.appSigned === 1 ? coaSig : null,
        },
      });
    } finally {
      setOpeningWaiver(null);
    }
  }

  if (!isOperator) return <PublicSignUpView settings={settings} entries={entries} onEntriesRefresh={onEntriesRefresh} />;

  const err = (field) => errors[field]
    ? <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 3 }}>{errors[field]}</div>
    : null;

  const fieldBorder = (field) => errors[field]
    ? { ...FIELD, borderColor: '#ff6b6b' }
    : FIELD;

  // Duplicate detection — check name or phone against existing entries
  const normName = s => (s || '').toLowerCase().trim();
  const normPhone = s => (s || '').replace(/\D/g, '');
  function findDuplicate(first, last, phone) {
    if (!first.trim() && !last.trim()) return null;
    return entries.find(e => {
      const nameMatch = normName(e.boaterFirst) === normName(first) && normName(e.boaterLast) === normName(last)
        || (normName(e.coAnglerFirst) === normName(first) && normName(e.coAnglerLast) === normName(last));
      const ph = normPhone(phone);
      const phoneMatch = ph.length >= 10 && (
        normPhone(e.boaterPhone) === ph || normPhone(e.coAnglerPhone) === ph
      );
      return nameMatch || phoneMatch;
    }) ?? null;
  }
  const boaterDup   = findDuplicate(form.boaterFirst, form.boaterLast, form.boaterPhone);
  const coAnglerDup = (form.coAnglerFirst || form.coAnglerLast)
    ? findDuplicate(form.coAnglerFirst, form.coAnglerLast, form.coAnglerPhone)
    : null;

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

      {/* ── Legal text ── */}
      <div style={{ marginBottom: 20, borderRadius: 8, border: '1px solid rgba(139,180,225,0.2)', background: 'rgba(255,255,255,0.03)', padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-light)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Participant Agreement, Release and Acknowledgment of Risk
        </div>
        <div style={{ fontSize: 12, color: 'var(--header-bg)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LEGAL_CLAUSES.map((clause, i) => (
            <p key={i} style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: clause }} />
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', border: '2px solid rgba(139,180,225,0.4)', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--header-bg)', textAlign: 'center', letterSpacing: 0.5 }}>
          THIS SIGNED WAIVER IS IN EFFECT FOR ANY SUSQUEHANNA FISHING TACKLE, INC. TOURNAMENT IN {new Date().getFullYear()}
        </div>
      </div>

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
          {boaterDup && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(240,173,78,0.12)', border: '1px solid rgba(240,173,78,0.45)', fontSize: 12, color: '#f0ad4e' }}>
              ⚠ {[boaterDup.boaterFirst, boaterDup.boaterLast].filter(Boolean).join(' ') === [form.boaterFirst.trim(), form.boaterLast.trim()].filter(Boolean).join(' ')
                ? `${form.boaterFirst.trim()} ${form.boaterLast.trim()} is already signed up`
                : `This phone number matches an existing entry`}
              {boaterDup.boatNo ? ` — Boat #${boaterDup.boatNo}` : ''}
            </div>
          )}
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
          {coAnglerDup && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(240,173,78,0.12)', border: '1px solid rgba(240,173,78,0.45)', fontSize: 12, color: '#f0ad4e' }}>
              ⚠ {[coAnglerDup.boaterFirst, coAnglerDup.boaterLast].filter(Boolean).join(' ') === [form.coAnglerFirst.trim(), form.coAnglerLast.trim()].filter(Boolean).join(' ')
                || [coAnglerDup.coAnglerFirst, coAnglerDup.coAnglerLast].filter(Boolean).join(' ') === [form.coAnglerFirst.trim(), form.coAnglerLast.trim()].filter(Boolean).join(' ')
                ? `${form.coAnglerFirst.trim()} ${form.coAnglerLast.trim()} is already signed up`
                : `This phone number matches an existing entry`}
              {coAnglerDup.boatNo ? ` — Boat #${coAnglerDup.boatNo}` : ''}
            </div>
          )}
        </div>

        {/* ── Entry Fees ── */}
        <div style={{ borderRadius: 8, border: '1px solid rgba(139,180,225,0.25)', background: 'rgba(255,255,255,0.03)', padding: '14px 16px' }}>
          <div style={{ ...SECTION, marginBottom: 12 }}>Entry Fees</div>

          {/* Paper copy toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={paperCopy}
              onChange={e => { setPaperCopy(e.target.checked); if (!e.target.checked) resetPaperPin(); }}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#e8c876' }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: paperCopy ? 'var(--gold-light)' : 'var(--header-bg)' }}>
              Paper Application on File
            </span>
            {paperCopy && (
              <span style={{ fontSize: 11, color: 'var(--gold-light)', opacity: 0.8 }}>— no digital signature needed</span>
            )}
          </label>

          {/* Order #s */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>Boater Order # <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input type="text" value={form.boaterOrderNo} placeholder="Online order #" onChange={e => set('boaterOrderNo', e.target.value)} style={FIELD} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>Co-Angler Order # <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input type="text" value={form.coAnglerOrderNo} placeholder="Online order #" onChange={e => set('coAnglerOrderNo', e.target.value)} style={FIELD} />
            </div>
          </div>

          {/* Fee fields */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={LABEL}>
                Buy-In Amount ($){paperCopy ? ' *' : ''}
                {!paperCopy && <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 4 }}>(optional — pre-fills digital app)</span>}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={feeAmount}
                placeholder={paperCopy ? 'Required' : '0.00 or 249+10+20'}
                onChange={e => { feeAmountRef.current = e.target.value; setFeeAmount(e.target.value); if (errors.feeAmount) setErrors(p => ({ ...p, feeAmount: null })); }}
                onBlur={e => {
                  const result = evalMath(e.target.value);
                  if (!isNaN(result) && e.target.value.trim()) { const v = parseFloat(result.toFixed(2)); feeAmountRef.current = v; setFeeAmount(v); }
                }}
                style={{
                  ...FIELD,
                  borderColor: errors.feeAmount ? '#ff6b6b' : feeAmount ? 'rgba(139,180,225,0.5)' : undefined,
                  color: feeAmount ? 'var(--white)' : undefined,
                }}
              />
              {errors.feeAmount && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 3 }}>{errors.feeAmount}</div>}
              {feeAmount !== '' && (() => { const amt = parseFloat(evalMath(String(feeAmount))); return !isNaN(amt) && amt > 0 ? (
                <div style={{ fontSize: 11, color: amt >= entryFee ? '#6fcf97' : '#f0ad4e', marginTop: 3 }}>
                  {amt >= entryFee ? `✓ Paid in Full ($${amt.toFixed(2)})` : `Partial — min $${entryFee}`}
                </div>
              ) : null; })()}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paperCopy && !paperPinUnlocked && (
            <div>
              {!showPaperPin ? (
                <button
                  type="button"
                  onClick={() => setShowPaperPin(true)}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 6,
                    border: '1.5px solid rgba(139,180,225,0.4)', background: 'rgba(255,255,255,0.06)',
                    fontSize: 14, cursor: 'pointer', color: 'var(--header-bg)', fontWeight: 600,
                  }}
                >
                  🔒 Enter Operator PIN to Submit Paper Copy
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    ref={paperPinRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Operator PIN"
                    value={paperPin}
                    onChange={e => { setPaperPin(e.target.value); setPaperPinError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') tryPaperPin(); if (e.key === 'Escape') { setShowPaperPin(false); setPaperPin(''); setPaperPinError(''); } }}
                    style={{ flex: 1, padding: '10px 12px', fontSize: 15, borderRadius: 6, border: paperPinError ? '1.5px solid #c00' : '1.5px solid rgba(139,180,225,0.4)', background: 'rgba(255,255,255,0.06)', color: 'var(--white)', WebkitTextSecurity: 'disc' }}
                  />
                  <button type="button" onClick={tryPaperPin}
                    style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: '#1a5276', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    Submit
                  </button>
                  <button type="button" onClick={() => { setShowPaperPin(false); setPaperPin(''); setPaperPinError(''); }}
                    style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(139,180,225,0.3)', background: 'rgba(255,255,255,0.06)', color: 'var(--header-bg)', fontSize: 14, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              )}
              {paperPinError && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>{paperPinError}</div>}
            </div>
          )}
          {paperCopy && paperPinUnlocked && (
            <div style={{ fontSize: 12, color: '#6fcf97', fontWeight: 600, padding: '4px 0' }}>✓ Operator verified</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-gold" disabled={submitting || (paperCopy && !paperPinUnlocked)}
                    style={{ flex: 1, fontSize: 16, padding: '12px 0', opacity: (paperCopy && !paperPinUnlocked) ? 0.4 : 1 }}>
              {submitting ? 'Saving…' : paperCopy ? '+ Sign Up (Paper)' : '+ Sign Up'}
            </button>
            {!paperCopy && (
              <button type="button" className="btn btn-outline" onClick={handleSaveForLater} disabled={submitting}
                      style={{ fontSize: 14, padding: '12px 14px', whiteSpace: 'nowrap' }}>
                Save — Sign Later
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={handleClear}
                    style={{ padding: '12px 20px' }}>
              Clear
            </button>
          </div>
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
            {recent.map((r) => (
              <div key={r.id} style={{
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
      {/* ── Fees Needed (signed but unpaid, or customer-entered fee needing verification) ── */}
      {(() => {
        const recentIds  = new Set(recent.map(r => r.id));
        const feesNeeded = entries
          .filter(e => e.appSigned === 1 && (!(e.paid === 1 || e.paid === '1') || e.feeVerified === 0) && !recentIds.has(e.id))
          .sort((a, b) => (b.signedUpAt ?? '').localeCompare(a.signedUpAt ?? ''));
        if (!feesNeeded.length) return null;
        return (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ color: '#f0ad4e', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              ⚠ Fees Needed ({feesNeeded.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {feesNeeded.map(r => {
                const needsVerify = r.feeVerified === 0;
                return (
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
                      {needsVerify && r.buyIn > 0 && (
                        <span style={{ fontSize: 11, color: '#f0ad4e' }}>
                          Customer entered: ${parseFloat(r.buyIn).toFixed(2)} — verify &amp; confirm
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={openingWaiver === r.id}
                      onClick={() => openSignApplication(r)}
                      style={{
                        padding: '4px 12px', fontSize: 11, cursor: openingWaiver === r.id ? 'not-allowed' : 'pointer',
                        background: needsVerify ? '#7b5c00' : '#c67c00', color: '#fff', border: 'none',
                        borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8,
                        opacity: openingWaiver === r.id ? 0.6 : 1,
                      }}
                    >
                      {openingWaiver === r.id ? 'Loading…' : needsVerify ? 'Verify Fee' : 'Enter Fee'}
                    </button>
                  </div>
                );
              })}
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
                  <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={openingWaiver === r.id}
                      onClick={() => openSignApplication(r)}
                      style={{
                        padding: '4px 12px', fontSize: 11, cursor: openingWaiver === r.id ? 'not-allowed' : 'pointer',
                        background: '#1a5276', color: '#fff', border: 'none',
                        borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap',
                        opacity: openingWaiver === r.id ? 0.6 : 1,
                      }}
                    >
                      {openingWaiver === r.id ? 'Loading…' : 'Sign Application'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (window.confirm(`Delete pending application for ${[r.boaterFirst, r.boaterLast].filter(Boolean).join(' ')}?`)) onDeleteEntry?.(r.id); }}
                      style={{
                        padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                        background: 'rgba(255,107,107,0.15)', color: '#ff9090',
                        border: '1px solid rgba(255,107,107,0.4)',
                        borderRadius: 5, fontWeight: 600, whiteSpace: 'nowrap',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {/* ── Find & Edit Existing Entry ── */}
      {onEdit && <FindAndEdit entries={entries} onEdit={onEdit} />}
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
            } else if (!pendingWaiver.prefillSigs) {
              // Fresh sign-up cancelled — delete the entry so it doesn't linger on the roster
              onDeleteEntry?.(pendingWaiver.entry.id);
              setRecent(prev => prev.filter(r => r.id !== pendingWaiver.entry.id));
              onEntriesRefresh?.();
            }
            setPendingWaiver(null);
          }}
        />
      )}
    </div>
  );
}
