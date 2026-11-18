---
name: project-refactor-status
description: Multi-device refactor — all three phases complete as of 2026-05-13
metadata:
  type: project
---

Refactor to support multi-device, multi-user use at up to 500 boats. All three phases complete.

**Phase 1 — TanStack Query ✅ (commit f915091)**
- Replaced hand-rolled polling loop, visibilitychange listener, settingsSavePendingRef, and manual optimistic rollback with TanStack Query
- `src/hooks/useEntries.js`, `src/hooks/useSettings.js`, `src/hooks/useContacts.js`
- `QueryClientProvider` in `src/main.jsx`
- `App.jsx` rewritten to use hooks; handlers call `mutate`/`mutateAsync`
- Poll interval: 5 s when unlocked, 10 s when locked; `refetchOnWindowFocus: true`

**Phase 2 — TanStack Table + Virtual ✅ (commit ede2812)**
- `RosterTab.jsx` fully migrated
- `useReactTable` with `getSortedRowModel` + `getFilteredRowModel`; custom `sortingFn`s preserve needsAttention float-to-top
- `useVirtualizer` with padding-row approach; renders only visible rows at 500 boats
- `globalFilterFn` combines text search + registration filter in one pass
- Sort state still persisted to localStorage

**Phase 3 — Conflict handling ✅ (commit 8eb916b)**
- `updated_at TEXT` column added to `entries` table; stamped on every INSERT/UPDATE
- Server returns 409 if client's `updatedAt` doesn't match DB (`WHERE id=? AND (? IS NULL OR updated_at = ?)`)
- `src/utils/api.js`: `updatedAt` in `parseEntry`; 409 → `err.isConflict = true`
- `src/App.jsx`: all six mutation handlers (`handleSaveEntry`, `handleToggleEntryField`, `handleUpdateInlineField`, `handleCheckInSave`, `handleClearDeductions`, `handleWeighIn`) show distinct conflict toast vs generic failure
- DB migrations run 2026-05-13: production (145 rows backfilled), dev (empty, column added)

**Rollback tag:** `v1.0-pre-refactor` — tagged at production baseline before any of these changes

**Why:** App will be used on multiple devices simultaneously at tournament events.
**How to apply:** All phases done — no pending refactor work. Next work is feature/bug driven.
