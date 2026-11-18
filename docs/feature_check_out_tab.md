---
name: feature-check-out-tab
description: Check Out tab (BoatCheckTab) — off-water toggle table and quick boat-number check-out input
metadata: 
  node_type: memory
  type: project
  originSessionId: 222f3876-a3c8-4ecf-8b04-5b9c9b35a31c
---

`src/components/BoatCheckTab.jsx` — tracks which boats have returned off water.

**Table:** shows all entries with a `boatNo`, sorted numerically. Columns: Off Water toggle | Boat # | Boater | Co-Angler. Clicking the toggle circle calls `onToggleOffWater(row.id)` (only when unlocked). Toggle is blue `✓` when off water, grey `○` when on water.

**Counter:** toolbar shows `X / Y off water`. Turns green and shows "✔ All Clear!" when all boated entries are off water.

**Reset All button:** appears when `offWaterCount > 0` and unlocked. Calls `onReset`.

**Locked state:** when `isUnlocked === false`, the entire tab shows a gold warning banner and toggles are disabled (no pointer events).

**Quick check-out input (added 2026-05-17):**
- Text input in toolbar: `inputMode="numeric"`, placeholder "Boat # + Enter"
- On submit (Enter): finds entry where `String(en.boatNo) === val` (exact match)
- If found and not already off water → calls `onToggleOffWater(match.id)`, shows green flash "✓ Boat #X — Name checked out"
- If not found → red flash "⚠️ Boat #X not found"
- If already off water → amber flash "⚠️ Boat #X (Name) already checked out"
- Flash message auto-clears after 1800ms, input clears and refocuses automatically
- Input only renders when `isUnlocked === true`
- Input uses `flex: '1 1 130px'` + `width: '100%'` so it stretches full-width when toolbar wraps on small screens

**Live name preview (added 2026-05-17):**
- `previewEntry` computed from `boatInput.trim()` — matches while typing, no submit needed
- Shows "Boat #X — Boater Name / Co-Angler Name" in a blue info banner below the form
- Turns amber with "· already off water" note if that boat is already checked out
- Preview disappears once flash message fires (conditional: `previewEntry && !flashMsg`)

**iOS fix (2026-05-17):** iOS numeric keyboard shows "Done" not "Return" — form submit never fired. Added an explicit "Check Out" submit button next to the input so mobile users have a tap target. Enter key still works on desktop.

**Reset All password-protected (2026-05-17):** `handleResetBoatCheck` in `App.jsx` now wraps the action in `setConfirmAction(...)` → `ConfirmActionModal`, requiring admin password re-entry before wiping all off-water flags. Matches the pattern used for all other destructive ops.

**Why:** At weigh-in, boats come back continuously. The quick input lets one person at a laptop/tablet type boat numbers rapidly without touching the table rows. The existing row toggles remain available for corrections.

**How to apply:** Only call `onToggleOffWater` if the entry is NOT already off water — do not toggle back via the quick input. The row toggle in the table still toggles both ways (for corrections). Always include the explicit submit button — do not rely on Enter alone for mobile compatibility.
