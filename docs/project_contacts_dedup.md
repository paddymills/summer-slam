---
name: project-contacts-dedup
description: Planned fix for same-name collision in contacts table — phone as secondary key
metadata: 
  node_type: memory
  type: project
  originSessionId: 5895bf20-c3e0-4f0e-abc6-de9ddb5a4d1a
---

The contacts table currently uses `first_name + last_name` (COLLATE NOCASE) as the effective unique key. Two different people with the same name collapse into one row — the second registration silently overwrites the first person's phone and email.

**Agreed approach: Option 1 — Phone as secondary key**
- If a name match is found AND the incoming phone is non-empty AND it differs from the stored phone → create a new contacts row instead of updating the existing one
- Two John Smiths with different phone numbers = two distinct contact rows
- Autofill/suggest when typing a name should show all matching contacts (with phone number visible) so the user can pick the right one
- This also makes the archive backfill safer — can match on name + phone together for higher confidence

**Why this approach over alternatives:**
- Option 2 (suffix/nickname field) — more friction, UI changes everywhere
- Option 3 (link entries to contact IDs) — most correct architecturally but biggest rewrite
- Phone numbers are always unique to a person and already collected at registration

**Files that will need changes:**
- `functions/api/contacts/index.js` — upsert logic (POST handler, lines 81–99)
- Contact autofill/suggest component — show phone number alongside name when multiple contacts share a name
- Archive backfill SQL — can use `name + phone` match for higher confidence once contacts are distinct

**Current state:** Implemented 2026-05-15. Stale-ref bug fixed 2026-05-15 (audit).
- `SignUpTab.jsx` — `boaterContactIdRef` and `coAnglerContactIdRef` (useRef) set on autofill select, cleared on clear/submit AND on manual edits to any name field (onChange now nulls the ref to prevent stale ID from renaming the wrong contact)
- `App.jsx` `handleSignUpEntry` — passes `contactId` in each person's upsert payload
- `src/utils/api.js` `upsertContacts` — forwards `contactId` to POST body when present
- `functions/api/contacts/index.js` — if `contactId` provided and found, does UPDATE by ID; else falls through to name-match path (creates new row for truly different people)

**Name cascade extended to archives (2026-05-16):**
- When a contact's name is edited via the roster, the update now cascades to matching rows in the `archives` table in addition to the active `entries` table.
- This keeps historical records consistent when correcting a misspelled name.

**Sign Up tab tip note (2026-05-16):**
- A visible tip is shown in the Sign Up tab instructing users how to correct an existing contact's name: type the name, select from the autofill suggestion, then edit the name field — the update propagates to the contact record.
- Prevents confusion when a name is already on file but spelled incorrectly.

**Why:** Collision was discovered while planning the archive contact backfill. Two people with the same name in a season is possible; without this fix the contacts table corrupts one person's info with the other's.

**How to apply:** Before building the archive backfill, implement the contacts dedup fix first so the contacts table is trustworthy as a source.
