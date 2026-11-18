---
name: feedback-branding-images
description: Lessons learned implementing header background image and leaderboard watermark
metadata:
  type: feedback
---

**Watermark must be a transparent-background PNG.** `public/watermark.png` has transparency; plain `opacity: 0.15` works on all themes with no blend-mode tricks. Black-background images require `mix-blend-mode: screen` (unreliable on iOS fixed elements) or `filter: invert(1)` (inverts colors). Get a transparent PNG instead.
**Why:** Attempted black-bg + screen/multiply/invert approaches all had issues — screen failed on iOS Safari fixed elements, invert produced wrong colors on light themes.
**How to apply:** Any future logo swap: insist on transparent-bg PNG for watermarks.

---

**Watermark img must live in App.jsx outside `<main>`, not inside tab components.** The img uses `position: fixed`. iOS Safari clips fixed elements that are descendants of a `-webkit-overflow-scrolling: touch` scroll container — `<main>` has that property.
**Why:** Watermark was completely invisible on iOS despite correct CSS because `<main>` created a compositing layer that clipped fixed children.
**How to apply:** Any `position: fixed` overlay (watermarks, toasts, modals) must be rendered outside `<main>`. App.jsx conditionally renders the watermark when `activeTab === 'leaderboard'`.

---

**Header background image lives on `header` element, not `.header-top`.** `public/header.jpg` is set as a CSS layered background on `header` (gradient overlay at 78% opacity + image). Stats bar and nav tabs are transparent so the image shows through the full header height.
**Why:** Scoping to `.header-top` made the image too small (only the row height). Full `header` gives the image room to scale via `contain`.
**How to apply:** `background: linear-gradient(rgba(26,51,32,0.78), rgba(26,51,32,0.78)), url('/header.jpg') left top/contain no-repeat #1a3320;` on `header`. Light/outdoor themes have matching rules with their own overlay color.

---

**Mobile header background-position needs `!important`.** Theme overrides use the `background` shorthand which resets `background-position`. A media query rule added later without `!important` gets overridden by theme rules appearing later in the file.
**Why:** `body.light header { background: ... left top ... }` appears after the `@media (max-width: 600px)` block, silently resetting position.
**How to apply:** `header, body.light header { background-position: center top !important; }` inside the mobile media query.

---

**App has two themes: dark and light.** The old three-way cycle (dark → light → outdoor) was consolidated on 2026-05-14 session 3. The old "light" (cream/green) was removed; the old "outdoor" (high-contrast white/green, readable in sunlight) was renamed to "light". Default is `light`.
**Why:** Outdoor was the only non-dark theme anyone actually used. Old light theme was redundant.
**How to apply:** `localStorage.getItem('ss_theme') || 'light'`; toggle cycle is `dark ↔ light`; body class is `light` (no class = dark).

---

**Theme-dependent CSS properties that affect layout must be in the base rule, not just the theme override.** Font-weight was only set in `body.light .stat-chip .lbl`, causing chips to resize when toggling themes.
**Why:** Bold text is wider than normal; adding it only in one theme causes reflow on toggle.
**How to apply:** Any property that affects element size (font-weight, font-size, padding, border-width) must match across all themes — put it in the base rule and only override color/background in theme rules.
