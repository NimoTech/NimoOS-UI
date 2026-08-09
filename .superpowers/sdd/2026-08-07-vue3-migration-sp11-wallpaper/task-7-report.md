# Task 7 report: mount `App.vue` + unlock the settings row

## What was implemented

1. **`src/settings/panels/general/WallpaperRow.vue`** — rewritten. Dropped the
   `disabled` attribute and the `#hint` slot, wired the button's `@click` to
   `useWallpaperStore().openDialog()`. Matches the brief's code block exactly.
2. **`src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`** — deleted the
   `settingsWallpaperNa` key from both files. `settingsWallpaper` and
   `settingsWallpaperChange` left in place (still consumed).
3. **`src/App.vue`** — merged the brief's three additions into the real file
   (which already had `router-view` + `AppToast` + a session-gated
   `loadFromServer()` call from earlier tasks) rather than overwriting it:
   - `<WallpaperDialog />` added to the template, between `router-view` and
     `AppToast`.
   - `WallpaperDialog` imported via `defineAsyncComponent(() => import(...))`.
   - `void useWallpaperStore().load()` added inside the existing
     `if (session.isAuthed)` branch in `onMounted`, alongside the pre-existing
     `useLocaleStore().loadFromServer()` call.
4. **`src/settings/panels/general/rows.test.ts`** — replaced the old
   `WallpaperRow(债务 D5…)` describe block with the brief's three new cases
   verbatim (enabled button / no hint / click opens the store's dialog).
   Added `import { useWallpaperStore } from '../../../stores/wallpaper'` and
   extended the `vi.mock('@nimotech/nimoos-service', …)` factory's `users`
   object with `uploadImage` / `setImageFromPath` stubs (`vi.fn()`), reusing
   the file's existing `getCustomStorage` mock rather than adding a
   duplicate — the wallpaper store's `load()`/`commit()` call the very same
   `service.users.getCustomStorage` / `setCustomStorage` that
   `TimezoneRow`/`DiskStandbyRow` already mock in this file, so no new stub
   was needed for that pair.

Checked `grep -rn "settingsWallpaperNa" src/` before deleting: the only three
hits were the row's own template and the two locale definitions — no other
consumer, so no dangling reference was left behind.

## Step 7's bundle-size evidence (both commands, real output)

```
$ pnpm build
...
dist/assets/wallpaper02-DZn-raxl.jpg           848.37 kB
dist/assets/wallpaper01-S0HR-c5b.jpg         2,281.37 kB
...
dist/assets/WallpaperDialog-D1n7Wwcc.js          3.28 kB │ gzip: 1.42 kB
...
✓ built in 16.72s

$ ls -la dist/assets/ | grep -i wallpaper
-rw-rw-r-- 1 nimo nimo 2281371 wallpaper01-S0HR-c5b.jpg
-rw-rw-r-- 1 nimo nimo  848369 wallpaper02-DZn-raxl.jpg
-rw-rw-r-- 1 nimo nimo    3275 WallpaperDialog-D1n7Wwcc.js
-rw-rw-r-- 1 nimo nimo    1779 WallpaperDialog-_xMAVEqZ.css

$ grep -c "wallpaper0" dist/assets/index-*.js
dist/assets/index-B24qL0De.js:0
dist/assets/index-B3JOD_ja.js:0
dist/assets/index-BmE1viyP.js:0
dist/assets/index-BENKR_cL.js:0
dist/assets/index-D__gPgmV.js:0
dist/assets/index-D6-A1V3I.js:0
dist/assets/index-CRTNdOJe.js:0
dist/assets/index-Bo4skD-w.js:0
dist/assets/index-Dyku21rA.js:0
dist/assets/index-pI3Ap_2Q.js:0
dist/assets/index-Cop3YBjE.js:0
dist/assets/index-BXI1ln-1.js:1

$ grep -l "wallpaper0" dist/assets/*.js
dist/assets/index-BXI1ln-1.js
```

`index-BXI1ln-1.js` is confirmed to be the real entry chunk (`dist/index.html`
has exactly one `<script type="module" ... src="/app/assets/index-BXI1ln-1.js">`).
So the brief's literal expectation (**0** across all `index-*.js`) does **not**
hold — one of the twelve `index-*.js` chunks, the entry chunk itself, has one
matching line.

**This is not a Task 7 regression.** Investigated before treating it as done:

- `grep -no "wallpaper0[12]" dist/assets/index-BXI1ln-1.js` shows all six
  occurrences (`wallpaper01` ×3, `wallpaper02` ×3) sit on line 29, inside the
  compiled `stores/wallpaper.ts` module — specifically the two `import
  wallpaperNN from '../assets/wallpaper/wallpaperNN.jpg'` statements, which
  Vite turns into plain string constants (`wallpaper01="/app/assets/wallpaper01-S0HR-c5b.jpg"`)
  because these files are far above Vite's 4 KB default asset-inline
  threshold. The **binary JPEG bytes are not embedded** — the images stay
  separate physical files under `dist/assets/`.
- `stores/wallpaper.ts` is eagerly imported by `main.ts` — but that import
  (`import { applyWallpaper, initialWallpaper } from './stores/wallpaper'`)
  was added in **Task 1-2, commit `91816ac`**, not by this task. It exists
  specifically so `main.ts` can call `applyWallpaper(initialWallpaper())`
  before mount to avoid a flash of the default gradient. `git log --oneline
  -- src/main.ts src/stores/wallpaper.ts` confirms this predates Task 7 by
  three commits; `git log -1 -- src/App.vue` before my change showed the
  last touch was `5b399f2` (an i18n task), unrelated to wallpaper.
- `dist/index.html` has no `<link rel="preload">`/`modulepreload` mentioning
  wallpaper (`grep -i "wallpaper\|preload" dist/index.html` → no matches), so
  nothing forces the browser to fetch the 3 MB of JPEGs at first paint. They
  are only fetched if `applyWallpaper` actually sets `--wallpaper-img` to a
  `builtin` record — i.e., only when the user already has one of the two
  presets active, which is correct, wanted behaviour, not a leak.
- Task 7's own async boundary — the thing actually in scope here — **is**
  isolated correctly: `WallpaperDialog-D1n7Wwcc.js` (3.28 kB, containing the
  inlined `NasImagePicker`) is a separate chunk not reachable from any
  `index-*.js`, and `grep -c "wallpaper0" dist/assets/WallpaperDialog-D1n7Wwcc.js`
  returns `0` — it references the store's exported `builtinUrl()` helper via
  the entry chunk's shared export table rather than duplicating the URL
  strings.

Net effect: the ~3 MB of *pixel data* is confirmed out of the first-paint
network path. What leaked into the entry chunk is two tiny string constants
(byte length ~90 total) that were already there before this task, as a
necessary consequence of the anti-flash design from Task 1-2. Flagging this
explicitly rather than reporting a clean "0" — the letter of the brief's
check does not pass, but the concern it exists to catch (megabytes of image
data downloaded before first paint) is not present, and fixing the letter
would mean re-litigating Task 1-2's already-committed anti-flash design,
which is out of this task's scope.

## Deviations from the brief's literal code

1. **`App.vue` was merged, not overwritten.** The brief's snippet only shows
   the wallpaper-related lines; the real file already had `AppToast`, a
   `useSessionStore`/`useLocaleStore` gated `onMounted`, and a header comment.
   All of that was preserved; only the three additions were spliced in.
2. **Test mock factory**: added `uploadImage`/`setImageFromPath` stubs as new
   `vi.fn()`s, but did **not** add a second `getCustomStorage` stub — the
   brief's prose asked for "get­CustomStorage" among the three, but it was
   already present and shared correctly (checked what the store actually
   calls at import time — nothing — and at `openDialog()` time — nothing that
   touches the service; `load()`/`commit()` are the only paths that do, and
   they reuse the existing mock). Adding a duplicate would have been
   speculative stubbing not exercised by any test in this file.
3. **Bundle check result differs from the brief's literal "0" expectation** —
   documented at length above; judged as a pre-existing, in-scope-for-Task-1-2
   condition rather than a Task 7 defect, but reported rather than papered
   over per the controller's instruction.

No other deviations. `WallpaperRow.vue`, the i18n deletions, and the test
block match the brief's code verbatim.

## TDD evidence

**RED** — `pnpm vitest run src/settings/panels/general/rows.test.ts --reporter=verbose`
(run after Step 1's test edits, before touching `WallpaperRow.vue`/`App.vue`):

```
FAIL  ... WallpaperRow (SP11: debt D5 paid off) > renders the label with an enabled change button
AssertionError: expected '' to be undefined      (button still has disabled="")
FAIL  ... WallpaperRow (SP11: debt D5 paid off) > no longer explains why it is unavailable
AssertionError: expected true to be false        (.set-row-hint still exists)
FAIL  ... WallpaperRow (SP11: debt D5 paid off) > opens the app-level picker
AssertionError: expected false to be true        (dialogOpen stayed false — button has no click handler)

Test Files  1 failed (1)
     Tests  3 failed | 18 passed (21)
```
All three failures are exactly the expected ones (old disabled/hint markup
still present, no click wiring) — not incidental breakage of unrelated rows
(the other 18 tests in the file passed throughout).

**GREEN** — after rewriting `WallpaperRow.vue`, deleting the i18n key in both
locales, and wiring `App.vue`:

```
$ pnpm vitest run src/settings/panels/general/rows.test.ts src/i18n --reporter=verbose
Test Files  8 passed (8)
     Tests  210 passed (210)
```
No stray `[Vue warn]` lines beyond the pre-existing, unrelated
"already registered" warnings that appear in this file's baseline run too
(vue-i18n global component re-registration across multiple `mount()` calls
in the same test file — present before this task, not introduced by it).

```
$ pnpm exec vue-tsc --noEmit
(exit 0, no output)
```

```
$ pnpm vitest run oss/ --reporter=verbose   # run post-commit (pre-commit the
                                             # export/tree suites fail on a
                                             # dirty tree by design — same
                                             # pattern documented in Task 6's
                                             # report)
Test Files  6 passed (6)
     Tests  141 passed (141)
```
Before committing, ran `oss/forbidden.mjs`'s `scanText` directly against all
five changed files (Task 6's established shortcut for this exact situation) —
all five came back clean, no whitelist entry needed.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/src/App.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/settings/panels/general/WallpaperRow.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/settings/panels/general/rows.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/zh_cn.sp9.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/en_us.sp9.ts`

Commit: `6326a21` — "feat(wallpaper): mount the picker app-wide and enable the
settings row" (pathspec exactly the brief's five files; no extra file needed
touching).

## Self-review findings

- Re-read `WallpaperRow.vue`, `App.vue` diff, and the test block once more
  with fresh eyes: no unused imports, no leftover `disabled`/`#hint` remnants,
  `wp` variable name matches the store's established convention from
  `WallpaperDialog.vue`.
- Confirmed `useWallpaperStore().load()` in `App.vue` is fire-and-forget
  (`void`) consistent with the existing `loadFromServer()` call right above
  it — no new error-handling asymmetry introduced.
- Confirmed the async `WallpaperDialog` import doesn't change the visible
  render order in the template (`router-view` → `WallpaperDialog` →
  `AppToast`) versus what the brief specified.
- Confirmed no color literals, no CJK strings introduced outside the
  Chinese locale file (English locale file only got a line removed, no line
  added).
- Confirmed `settingsWallpaperNa` has zero remaining references anywhere in
  `src/` after the deletion (`grep -rn` came back empty for both keys'
  matches other than the two now-deleted lines).
- Re-ran the full `rows.test.ts` + `src/i18n` + `oss/` + `vue-tsc` suite one
  final time after the commit to make sure nothing regressed post-commit
  (all green, shown above).

## Concerns

The one substantive concern is the bundle-check deviation written up above —
worth a second pair of eyes if the project wants the literal "zero bytes of
wallpaper anywhere in the entry chunk" guarantee, since achieving that would
require deferring `stores/wallpaper.ts`'s built-in URL constants out of the
main.ts-eager path, which is Task 1-2's territory, not Task 7's. Everything
else is clean.
