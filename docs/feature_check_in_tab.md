---
name: feature-check-in-tab
description: "Check In tab behavior — search, expanded card, warnings for unpaid/unsigned, and inline paid/appSigned toggles"
metadata: 
  node_type: memory
  type: project
  originSessionId: 222f3876-a3c8-4ecf-8b04-5b9c9b35a31c
---

`src/components/CheckInTab.jsx` — search-driven check-in flow for tournament day.

**Search:** single input at top searches by name, phone digits, or boat #. Results appear as expandable cards. Empty query shows prompt; no match shows "No entries match" message.

**Card summary row:**
- Boat # badge (green when checked in, gold otherwise)
- Boater name + co-angler name (or "✓ Checked in — Boat #X" when already checked in)
- Green border + green text when `boatNo` is set (already checked in)
- Red border when `appSigned` or `paid` is falsy
- Badge chips (right side): **`$`** (red) = not paid, **`!`** (red) = not signed, **L** (gold) = lunker, **O** (blue) = option

**Warning banners (expanded card, shown when draft values are falsy):**
1. "⚠️ Entry fee not paid — collect payment before weigh-in." (red, shown first)
2. "⚠️ Application not signed — collect signature before weigh-in." (red, shown second)

**Inline toggles (expanded card, 2-column grid):**
- **Paid** toggle — green "✓ Paid" / red "✕ Not Paid — tap to mark paid"
- **App Signed** toggle — green "✓ Signed" / red "✕ Not Signed — tap to mark signed"
- Both wired to `toggle('paid')` / `toggle('appSigned')` via draft state; persisted on Save via `handleCheckInSave` in `App.jsx`

**Draft initialization (`openCard`):** pulls `paid` and `appSigned` from `row.paid ?? ''` and `row.appSigned ?? ''` — uses `isOn(v)` helper (`v === 1 || v === '1'`) for truthiness checks throughout.

**Save:** calls `onSave(row.id, draft)` → `handleCheckInSave` in `App.jsx` → `updateEntryMut` with `preserveWeighTime: true`. Also triggers contact upsert for name changes. Clears expanded card and refocuses search.

**Why:** Organizers check in boats one at a time at a table. Fast search + immediate visual warnings let them catch unpaid/unsigned entries at the gate before boats launch.

**How to apply:** Keep `paid` and `appSigned` in draft state and initialize them from `row`. Warning banners read from `draft`, not `row`, so toggling paid/signed clears the banner immediately without requiring a save.
