import { jsPDF } from 'jspdf';

export const LEGAL_CLAUSES = [
  'In consideration of Susquehanna Fishing Tackle, Inc. allowing me to participate in this tournament, I acknowledge and agree as follows:',
  '<strong>1.</strong> I have read and understand the description of the tournament and the Official Rules of this tournament. I will obey all rules and understand that any violation may result in immediate disqualification without refund of my entry fee. I also understand that tournament officials may reject my application for any reason and in that event will refund my entry fee.',
  '<strong>2.</strong> I understand and acknowledge that competitive fishing is a dangerous sport, the risks of which include, though not exclusively, drowning, collisions in the water, and injuries from hooks and other fishing paraphernalia. I voluntarily assume responsibility for these risks, identified and not identified, and all risk of injury or death or damage to myself, or my property or to others, including spectators and their property, arising from my participation in the tournament.',
  '<strong>3.</strong> I hereby release, discharge, and agree to hold harmless and indemnify Susquehanna Fishing Tackle, Inc., its shareholders, officers, directors, agents and employees, the host, sponsors and tournament officials, and its partners, agents, or employees, and all other persons or entities associated with the tournament for any and all injury, death, illness or disease, and other damage or loss to property suffered by myself or others. In signing this document I acknowledge and agree that if anyone is hurt or property damaged while I am engaged in this event, I will have no right to make a claim or file a lawsuit against Susquehanna Fishing Tackle, Inc., its shareholders, officers, directors, agents or employees, the host, sponsors, officials, and all other persons or entities associated with the tournament, even if they or any of them negligently caused the bodily injury or property damage.',
  '<strong>4.</strong> Any suit brought against me by Susquehanna Fishing Tackle, Inc. as a result of my participation in this tournament will be brought in state or county court in Lancaster County, PA where the principal office of Susquehanna Fishing Tackle, Inc. is located. Should it become necessary for Susquehanna Fishing Tackle, Inc. or someone on its behalf, to incur attorney\'s fees and costs to enforce this agreement, or any portion thereof, I agree to pay the reasonable costs and attorney\'s fees thereby expended, or for which a liability is incurred.',
  '<strong>5.</strong> I have sufficient health, accident and liability insurance to cover any bodily injury or property damage incurred by myself or others as a result of my participation in this event. If I have no such insurance, I represent that I am capable of paying for any and all such expenses or liability.',
];

// Template placeholder tokens used in frozen HTML snapshots
function sigBlockTemplate(label, number, year) {
  const tokenSig  = label === 'Boater' ? '{{BOATER_SIG}}'  : '{{COA_SIG}}';
  const tokenDate = label === 'Boater' ? '{{BOATER_DATE}}' : '{{COA_DATE}}';
  return `
    <div style="flex:1;min-width:0;">
      <div style="font-size:10px;font-weight:700;margin-bottom:3px;color:#333;">
        #${number} ${label} Signature &nbsp;
        <span style="font-weight:400;color:#666;font-size:9px;">(Good through 12/31/${year})</span>
      </div>
      <div style="border:1px solid #aaa;border-radius:3px;background:#fafafa;height:80px;overflow:hidden;">
        ${tokenSig}
      </div>
      <div style="font-size:9px;color:#666;margin-top:3px;">${tokenDate}</div>
    </div>`;
}

