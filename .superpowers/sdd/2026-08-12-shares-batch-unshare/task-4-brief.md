### Task 4: Full gates

**Files:** none new — verification only (fix-forward if a gate is red, commit fixes with pathspec).

- [ ] **Step 1: Type check**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: exit code 0, zero failures. Note: `color-guard.test.ts` generates cases per `.vue` file — the case count grows by the new component; that is expected, only failures matter. If `oss/*.test.mjs` fail with a dirty-tree message, that means uncommitted changes exist — commit first, never stash.

- [ ] **Step 3: OSS export guard specifically**

Run: `pnpm exec vitest run oss/`
Expected: PASS. The new files live under `src/files/shares/` (files area ships in the public export). If a manifest/tree guard flags the new files by name, follow the guard's own message to register them in `oss/manifest.mjs`; do not add forbidden-word whitelist entries.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: success (this also re-runs vue-tsc).

- [ ] **Step 5: Commit any gate fixes**

Only if Steps 1-4 required changes:

```bash
git add <exact files touched>
git commit -m "chore(shares): gate fixes for batch unshare" -- <exact files touched>
```
