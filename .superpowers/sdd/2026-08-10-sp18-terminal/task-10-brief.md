### Task 10: closing gates

**Files:** none created — verification only (plus fixes for anything the gates surface).

- [ ] **Step 1: Full type check** — `pnpm exec vue-tsc --noEmit` → zero errors.
- [ ] **Step 2: Full test suite** — `pnpm test` (foreground; expect every suite green, including `src/i18n/parity.test.ts` and any repo-wide guard tests — color guards scan source text, so recheck that no new file carries a color literal outside tokens).
- [ ] **Step 3: Build** — `pnpm build` → succeeds.
- [ ] **Step 4: Commit any gate fixes**, then **OSS export gate** (dirty tree fakes a red — commit FIRST):

```bash
git status --porcelain   # must be empty before the export gate
node oss/export.mjs --no-commit
```

Expected: export succeeds. The terminal area is a system-management feature — it ships in the OSS tree in full, so no manifest PATCH/DELETE entries should be needed. If the export gate flags anything (e.g. a guard about cross-area references or forbidden words), fix the flagged wording rather than whitelisting, and re-run.
- [ ] **Step 5: Verify the export tree builds** (the SP9-era extra gate): follow the build-check step that `oss/export.mjs` output or `oss/README`/manifest documents for the exported tree (default output is a /tmp preview directory per the 08-08 fix — build from there; do NOT pass `--publish`).
- [ ] **Step 6: Final commit** if steps 1-5 produced fixes:

```bash
git add -A && git commit -m "chore(sp18): gate fixes after full-suite verification"
```

---

## Verification checklist seed (for the acceptance run later — NOT part of implementation)

1. `pnpm dev` (or deploy per owner's call) → open `/app/#/terminal` as admin.
2. ShellUser is intentionally root (owner decision Q4) — a root shell is EXPECTED, not a bug.
3. Check the current lock policy in Settings > Terminal first — it decides whether the first open shows the lock card (`on_open`/`idle`) or goes straight in (`off`).
4. Lock (idle or via policy change), unlock — the tmux session must resume exactly as left.
5. `systemctl restart nimoos-terminal.service` while the page is open → the page must self-heal to the lock/provision path on the next keepalive (401), not white-screen.
6. `systemctl stop nimoos-terminal.service` → desktop tile disappears after reload; non-admin account never sees the tile.
7. Settings section: wrong password → inline error; 6 rapid failures → freeze countdown; successful save invalidates the terminal page's ticket (it re-locks on next keepalive).