// sig: { signature: dataUrl|'paper'|null, signedAt: isoString|null }
function sigBlock(sig, label, number, year, isPaper = false) {
  const hasPaper = isPaper || sig?.signature === 'paper';
  const hasDigital = sig?.signature && sig.signature !== 'paper';
  const sigDate = sig?.signedAt
    ? new Date(sig.signedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' })
    : '';
  return `
    <div style="flex:1;min-width:0;">
      <div style="font-size:10px;font-weight:700;margin-bottom:3px;color:#333;">
        #${number} ${label} Signature &nbsp;
        <span style="font-weight:400;color:#666;font-size:9px;">(Good through 12/31/${year})</span>
      </div>
      <div style="border:1px solid #aaa;border-radius:3px;background:#fafafa;height:80px;overflow:hidden;">
        ${hasDigital
          ? `<img src="${sig.signature}" style="display:block;width:100%;height:auto;max-height:80px;object-fit:contain;object-position:left;" />`
          : hasPaper
            ? `<div style="display:flex;align-items:center;justify-content:center;height:80px;color:#555;font-size:12px;font-weight:600;font-style:italic;">Paper Application</div>`
            : `<div style="display:flex;align-items:center;justify-content:center;height:80px;color:#999;font-size:11px;">Signature not on file</div>`}
      </div>
      ${sigDate ? `<div style="font-size:9px;color:#666;margin-top:3px;">Signed: ${sigDate}</div>` : ''}
    </div>`;
}

function waiverHTML(entry, boaterSig, coaSig, settings, templateMode = false) {
  const year      = new Date().getFullYear();
  const entryFee  = parseFloat(settings?.fees?.entryFee) || 250;
  const lunkerFee = parseFloat(settings?.fees?.lunkerFee) || 10;
  const optFee    = parseFloat(settings?.fees?.optFee) || 20;
  const tDate     = settings?.tournamentDate
    ? new Date(settings.tournamentDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const tLocation = settings?.tournamentLocation || '';
  const header    = [tDate, tLocation].filter(Boolean).join(' · ');

  const hasCoAngler = !!(entry.coAnglerFirst && entry.coAnglerLast);
  // appSigned=1 with no real digital signature means paper copy
  const isPaper     = entry.appSigned === 1 && (!boaterSig?.signature || boaterSig?.signature === 'paper');
  const boaterName  = [entry.boaterFirst,   entry.boaterLast,   entry.boaterSuffix].filter(Boolean).join(' ');
  const coaName     = hasCoAngler ? [entry.coAnglerFirst, entry.coAnglerLast, entry.coAnglerSuffix].filter(Boolean).join(' ') : '';
  const buyInAmt    = parseFloat(entry.buyIn || 0).toFixed(2);
  const paidLabel   = entry.paid ? '— Paid in Full' : '— Partial';
  const extras      = [entry.lunker && `Lunker ($${lunkerFee})`, entry.option && `Option ($${optFee})`].filter(Boolean).join(' · ');
  const orderParts  = [
    entry.boaterOrderNo    && `Boater Order #: ${entry.boaterOrderNo}`,
    entry.coAnglerOrderNo  && `Co-Angler Order #: ${entry.coAnglerOrderNo}`,
  ].filter(Boolean);

  const clauseP = LEGAL_CLAUSES.map(c =>
    `<p style="font-size:11px;line-height:1.4;margin:0 0 5px;text-align:justify;color:#222;">${c}</p>`
  ).join('');

  return `
    <div class="waiver">
      <h1 style="text-align:center;font-size:17px;font-weight:700;margin:0 0 3px;letter-spacing:.5px;">${year} SUMMER SLAM ENTRY FORM</h1>
      ${header ? `<p style="text-align:center;font-size:12px;font-weight:400;margin:0 0 10px;color:#444;">${header}</p>` : ''}
      <hr style="border:none;border-top:2px solid #111;margin:8px 0;" />

      <p style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 5px;color:#333;">Entry Fees</p>
      <div style="border:1.5px solid #2e7d32;border-radius:6px;padding:6px 10px;margin-bottom:10px;background:#f1f8e9;font-size:12px;">
        <strong>Buy In:</strong> $${buyInAmt} ${paidLabel}${extras ? `&nbsp;&nbsp;·&nbsp;&nbsp;${extras}` : ''}
        ${orderParts.length ? `<div style="margin-top:4px;font-size:11px;color:#555;">${orderParts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>` : ''}
      </div>

      <p style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 5px;color:#333;">Anglers</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;">
        <tr style="border-bottom:1px solid #ddd;">
          <td style="padding:4px 6px;font-weight:700;width:80px;">Boater</td>
          <td style="padding:4px 6px;">${boaterName}</td>
          <td style="padding:4px 6px;color:#555;">${entry.boaterPhone || ''}</td>
          <td style="padding:4px 6px;color:#555;font-size:11px;">${entry.boaterEmail || ''}</td>
        </tr>
        ${hasCoAngler ? `<tr>
          <td style="padding:4px 6px;font-weight:700;">Co-Angler</td>
          <td style="padding:4px 6px;">${coaName}</td>
          <td style="padding:4px 6px;color:#555;">${entry.coAnglerPhone || ''}</td>
          <td style="padding:4px 6px;color:#555;font-size:11px;">${entry.coAnglerEmail || ''}</td>
        </tr>` : ''}
      </table>
      <hr style="border:none;border-top:2px solid #111;margin:8px 0;" />

      <p style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;color:#333;">Participant Agreement, Release and Acknowledgment of Risk</p>
      ${clauseP}

      <div style="text-align:center;font-weight:700;font-size:11px;border:2px solid #111;padding:5px 12px;margin:10px 0 12px;">
        THIS SIGNED WAIVER IS IN EFFECT FOR ANY SUSQUEHANNA FISHING TACKLE, INC. TOURNAMENT IN ${year}
      </div>

      <div style="display:flex;gap:16px;margin-top:12px;">
        ${templateMode ? sigBlockTemplate('Boater', 1, year) : sigBlock(boaterSig, 'Boater', 1, year, isPaper)}
        ${hasCoAngler ? (templateMode ? sigBlockTemplate('Co-Angler', 2, year) : sigBlock(coaSig, 'Co-Angler', 2, year, isPaper)) : ''}
      </div>
    </div>`;
}

function openPrintWindow(title, bodyHTML, { autoPrint = true, extraCss = '' } = {}) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { margin: 0.45in; size: letter portrait; }
    body { font-family: Georgia, serif; color: #111; margin: 0; }
    .waiver { max-width: 680px; margin: 0 auto; padding: 16px 12px; page-break-after: always; box-sizing: border-box; }
    .waiver:last-child { page-break-after: auto; }
    .print-bar { position: sticky; top: 0; z-index: 10; background: #1a5276; padding: 10px 20px; display: flex; align-items: center; gap: 12px; }
    .print-bar button { padding: 7px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .print-bar .btn-print { background: #fff; color: #1a5276; }
    .print-bar .btn-close { background: rgba(255,255,255,0.15); color: #fff; }
    .print-bar span { color: rgba(255,255,255,0.8); font-size: 13px; flex: 1; }
    @media print { .print-bar { display: none !important; } }
    ${extraCss}
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">🖨 Print</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
    <span>${title}</span>
  </div>
  ${bodyHTML}
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to print applications.'); return; }
  w.document.write(html);
  w.document.close();
  if (autoPrint) setTimeout(() => { w.focus(); w.print(); }, 400);
  else w.focus();
}

function makeTitle(entry) {
  const year = new Date().getFullYear();
  return `${year} Summer Slam — ${[entry.boaterFirst, entry.boaterLast, entry.boaterSuffix].filter(Boolean).join(' ')}`;
}

export function contactsToSigs(entry, contacts) {
  const norm  = s => (s || '').toLowerCase().trim();
  const normP = s => (s || '').replace(/\D/g, '');
  const find  = (fn, ln, ph) => contacts.find(c =>
    norm(c.firstName) === norm(fn) && norm(c.lastName) === norm(ln) &&
    (!ph || !normP(c.phone) || normP(c.phone) === normP(ph))
  ) ?? null;
  const hasCoAngler = !!(entry.coAnglerFirst && entry.coAnglerLast);
  return {
    boaterSig: find(entry.boaterFirst, entry.boaterLast, entry.boaterPhone),
    coaSig:    hasCoAngler ? find(entry.coAnglerFirst, entry.coAnglerLast, entry.coAnglerPhone) : null,
  };
}

// Returns the waiver HTML with {{BOATER_SIG}}, {{BOATER_DATE}}, {{COA_SIG}}, {{COA_DATE}} placeholders
export function waiverHTMLTemplate(entry, settings) {
  return waiverHTML(entry, null, null, settings, true);
}

// Inject archived sigs into a frozen template previously created by waiverHTMLTemplate
export function renderArchivedWaiver(templateHtml, boaterSig, coaSig) {
  const fmtDate = sig => {
    if (!sig?.signedAt) return '';
    const d = new Date(sig.signedAt).toLocaleDateString('en-US', {
      month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit',
    });
    return `Signed: ${d}`;
  };
  const imgHtml = sig =>
    sig?.signature
      ? `<img src="${sig.signature}" style="display:block;width:100%;height:auto;max-height:80px;object-fit:contain;object-position:left;" />`
      : `<div style="display:flex;align-items:center;justify-content:center;height:80px;color:#999;font-size:11px;">Signature not on file</div>`;
  return templateHtml
    .replace('{{BOATER_SIG}}',  imgHtml(boaterSig))
    .replace('{{COA_SIG}}',     imgHtml(coaSig))
    .replace('{{BOATER_DATE}}', fmtDate(boaterSig))
    .replace('{{COA_DATE}}',    fmtDate(coaSig));
}

const WAIVER_EXTRA_CSS = `
  @page { margin: 0.45in; size: letter portrait; }
  .waiver { max-width: 680px; margin: 0 auto; padding: 10px 12px; box-sizing: border-box; page-break-after: auto; break-after: auto; }
`;

export function printSingleWaiver(entry, boaterSigUrl, coaSigUrl, settings) {
  const now       = new Date().toISOString();
  const boaterSig = { signature: boaterSigUrl, signedAt: now };
  const coaSig    = coaSigUrl ? { signature: coaSigUrl, signedAt: now } : null;
  openPrintWindow(makeTitle(entry), waiverHTML(entry, boaterSig, coaSig, settings), { autoPrint: false, extraCss: WAIVER_EXTRA_CSS });
}

export function viewSingleWaiver(entry, boaterSigUrl, coaSigUrl, settings) {
  const now       = new Date().toISOString();
  const boaterSig = { signature: boaterSigUrl, signedAt: now };
  const coaSig    = coaSigUrl ? { signature: coaSigUrl, signedAt: now } : null;
  openPrintWindow(makeTitle(entry), waiverHTML(entry, boaterSig, coaSig, settings), { autoPrint: false, extraCss: WAIVER_EXTRA_CSS });
}

// For archived waivers where we already have { signature, signedAt } objects.
// Uses frozen HTML template when available; falls back to reconstructing from entry data.
export function viewArchivedWaiver(entry, boaterSig, coaSig, settings) {
  const html = entry.waiverHtml
    ? renderArchivedWaiver(entry.waiverHtml, boaterSig, coaSig)
    : waiverHTML(entry, boaterSig, coaSig, settings);
  openPrintWindow(makeTitle(entry), html, { autoPrint: false, extraCss: WAIVER_EXTRA_CSS });
}

export async function viewWaiverForEntry(entry, settings, fetchContactsFn) {
  const contacts = await fetchContactsFn();
  const { boaterSig, coaSig } = contactsToSigs(entry, contacts);
  openPrintWindow(makeTitle(entry), waiverHTML(entry, boaterSig, coaSig, settings), { autoPrint: false, extraCss: WAIVER_EXTRA_CSS });
}

// formData: optional { boaterFirst, boaterLast, boaterSuffix, boaterPhone, boaterEmail,
//                      coAnglerFirst, coAnglerLast, coAnglerSuffix, coAnglerPhone, coAnglerEmail,
//                      lunker, option }
export function printBlankApplication(settings, formData = null) {
  const year      = new Date().getFullYear();
  const entryFee  = parseFloat(settings?.fees?.entryFee)  || 250;
  const lunkerFee = parseFloat(settings?.fees?.lunkerFee) || 10;
  const optFee    = parseFloat(settings?.fees?.optFee)    || 20;
  const tDate     = settings?.tournamentDate
    ? new Date(settings.tournamentDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const tLocation = settings?.tournamentLocation || '';
  const header    = [tDate, tLocation].filter(Boolean).join(' · ');

  const clauseP = LEGAL_CLAUSES.map(c =>
    `<p style="font-size:11px;line-height:1.4;margin:0 0 5px;text-align:justify;color:#222;">${c}</p>`
  ).join('');

  const line = (val, w = '150px') => val
    ? `<span style="display:inline-block;border-bottom:1px solid #333;min-width:${w};margin-left:3px;font-weight:600;color:#111;">&nbsp;${val}&nbsp;</span>`
    : `<span style="display:inline-block;border-bottom:1px solid #333;width:${w};margin-left:3px;">&nbsp;</span>`;

  const f = formData || {};
  const boaterName  = [f.boaterFirst, f.boaterLast, f.boaterSuffix].filter(Boolean).join(' ');
  const coaName     = [f.coAnglerFirst, f.coAnglerLast, f.coAnglerSuffix].filter(Boolean).join(' ');
  const hasCoAngler = !!(f.coAnglerFirst || f.coAnglerLast);

  const blankSigBlock = (label, number) => `
    <div style="flex:1;min-width:0;">
      <div style="font-size:10px;font-weight:700;margin-bottom:3px;color:#333;">
        #${number} ${label} Signature
        <span style="font-weight:400;color:#666;font-size:9px;">(Good through 12/31/${year})</span>
      </div>
      <div style="height:80px;border:1px solid #aaa;border-radius:3px;background:#fafafa;"></div>
      <div style="font-size:9px;color:#555;margin-top:5px;">Date:${line('', '100px')}</div>
    </div>`;

  const html = `
    <div class="waiver">
      <h1 style="text-align:center;font-size:15px;font-weight:700;margin:0 0 2px;letter-spacing:.5px;">${year} SUMMER SLAM ENTRY FORM</h1>
      ${header ? `<p style="text-align:center;font-size:11px;font-weight:400;margin:0 0 6px;color:#444;">${header}</p>` : ''}
      <hr style="border:none;border-top:2px solid #111;margin:5px 0;" />

      <p style="font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 3px;color:#333;">Entry Fees</p>
      <div style="border:1px solid #999;border-radius:4px;padding:5px 10px;margin-bottom:6px;background:#fafafa;font-size:11px;">
        Entry Fee: <strong>$${entryFee}</strong>
        &nbsp;&nbsp;
        Lunker: <strong>$${lunkerFee}</strong> <input type="checkbox" style="vertical-align:middle;" /> Yes
        &nbsp;&nbsp;
        Option: <strong>$${optFee}</strong> <input type="checkbox" style="vertical-align:middle;" /> Yes
        &nbsp;&nbsp;&nbsp;
        Buy-In Total:${line('', '100px')}
        &nbsp;&nbsp;&nbsp;
        Boater Order #:${line(f.boaterOrderNo || '', '90px')}
        &nbsp;&nbsp;
        Co-Angler Order #:${line(f.coAnglerOrderNo || '', '90px')}
      </div>

      <p style="font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 3px;color:#333;">Anglers</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px;">
        <tbody>
          <tr style="border-bottom:1px solid #ddd;">
            <td style="padding:3px 4px 3px 0;font-weight:700;white-space:nowrap;width:62px;">Boater</td>
            <td style="padding:3px 4px;">Name:${line(boaterName, '130px')}</td>
            <td style="padding:3px 4px;">Phone:${line(f.boaterPhone, '100px')}</td>
            <td style="padding:3px 4px;font-size:10px;">Email:${line(f.boaterEmail, '120px')}</td>
          </tr>
          <tr>
            <td style="padding:3px 4px 3px 0;font-weight:700;white-space:nowrap;">Co-Angler</td>
            <td style="padding:3px 4px;">Name:${line(hasCoAngler ? coaName : '', '130px')}</td>
            <td style="padding:3px 4px;">Phone:${line(hasCoAngler ? f.coAnglerPhone : '', '100px')}</td>
            <td style="padding:3px 4px;font-size:10px;">Email:${line(hasCoAngler ? f.coAnglerEmail : '', '120px')}</td>
          </tr>
        </tbody>
      </table>
      <hr style="border:none;border-top:2px solid #111;margin:5px 0;" />

      <p style="font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 4px;color:#333;">Participant Agreement, Release and Acknowledgment of Risk</p>
      ${clauseP}

      <div style="text-align:center;font-weight:700;font-size:9.5px;border:2px solid #111;padding:4px 10px;margin:6px 0 10px;">
        THIS SIGNED WAIVER IS IN EFFECT FOR ANY SUSQUEHANNA FISHING TACKLE, INC. TOURNAMENT IN ${year}
      </div>

      <div style="display:flex;gap:16px;margin-top:12px;">
        ${blankSigBlock('Boater', 1)}
        ${blankSigBlock('Co-Angler', 2)}
      </div>
    </div>`;

  openPrintWindow(`${year} Summer Slam — Entry Form`, html, {
    autoPrint: false,
    extraCss: `
      @page { margin: 0.45in; size: letter portrait; }
      .waiver { max-width: 680px; margin: 0 auto; padding: 10px 12px; box-sizing: border-box; page-break-after: auto; break-after: auto; }
    `,
  });
}

export function printAllWaivers(signedEntries, contacts, settings) {
  const year = new Date().getFullYear();
  const html = signedEntries.map(entry => {
    const { boaterSig, coaSig } = contactsToSigs(entry, contacts);
    return waiverHTML(entry, boaterSig, coaSig, settings);
  }).join('');

  openPrintWindow(`${year} Summer Slam — Signed Applications`, html, {
    autoPrint: false,
    extraCss: `
      @page { margin: 0.45in; size: letter portrait; }
      .waiver { max-width: 680px; margin: 0 auto; padding: 10px 12px; box-sizing: border-box; }
    `,
  });
}

export async function shareBlankApplication(settings, formData = null) {

  const year      = new Date().getFullYear();
  const entryFee  = parseFloat(settings?.fees?.entryFee)  || 250;
  const lunkerFee = parseFloat(settings?.fees?.lunkerFee) || 10;
  const optFee    = parseFloat(settings?.fees?.optFee)    || 20;
  const tDate     = settings?.tournamentDate
    ? new Date(settings.tournamentDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const header = [tDate, settings?.tournamentLocation].filter(Boolean).join(' · ');

  const f = formData || {};
  const boaterName = [f.boaterFirst, f.boaterLast, f.boaterSuffix].filter(Boolean).join(' ');
  const coaName    = [f.coAnglerFirst, f.coAnglerLast, f.coAnglerSuffix].filter(Boolean).join(' ');
  const stripTags  = s => s.replace(/<[^>]+>/g, '');

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const PW = 215.9, M = 15, CW = PW - 2 * M;
  // line height in mm for a given pt size at 1.15× factor
  const lh = pt => pt * 1.15 * 25.4 / 72;
  let y = M;

  const sf = (style, pt) => { doc.setFont('helvetica', style); doc.setFontSize(pt); };
  const hr = (w = 0.5) => {
    doc.setLineWidth(w); doc.setDrawColor(30, 30, 30);
    doc.line(M, y, PW - M, y); y += 3;
  };
  const underline = (x1, x2, yy) => {
    doc.setLineWidth(0.3); doc.setDrawColor(120, 120, 120);
    doc.line(x1, yy + 0.5, x2, yy + 0.5);
  };
  const sectionLabel = text => {
    sf('bold', 7); doc.setTextColor(60, 60, 60);
    doc.text(text.toUpperCase(), M, y); y += 4;
    doc.setTextColor(20, 20, 20);
  };

  // ── Title ──────────────────────────────────────────────
  sf('bold', 14); doc.setTextColor(20, 20, 20);
  doc.text(`${year} SUMMER SLAM ENTRY FORM`, PW / 2, y, { align: 'center' }); y += 5;
  if (header) {
    sf('normal', 9); doc.setTextColor(80, 80, 80);
    doc.text(header, PW / 2, y, { align: 'center' }); y += 4;
    doc.setTextColor(20, 20, 20);
  }
  y += 1; hr(0.8); y += 1;

  // ── Entry Fees ─────────────────────────────────────────
  sectionLabel('Entry Fees');
  sf('normal', 8.5);
  let x = M;
  doc.text('Entry Fee: ', x, y); x += doc.getTextWidth('Entry Fee: ');
  sf('bold', 8.5); doc.text(`$${entryFee}`, x, y); x += doc.getTextWidth(`$${entryFee}`) + 6;
  sf('normal', 8.5);
  doc.setLineWidth(0.3); doc.setDrawColor(100, 100, 100);
  doc.rect(x, y - 2.8, 3, 3); x += 4;
  doc.text(`Lunker ($${lunkerFee})`, x, y); x += doc.getTextWidth(`Lunker ($${lunkerFee})`) + 6;
  doc.rect(x, y - 2.8, 3, 3); x += 4;
  doc.text(`Option ($${optFee})`, x, y); x += doc.getTextWidth(`Option ($${optFee})`) + 6;
  doc.text('Buy-In:', x, y); x += doc.getTextWidth('Buy-In:') + 1;
  underline(x, x + 35, y);
  y += 6;

  // Order # on its own line so Co-Angler Order # doesn't get cut off
  x = M;
  sf('normal', 8.5);
  const boaterLabelW = doc.getTextWidth('Boater Order #:');
  const coaLabelW    = doc.getTextWidth('Co-Angler Order #:');
  const orderBlankW  = (CW - boaterLabelW - coaLabelW - 14) / 2;
  doc.text('Boater Order #:', x, y); x += boaterLabelW + 2;
  underline(x, x + orderBlankW, y);
  if (f.boaterOrderNo) { sf('bold', 8.5); doc.text(f.boaterOrderNo, x + 1, y, { maxWidth: orderBlankW - 2 }); sf('normal', 8.5); }
  x += orderBlankW + 10;
  doc.text('Co-Angler Order #:', x, y); x += coaLabelW + 2;
  underline(x, PW - M, y);
  if (f.coAnglerOrderNo) { sf('bold', 8.5); doc.text(f.coAnglerOrderNo, x + 1, y, { maxWidth: PW - M - x - 2 }); sf('normal', 8.5); }
  y += 7;

  // ── Anglers ────────────────────────────────────────────
  sectionLabel('Anglers');
  const drawAnglerRow = (label, name, phone, email) => {
    sf('bold', 8); doc.text(label, M, y);
    sf('normal', 8);
    let rx = M + 20;
    doc.text('Name:', rx, y); rx += doc.getTextWidth('Name:') + 1;
    underline(rx, rx + 50, y);
    if (name) { sf('bold', 8); doc.text(name, rx + 1, y, { maxWidth: 49 }); sf('normal', 8); }
    rx += 52;
    doc.text('Phone:', rx, y); rx += doc.getTextWidth('Phone:') + 1;
    underline(rx, rx + 32, y);
    if (phone) { sf('bold', 8); doc.text(phone, rx + 1, y); sf('normal', 8); }
    rx += 34;
    sf('normal', 7.5);
    doc.text('Email:', rx, y); rx += doc.getTextWidth('Email:') + 1;
    underline(rx, PW - M, y);
    if (email) { sf('bold', 7.5); doc.text(email, rx + 1, y, { maxWidth: PW - M - rx - 2 }); sf('normal', 7.5); }
    y += 5.5;
  };
  drawAnglerRow('Boater', boaterName, f.boaterPhone, f.boaterEmail);
  drawAnglerRow('Co-Angler', coaName, f.coAnglerPhone, f.coAnglerEmail);
  y += 1; hr(0.8); y += 2;

  // ── Legal Clauses ──────────────────────────────────────
  sectionLabel('Participant Agreement, Release and Acknowledgment of Risk');
  sf('normal', 8); doc.setTextColor(30, 30, 30);
  const lineH = lh(8);
  for (const clause of LEGAL_CLAUSES) {
    const lines = doc.splitTextToSize(stripTags(clause), CW);
    doc.text(lines, M, y);
    y += lines.length * lineH + 2;
  }
  y += 2;

  // ── Waiver Banner ──────────────────────────────────────
  sf('bold', 7.5); doc.setTextColor(20, 20, 20);
  const bannerText = `THIS SIGNED WAIVER IS IN EFFECT FOR ANY SUSQUEHANNA FISHING TACKLE, INC. TOURNAMENT IN ${year}`;
  const bannerLines = doc.splitTextToSize(bannerText, CW - 6);
  const bannerH = bannerLines.length * lh(7.5) + 5;
  doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.7);
  doc.rect(M, y, CW, bannerH);
  doc.text(bannerLines, PW / 2, y + bannerH / 2 + 1, { align: 'center' });
  y += bannerH + 5;

  // ── Signature Blocks ───────────────────────────────────
  const sigW = (CW - 8) / 2, sigH = 22;
  [[`Boater`, 1], [`Co-Angler`, 2]].forEach(([label, num], i) => {
    const sx = M + i * (sigW + 8);
    sf('bold', 8); doc.setTextColor(20, 20, 20);
    doc.text(`#${num} ${label} Signature`, sx, y);
    sf('normal', 7); doc.setTextColor(100, 100, 100);
    doc.text(`(Good through 12/31/${year})`, sx, y + 3.5);
    doc.setFillColor(250, 250, 250); doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.4);
    doc.rect(sx, y + 7, sigW, sigH, 'FD');
    sf('normal', 7.5); doc.setTextColor(60, 60, 60);
    const dy = y + 7 + sigH + 5;
    doc.text('Date:', sx, dy);
    underline(sx + doc.getTextWidth('Date:') + 1, sx + sigW, dy);
  });

  // ── Share or Download ──────────────────────────────────
  const SUBMIT_EMAIL = 'info@sfttackle.com';
  const boaterNameForFile = [f.boaterFirst, f.boaterLast].filter(Boolean).join(' ');
  const orderParts = [f.boaterOrderNo, f.coAnglerOrderNo].filter(Boolean);
  const orderPart = orderParts.length ? ` · Order #${orderParts.join(', ')}` : '';
  const subjectLine = boaterNameForFile
    ? `${year} Summer Slam Entry — ${boaterNameForFile}${orderPart}`
    : `${year} Summer Slam Entry Form${orderPart}`;
  const fileName = boaterNameForFile
    ? `${year}_Summer_Slam_Entry_${boaterNameForFile.replace(/\s+/g, '_')}.pdf`
    : `${year}_Summer_Slam_Entry.pdf`;
  const pdfBlob  = doc.output('blob');
  const pdfFile  = new File([pdfBlob], fileName, { type: 'application/pdf' });

  const fallbackShare = () => {
    const url = URL.createObjectURL(pdfBlob);
    const a   = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const body = `Please find the attached entry form.\n\n(Attach the downloaded PDF: ${fileName})`;
    window.open(`mailto:${SUBMIT_EMAIL}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`);
  };

  if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        title: subjectLine,
        text: `Please email the attached entry form to ${SUBMIT_EMAIL}`,
        files: [pdfFile],
      });
    } catch (e) {
      if (e.name !== 'AbortError') fallbackShare();
    }
  } else {
    fallbackShare();
  }
}
