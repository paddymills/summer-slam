---
name: feature-mike-mode
description: Mike Mode toggle — large-font TV/monitor view for leaderboard readability at tournaments
metadata:
  type: project
---

`src/components/Header.jsx` + `src/App.jsx` + `src/style.css`

**Toggle button:** "👁️ Mike Mode" / "👁️ Regular Mode" — sits next to the Light/Dark theme toggle in the header. Glows amber when active (`.mike-active` class). State persisted to `localStorage` key `ss_mike_mode`.

**Activation:** `document.documentElement.setAttribute('data-mike', 'true'|'false')` in a `useEffect` in App.jsx. All CSS overrides are scoped to `[data-mike="true"]`.

**What it does:** Boosts font sizes ~35% on leaderboard cards, summary chips, recently-weighed section, stat chips, and nav tabs for readability on a large TV in bright light.

**Grid layout — critical lesson:** The lb-card grid is `rank | boatno | 1fr (names) | stats | payout`. In normal mode the last two columns are `auto`-sized. In Mike Mode, larger fonts make those auto columns expand and crush the `1fr` name column. **Fix: pin stats and payout to fixed px widths in Mike Mode at every breakpoint.**

Fixed widths by breakpoint:
- Desktop (no MQ): `100px 90px 1fr 160px 140px`
- ≤768px: `76px 76px 1fr 140px 120px`
- ≤700px: `54px 54px 1fr 110px 95px`
- ≤480px: `44px 46px 1fr 85px 72px`

**Secondary stats hidden in Mike Mode:** `[data-mike="true"] .lb-stat-item:not(.highlight) { display: none }` — fish count and lunker weight are hidden; only total weight shown. Cleaner TV look and frees more space for names.

**Name wrapping:** Use `overflow-wrap: normal` on `.lb-angler-name` in Mike Mode. This prevents mid-character breaks (the "Je\nff" problem) while allowing word-boundary wrapping. Do NOT use `white-space: nowrap` + `text-overflow: ellipsis` — names get truncated even on large screens if the grid isn't fixed first.

**Responsive breakpoints covered:** 768px (iPad portrait), 700px (large phone landscape), 600px (summary chips only), 480px (iPhone portrait). All breakpoints need explicit Mike Mode overrides — missing one causes the higher-specificity base rule to bleed in with too-large fonts.

**Header chip scroll fix (related):** `.stats-bar` uses `justify-content: flex-start` + `margin: 0 auto` on `.header-stats`. The old `justify-content: center` caused left-side clip on overflow — left chips unreachable on iPhone landscape. This fix is NOT Mike-Mode-specific.

**Why:** User ("Mike") runs the app on a laptop/tablet at the weigh-in table while the leaderboard is mirrored to a TV. Regular mode is sized for handheld use; Mike Mode bumps everything for spectators reading from 10+ feet away.
