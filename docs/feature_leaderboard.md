---
name: feature-leaderboard
description: "Leaderboard tab layout — summary chips, subtitle, boats weighed, recently weighed cards, payout cards"
metadata: 
  node_type: memory
  type: project
  originSessionId: 222f3876-a3c8-4ecf-8b04-5b9c9b35a31c
---

`src/components/LeaderboardTab.jsx` — always visible (locked and unlocked).

**Header:**
- `<h2>🎣 Summer Slam! 🎣</h2>`
- Subtitle `<p>`: "Live Tournament Leaderboard · X of Y Boats Weighed"
  - `boatsWeighed` = entries where `boatNo` assigned AND `totalWeight > 0`
  - `checkedInCount` = entries where `boatNo` assigned (total checked in)
  - Placement: in the subtitle line, NOT as a separate chip (adding it to the summary grid displaces the 5-chip layout)

**Summary grid (`summary-grid-top`):** 5 chips — Total Weight, Largest Bag, Lunker to Beat, Option 1, Option 2.
- Total Weight: sum of `lbEntries` (leaderboard-eligible entries), NOT the same as header stats grandTotalWeight
- Largest Bag: top totalWeight among paid+signed+weight > 0
- Lunker to Beat: top lunkerWeight among lunker=1+boatNo+weight > 0

**Recently Weighed section:** shows last `recentWeighCount` entries sorted by `weighedAt` desc. Each card shows boat #, names, fish count, lunker weight (if > 0), effective total weight with late penalty note. Hidden when `recentWeighCount === 0`. Has `no-print` class.

**Leaderboard cards:** ranked by `_lbRank` from `getLeaderboardEntries()`. Gold/silver/bronze/normal card classes for top 3. Shows payout from `payoutSettings.payouts` array (split evenly on ties). Cards beyond `topN` get `lb-print-only` class.

**Why:** Boats Weighed in the subtitle keeps the 5-chip grid balanced. It answers the key tournament-day question ("how many boats are still out?") without adding visual weight.

**How to apply:** Do NOT add Boats Weighed as a summary-grid chip — it breaks the layout. Keep it in the subtitle `<p>`. The subtitle format is: `Live Tournament Leaderboard &nbsp;·&nbsp; {boatsWeighed} of {checkedInCount} Boats Weighed`.
