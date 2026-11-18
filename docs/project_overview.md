---
name: Project overview
description: Stack, deployment, database URLs, and schema summary for the Summer Slam fishing tournament app
metadata:
  type: project
---

Cloudflare Pages app (React + Vite frontend, Cloudflare Functions for API). Database is Turso (libsql).

**Production URL:** `https://sft-summer-slam.pages.dev`

**Production DB:** `libsql://summer-slam-dskiles5311.aws-us-east-1.turso.io`
**Dev DB:** `libsql://summer-slam-dev-dskiles5311.aws-us-east-1.turso.io` (from .env.local)

**Schema tables:**
- `entries` — tournament entries with boater/co-angler info, catch details. Full column list (snake_case only — stale camelCase columns dropped 2026-05-13): `id, boater_first, boater_last, co_angler_first, co_angler_last, boat_no, num_fish, lunker_weight, total_weight, lunker, option_field, paid, app_signed, buy_in, raw_weight, dead_fish, short_fish, needs_attention, boater_phone, co_angler_phone, boater_email, co_angler_email, weighed_at, updated_at, signed_up_at, checked_in_at, off_water_at`
- `contacts` — persistent individual contacts (first_name, last_name, phone, email, last_seen) — survives entry clears
- `settings` — JSON key/value store (fees, payoutSettings, theme, boatCheck, offWater)

**Default payouts:** 10500 total, 17 winners: [4000,1000,800,600,500,360,350,340,330,320,295,280,275,270,265,260,255]

**Functions API:** `functions/api/entries/`, `functions/api/entries/[id].js`, `functions/api/contacts/`, `functions/api/settings/`, `functions/api/auth/`

**DB migration history:**
- 2026-05-08: added boater_phone, co_angler_phone, boater_email, co_angler_email, weighed_at to production
- 2026-05-13: added updated_at (conflict handling); dropped stale boaterPhone/coAnglerPhone columns from production; brought dev schema in sync with production (contacts + archives tables created in dev, entries table recreated with correct column order)
- 2026-05-14 (session 1): codebase cleanup — removed stale rules PDF, dead .summary-card CSS, stale comment; both DBs fully audited and healthy; fixed name typos in contacts (Harry Nurk, Schweitzer); fixed 7 entry mismatches via Levenshtein audit; added Actions dropdown to RosterTab, EmailInput component, mobile card layout for contacts tab, disabled click-outside on EditModal
- 2026-05-14 (session 2): branding overhaul — header background image (header.jpg), leaderboard watermark (watermark.png transparent bg); mobile/iOS fixes (form font-size ≥16px, safe-area insets, touch targets, landscape query); all form fields given id/name/htmlFor; default theme changed from dark to outdoor
- 2026-05-14 (session 3): consolidated from 3 themes (dark/light/outdoor) to 2 (dark/light) — old "light" removed, "outdoor" renamed to "light"; stat chip font-weight normalised to fix resize-on-toggle; audit cleaned orphaned .logo/.logo-icon CSS (5 rules) and removed broken manifest icon refs (icon-192/512 deleted but still in manifest.json)
- 2026-05-14 (session 4): added timestamp log columns (signed_up_at, checked_in_at, off_water_at) to entries + archives tables in both DBs; EventLogModal in Settings for Sign-Up, Check-In, Off-Water logs (same pattern as Weigh-In); locked roster now filters to paid+app_signed only, shows disclaimer, Signed Up column (MM/DD/YY HH:MM), and team count chip
- 2026-05-15 (session 5): fixed parseEntry in api.js not mapping signedUpAt/checkedInAt/offWaterAt (they were stripped on every fetch); fixed signed_up_at not setting on PUT (only INSERT); Safari ISO date parsing fix (space→T); SW changed to network-first (was cache-first causing stale deploys); nav tab renamed to "⚓ Check Out"; Settings logs finalised: Sign-Up Log, Check In Log (checked_in_at), Check Out Log (off_water_at), Weigh-In Log; clear buttons added to Sign-Up/Check In/Check Out logs; all log dates show MM/DD/YY HH:MM:SS
- 2026-05-15 (session 6): leaderboard print hides Recently Weighed and Print/Export buttons via .no-print CSS class; locked roster disclaimer centered, enlarged (15px), team count chip stacked above text; Off Limits tab added (🚫) to the right of Rules — src/content/offlimits.md + src/components/OffLimitsTab.jsx; off limits content uses {{YEAR}}, {{MAX_FISH}}, {{MIN_LENGTH}}, {{FLIGHT_TIMES}} placeholders; Anchor_Marina.jpg and Aberdeen_Proving_Grounds.png added to public/ and rendered inline; Settings Penalties section renamed to "Penalties & Limits"; minFishLength added to penalties settings (default 15); all timestamps archived correctly (confirmed); flight form boatStart/boatEnd now support math expressions (evalMath) + Enter saves the form; Flights tab always shows all configured flights, removed unassigned section; Settings H3 headings centered; Penalties & Limits layout changed to label-left/input-right single column with form-field class for consistent styling

**How to apply:** When touching DB schema, run migrations against both dev and production via Turso HTTP API (`/v2/pipeline`). Contacts table must not be dropped on season reset. Dev token in `.env.local`; production token in Cloudflare Pages env vars.
