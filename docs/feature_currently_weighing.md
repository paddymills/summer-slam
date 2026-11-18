---
name: feature-currently-weighing
description: "Planned feature — show currently-weighing boat on leaderboard screen (separate device, DB-backed)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 222f3876-a3c8-4ecf-8b04-5b9c9b35a31c
---

**Goal:** When a boat number is entered in the WeighIn tab (admin device), the public leaderboard screen (separate TV/tablet) should display that boat's number and angler names prominently — e.g., a banner or overlay showing "Now Weighing: Boat #5 — John Smith / Jane Doe".

**Architecture required (separate-device scenario):**
- A new persistent field to store the currently-weighing boat — simplest approach is a new key in the existing `settings` table (e.g., `currentlyWeighingBoatNo`), set/cleared server-side.
- A new API endpoint (e.g., `PUT /api/settings/currently-weighing`) that sets or clears the value.
- WeighInTab calls this endpoint when a boat number is looked up (on Enter / onBlur), and clears it when Save completes or the field is cleared.
- LeaderboardTab already polls entries on an interval — it can read `currentlyWeighingBoatNo` from the settings response (no new poll needed if settings are polled too). If settings aren't polled separately, add a lightweight poll.
- LeaderboardTab renders a banner/chip at the top when `currentlyWeighingBoatNo` is set, looking up the matching entry by boatNo to get names.

**Key files to touch:**
- `functions/api/settings/index.js` — add handler for the new field
- `src/components/WeighInTab.jsx` — call set endpoint on boat lookup, clear on save/reset
- `src/components/LeaderboardTab.jsx` — render "Now Weighing" banner from prop
- `src/App.jsx` — pass currentlyWeighing data down to LeaderboardTab; wire up settings poll if not already
- `src/hooks/useSettings.js` — confirm settings are polled (or add polling)

**Estimated effort:** A few hours — moderate, not trivial due to cross-device DB persistence requirement.

**Why:** Leaderboard is displayed on a public TV/screen; WeighIn is operated on a separate admin device at the scales. Anglers watching the board want to see who is currently on the scale.

**How to apply:** Implement the settings-field approach first (simplest). Clear `currentlyWeighingBoatNo` both on successful save AND when the WeighIn tab's boat number field is manually cleared, so the banner doesn't linger after a team is done.
