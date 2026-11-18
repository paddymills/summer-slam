---
name: feature-off-limits-tab
description: "Off Limits tab — markdown content, dynamic placeholders, images, and settings fields"
metadata: 
  node_type: memory
  type: project
  originSessionId: 222f3876-a3c8-4ecf-8b04-5b9c9b35a31c
---

Tab added 2026-05-15, positioned to the right of Rules. Accessible to both locked and unlocked users (same as Rules tab).

**Files:**
- `src/content/offlimits.md` — markdown source with placeholders
- `src/components/OffLimitsTab.jsx` — renders markdown via `marked`, same style as RulesTab
- `public/Anchor_Marina.jpg` — Anchor Marina map image
- `public/Aberdeen_Proving_Grounds.png` — Aberdeen Proving Grounds map image

**Placeholders in offlimits.md:**
| Placeholder | Source |
|---|---|
| `{{YEAR}}` | `new Date().getFullYear()` |
| `{{MAX_FISH}}` | `settings.penalties.maxFish` (default 5) |
| `{{MIN_LENGTH}}` | `settings.penalties.minFishLength` (default 15) |
| `{{FLIGHT_TIMES}}` | Generated markdown table from `settings.flights[]` sorted by boatStart — columns: "Boats" (zero-padded range) and "Weigh-In Time" (checkInTime field) |

**Images** are embedded inline in the markdown at the appropriate paragraphs. Styled with `max-width: 100%`, rounded corners, subtle border.

**Settings additions:**
- `penalties.minFishLength` (integer, default 15) — "Minimum Fish Length (inches)" field added to "Penalties & Limits" section in SettingsTab, directly below "Max Fish Limit"
- Section header renamed from "Penalties" to "Penalties & Limits"

**Flight table behavior (updated 2026-05-16):**
- The last flight in the `{{FLIGHT_TIMES}}` table is rendered as an open-ended range (e.g., "Boats 16+" instead of "Boats 16–20") because the last flight absorbs all remaining/unassigned boats.
- This means the last flight row never has a fixed upper bound — any boat not assigned to an earlier flight falls into it automatically.
- Logic lives in `OffLimitsTab.jsx` where the flights array is sorted and the last entry's upper bound is replaced with "+".

**Why:** Organizer hands out an off-limits sheet at the tournament. This tab is the digital version, always current with the year and live settings values. Flight weigh-in times auto-populate from whatever is configured in the Flights/Settings section.

**How to apply:** If the user wants to update off-limits content, edit `src/content/offlimits.md`. Any new dynamic value needs a placeholder added there, a `.replace()` call in `OffLimitsTab.jsx`, and a source in settings or computed from `new Date()`. Images go in `public/` and are referenced as `/filename.ext` in the markdown. When adding flights, the last flight row will always show as open-ended.
