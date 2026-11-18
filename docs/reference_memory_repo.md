---
name: reference-memory-repo
description: Private GitHub repo for Claude memory files — how to sync and restore on new devices
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5895bf20-c3e0-4f0e-abc6-de9ddb5a4d1a
---

Memory files live at `C:\Users\dskiles\.claude\projects\c--Users-dskiles-src-summer-slam\memory\` and are tracked in a private GitHub repo.

**Repo:** https://github.com/dskiles5311/summer-slam-claude.git (private)

**Auto-sync:** A `PostToolUse` hook in `C:\Users\dskiles\.claude\settings.json` auto-commits and pushes whenever Claude writes a memory file:
```json
"hooks": {
  "PostToolUse": [{
    "matcher": "Write",
    "hooks": [{ "type": "command", "command": "powershell -NonInteractive -Command \"$m='C:\\Users\\dskiles\\.claude\\projects\\c--Users-dskiles-src-summer-slam\\memory'; Set-Location $m; if (git status --porcelain 2>$null) { git add -A; git commit -m 'Auto-sync memory'; git push } \"" }]
  }]
}
```

**Restore on a new device** (assumes project cloned to same path):
```powershell
git clone https://github.com/dskiles5311/summer-slam-claude.git `
  "$env:USERPROFILE\.claude\projects\c--Users-dskiles-src-summer-slam\memory"
```
Then copy the `hooks` block above into `~/.claude/settings.json` on the new device.

**Why:** Memory files are machine-local by default; this keeps them in sync across devices without exposing them publicly.
