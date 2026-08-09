# SP11 wallpaper — final review fix wave report

Base for this wave: New-UI `master@819d2ab` (the review's head). Four commits landed:

- `8660050` fix(service): send wallpaper image upload as real multipart, not JSON
- `1112c29` fix(wallpaper): wire login/logout lifecycle and fix theme preview persistence
- `2e2ca74` test(wallpaper): cover the desktop menu item's real render path, split a mis-asserted case
- `f6da89f` chore(oss): whitelist SP11 final-fix-wave comments' ordinary 'photo'/'ai' hits

All commits used explicit pathspecs; the 3 permanent staged `design-export/*.html`
deletions were never touched (`git status --short` still shows exactly those 3 `D`
lines and nothing else after the wave).

## Findings

### C1 (Critical) — `uploadImage` sent FormData as JSON

**File:** `packages/service/src/users.ts`

Added the same `{ headers: { 'Content-Type': 'multipart/form-data' } }` override
every other multipart caller in the package already uses (`ai.ts:120`,
`photos.ts:365/371`, `sys.ts:106`).

**Test:** `packages/service/src/users.test.ts` — extended the existing
`uploadImage` test to a three-argument mock (`post(url, body, config)`) and
asserted `calls[0].config` equals the multipart header, following the pattern
`sys.test.ts`'s `'uploadSSLCert 走 multipart'` already uses.

**Non-vacuous, verified by reverting the fix**: with the header removed from
`uploadImage`, this exact test goes red (`expected undefined to deeply equal
{ headers: ... }`); all 27 other tests in the file stayed green, confirming the
new assertion — not something else — is what catches the regression.

### I1 (Important) — no login/logout lifecycle for the wallpaper

**Files:** `src/App.vue`, `src/stores/wallpaper.ts` (new `reset()` action)

**Shape chosen: a single `watch(() => session.isAuthed, ...)` in `App.vue`**,
replacing the `onMounted`-gated call, rather than wiring into `useAuth.ts` or
the post-login navigation sites (Login.vue / AccountPanel.vue).

**Why:** `session.isAuthed` is a `computed` over a `ref` (`stores/session.ts`),
so it is already reactive to whatever call flips `token.value` — `setTokens()`
(login, registerAndLogin) or `clear()` (logout) — regardless of which
composable or view triggered it. A watcher in the one place that already owned
`load()` covers both directions of the lifecycle without touching `useAuth.ts`,
`Login.vue`, or `AccountPanel.vue` at all — the alternative (wiring `logout()`
+ either `login()` or the post-login `router.push` call site) would have spread
the fix across 2-3 files for no benefit, since App.vue is a persistent root
that never remounts across a login/logout SPA transition. `immediate: true`
reproduces the old onMounted-gated behavior for the already-authed-at-boot case.

Added `wallpaper.reset()`: clears `dialogOpen`, drops any pending `snapshot`,
previews `NONE` (updates DOM + record), and clears the cache key
(`cacheRecord(NONE)`) — the last one duplicates what `session.clear()` already
does to the shared `'wallpaper'` localStorage key, deliberately, so the store
stays correct even if `reset()` is ever called from somewhere other than that
exact logout path.

**Test:** new file `src/App.test.ts` — mounts the real `App.vue` with a minimal
memory router + real Pinia + mocked `service.users.getCustomStorage`, and
exercises both halves:
1. Not authed at mount → `getCustomStorage` never called, no wallpaper painted;
   then `session.setTokens(...)` (what `login()` does) → wallpaper loads and
   paints, **with no remount** (asserting exactly the bug's premise).
2. Authed at mount with a wallpaper already loaded → `session.clear()` (what
   `logout()` does) → wallpaper clears from the DOM, record resets to `NONE`,
   and the cache key is gone.

**Non-vacuous, verified by reverting the fix**: reverted `App.vue`'s script to
the original `onMounted`-gated version and reran `App.test.ts` — both tests
went red (`getCustomStorage` never called in test 1; `dataset.wallpaper` still
`''` after `session.clear()` in test 2). Restored and reran clean.

### I2 (Important) — `cancelPreview` didn't restore `localStorage.theme`

**Files:** `src/stores/theme.ts` (new `previewTheme()`), `src/stores/wallpaper.ts`
(`cancelPreview`, `commit`), `src/components/WallpaperDialog.vue` (`pickBase`)

**Shape chosen: option 2** — preset tiles preview the theme in memory + DOM
only; `commit()` is what persists it. Rejected option 1 (just call
`setTheme(snapshot.theme)` in `cancelPreview`) because, as the finding notes,
it doesn't fix the actual split: today the wallpaper half of a preset pick is
preview-only while the theme half persists immediately — a one-line patch to
`cancelPreview` alone would still leave a **confirmed** localStorage write
happening at pick-time for the theme, just with a correctly-restored value on
Cancel. That's still not "preview, then Apply confirms," it's "confirm
immediately, then partially undo." Option 2 makes the wallpaper and theme
halves of a preset symmetric (both preview-only until Apply), which is what
the stage's own "preview for real without persisting, Apply commits" framing
actually describes.

Concretely:
- `theme.ts` gained `previewTheme(t)`: sets the ref and calls `applyTheme(t)`,
  never touches `localStorage`. `ThemeToggle.vue` (topbar) is untouched — it's
  deliberately one-step with no Apply, and keeps calling `setTheme()` directly.
- `WallpaperDialog.vue`'s `pickBase()` now calls `theme.previewTheme(which)`
  instead of `theme.setTheme(which)`.
- `wallpaper.ts`'s `cancelPreview()` now restores via
  `useThemeStore().previewTheme(snapshot.theme)` (goes through the store's own
  action rather than poking `.theme` directly from outside).
- `wallpaper.ts`'s `commit()` now also calls
  `themeStore.setTheme(themeStore.theme)` after the wallpaper record is saved.
  This is the single point that turns *any* accepted preview into confirmed
  state, for every caller of `commit()`: the dialog's Apply button, and the
  NAS/upload one-shot paths (`setFromNasPath`) that call `commit()` directly
  with no dialog to Apply from. When the theme was never touched during the
  preview, this is a no-op re-write of the same value already in
  `localStorage`.
- Replaced the old inverted-reasoning comment on `cancelPreview` (it said going
  through `setTheme()` would "rewrite localStorage with a value the user never
  confirmed" — backwards, since `previewTheme()` never wrote it in the first
  place) with the corrected reasoning.

**Tests:**
- `src/stores/theme.test.ts` — new case pinning `previewTheme()` directly:
  state + `data-theme` change, `localStorage.getItem('theme')` stays at the
  prior confirmed value.
- `src/stores/wallpaper.test.ts` — two new `commit()` cases: persists whatever
  theme is currently live (previewed via `previewTheme` beforehand), and is a
  no-op on the theme when the preview never touched it (guards against
  clobbering an untouched confirmed value).
- `src/components/WallpaperDialog.test.ts` — two new cases reproducing the
  exact repro from the finding: pick white base → Cancel → `localStorage`
  still holds the pre-pick theme; pick white base → Apply →
  `localStorage.getItem('theme')` is now `'light'`.
- Superseded the ledger's deferred item ("no test pins that `cancelPreview`
  avoids writing `localStorage.theme`") — that pinned the wrong invariant
  (avoiding a write that was never the bug); the new tests pin the real one
  (Cancel leaves the prior confirmed value, Apply writes the new one).

**Non-vacuous, verified by reverting the fix**: reverted `pickBase()` to call
`theme.setTheme(which)` (the old code) and reran `WallpaperDialog.test.ts` —
the new "cancelling ... does not leave it in localStorage" case went red
(`expected 'light' to be 'blue'`), reproducing the exact bug from the finding.
Restored and reran clean; also reverted `wallpaper.ts`'s `commit()` theme call
and confirmed the new "commit also persists ... theme" store test goes red.

### M2 — Apply not disabled during `wp.busy`

**File:** `src/components/WallpaperDialog.vue` — `:disabled="saving || wp.busy"`.

**Test:** new case in `WallpaperDialog.test.ts` — starts an upload with a
controlled (never-auto-resolving) promise, asserts Apply is disabled while
`wp.busy` is true, then resolves and asserts it re-enables.

**Non-vacuous, verified by reverting the fix**: reverted the template back to
`:disabled="saving"` — the new test failed (`expected undefined to be
defined`, i.e. no `disabled` attribute during the in-flight upload). Restored
and reran clean.

### M3 — no coverage that the desktop menu item actually renders/wires up

**File:** `src/home/components/DesktopContextMenu.test.ts`

Added a `describe('rendered menu item (M3)')` block that dispatches a real
`contextmenu` event, waits for reka-ui's portal (same timing note the existing
"handles a right-click on blank canvas" case already documents), and then:
finds `.ctx-change-wallpaper` in `document.body` and asserts its text equals
`zh.wpChangeWallpaper`; clicks it and asserts `useWallpaperStore().dialogOpen`
flips to `true`.

**Non-vacuous, verified by reverting the fix**: removed the `onSelect:
onChangeWallpaper` binding in `DesktopContextMenu.vue` (leaving the item
inert, matching the finding's exact scenario) and reran — the "clicking the
rendered item opens the wallpaper picker" case went red
(`expected false to be true`); the pre-existing "exposes a wallpaper action"
test (which calls the handler directly) stayed green, which is precisely the
gap the finding described. Restored and reran clean (6/6 in that file).

### M5 — accept assertion buried in a "rejects ..." test case

**File:** `src/files/util/wallpaperExt.test.ts`

Split `canBeWallpaper({ name: '.jpg', is_dir: false }) => true` into its own
case named for what it actually asserts, with a comment explaining the
mechanism (`lastIndexOf('.')` finds the leading dot of a dotfile, so the
"extension" ends up being the whole name minus that dot) and noting this is a
policy call the fix wave is not asked to change, not a bug.

No fresh "break it and watch it fail" check applies here — this is a pure
test-hygiene split, not a behavior fix; the assertion itself (and its
pass/fail state) is byte-for-byte unchanged, only its location and name moved.

### M6 — stale comment about JPEG deferral

**File:** `src/App.vue`

Replaced the comment claiming the built-ins "download only when the picker is
opened" with the accurate mechanism: `defineAsyncComponent` resolves on every
mount (no `v-if` gates `<WallpaperDialog />`); the actual deferral is
`DialogRoot` never rendering `DialogContent` while `:open` is false. Confirmed
against the build output: `WallpaperDialog` still gets its own chunk
(`dist/assets/WallpaperDialog-*.js`, 3.29 kB) separate from the main bundle,
consistent with the corrected explanation (the chunk is fetched at mount,
independent of whether the dialog is ever opened).

Comment-only change; no test applies.

### M7 — `openDialog` re-snapshots unconditionally

**File:** `src/stores/wallpaper.ts` — `if (!dialogOpen.value) beginPreview()`.

**Test:** new case in `wallpaper.test.ts` reproducing the exact scenario: open
from one entry point (snapshots w01), preview w02 inside the dialog, call
`openDialog()` again (simulating a second entry point while still open),
`cancelPreview()` — asserts the rollback lands on w01, not w02.

**Non-vacuous, verified by reverting the fix**: reverted `openDialog()` to the
unconditional `beginPreview(); dialogOpen.value = true` — the new test went
red (`expected { id: 'w02' } to deeply equal { id: 'w01' }`). Restored and
reran clean.

### M8 — no coverage of `onOpenChange` (Esc / outside-dismiss)

**File:** `src/components/WallpaperDialog.test.ts`

Added a case that picks the white-base preset, then dispatches a real
`document`-level `keydown Escape` event (reka-ui's own `DismissableLayer`
picks this up via `onKeyStroke('Escape', ...)` and calls the root's
`onOpenChange(false)` — nothing in this codebase's own code fires that path
directly, so this is the only test that exercises `onOpenChange` at all), then
asserts the theme rolled back to blue and the dialog closed — same
failure shape as the adjacent Cancel-button test, so a stub `onOpenChange`
handler (or one that called `closeDialog()` instead of `cancel()`) would leave
the theme on `'light'` here. Ran as written first without any source change
(there was nothing to "revert" for a coverage-only finding); it passed on the
first try, which also served as live confirmation that reka-ui's Escape
handling does reach `@update:open` the way the code assumes.

## Findings I did not change

None disputed. All eight were confirmed real on inspection and fixed as
described above (M5 and M6 are comment/test-hygiene fixes with no behavioral
change to verify red/green against).

## Gate results (final, after all 4 commits, clean tree)

- **`pnpm vitest run`** (whole suite): `Test Files 646 passed (646)` /
  `Tests 10410 passed (10410)`. Duration ~158s. (A `Files.test.ts`-adjacent
  jsdom WebSocket unhandled-rejection warning seen in one earlier dirty-tree
  run did not reappear in the final clean run — confirmed unrelated to this
  wave by running `Files.test.ts` alone, which passed both times.)
- **`pnpm exec vue-tsc --noEmit`**: clean, no output, exit 0. (Two of the new
  test files initially failed type-check on `vi.fn(async () => ...)`'s
  0-argument inference vs. a spread call of 1-2 args; fixed by switching to
  the explicit `vi.fn<(args) => Ret>()` generic form already used as
  precedent in `stores/wallpaper.test.ts`.)
- **`pnpm build`**: succeeds, `✓ built in 16.84s`. `WallpaperDialog` still
  code-splits into its own ~3.3 kB chunk (consistent with the corrected M6
  comment).
- **Safe `oss/export.mjs` invocation**
  (`node oss/export.mjs --out /tmp/oss-check-sp11-fixwave --no-commit
  --allow-dirty-oss`, run only after committing so the tree was clean):
  `[oss] 完成 → /tmp/oss-check-sp11-fixwave`, leak guard reports
  "零真实泄漏命中" (zero real leak hits; 3 expected binary-file skips
  recorded). `pnpm vitest run oss/`: `6 passed (6)` / `141 passed (141)`.

Mid-wave note: before the last (`chore(oss)`) commit, `pnpm vitest run oss/`
showed 1 failing test (`oss/tree.test.mjs`'s leak-guard case) with 5 hits —
`packages/service/src/users.ts:164` on both `[photo]` and `[ai]` (the C1 fix
comment naming sibling files `ai.ts`/`photos.ts`/`sys.ts`), plus three `[photo]`
hits in the I1 fix's own comments/test prose (`App.test.ts:91`,
`wallpaper.test.ts:333`, `wallpaper.ts:203`) — all five were the soft-list
"ordinary English word" case the task's constraints anticipated, not real
leaks. Added one `exactLine()` entry per hit to `oss/forbidden.mjs` (word list
itself untouched), verified each one by hand with `oss/export.mjs` before and
after. Also earlier in the process, while the tree still had uncommitted
changes, `oss/tree.test.mjs`, `oss/export-rsync.test.mjs` and
`oss/media-wave.test.mjs` failed for an unrelated, expected reason: they each
spawn `node oss/export.mjs` against the live git tree, and `--allow-dirty-oss`
only tolerates changes under `oss/` itself (by design, per the comment at
`oss/export.mjs:33-41`) — not arbitrary in-progress source edits elsewhere.
This resolved on its own once the fix-wave commits landed; it was never a bug
in the wave's code, and running `oss/forbidden.test.mjs`/`apply.test.mjs`/
`dist-scan.test.mjs` in isolation (which don't shell out to `export.mjs`
against the live tree) confirmed they were green throughout.

## Self-review

- Checked every changed file's diff by hand after the wave (`git show` on all
  4 commits) — no stray debug code, no leftover backup files (the `/tmp/*.bak`
  copies used for the red/green checks were all restored via `cp` back over
  the working files and later cleaned up from `/tmp`, and `git status` was
  re-checked after each restore to confirm no residual diff before the next
  step).
- No raw colour literals were introduced (all changes are logic/comments/test
  code; the one `.vue` template change for M2 is a `:disabled` binding, no
  styling).
- Commit messages are English-only, imperative subject, bodies explain why;
  each ends with the required `Co-Authored-By` trailer.
- All commits used explicit pathspecs (`git commit -m "..." -- <files>`);
  `git status --short` after every commit in the wave showed only the 3
  permanent `design-export/*.html` deletions plus the intended remaining
  diff — never a bare `git add -A`.
- The working tree was never `git checkout`-ed or `git stash`-ed; the
  "break the fix and watch it go red" checks were done by editing files
  in-place with `cp`/`python3`/`Edit` and restoring the same way, never via
  git.
- One thing worth flagging rather than silently deciding: the C1 fix's
  comment in `users.ts` names `ai.ts` and `photos.ts` as sibling multipart
  callers, but both files are stripped from the OSS export
  (`SERVICE_DELETE` in `oss/manifest.mjs`) — so in the public mirror this
  comment will reference two files that don't exist there, leaving only
  `sys.ts` as a resolvable reference. This isn't a content leak (nothing
  sensitive about AI/photos internals is disclosed, just a filename), and
  the private repo is the primary source of truth for code comments, so I
  left the wording as-is and whitelisted the hit rather than rewording to
  avoid a dangling reference in a mirror this comment wasn't written for.
  Flagging in case the controller prefers the comment reworded to only name
  `sys.ts` (the one caller that survives export) for OSS-mirror hygiene.

