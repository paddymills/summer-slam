import { useState, useRef, useEffect } from 'react';
import { updateEntry, saveContactWaiver, lookupContactId, signEntryAsCustomer, searchContacts, upsertContacts } from '../utils/api';
import { printSingleWaiver, waiverHTMLTemplate, shareSignedWaiver } from '../utils/printWaivers';
import { formatPhone } from '../utils/phone';

const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.88)',
  display: 'flex', flexDirection: 'column',
  overflowY: 'auto', overscrollBehavior: 'contain',
};

const PAPER = {
  background: '#fff', color: '#111',
  maxWidth: 680, width: '100%',
  margin: '0 auto', padding: '28px 24px 36px',
  boxSizing: 'border-box',
  fontFamily: 'Georgia, serif',
};

const H1 = { textAlign: 'center', fontSize: 20, fontWeight: 700, margin: '0 0 4px', letterSpacing: 0.5 };
const H2 = { textAlign: 'center', fontSize: 14, fontWeight: 400, margin: '0 0 20px', color: '#444' };
const DIVIDER = { border: 'none', borderTop: '2px solid #111', margin: '16px 0' };
const SECTION_HEAD = {
  fontSize: 12, fontWeight: 700, letterSpacing: 1.2,
  textTransform: 'uppercase', margin: '0 0 10px', color: '#333',
};
const CLAUSE = { fontSize: 12, lineHeight: 1.65, margin: '0 0 10px', textAlign: 'justify', color: '#222' };
const WAIVER_NOTICE = {
  textAlign: 'center', fontWeight: 700, fontSize: 13,
  border: '2px solid #111', padding: '8px 16px', margin: '18px 0 20px',
};

