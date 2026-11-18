---
name: feedback-ui-patterns
description: UI behavior preferences the user has validated or corrected during development
metadata:
  type: feedback
---

**No click-outside dismiss on modals.** Cancel and Save buttons (plus Escape key) are the only ways to close EditModal. Removed overlay pointer handlers in commit dfdba80 (2026-05-14).
**Why:** Prevents accidental dismissal on mobile when tapping near the edge of the panel.
**How to apply:** Any new modal/panel should not close on overlay click. Use explicit buttons only.

---

**No ContactSuggest in EditModal for existing entries.** When editing an existing roster entry, plain `<input>` fields replace `ContactSuggest` for last name. ContactSuggest is only shown when `isNew` (adding a brand-new entry).
**Why:** User said "I don't need contact suggestions on the roster tab when selecting the edit action — that would mean the contact was already selected."
**How to apply:** Gate `ContactSuggest` on `isNew`. Existing entries get plain inputs.

---

**Toolbar buttons → Actions dropdown.** Seven individual toolbar buttons in RosterTab were collapsed into a single `⚙️ Actions ▾` dropdown (commit a5e7d8e area, 2026-05-14).
**Why:** Cleaner toolbar, better mobile UX — individual buttons were hard to tap and caused layout overflow.
**How to apply:** Keep toolbar lean; prefer a single dropdown for bulk/admin actions rather than many individual buttons. Dropdown uses `position: fixed` + `getBoundingClientRect()` to escape overflow:hidden parent, and flips upward when space below is tight.

---

**EmailInput component for email fields.** `src/components/EmailInput.jsx` provides domain autocomplete (gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com) after `@` is typed. Used in SignUpTab and EditModal.
**Why:** User requested domain suggestions for faster email entry on mobile.
**How to apply:** Use `<EmailInput value={...} onChange={...} />` wherever an email field appears.

---

**Form field accessibility standards.** All form inputs/selects need `id` and `name`; all `<label>` elements need `htmlFor` matching the input's `id`. ToggleButton (renders `<button>`) captions must use `<span>` or `<div>`, never `<label>` — browser flags unassociated labels as warnings. `<select>` elements need `id`/`name` too. `EmailInput` and `ContactSuggest` accept `id`/`name` via props/inputProps and forward them.
**Why:** Browser DevTools flagged missing id/name and unassociated labels across all tabs (2026-05-14).
**How to apply:** Any new form field: add `id`, `name`, and a `<label htmlFor>`. Any new button-backed toggle: use `<span>` for its caption label.
