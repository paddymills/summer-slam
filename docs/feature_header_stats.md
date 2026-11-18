---
name: feature-header-stats
description: "Header stats bar chips — always-visible and unlocked-only, including Total Weight and Deductions"
metadata: 
  node_type: memory
  type: project
  originSessionId: 222f3876-a3c8-4ecf-8b04-5b9c9b35a31c
---

Stats bar lives in `src/components/Header.jsx`. Data comes from `getStats(entries, settings.fees)` in `src/utils/calculations.js`.

**Always-visible chips (locked and unlocked):**
| Chip | Value | Source |
|---|---|---|
| Boats | `totalBoats` | entries with boatNo set |
| Top Lunker | `lunkerToBeat` lbs | top lunkerWeight, paid+signed+!DQ |
| Largest Bag | `largestBag` lbs | top totalWeight, paid+signed+!DQ |
| Lunker Pot | `$lunkerPot` + paid count | lunkerPaidCount × lunkerFee |
| Option Pot | `$optionPot` + paid count | optionPaidCount × optFee |
| Total Weight | `grandTotalWeight` lbs · `totalNumFish` fish | ALL entries with totalWeight > 0 (not filtered to paid/signed) |

**Unlocked-only chips:**
| Chip | Value | Blurred? |
|---|---|---|
| Total Buy-In | `$totalBuyIn` | Yes — `buyInBlurred` toggle |
| Deductions | `X dead / Y short` | Yes — same `buyInBlurred` toggle |

**Deductions chip:** red-tinted border (`rgba(255,107,107,0.4)`) and red text (`#ff9090`). Shows `totalDeadFish` and `totalShortFish` summed across ALL entries. Tapping it toggles the blur (same as Total Buy-In). Label: "Deductions".

**Blur toggle:** `buyInBlurred` state in `App.jsx`, persisted to `localStorage` (`ss_buyin_blur`). Toggled by `onToggleBuyInBlur`. Blurs both Total Buy-In and Deductions simultaneously.

**`getStats` fields added (2026-05-17):**
- `grandTotalWeight` — sum of totalWeight for all entries where totalWeight > 0
- `totalNumFish` — sum of numFish for same set of entries
- `totalDeadFish` — sum of deadFish across ALL entries
- `totalShortFish` — sum of shortFish across ALL entries

**Why:** Total Weight is public-facing info anglers want to see. Deductions are admin-sensitive (show penalty exposure) so they're blurred with financial data. Fish count gives context to the weight number.

**How to apply:** Total Weight chip always renders outside any `isUnlocked` guard. Deductions and Buy-In chips are inside `{isUnlocked && ...}`. Adding a new always-visible chip: add it before the `{isUnlocked && ...}` block. Adding a new blurred chip: use `style={{ filter: buyInFilter }}` and `onClick={onToggleBuyInBlur}`.