// Signature pad component backed by a canvas
function SigPad({ label, number, canvasRef, onStroke }) {
  const drawing = useRef(false);
  const lastPt  = useRef(null);

  function getPos(e, canvas) {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / r.width;
    const scaleY = canvas.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - r.left) * scaleX,
      y: (src.clientY - r.top)  * scaleY,
    };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pt = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    lastPt.current = pt;
  }

  function move(e) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pt = getPos(e, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPt.current = pt;
    onStroke();
  }

  function end(e) {
    e.preventDefault();
    drawing.current = false;
  }

  function clear(e) {
    e.stopPropagation();
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    onStroke(); // parent re-checks isEmpty
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#333' }}>
        #{number} {label} Signature &nbsp;
        <span style={{ fontWeight: 400, color: '#666', fontSize: 11 }}>(Good through 12/31/{new Date().getFullYear()})</span>
      </div>
      <div style={{ position: 'relative', border: '1px solid #aaa', borderRadius: 4, background: '#fafafa' }}>
        <canvas
          ref={canvasRef}
          width={620}
          height={110}
          style={{ display: 'block', width: '100%', height: 110, touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
        <button
          type="button"
          onClick={clear}
          style={{
            position: 'absolute', top: 6, right: 6,
            padding: '3px 10px', fontSize: 11, cursor: 'pointer',
            background: '#eee', border: '1px solid #bbb', borderRadius: 4, color: '#555',
          }}
        >
          Clear
        </button>
      </div>
      <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
        Date: {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
      </div>
    </div>
  );
}

function captureSig(canvas) {
  if (!canvas) return null;
  const tmp = document.createElement('canvas');
  tmp.width  = canvas.width;
  tmp.height = canvas.height;
  const ctx = tmp.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(canvas, 0, 0);
  return tmp.toDataURL('image/jpeg', 0.7);
}

function isCanvasBlank(canvas) {
  if (!canvas) return true;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return false;
  return true;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; for (let j = 1; j <= n; j++) dp[i][j] = i === 0 ? j : 0; }
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function normName(s) { return (s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

function ReadOnlySigBlock({ sig, label, number }) {
  const year = new Date().getFullYear();
  const sigDate = sig?.signedAt
    ? new Date(sig.signedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' })
    : '';
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#333' }}>
        #{number} {label} Signature &nbsp;
        <span style={{ fontWeight: 400, color: '#666', fontSize: 11 }}>(Good through 12/31/{year})</span>
        <span style={{ fontWeight: 400, color: '#2e7d32', fontSize: 11, marginLeft: 8 }}>✓ Already on file</span>
      </div>
      <div style={{ border: '1px solid #aaa', borderRadius: 4, background: '#fafafa', opacity: 0.85 }}>
        <img src={sig.signature} alt={`${label} signature`} style={{ display: 'block', width: '100%', height: 'auto' }} />
      </div>
      {sigDate && <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Signed: {sigDate}</div>}
    </div>
  );
}

export default function WaiverModal({ entry, boaterContactId, coAnglerContactId, prefillSigs = null, settings, onClose, customerMode = false }) {
  const year        = new Date().getFullYear();
  const entryFee    = parseFloat(settings?.fees?.entryFee) || 250;
  const lunkerFee   = parseFloat(settings?.fees?.lunkerFee) || 10;
  const optFee      = parseFloat(settings?.fees?.optFee) || 20;
  const tDate       = settings?.tournamentDate
    ? new Date(settings.tournamentDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const tLocation   = settings?.tournamentLocation || '';

  // Co-angler signing mode: boater's sig is already on file, only co-angler signs
  const isCoAnglerMode  = !!prefillSigs?.boater?.signature;
  const existingBuyIn   = parseFloat(entry.buyIn || 0);
  // Split fee UI only when both: co-angler mode AND a real existing buy-in to display
  const usesSplitFeeUI  = isCoAnglerMode && existingBuyIn > 0;
  // When a fee is already on the entry, show fee fields freely — only lock the Submit button
  const feePreFilled    = existingBuyIn > 0;

  const hasCoAngler = !!(entry.coAnglerFirst && entry.coAnglerLast);

  // Operator PIN unlock — customer mode starts unlocked (no PIN needed)
  const [unlocked,    setUnlocked]    = useState(customerMode);
  const [pinInput,    setPinInput]    = useState('');
  const [pinError,    setPinError]    = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  // Fee fields (only active after operator unlock)
  // In co-angler mode: additionalAmount is the co-angler's addition on top of existingBuyIn
  const [buyInAmount,      setBuyInAmount]      = useState(!isCoAnglerMode && entry.buyIn > 0 ? String(entry.buyIn) : '');
  const [additionalAmount, setAdditionalAmount] = useState('');
  const [lunkerChecked,  setLunkerChecked]  = useState(!!entry.lunker);
  const [optionChecked,  setOptionChecked]  = useState(!!entry.option);

  // Phone overrides (editable when missing from entry)
  const [boaterPhone,    setBoaterPhone]    = useState(entry.boaterPhone    ?? '');
  const [coAnglerPhone,  setCoAnglerPhone]  = useState(entry.coAnglerPhone  ?? '');

  // Signature state — prefilled sigs count as already signed
  const [boaterSigned,   setBoaterSigned]   = useState(!!prefillSigs?.boater?.signature);
  const [coAnglerSigned, setCoAnglerSigned] = useState(!!prefillSigs?.coAngler?.signature);
  const boaterCanvasRef   = useRef(null);
  const coAnglerCanvasRef = useRef(null);

  // Submission
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [submitted,       setSubmitted]       = useState(false);
  const [submittedSigs,   setSubmittedSigs]   = useState(null); // { boater, coAngler, result }
  const [showFeeConfirm,  setShowFeeConfirm]  = useState(false);
  const [nearDupPrompt, setNearDupPrompt] = useState(null);
  const pinRef = useRef(null);

  // Auto-close after operator submit (customerMode keeps the Done screen for PDF sharing)
  useEffect(() => {
    if (submitted && !customerMode && submittedSigs) {
      onClose(submittedSigs.result);
    }
  }, [submitted, customerMode, submittedSigs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus PIN field when it appears
  useEffect(() => {
    if (showPinInput) setTimeout(() => pinRef.current?.focus(), 50);
  }, [showPinInput]);

  // No auto-fill — operator must manually enter the actual amount collected

  function checkStroke() {
    if (!prefillSigs?.boater?.signature) setBoaterSigned(!isCanvasBlank(boaterCanvasRef.current));
    if (hasCoAngler && !prefillSigs?.coAngler?.signature) setCoAnglerSigned(!isCanvasBlank(coAnglerCanvasRef.current));
  }

  function tryUnlock() {
    if (pinInput === '227737' || pinInput === '2277') {
      setUnlocked(true);
      setShowPinInput(false);
      setPinError('');
      setPinInput('');
      handleSubmit(true);
    } else {
      setPinError('Incorrect PIN');
    }
  }

  async function handleSignFeePending() {
    const effectiveBoaterPhone   = entry.boaterPhone?.trim()   || formatPhone(boaterPhone.trim());
    const effectiveCoAnglerPhone = entry.coAnglerPhone?.trim() || formatPhone(coAnglerPhone.trim());
    if (!effectiveBoaterPhone) { setError('Boater phone number is required — enter it in the Anglers section above.'); return; }
    if (hasCoAngler && !effectiveCoAnglerPhone) { setError('Co-angler phone number is required — enter it in the Anglers section above.'); return; }
    if (!boaterSigned) { setError('Boater signature is required.'); return; }
    if (hasCoAngler && !coAnglerSigned) { setError('Co-angler signature is required.'); return; }

    const now      = new Date().toISOString();
    const snapshot = JSON.stringify({ year, tournamentDate: tDate, tournamentLocation: tLocation });
    const keepPaid = existingBuyIn >= entryFee ? 1 : 0;
    const waiverHtml = waiverHTMLTemplate({
      ...entry,
      boaterPhone: effectiveBoaterPhone, coAnglerPhone: effectiveCoAnglerPhone,
      buyIn: existingBuyIn, lunker: entry.lunker || 0, option: entry.option || 0, paid: keepPaid, appSigned: 1,
    }, settings);

    setSubmitting(true);
    setError('');
    try {
      await updateEntry(entry.id, {
        ...entry,
        boaterPhone:   effectiveBoaterPhone,
        coAnglerPhone: effectiveCoAnglerPhone,
        appSigned:   1,
        buyIn:       existingBuyIn,
        paid:        keepPaid,
        lunker:      entry.lunker  || 0,
        option:      entry.option  || 0,
        feeVerified: 1,
      });

      const boaterSigUrl = prefillSigs?.boater?.signature   ?? captureSig(boaterCanvasRef.current);
      const coaSigUrl    = hasCoAngler
        ? (prefillSigs?.coAngler?.signature ?? captureSig(coAnglerCanvasRef.current))
        : null;

      const result = { appSigned: 1, buyIn: existingBuyIn, lunker: entry.lunker || 0, option: entry.option || 0, paid: keepPaid };
      await resolveContacts({
        boaterInfo: { cid: boaterContactId, first: entry.boaterFirst, last: entry.boaterLast, phone: effectiveBoaterPhone, email: entry.boaterEmail, prefilled: !!prefillSigs?.boater?.signature },
        coaInfo: hasCoAngler ? { cid: coAnglerContactId, first: entry.coAnglerFirst, last: entry.coAnglerLast, phone: effectiveCoAnglerPhone, email: entry.coAnglerEmail, prefilled: !!prefillSigs?.coAngler?.signature } : null,
        boaterSigUrl, coaSigUrl, waiverHtml, now, snapshot, result, feePending: keepPaid === 0,
      });
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Background contact resolution for customer self-sign — no near-dup modal, best-effort only
  async function resolveContactsCustomer({ boaterInfo, coaInfo, boaterSigUrl, coaSigUrl, waiverHtml, now, snapshot }) {
    const anglers = [
      { ...boaterInfo, sigUrl: boaterSigUrl },
      ...(coaInfo ? [{ ...coaInfo, sigUrl: coaSigUrl }] : []),
    ];
    for (const angler of anglers) {
      try {
        if (angler.cid) {
          await saveContactWaiver(angler.cid, { signature: angler.sigUrl, signedAt: now, waiverYear: year, waiverSnapshot: snapshot, waiverHtml });
          continue;
        }
        const candidates = await searchContacts(`${angler.first} ${angler.last}`).catch(() => []);
        const exact = candidates.find(c =>
          normName(c.firstName) === normName(angler.first) &&
          normName(c.lastName)  === normName(angler.last)
        );
        if (exact) {
          await saveContactWaiver(exact.id, { signature: angler.sigUrl, signedAt: now, waiverYear: year, waiverSnapshot: snapshot, waiverHtml });
        } else {
          await upsertContacts([{ firstName: angler.first, lastName: angler.last, phone: angler.phone, email: angler.email }]);
          const cid = await lookupContactId(angler.first, angler.last, angler.phone);
          if (cid) await saveContactWaiver(cid, { signature: angler.sigUrl, signedAt: now, waiverYear: year, waiverSnapshot: snapshot, waiverHtml });
        }
      } catch (_) {}
    }
  }

  async function handleCustomerSubmit() {
    const amount = parseFloat(buyInAmount) || 0;
    const effectiveBoaterPhone   = entry.boaterPhone?.trim()   || formatPhone(boaterPhone.trim());
    const effectiveCoAnglerPhone = entry.coAnglerPhone?.trim() || formatPhone(coAnglerPhone.trim());
    if (!effectiveBoaterPhone) { setError('Boater phone number is required — enter it in the Anglers section above.'); return; }
    if (hasCoAngler && !effectiveCoAnglerPhone) { setError('Co-angler phone number is required — enter it in the Anglers section above.'); return; }
    if (!boaterSigned) { setError('Boater signature is required.'); return; }
    if (hasCoAngler && !coAnglerSigned) { setError('Co-angler signature is required.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const boaterSigUrl = captureSig(boaterCanvasRef.current);
      const coaSigUrl    = hasCoAngler ? captureSig(coAnglerCanvasRef.current) : null;
      await signEntryAsCustomer(entry.id, {
        buyIn:          amount,
        lunker:         lunkerChecked ? 1 : 0,
        option:         optionChecked ? 1 : 0,
        boaterPhone:    effectiveBoaterPhone,
        coAnglerPhone:  effectiveCoAnglerPhone,
        boaterSig:      boaterSigUrl,
        coAnglerSig:    coaSigUrl,
      });
      const result = { appSigned: 1, buyIn: amount, lunker: lunkerChecked ? 1 : 0, option: optionChecked ? 1 : 0, paid: 0, feeVerified: 0 };
      setSubmittedSigs({ boater: boaterSigUrl, coAngler: coaSigUrl, result, customerMode: true });
      setSubmitted(true);

      // Fire-and-forget: create/update contact record and save waiver signature
      const now      = new Date().toISOString();
      const snapshot = JSON.stringify({ year, tournamentDate: tDate, tournamentLocation: tLocation });
      const waiverHtml = waiverHTMLTemplate(
        { ...entry, boaterPhone: effectiveBoaterPhone, coAnglerPhone: effectiveCoAnglerPhone, buyIn: amount, lunker: lunkerChecked ? 1 : 0, option: optionChecked ? 1 : 0, paid: 0, appSigned: 1 },
        settings
      );
      resolveContactsCustomer({
        boaterInfo: { cid: boaterContactId, first: entry.boaterFirst, last: entry.boaterLast, phone: effectiveBoaterPhone, email: entry.boaterEmail },
        coaInfo: hasCoAngler ? { cid: coAnglerContactId, first: entry.coAnglerFirst, last: entry.coAnglerLast, phone: effectiveCoAnglerPhone, email: entry.coAnglerEmail } : null,
        boaterSigUrl, coaSigUrl, waiverHtml, now, snapshot,
      }).catch(() => {});
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resolveContacts({ boaterInfo, coaInfo, boaterSigUrl, coaSigUrl, waiverHtml, now, snapshot, result, feePending = false }) {
    const anglers = [
      { ...boaterInfo, role: 'boater', sigUrl: boaterSigUrl },
      ...(coaInfo ? [{ ...coaInfo, role: 'coAngler', sigUrl: coaSigUrl }] : []),
    ];

    const warnings = [];

    for (const angler of anglers) {
      if (angler.prefilled) continue;

      if (angler.cid) {
        try { await saveContactWaiver(angler.cid, { signature: angler.sigUrl, signedAt: now, waiverYear: year, waiverSnapshot: snapshot, waiverHtml }); } catch (_) {}
        continue;
      }

      const candidates = await searchContacts(`${angler.first} ${angler.last}`).catch(() => []);
      const entNorm = normName(`${angler.first} ${angler.last}`);

      const exact = candidates.find(c =>
        normName(c.firstName) === normName(angler.first) &&
        normName(c.lastName)  === normName(angler.last)
      );

      if (exact) {
        try { await saveContactWaiver(exact.id, { signature: angler.sigUrl, signedAt: now, waiverYear: year, waiverSnapshot: snapshot, waiverHtml }); } catch (_) {}
        continue;
      }

      const nearMatches = candidates.filter(c => levenshtein(entNorm, normName(`${c.firstName} ${c.lastName}`)) <= 2);

      if (nearMatches.length > 0) {
        warnings.push({ role: angler.role, entered: `${angler.first} ${angler.last}`, match: nearMatches[0], sigUrl: angler.sigUrl, angler });
      } else {
        // No match — create new contact and save sig
        try {
          await upsertContacts([{ firstName: angler.first, lastName: angler.last, phone: angler.phone, email: angler.email }]);
          const cid = await lookupContactId(angler.first, angler.last, angler.phone);
          if (cid) await saveContactWaiver(cid, { signature: angler.sigUrl, signedAt: now, waiverYear: year, waiverSnapshot: snapshot, waiverHtml });
        } catch (_) {}
      }
    }

    if (warnings.length > 0) {
      setNearDupPrompt({ warnings, idx: 0, decisions: {}, saveData: { boaterSigUrl, coaSigUrl, waiverHtml, now, snapshot }, result, feePending });
      return;
    }

    setSubmittedSigs({ boater: boaterSigUrl, coAngler: coaSigUrl, result, feePending });
    setSubmitted(true);
  }

  async function handleNearDupDecision(useExisting) {
    const { warnings, idx, decisions, saveData, result, feePending } = nearDupPrompt;
    const newDecisions = { ...decisions, [idx]: useExisting ? 'existing' : 'new' };

    if (idx + 1 < warnings.length) {
      setNearDupPrompt({ ...nearDupPrompt, idx: idx + 1, decisions: newDecisions });
      return;
    }

    setNearDupPrompt(null);
    setSubmitting(true);
    try {
      for (let i = 0; i < warnings.length; i++) {
        const w = warnings[i];
        try {
          if (newDecisions[i] === 'existing') {
            await saveContactWaiver(w.match.id, { signature: w.sigUrl, signedAt: saveData.now, waiverYear: year, waiverSnapshot: saveData.snapshot, waiverHtml: saveData.waiverHtml });
          } else {
            await upsertContacts([{ firstName: w.angler.first, lastName: w.angler.last, phone: w.angler.phone, email: w.angler.email }]);
            const cid = await lookupContactId(w.angler.first, w.angler.last, w.angler.phone);
            if (cid) await saveContactWaiver(cid, { signature: w.sigUrl, signedAt: saveData.now, waiverYear: year, waiverSnapshot: saveData.snapshot, waiverHtml: saveData.waiverHtml });
          }
        } catch (_) {}
      }
      setSubmittedSigs({ boater: saveData.boaterSigUrl, coAngler: saveData.coaSigUrl, result, feePending });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(pinVerified = false) {
    if (!unlocked && !pinVerified) { setError('Staff must enter their PIN to unlock and record fees before submitting.'); return; }
    const amount = usesSplitFeeUI
      ? existingBuyIn + (parseFloat(additionalAmount) || 0)
      : parseFloat(buyInAmount);
    if (!usesSplitFeeUI && (!buyInAmount || isNaN(amount) || amount <= 0)) { setError('Enter the amount collected for buy-in.'); return; }
    const effectiveBoaterPhone   = entry.boaterPhone?.trim()   || formatPhone(boaterPhone.trim());
    const effectiveCoAnglerPhone = entry.coAnglerPhone?.trim() || formatPhone(coAnglerPhone.trim());
    if (!effectiveBoaterPhone) { setError('Boater phone number is required — enter it in the Anglers section above.'); return; }
    if (hasCoAngler && !effectiveCoAnglerPhone) { setError('Co-angler phone number is required — enter it in the Anglers section above.'); return; }
    if (!boaterSigned) { setError('Boater signature is required.'); return; }
    if (hasCoAngler && !coAnglerSigned) { setError('Co-angler signature is required.'); return; }

    const paid = amount >= entryFee ? 1 : 0;
    const now    = new Date().toISOString();
    const snapshot = JSON.stringify({ year, tournamentDate: tDate, tournamentLocation: tLocation });
    const waiverHtml = waiverHTMLTemplate({
      ...entry,
      boaterPhone: effectiveBoaterPhone, coAnglerPhone: effectiveCoAnglerPhone,
      buyIn: amount, lunker: lunkerChecked ? 1 : 0, option: optionChecked ? 1 : 0, paid, appSigned: 1,
    }, settings);

    setSubmitting(true);
    setError('');
    try {
      // 1. Update entry fees + app_signed; operator submission always marks fee as verified
      await updateEntry(entry.id, {
        ...entry,
        boaterPhone:   effectiveBoaterPhone,
        coAnglerPhone: effectiveCoAnglerPhone,
        buyIn:     amount,
        lunker:    lunkerChecked ? 1 : 0,
        option:    optionChecked ? 1 : 0,
        paid,
        appSigned:   1,
        feeVerified: 1,
      });

      // 2. Capture or use prefilled signatures
      const boaterSigUrl = prefillSigs?.boater?.signature ?? captureSig(boaterCanvasRef.current);
      const coaSigUrl    = hasCoAngler
        ? (prefillSigs?.coAngler?.signature ?? captureSig(coAnglerCanvasRef.current))
        : null;

      const result = { appSigned: 1, buyIn: amount, lunker: lunkerChecked ? 1 : 0, option: optionChecked ? 1 : 0, paid };
      // Upsert/match contacts with near-duplicate detection (sets submitted state internally)
      await resolveContacts({
        boaterInfo: { cid: boaterContactId, first: entry.boaterFirst, last: entry.boaterLast, phone: effectiveBoaterPhone, email: entry.boaterEmail, prefilled: !!prefillSigs?.boater?.signature },
        coaInfo: hasCoAngler ? { cid: coAnglerContactId, first: entry.coAnglerFirst, last: entry.coAnglerLast, phone: effectiveCoAnglerPhone, email: entry.coAnglerEmail, prefilled: !!prefillSigs?.coAngler?.signature } : null,
        boaterSigUrl, coaSigUrl, waiverHtml, now, snapshot, result,
      });
    } catch (e) {
      setError(e.message || 'Failed to save application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const boaterName    = [entry.boaterFirst, entry.boaterLast, entry.boaterSuffix].filter(Boolean).join(' ');
  const coAnglerName  = hasCoAngler ? [entry.coAnglerFirst, entry.coAnglerLast, entry.coAnglerSuffix].filter(Boolean).join(' ') : '';

  return (
    <div style={OVERLAY}>
      {/* ── Near-Duplicate Contact Warning ── */}
      {nearDupPrompt && (() => {
        const w = nearDupPrompt.warnings[nearDupPrompt.idx];
        const roleLabel = w.role === 'boater' ? 'Boater' : 'Co-Angler';
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 480, width: '100%', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#7f4f00' }}>⚠ Similar {roleLabel} Contact Found</div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>
                The name entered is very similar to an existing contact. Is this the same person?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#fff3cd', border: '1.5px solid #ffc107', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#856404', marginBottom: 6 }}>Customer Entered</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{w.entered}</div>
                </div>
                <div style={{ background: '#e8f4fd', border: '1.5px solid #3498db', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#1a5276', marginBottom: 6 }}>Existing Contact</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{w.match.firstName} {w.match.lastName}</div>
                  {w.match.phone && <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{w.match.phone}</div>}
                </div>
              </div>
              {nearDupPrompt.warnings.length > 1 && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 14, textAlign: 'center' }}>
                  {nearDupPrompt.idx + 1} of {nearDupPrompt.warnings.length}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleNearDupDecision(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: '1.5px solid #bbb', background: '#f5f5f5', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#333' }}
                >
                  No — Create New
                </button>
                <button
                  type="button"
                  onClick={() => handleNearDupDecision(true)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', background: '#1a5276', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' }}
                >
                  Yes — Use "{w.match.firstName} {w.match.lastName}"
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      <div style={PAPER}>

        {/* ── Header ── */}
        <h1 style={H1}>{year} SUMMER SLAM ENTRY FORM</h1>
        {(tDate || tLocation) && (
          <p style={H2}>{[tDate, tLocation].filter(Boolean).join(' · ')}</p>
        )}
        <hr style={DIVIDER} />

        {/* ── Entry Fees ── */}
        <p style={SECTION_HEAD}>Entry Fees</p>
        {customerMode ? (
          /* ── Customer self-sign: fee is self-reported, staff verifies later ── */
          <div style={{ border: '1.5px solid #1a5276', borderRadius: 8, padding: '14px 16px', marginBottom: 20, background: '#eaf3fb' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#333' }}>
                  Buy-In — Amount You're Paying ($)
                  <span style={{ fontWeight: 400, color: '#666', marginLeft: 6, fontSize: 11 }}>Staff will verify</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={buyInAmount}
                  placeholder="e.g. 250"
                  min="0"
                  step="0.01"
                  onChange={e => setBuyInAmount(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 16, borderRadius: 6, border: '1.5px solid #aaa', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 16, paddingBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={lunkerChecked} onChange={e => setLunkerChecked(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  Lunker (${lunkerFee})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={optionChecked} onChange={e => setOptionChecked(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  Option (${optFee})
                </label>
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#1a5276', marginTop: 8, marginBottom: 0 }}>
              Your self-reported fee will be verified by tournament staff before your entry is confirmed as paid.
            </p>
          </div>
        ) : !unlocked && !feePreFilled ? (
          <div style={{ marginBottom: 20 }}>
            {!showPinInput ? (
              <button
                type="button"
                onClick={() => setShowPinInput(true)}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 6,
                  border: '1.5px solid #bbb', background: '#f5f5f5',
                  fontSize: 14, cursor: 'pointer', color: '#444', fontWeight: 600,
                }}
              >
                🔒 Enter Staff PIN to Record Fees
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={pinRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Staff PIN"
                  value={pinInput}
                  onChange={e => { setPinInput(e.target.value); setPinError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') tryUnlock(); if (e.key === 'Escape') { setShowPinInput(false); setPinInput(''); setPinError(''); }}}
                  style={{ flex: 1, padding: '10px 12px', fontSize: 15, borderRadius: 6, border: pinError ? '1.5px solid #c00' : '1.5px solid #bbb', WebkitTextSecurity: 'disc' }}
                />
                <button type="button" onClick={tryUnlock}
                  style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: '#1a5276', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Submit
                </button>
                <button type="button" onClick={() => { setShowPinInput(false); setPinInput(''); setPinError(''); }}
                  style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #bbb', background: '#eee', fontSize: 14, cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            )}
            {pinError && <p style={{ color: '#c00', fontSize: 12, margin: '6px 0 0' }}>{pinError}</p>}
            <p style={{ fontSize: 11, color: '#888', marginTop: 8, textAlign: 'center' }}>
              Staff must enter fees — this section is locked to anglers.
            </p>
          </div>
        ) : usesSplitFeeUI ? (
          /* ── Co-angler signing mode with existing buy-in: show existing + addition ── */
          <div style={{ border: unlocked ? '1.5px solid #2e7d32' : '1.5px solid #bbb', borderRadius: 8, padding: '14px 16px', marginBottom: 20, background: unlocked ? '#f1f8e9' : '#fafafa' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#333' }}>
                  Existing Buy-In (Boater)
                </label>
                <div style={{ padding: '8px 10px', fontSize: 16, borderRadius: 6, border: '1.5px solid #c8e6c9', background: '#e8f5e9', color: '#2e7d32', fontWeight: 700 }}>
                  ${existingBuyIn.toFixed(2)}
                </div>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#333' }}>
                  Co-Angler Addition ($) <span style={{ fontWeight: 400, color: '#666' }}>optional</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={additionalAmount}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  onChange={e => setAdditionalAmount(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 16, borderRadius: 6, border: '1.5px solid #aaa', boxSizing: 'border-box' }}
                  autoFocus={unlocked}
                />
              </div>
              <div style={{ display: 'flex', gap: 16, paddingBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={lunkerChecked} onChange={e => setLunkerChecked(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  Lunker (${lunkerFee})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={optionChecked} onChange={e => setOptionChecked(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  Option (${optFee})
                </label>
              </div>
            </div>
            {unlocked && (() => {
              const total = existingBuyIn + (parseFloat(additionalAmount) || 0);
              return (
                <p style={{ fontSize: 11, color: '#2e7d32', marginTop: 8, marginBottom: 0 }}>
                  ✓ Fees unlocked &nbsp;·&nbsp; New Total: <strong>${total.toFixed(2)}</strong>
                  {parseFloat(additionalAmount) > 0 && ` ($${existingBuyIn.toFixed(2)} + $${parseFloat(additionalAmount).toFixed(2)})`}
                  &nbsp;&mdash;&nbsp;
                  {total >= entryFee ? 'Paid in Full' : `Partial (min $${entryFee})`}
                  {[lunkerChecked && ' · Lunker', optionChecked && ' · Option Pot'].filter(Boolean).join('')}
                </p>
              );
            })()}
          </div>
        ) : (
          /* ── Normal signing mode: enter total collected ── */
          <div style={{ border: unlocked ? '1.5px solid #2e7d32' : '1.5px solid #bbb', borderRadius: 8, padding: '14px 16px', marginBottom: 20, background: unlocked ? '#f1f8e9' : '#fafafa' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#333' }}>
                  Buy-In — Amount Collected ($)
                  <span style={{ fontWeight: 400, color: '#666', marginLeft: 6 }}>min ${entryFee} to mark Paid</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={buyInAmount}
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                  onChange={e => setBuyInAmount(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 16, borderRadius: 6, border: !buyInAmount ? '1.5px solid #c00' : '1.5px solid #aaa', boxSizing: 'border-box' }}
                  autoFocus={unlocked}
                />
              </div>
              <div style={{ display: 'flex', gap: 16, paddingBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={lunkerChecked} onChange={e => setLunkerChecked(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  Lunker (${lunkerFee})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={optionChecked} onChange={e => setOptionChecked(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  Option (${optFee})
                </label>
              </div>
            </div>
            {unlocked && (
              <p style={{ fontSize: 11, color: '#2e7d32', marginTop: 8, marginBottom: 0 }}>
                ✓ Fees unlocked &nbsp;·&nbsp;
                {parseFloat(buyInAmount) >= entryFee
                  ? `$${parseFloat(buyInAmount).toFixed(2)} collected — Paid in Full`
                  : parseFloat(buyInAmount) > 0
                    ? `$${parseFloat(buyInAmount).toFixed(2)} collected — Partial (min $${entryFee})`
                    : <span style={{ color: '#c00' }}>Enter amount collected</span>}
                {[lunkerChecked && ' · Lunker', optionChecked && ' · Option Pot'].filter(Boolean).join('')}
              </p>
            )}
          </div>
        )}

        {/* ── Order Numbers ── */}
        {(entry.boaterOrderNo || entry.coAnglerOrderNo) && (
          <div style={{ fontSize: 11, color: '#555', marginBottom: 16, marginTop: -10 }}>
            {entry.boaterOrderNo && (
              <span>Boater Order #: <strong style={{ color: '#222' }}>{entry.boaterOrderNo}</strong></span>
            )}
            {entry.boaterOrderNo && entry.coAnglerOrderNo && <span style={{ margin: '0 8px' }}>·</span>}
            {entry.coAnglerOrderNo && (
              <span>Co-Angler Order #: <strong style={{ color: '#222' }}>{entry.coAnglerOrderNo}</strong></span>
            )}
          </div>
        )}

        {/* ── Angler Info ── */}
        <p style={SECTION_HEAD}>Anglers</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
          <tbody>
            <tr style={{ borderBottom: hasCoAngler ? '1px solid #ddd' : undefined }}>
              <td style={{ padding: '6px 8px', fontWeight: 700, width: 90 }}>Boater</td>
              <td style={{ padding: '6px 8px' }}>{boaterName}</td>
              <td style={{ padding: '6px 8px' }}>
                {entry.boaterPhone ? (
                  <span style={{ color: '#555' }}>{entry.boaterPhone}</span>
                ) : (
                  <input
                    type="tel"
                    placeholder="Phone required"
                    value={boaterPhone}
                    onChange={e => setBoaterPhone(e.target.value)}
                    onBlur={e => setBoaterPhone(formatPhone(e.target.value))}
                    style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: boaterPhone ? '1px solid #aaa' : '1.5px solid #c00', width: 130 }}
                  />
                )}
              </td>
              <td style={{ padding: '6px 8px', color: '#555', fontSize: 12 }}>{entry.boaterEmail}</td>
            </tr>
            {hasCoAngler && (
              <tr>
                <td style={{ padding: '6px 8px', fontWeight: 700 }}>Co-Angler</td>
                <td style={{ padding: '6px 8px' }}>{coAnglerName}</td>
                <td style={{ padding: '6px 8px' }}>
                  {entry.coAnglerPhone ? (
                    <span style={{ color: '#555' }}>{entry.coAnglerPhone}</span>
                  ) : (
                    <input
                      type="tel"
                      placeholder="Phone required"
                      value={coAnglerPhone}
                      onChange={e => setCoAnglerPhone(e.target.value)}
                      onBlur={e => setCoAnglerPhone(formatPhone(e.target.value))}
                      style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: coAnglerPhone ? '1px solid #aaa' : '1.5px solid #c00', width: 130 }}
                    />
                  )}
                </td>
                <td style={{ padding: '6px 8px', color: '#555', fontSize: 12 }}>{entry.coAnglerEmail}</td>
              </tr>
            )}
          </tbody>
        </table>
        <hr style={DIVIDER} />

        {/* ── Legal Text ── */}
        <p style={{ ...SECTION_HEAD, marginBottom: 14 }}>Participant Agreement, Release and Acknowledgment of Risk</p>
        <p style={CLAUSE}>
          In consideration of Susquehanna Fishing Tackle, Inc. allowing me to participate in this tournament, I acknowledge and agree as follows:
        </p>
        <p style={CLAUSE}>
          <strong>1.</strong> I have read and understood the description of the tournament and the Official Rules of this tournament. I will obey all rules and understand that any violation may result in immediate disqualification without refund of my entry fee. I also understand that tournament officials may reject my application for any reason and in that event will refund my entry fee.
        </p>
        <p style={CLAUSE}>
          <strong>2.</strong> I understand and acknowledge that competitive fishing is a dangerous sport, the risks of which include, though not exclusively, drowning, collisions in the water, and injuries from hooks and other fishing paraphernalia. I voluntarily assume responsibility for these risks, identified and not identified, and all risk of injury or death or damage to myself, or my property or to others, including spectators and their property, arising from my participation in the tournament.
        </p>
        <p style={CLAUSE}>
          <strong>3.</strong> I hereby release, discharge, and agree to hold harmless and indemnify Susquehanna Fishing Tackle, Inc., its shareholders, officers, directors, agents and employees, the host, sponsors and tournament officials, and its partners, agents, or employees, and all other persons or entities associated with the tournament for any and all injury, death, illness or disease, and other damage or loss to property suffered by myself or others. In signing this document I acknowledge and agree that if anyone is hurt or property damaged while I am engaged in this event, I will have no right to make a claim or file a lawsuit against Susquehanna Fishing Tackle, Inc., its shareholders, officers, directors, agents or employees, the host, sponsors, officials, and all other persons or entities associated with the tournament, even if they or any of them negligently caused the bodily injury or property damage.
        </p>
        <p style={CLAUSE}>
          <strong>4.</strong> Any suit brought against me by Susquehanna Fishing Tackle, Inc. as a result of my participation in this tournament will be brought in state or county court in Lancaster County, PA where the principal office of Susquehanna Fishing Tackle, Inc. is located. Should it become necessary for Susquehanna Fishing Tackle, Inc. or someone on its behalf, to incur attorney's fees and costs to enforce this agreement, or any portion thereof, I agree to pay the reasonable costs and attorney's fees thereby expended, or for which a liability is incurred.
        </p>
        <p style={CLAUSE}>
          <strong>5.</strong> I have sufficient health, accident and liability insurance to cover any bodily injury or property damage incurred by myself or others as a result of my participation in this event. If I have no such insurance, I represent that I am capable of paying for any and all such expenses or liability.
        </p>

        <div style={WAIVER_NOTICE}>
          THIS SIGNED WAIVER IS IN EFFECT FOR ANY SUSQUEHANNA FISHING TACKLE, INC. TOURNAMENT IN {year}
        </div>

        {/* ── Signatures ── */}
        {submitted && submittedSigs ? (
          <>
            {[
              { url: submittedSigs.boater,   label: 'Boater',    number: 1 },
              ...(hasCoAngler ? [{ url: submittedSigs.coAngler, label: 'Co-Angler', number: 2 }] : []),
            ].map(({ url, label, number }) => (
              <div key={label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#333' }}>
                  #{number} {label} Signature &nbsp;
                  <span style={{ fontWeight: 400, color: '#666', fontSize: 11 }}>(Good through 12/31/{year})</span>
                </div>
                <div style={{ border: '1px solid #aaa', borderRadius: 4, background: '#fafafa' }}>
                  {url
                    ? <img src={url} alt={`${label} signature`} style={{ display: 'block', width: '100%', height: 'auto' }} />
                    : <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>No signature captured</div>}
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                  Date: {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {prefillSigs?.boater?.signature
              ? <ReadOnlySigBlock sig={prefillSigs.boater} label="Boater" number={1} />
              : <SigPad label="Boater" number={1} canvasRef={boaterCanvasRef} onStroke={checkStroke} />}
            {hasCoAngler && (
              prefillSigs?.coAngler?.signature
                ? <ReadOnlySigBlock sig={prefillSigs.coAngler} label="Co-Angler" number={2} />
                : <SigPad label="Co-Angler" number={2} canvasRef={coAnglerCanvasRef} onStroke={checkStroke} />
            )}
          </>
        )}

        {/* ── Success banner ── */}
        {submitted && (
          <>
            <div style={{ background: '#e8f5e9', border: '2px solid #2e7d32', borderRadius: 8, padding: '12px 16px', marginBottom: submittedSigs?.feePending ? 8 : 16, textAlign: 'center', color: '#1b5e20', fontWeight: 700, fontSize: 15 }}>
              ✓ Application submitted for {boaterName}
            </div>
            {(submittedSigs?.feePending || submittedSigs?.customerMode) && (
              <div style={{ background: 'rgba(240,173,78,0.12)', border: '1.5px solid rgba(240,173,78,0.5)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, textAlign: 'center', color: '#f0ad4e', fontSize: 13 }}>
                {submittedSigs?.customerMode
                  ? '⚠ Your self-reported fee will be verified by tournament staff before your entry is confirmed as paid.'
                  : '⚠ Fee entry is pending — staff will complete this before the tournament.'}
              </div>
            )}
          </>
        )}

        {/* ── Error ── */}
        {error && (
          <p style={{ color: '#c00', fontSize: 13, textAlign: 'center', marginBottom: 16, fontWeight: 600 }}>{error}</p>
        )}

        {/* ── Actions ── */}
        {submitted ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => printSingleWaiver(
                { ...entry, ...submittedSigs.result },
                submittedSigs.boater, submittedSigs.coAngler, settings
              )}
              style={{
                flex: '0 0 auto', padding: '13px 18px', borderRadius: 8,
                border: '1.5px solid #1a5276', background: '#eaf3fb',
                fontSize: 15, cursor: 'pointer', color: '#1a5276', fontWeight: 600,
              }}
            >
              🖨 Print
            </button>
            {submittedSigs?.customerMode && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await shareSignedWaiver(
                      { ...entry, ...submittedSigs.result },
                      submittedSigs.boater, submittedSigs.coAngler, settings
                    );
                  } catch (err) {
                    if (err?.name !== 'AbortError') alert('Could not share PDF: ' + err?.message);
                  }
                }}
                style={{
                  flex: '0 0 auto', padding: '13px 18px', borderRadius: 8,
                  border: '1.5px solid #555', background: '#f5f5f5',
                  fontSize: 15, cursor: 'pointer', color: '#333', fontWeight: 600,
                }}
              >
                📤 Save / Email PDF
              </button>
            )}
            <button
              type="button"
              onClick={() => onClose(submittedSigs?.result)}
              style={{
                flex: 1, minWidth: 80, padding: '13px 0', borderRadius: 8,
                border: 'none', background: '#2e7d32',
                fontSize: 15, fontWeight: 700, cursor: 'pointer', color: '#fff',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {customerMode ? (
              showFeeConfirm ? (
                /* ── Fee verification confirmation step ── */
                <div style={{ border: '3px solid #c8a000', borderRadius: 10, background: '#fff3cd', padding: '20px' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#7a5c00', marginBottom: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    ⚠ Before You Submit — Fee Verification Required
                  </div>
                  <div style={{ fontSize: 14, color: '#5a4200', lineHeight: 1.75, marginBottom: 16 }}>
                    <div style={{ marginBottom: 10 }}>
                      <strong>In-Store Purchase:</strong> Email or text a photo of your receipt along with your <strong>boater first and last name</strong> to tournament staff for verification.
                    </div>
                    <div>
                      <strong>Online Order:</strong> Your order number is required for verification. Make sure your order number is entered on your application before submitting, or contact staff to provide it.
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#7a5c00', fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>
                    Your entry will not be confirmed as paid until staff verifies your purchase.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowFeeConfirm(false)}
                      style={{
                        flex: '0 0 auto', padding: '13px 20px', borderRadius: 8,
                        border: '1.5px solid #aaa', background: '#fff',
                        fontSize: 14, cursor: 'pointer', color: '#555', fontWeight: 600,
                      }}
                    >
                      ← Edit Application
                    </button>
                    <button
                      type="button"
                      onClick={handleCustomerSubmit}
                      disabled={submitting}
                      style={{
                        flex: 1, padding: '13px 0', borderRadius: 8,
                        border: 'none', background: '#1a5276',
                        fontSize: 15, fontWeight: 700,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        color: '#fff', opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      {submitting ? 'Saving…' : '✓ Confirm & Submit'}
                    </button>
                  </div>
                </div>
              ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: '0 0 auto', padding: '13px 22px', borderRadius: 8,
                    border: '1.5px solid #bbb', background: '#eee',
                    fontSize: 15, cursor: 'pointer', color: '#444',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeeConfirm(true)}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '13px 0', borderRadius: 8,
                    border: 'none', background: '#1a5276',
                    fontSize: 15, fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    color: '#fff', opacity: submitting ? 0.5 : 1,
                  }}
                >
                  ✓ Submit Application
                </button>
              </div>
              )
            ) : null}
            {!customerMode && feePreFilled && !unlocked && (
              <div>
                {!showPinInput ? (
                  <button
                    type="button"
                    onClick={() => setShowPinInput(true)}
                    style={{
                      width: '100%', padding: '10px 0', borderRadius: 6,
                      border: '1.5px solid #bbb', background: '#f5f5f5',
                      fontSize: 14, cursor: 'pointer', color: '#444', fontWeight: 600,
                    }}
                  >
                    🔒 Enter Staff PIN to Submit
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      ref={pinRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Staff PIN"
                      value={pinInput}
                      onChange={e => { setPinInput(e.target.value); setPinError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') tryUnlock(); if (e.key === 'Escape') { setShowPinInput(false); setPinInput(''); setPinError(''); } }}
                      style={{ flex: 1, padding: '10px 12px', fontSize: 15, borderRadius: 6, border: pinError ? '1.5px solid #c00' : '1.5px solid #bbb', WebkitTextSecurity: 'disc' }}
                    />
                    <button type="button" onClick={tryUnlock}
                      style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: '#1a5276', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      Unlock
                    </button>
                    <button type="button" onClick={() => { setShowPinInput(false); setPinInput(''); setPinError(''); }}
                      style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #bbb', background: '#eee', fontSize: 14, cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                )}
                {pinError && <p style={{ color: '#c00', fontSize: 12, margin: '6px 0 0' }}>{pinError}</p>}
              </div>
            )}
            {!customerMode && (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      flex: '0 0 auto', padding: '13px 22px', borderRadius: 8,
                      border: '1.5px solid #bbb', background: '#eee',
                      fontSize: 15, cursor: 'pointer', color: '#444',
                    }}
                  >
                    Cancel
                  </button>
                  {unlocked && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      style={{
                        flex: 1, padding: '13px 0', borderRadius: 8,
                        border: 'none', background: '#1a5276',
                        fontSize: 15, fontWeight: 700,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        color: '#fff', opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      {submitting ? 'Saving…' : '✓ Submit Application'}
                    </button>
                  )}
                </div>
                {!unlocked && (
                  <button
                    type="button"
                    onClick={handleSignFeePending}
                    disabled={submitting}
                    style={{
                      width: '100%', padding: '11px 0', borderRadius: 8,
                      border: '1.5px solid rgba(240,173,78,0.5)', background: 'rgba(240,173,78,0.08)',
                      fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                      color: '#f0ad4e',
                    }}
                  >
                    ✓ Sign Application — Fee Pending (Staff will complete)
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {!submitted && customerMode && (
          <p style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 10 }}>
            Your fee is self-reported and will be verified by tournament staff.
          </p>
        )}
        {!submitted && !customerMode && (
          <p style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 10 }}>
            Submitting records fees, marks app signed, and saves signatures to the angler contacts.
          </p>
        )}

      </div>
    </div>
  );
}
