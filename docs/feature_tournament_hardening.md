---
name: feature-tournament-hardening
description: "Tournament-day reliability improvements made 2026-05-15 — destructive op protection, offline resilience, weigh-in overwrite guard"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5895bf20-c3e0-4f0e-abc6-de9ddb5a4d1a
---

Audit and hardening pass done 2026-05-15 in preparation for tournament day.

**Destructive operations — password re-entry required**
All five clear operations (weigh log, sign-up log, check-in log, off-water log, clear all) now use `ConfirmActionModal` instead of bare `confirm()`. Requires admin password re-entry before executing. Previously a single accidental tap on mobile could wipe data.
- `App.jsx`: `handleClearWeighLog`, `handleClearSignUpLog`, `handleClearCheckInLog`, `handleClearCheckOutLog`, `handleClearAll` — all use `setConfirmAction({ label, action })` pattern
- `confirmAction` state + `<ConfirmActionModal>` rendered at bottom of App JSX
- Two-step protection: must be unlocked (password #1) to see buttons + re-enter password (password #2) to execute

**Service worker — offline resilience**
`public/sw.js` was already present but had two gaps: no pre-caching on install, and it cached error responses. Fixed:
- Install now pre-caches `/` and `/index.html` so app shell loads even on first visit with no network
- Fetch handler only caches successful GET responses (`res.ok` check)
- Cache fallback serves cached `/` if no match (keeps UI alive during WiFi drop)
- API calls (`/api/`) always bypass cache — always network-only
- Cache name bumped to `summer-slam-v8`

**Weigh-in overwrite protection**
When a boat already has weight data, Save is disabled until admin explicitly clicks "Yes, overwrite existing weight" in the warning banner.
- `WeighInTab.jsx`: `overwriteConfirmed` state; cleared on boat number change and reset
- Warning banner now has confirm button; once clicked shows green "✔ Overwrite confirmed" line
- Save button: `disabled={... || (status?.type === 'warning' && !overwriteConfirmed)}`

**Performance with 50 public viewers**
Verified safe: Turso free tier allows ~1B row reads/month; 50 viewers at 10s poll × 150 rows × full tournament day ≈ 27M reads. Well within limits. Cloudflare paid plan handles the function invocations easily.

**DQ'd entries excluded from header stats (2026-05-16):**
- Entries marked as disqualified are excluded from the "lunker to beat" and "largest bag" header stats shown to viewers.
- Previously a DQ'd entry could appear as the top fish/bag, which is misleading on the public-facing display.

**buyIn expression validation in EditModal (2026-05-16):**
- The `buyIn` field in `EditModal` now validates the entered expression for both new and existing entries before allowing save.
- Prevents malformed buy-in values from being persisted (e.g., empty string, non-numeric).

**Audit issues fixed (2026-05-16):**
- Flights overflow filter: edge case where a flight filter could return too many or wrong rows — fixed.
- COLLATE NOCASE coverage: ensured all name-comparison SQL queries use COLLATE NOCASE consistently to prevent case-sensitivity mismatches.

**Late penalty trigger fixed (2026-05-17):**
- `src/utils/calculations.js` — late penalty now compares `checkedInAt` (when the boat physically checked in) against `flight.checkInTime` (the scheduled deadline), NOT `weighedAt`.
- Previously penalized based on weigh-in time, which was wrong — penalty should reflect late arrival at check-in, not late weigh-in.
- Entry skips penalty calculation entirely if `checkedInAt` is null (boat never checked in).

**iPad / wide-viewport tab overflow fixed (2026-05-17):**
- Nav tabs were only set to `overflow-x: auto` inside `@media (max-width: 768px)`. iPads in landscape (1024px+) never hit that breakpoint, so tabs overflowed and were clipped.
- Fixed by moving `overflow-x: auto`, `scrollbar-width: none`, and `flex-wrap: nowrap` to the base `.nav-tabs` rule in `style.css` so it applies at all viewport widths.
- Media query still overrides padding to `0 12px` on small screens.

**Why:** Tournament-day failures are unrecoverable in real-time. Spotty venue WiFi + multiple admins on phones = these protections matter.
**How to apply:** These are in place — don't revert the confirm modal pattern back to bare confirm(). DQ exclusion from stats is intentional; do not show DQ'd entries in leaderboard/header aggregates. Late penalty always uses `checkedInAt`, never `weighedAt`.
