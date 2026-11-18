---
name: project-waiver-upload
description: Planned feature — digital in-app waiver signing tied to contacts, season-long validity, no external storage needed
metadata:
  type: project
---

**No R2 or file storage needed.** Signatures are captured as SVG path data (a few hundred bytes) and stored directly in the contacts table as a TEXT column. No object storage, no file uploads.

**The waiver is a season-long release** (2026 SUMMER SLAM ENTRY FORM). Key line: *"THIS SIGNED WAIVER IS IN EFFECT FOR ANY SUSQUEHANNA FISHING TACKLE, INC. TOURNAMENT IN 2026."* Once a contact signs, they don't need to sign again for any 2026 SFT event. Waiver must be versioned by year so 2026 vs 2027 signatures are distinguishable.

**Waiver form content (2026):**
- Header: "2026 SUMMER SLAM ENTRY FORM — May 17, 2026 - North East River Anchor Marina, MD"
- Entry fields: Buy In / Lunker / Option Pot checkboxes (already in app as entry fields)
- Boater and co-angler name/email/phone (already collected during sign-up)
- 5-clause legal release from Susquehanna Fishing Tackle, Inc. covering: rules acknowledgment, risk assumption, liability release, jurisdiction (Lancaster County PA), insurance representation
- TWO signature lines (#1 boater, #2 co-angler) each with date — "Good through 12/31/26"

**Data model additions to contacts table:**
- `signature` TEXT — SVG path data of the drawn signature
- `signed_at` TIMESTAMP — when they signed
- `waiver_year` INTEGER — auto-populated from `new Date().getFullYear()`, no manual update ever needed
- `waiver_snapshot` TEXT (JSON) — captures `{ year, tournamentDate, tournamentLocation }` from settings at the moment of signing; used when rendering a historical waiver so it always shows exactly what the contact agreed to, even if settings have since been updated for a new season

**Sign-up flow logic:**
1. When a contact is matched during sign-up, check if they already have a `waiver_year` matching the current season
2. If yes: show "Waiver on file — signed [date]" and skip the signature step
3. If yes: automatically set `app_signed = 1` on the entry — no manual step needed
4. If no: display the full waiver text and signature pad; capture signature on submit; also set `app_signed = 1` on the entry
4. The same session covers both boater and co-angler — each gets their own signature canvas (#1 and #2) stored independently on their respective contact records

**Roster tab behavior:**
- Show waiver status per angler (signed ✓ with date, or unsigned)
- Tapping/clicking opens a modal showing the rendered SVG signature + signed date

**Contacts tab behavior:**
- Each contact row shows waiver status and signed date if present

**Target build window:** after the 2026 tournament roster is cleared. A clean roster means no mixed paper/digital state to manage and the full digital flow can be the only path from day one.

**Settings tab additions (when building):** add `tournamentDate` and `tournamentLocation` fields to the settings JSON — same pattern as fees/payouts, updated once per season. The waiver header pulls from these at sign time and snapshots them.

**Not in scope yet:** waiver text versioning storage (just use `waiver_year` for now), expiry notifications, multi-year waivers with different text.

**How to apply:** When building, migrate `signature`, `signed_at`, `waiver_year` onto contacts table in both dev and production. No Cloudflare R2 needed. [[project-overview]]
