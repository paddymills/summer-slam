---
name: feature-print-pdf
description: Print/PDF feature for Rules and Off Limits tabs — window.print() with filename control and compact letter-paper CSS
metadata:
  type: project
---

Both the Rules tab and Off Limits tab have a "🖨️ Print / PDF" button matching the leaderboard pattern.

**How it works:**
- Calls `window.print()` directly (no popup window)
- Temporarily sets `document.title` to `"Rules"` or `"Off Limits"` before printing so the browser suggests that as the PDF filename
- Restores the original title via `window.addEventListener('afterprint', ..., { once: true })`

**Print layout:**
- `@media print` CSS in `style.css` targets `.rules-body-panel` (class on the outer tab div) and `.rules-body`
- 10px body text, 1.35 line-height, tight margins — Rules fits ~2 sides of 8.5×11 (front/back)
- Off Limits has 2 location photos constrained to 260×150px max, QR code at 90px
- All colors forced to black for print; header hidden; nav/toolbar hidden via `.no-print`

**QR code:**
- Generated client-side using the `qrcode` npm package (v1.5.4) as a data URL
- Injected via `{{QR_CODE}}` placeholder in both markdown files under a "Register & Results" heading
- URL: `https://sft-summer-slam.pages.dev`
- Data URL survives `window.print()` without any external requests

**Files:**
- `src/components/RulesTab.jsx` — print button, QR generation, `{{QR_CODE}}` injection
- `src/components/OffLimitsTab.jsx` — same pattern
- `src/content/rules.md` — `{{QR_CODE}}` placeholder at bottom
- `src/content/offlimits.md` — `{{QR_CODE}}` placeholder at bottom
- `src/style.css` — `.rules-body-panel` and `.rules-body` print overrides in `@media print`

**Why:** User wanted consistent print UX with the leaderboard, letter-paper sizing for physical handouts, and browser-suggested filenames matching the document name.

**How to apply:** If adding print to other markdown-driven tabs, follow this same pattern: `.rules-body-panel` class on the wrapper, `document.title` swap, `afterprint` restore.