## Round 2 — scoped re-review finding

The controller's scoped re-review confirmed all eight original findings
addressed, and caught one real regression introduced *by* the I2 fix itself.

### Regression — `commit()` unconditionally confirmed whatever theme was live

**Root cause:** the round-1 I2 fix put `themeStore.setTheme(themeStore.theme)`
at the end of `wallpaper.ts`'s `commit()`, reasoning that `commit()` was "the
one point every caller shares." That reasoning didn't hold: `setFromNasPath()`
is also a caller of `commit()` — a wallpaper-only one-shot reachable two ways:
directly from `Files.vue`'s context menu (`Files.vue:157`, no dialog, no
preview of any kind), and from *inside* an open `WallpaperDialog` session via
`onNasPick` (`WallpaperDialog.vue:89-97`) — pick a base preset (previews the
theme only, via `theme.previewTheme()`, exactly the state I2 exists to let the
user discard), then change your mind and choose "从 NAS 选择" instead, with no
Apply click anywhere in between. `setFromNasPath`'s internal `commit()` call
then silently wrote the previewed theme to `localStorage` as a side effect —
undercutting I2's own "preview, then Apply confirms" invariant for precisely
the control it was written to protect.

**Fix, and why this shape:** of the two shapes the controller offered
(`commit(confirmTheme: boolean)` parameter vs. moving the confirmation into
Apply and leaving `commit()` wallpaper-only), I chose the second —
**`commit()` is back to being purely about the wallpaper record; confirming a
previewed theme moved into `WallpaperDialog.vue`'s `apply()`.** Reasons:
- Checked every caller of `commit()` in the codebase first (`grep -rn
  '\.commit()'`): only `WallpaperDialog.vue`'s `apply()` and `wallpaper.ts`'s
  own `setFromNasPath()` call it. `apply()` is the *only* caller that ever
  offers a theme preview to confirm in the first place (via the preset tiles);
  a boolean parameter would exist solely to be `true` at exactly one call site
  and `false` at the other, which is just a more roundabout way of saying "this
  doesn't belong in `commit()`."
  `ThemeToggle.vue` (topbar) doesn't call `commit()`'s theme logic either way —
  it already calls `theme.setTheme(v)` directly, independently of `wp.commit()`.
