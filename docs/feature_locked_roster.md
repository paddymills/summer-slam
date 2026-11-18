---
name: feature-locked-roster
description: "Locked roster view behavior — filter rules, disclaimer, timestamp column, team count, and log modals in Settings"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5895bf20-c3e0-4f0e-abc6-de9ddb5a4d1a
---

When the roster is locked (`isUnlocked === false`), `RosterTab.jsx` returns early with a completely separate simple table (the TanStack table is never rendered). This locked view has:

1. **Filter:** only entries where `paid === 1` AND `appSigned === 1`.
2. **Disclaimer banner** (centered, gold-tinted, above table): team count chip (large bold number + "Teams Registered") stacked above centered disclaimer text (15px). Two lines: bold sentence about paid+signed, then contact line. Contact is info@sfttackle.com.
3. **Team count chip** centered above the disclaimer text (not side-by-side).
4. **Boat # column** (5th column): shows `boatNo`, gold when assigned, `—` when not yet checked in. Sorts numerically (unassigned sort to bottom).
5. **Signed Up column** (6th column): shows `signedUpAt` timestamp formatted as MM/DD/YY HH:MM via `fmtSignedUp()` helper.
6. **Empty state:** "No registered entries yet." (colSpan=6).
7. **Sort:** user-sortable — all 6 columns clickable (▲/▼), defaults to boaterFirst asc. State held in `lockedSortBy` / `lockedSortDesc` in RosterTab. Timestamp sorts by parsed ms; boatNo sorts numerically.
8. **Boat # filter:** exact-match text input above the table (`lockedBoatFilter` state). Entering "5" only shows boat 5, not 35/55/105. Empty input shows all entries.

**Timestamp log columns added to DB (2026-05-14):**
- `signed_up_at` — set to CURRENT_TIMESTAMP on INSERT (when entry is created)
- `checked_in_at` — set on first UPDATE where boat_no is non-empty (CASE WHEN boat_no != '' AND checked_in_at IS NULL)
- `off_water_at` — set when offWater toggled true, cleared when toggled false (server-side CASE expression)
- These columns also exist on `archives` table for permanent record.

**Settings tab log button order:** Sign-Up Log → Check In Log → Check Out Log → Weigh-In Log.

| Button | Icon | tsKey | Trigger |
|---|---|---|---|
| Sign-Up Log | 📝 | signedUpAt | INSERT or first PUT with boaterFirst when NULL |
| Check In Log | ⚓ | checkedInAt | First PUT with non-empty boatNo when NULL |
| Check Out Log | 🏁 | offWaterAt | Off-water toggle turned ON in Check Out tab |
| Weigh-In Log | 📋 | weighedAt | Weight saved via WeighIn tab |

Sign-Up, Check In, and Check Out logs have a **🗑️ Clear Log** button (danger, requires confirm). Weigh-In log has its own clear via `WeighInLogModal`. All logs show MM/DD/YY HH:MM:SS.

All three EventLogModal logs accept `onClearLog` prop → calls `clear-signup-log`, `clear-checkin-log`, or `clear-checkout-log` DELETE endpoints respectively.

**Name correction tip in unlocked roster view (2026-05-16):**
- A tip note is displayed in the unlocked roster view explaining how to correct a contact name: select the entry, edit the name field, and the change cascades to the contact record and all matching entries/archives rows.
- Positioned near the top of the unlocked view so organizers see it before editing.

**Check In tab — visual indicator for already-checked-in anglers (2026-05-16):**
- Anglers who are already checked in are visually distinguished on the Check In tab (e.g., muted/highlighted row or icon) so the organizer can see at a glance who has and hasn't checked in yet.

**Team count vs filter (2026-05-17):** `lockedQualified` (paid+signed, no boat filter) drives the Teams Registered and Individuals chips. `lockedSorted` applies the boat # filter on top for the table rows only. Never use `lockedSorted.length` for the header count chips.

**Individuals chip (2026-05-17):** Second chip in the header — counts boaters + co-anglers with a name across `lockedQualified`. One `appSigned` covers both people on a team. Uses same paid+signed filter as Teams Registered.

**Unlocked roster angler count (2026-05-17):** The filter toggle button in the unlocked roster shows angler counts alongside entry counts:
- All: "All X entries — Y anglers"
- Registered: "X / Y registered — Z anglers"
- Counts computed via `countAnglers()` helper (boaterFirst||boaterLast = 1, coAnglerFirst||coAnglerLast = 1 per entry). `registeredAnglerCount` uses same paid+signed filter.

**Why:** Tournament organizer displays this screen publicly at the event so anglers can confirm their registration. Filter ensures only fully-registered (paid + signed) teams appear.

**How to apply:** Do not show pending/unpaid entries on the locked roster. The team count and individuals count must always reflect `lockedQualified` (ignoring the boat filter). The boat filter only affects visible table rows.