- This keeps `commit()`'s contract single-purpose (save + cache the wallpaper
  record, nothing else), which is also what its name says and what every other
  caller already assumed.
- The controller's ruled-out third option (`setFromNasPath` snapshot-and-restore
  the theme around its `commit()` call) would have left the same write
  happening and then undone it — an unnecessary round-trip through
  `localStorage`/`applyTheme` for no benefit over just not writing it, so I
  didn't consider it further.

Implementation: `apply()` now runs `theme.setTheme(theme.theme)` **after**
`await wp.commit()` succeeds (same timing the old in-`commit()` code had:
inside the `try`, before `wp.closeDialog()`), so a failed wallpaper save still
leaves the dialog open with the theme unconfirmed too — no partial
confirm-wallpaper-but-not-theme state on error. Updated the comments in
`pickBase()` (theme.ts's `previewTheme()`) and `commit()` itself to point at
`apply()` as the confirming call site instead of `commit()`.

**Tests, and how I convinced myself they're not vacuous:**
- `src/stores/wallpaper.test.ts` — replaced the two round-1 tests that had
  asserted the *old* (now-wrong) behavior ("commit also persists whatever
  theme is currently live") with three new cases:
  1. `commit() never touches the theme, even when a preset preview changed it
     in memory` — direct negative pin on `commit()` itself.
  2. `setFromNasPath does not silently confirm a theme previewed earlier in
     the same dialog session` — the exact repro sequence from the finding,
     at the store level (`theme.previewTheme('light')` then
     `s.setFromNasPath(...)`, assert `localStorage.getItem('theme')` is still
     `'blue'`).
  3. `setFromNasPath never touches the theme when called with no
     dialog/preview at all (Files.vue context menu)` — the `Files.vue`-shaped
     case the controller specifically asked to double-check: baseline theme,
     call `setFromNasPath` directly with zero preceding theme interaction,
     assert it's still untouched. (This one passes under both old and new
     code, since nothing in it ever called `previewTheme()` — included anyway
     because the controller asked for it explicitly, and a future change to
     `setFromNasPath` that started touching the theme should still be caught
     here.)
- `src/components/WallpaperDialog.test.ts` — added the same repro sequence
  end-to-end through real DOM interaction: mount the dialog, click the light
  preset tile, click "从 NAS 选择", emit a `pick` event on `NasImagePicker`,
  assert `localStorage.getItem('theme')` is still the pre-pick value.
- **Verified all three new assertions go red against the pre-round-2 code**:
  temporarily restored `commit()`'s `themeStore.setTheme(themeStore.theme)`
  line (via `cp`/`python3` in-place edit + restore, never `git checkout`) and
  reran — all three failed with `expected 'light' to be 'blue'`, exactly the
  bug described. The `Files.vue`-shaped test (case 3 above) stayed green in
  that same run, confirming it isn't accidentally coupled to the regression.
  Restored the fix and reran clean (54/54 across the three affected test
  files).

### OSS leak-guard whitelist follow-up

The round-2 fix's new comments/tests tripped the same soft-word guard as round
1, on ordinary text — added narrow `exactLine()` entries, verified with
`oss/export.mjs` before and after, word list itself untouched:
- `oss/export.mjs`, run against the dirty (pre-commit) tree, flagged
  `src/stores/wallpaper.test.ts:260`
  (`await s.setFromNasPath('/DATA/Gallery/a.png') // user changes their mind
  mid-session`) under `[gallery]` — same reserved NAS-path sample as three
  already-whitelisted lines in this file, just with a different trailing
  comment making the full-line text new. One `exactLine()` entry added; `pnpm
  vitest run oss/` went from 1 failed / 140 passed to 6 files / 141 passed.

## Round 2 commits

- `2870446` fix(wallpaper): move I2's theme confirmation out of commit() into Apply
- `bbbd5e6` chore(oss): whitelist round-2 test line's ordinary 'Gallery' path hit

## Round 2 gate results (final, clean tree)

- **`pnpm vitest run`**: `Test Files 646 passed (646)` / `Tests 10412 passed
  (10412)`. Duration ~156s. (Two intermediate runs during this round showed 1
  failed test / 3 failed files each, both for the same already-understood
  reason as round 1: `oss/tree.test.mjs` / `export-rsync.test.mjs` /
  `media-wave.test.mjs` spawn `node oss/export.mjs` against the live tree,
  and `--allow-dirty-oss` only tolerates changes under `oss/` itself — the
  fix-wave commits hadn't landed yet at the time those two runs were kicked
  off. Resolved once committed; not a defect in the round-2 code.)
- **`pnpm exec vue-tsc --noEmit`**: clean, no output, exit 0.
- **`pnpm build`**: succeeds, `✓ built in 16.71s`.
- **Safe `oss/export.mjs` invocation** (`node oss/export.mjs --out
  /tmp/oss-check-sp11-round2 --no-commit --allow-dirty-oss`, run after
  committing so the tree was clean): `[oss] 完成 →
  /tmp/oss-check-sp11-round2`, "零真实泄漏命中" (zero real leak hits; the
  same 3 expected binary-file skips as round 1). `pnpm vitest run oss/`:
  `6 passed (6)` / `141 passed (141)`.

## Round 2 self-review

- Re-read every caller of `commit()`, `setFromNasPath()`, and `previewTheme()`
  in the whole repo (`grep -rn`) before deciding the fix shape, not just the
  two call sites the finding named — confirmed `ThemeToggle.vue` needed no
  change and there are no other consumers of `wp.commit()`.
- Confirmed the fix does not reintroduce round 1's original I2 bug (cancelled
  theme surviving reload): reran the round-1 `WallpaperDialog.test.ts` cases
  ("cancelling ... does not leave it in localStorage" / "applying ... does
  persist it") unchanged, both still pass, because `apply()` is still the one
  and only place that calls `theme.setTheme()` for a dialog-previewed theme.
- Double-checked ordering inside `apply()`: `theme.setTheme(theme.theme)` runs
  only after `await wp.commit()` resolves successfully, so a failed save
  (network error) leaves both the wallpaper record *and* the theme
  unconfirmed together — no split state where one half of a preset commits and
  the other doesn't.
- `git status --short` after every commit in this round showed only the 3
  permanent `design-export/*.html` deletions plus the intended diff; both
  commits used explicit pathspecs; the working tree was never `git
  checkout`-ed or `git stash`-ed (in-place `cp`/`python3` edits + restores
  were used for the red/green checks, same technique as round 1).
