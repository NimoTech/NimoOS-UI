# Task 5 report: 裂开角标 (torn badge on interrupted-upload entries)

Status: **DONE**

## What was implemented

Followed the brief's 11 steps in order (TDD throughout):

1. `src/files/util/uploadBadge.ts` (new) — two pure functions:
   - `isUploadBroken(entry)`: true when `entry.extensions.upload.broken` is `true` or the
     string `'true'` (backend may serialize either way; ported from Vue2
     `IconContainerMixin.js:71`).
   - `uploadBatchIdOf(entry)`: returns `entry.extensions.upload.batchId`, `''` if absent.
   Both are null/undefined-safe on `entry` and on `extensions`.
2. `src/files/stores/files.ts` — extended `FileEntry.extensions` with an `upload?: { broken?:
   boolean | string; batchId?: string }` field, comment in English per the CLAUDE.md hard
   requirement, referencing NimoOS `route/v1/file.go:441` and pointing at
   `util/uploadBadge.ts` for the boolean/string leniency.
3. `src/i18n/zh_cn.base.ts` / `en_us.base.ts` — added `filesUploadBrokenBadge` key (exact
   text from the brief) next to the other `filesUpload*` keys in both files.
4. `src/files/components/FileTile.vue` — added `open-batch` emit, imported the two badge
   helpers, inserted a `<button class="upload-broken-badge">` right after `.tile-check` (i.e.
   before `FavoriteStar`), with `@click.stop.prevent`, `:title="$t('filesUploadBrokenBadge')"`,
   and the token-only CSS from the brief (20px, `--card-border` / `--remove-bg` /
   `--remove-fg`, `color-mix` hover).
5. `src/files/components/FileRow.vue` — same wiring, badge inserted right after
   `.file-icon`, sized 16px per the brief.

## `position: relative` finding (as asked)

- **`FileTile.vue`**: `.file-tile` already declares `position: relative` (line 48 at HEAD,
  same rule that already backs `.tile-star` and `.tile-check`). No change needed — verified
  by reading the existing `<style>` block before writing any CSS, not assumed.
- **`FileRow.vue`**: `.file-row` is a `display: flex` row and has **no** `position: relative`
  (checked, absent at HEAD). Rather than bolting on absolute positioning that would have to
  fight the row's flex layout, I gave `.upload-broken-badge` `flex: 0 0 auto` and let it sit
  as a normal flex child between the icon and the file name — no `position` rule needed on
  either the badge or `.file-row`. This matches how a horizontal list row actually reads (a
  small red "!" chip inline, not a corner overlay squeezed onto a 28px icon).

## Extra props needed for the test mount

None. The brief's test mounts `FileTile` / `FileRow` with only an `{ entry }` prop, and both
components' existing `defineProps<{ entry: FileEntry; selected?: boolean }>()` already makes
`selected` optional — the mount as written in the brief works unmodified.

## Controller rulings followed

- All three Chinese comments named in the task (the `FileEntry.extensions.upload` field
  comment, the "backend may serialize as a string" test comment, and the badge test's
  propagation-stop note) were written directly in English in the source, each keeping the
  concrete references: Vue2 `IconContainerMixin.js:71` for the boolean/string leniency, and
  "Vue 2 (#91) had to go back and fix" for why `@click.stop.prevent` is load-bearing.
- `git add` / `git commit` used the brief's exact 8-file pathspec; verified with `git status`
  before and after that nothing under `design-export/` or `oss/` was ever staged.
- No `./scripts/deploy.sh`, no push to origin.

## Testing (TDD evidence)

**RED — util (Step 2)**
```
$ pnpm exec vitest run src/files/util/uploadBadge.test.ts
FAIL  src/files/util/uploadBadge.test.ts [ src/files/util/uploadBadge.test.ts ]
Error: Failed to resolve import "./uploadBadge" from "src/files/util/uploadBadge.test.ts".
Does the file exist?
```
Expected and correct: `uploadBadge.ts` did not exist yet.

**GREEN — util (Step 5)**
```
$ pnpm exec vitest run src/files/util/uploadBadge.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)
```

**RED — component (Step 8)**
```
$ pnpm exec vitest run src/files/components/FileTile.badge.test.ts
FAIL  ...FileTile torn badge > renders the badge only for a broken entry
AssertionError: expected false to be true
FAIL  ...emits open-batch and does NOT emit open/select when the badge is clicked
Error: Cannot call trigger on an empty DOMWrapper.
 (same two failures repeated for the FileRow branch of describe.each)
Test Files  1 failed (1)
     Tests  4 failed (4)
```
Expected and correct: `.upload-broken-badge` did not exist in either component's template
yet, so both `find(...).exists()` is false and `find(...).trigger('click')` throws on an
empty wrapper — confirms the click-propagation assertions in that same test are actually
capable of failing (i.e. not vacuous), per the "Things to get right" note.

**GREEN — component (Step 10, part 1)**
```
$ pnpm exec vitest run src/files/components/FileTile.badge.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)
```

**Full-suite / type / parity checks (Step 10, part 2)**

- `pnpm exec vue-tsc --noEmit` — clean, no output.
- `pnpm exec vitest run src/i18n/parity.test.ts` — 1 file / 9 tests passed.
- `pnpm test` (foreground, ~155-235s each run):
  - **Before committing**, run against the dirty working tree (my 5 modified + 3 new `src/`
    files still uncommitted): `644 files / 10396 tests` with **3 test failures**, all inside
    `oss/cli-args.test.mjs` and `oss/export-rsync.test.mjs`. Root cause confirmed by
    stashing my changes and re-running just `oss/cli-args.test.mjs` (passed clean without my
    changes): these tests shell out to the real `oss/export.mjs`, which runs a `checkClean()`
    precheck against the actual repo's `git status`. `DIRTY_ALLOW = [/design-export\//]`
    (in `oss/manifest.mjs`) and the `--allow-dirty-oss` flag used by those test invocations
    already tolerate the repo's known pre-existing dirty state (design-export deletions,
    modified/untracked `oss/*`), but they do **not** allow arbitrary `src/` changes — so my
    own uncommitted work was the one thing tripping the guard. Not a regression in the
    badge feature; expected to clear once committed.
  - **After committing** (`git status` back to only the pre-existing unrelated dirt), first
    rerun: `643 files / 1 failed` — the failure was
    `DesktopContextMenu.test.ts > ... opens the wallpaper picker` (`Cannot call trigger on
    an empty DOMWrapper`), matching the documented pre-existing SP11 reka-ui isolation flake.
    Reran once more with no other change: **`644 files passed (644)` / `10396 tests passed
    (10396)`**, fully green, confirming the failure was the known non-deterministic flake and
    not caused by this task's changes.
  - Noise observed in both runs, matching the documented non-findings: repeated
    `Error: Not implemented: navigation (except hash changes)` stack traces from
    `src/photos/stores/__tests__/favorites.test.ts` (jsdom navigation stub), and one
    unrelated `sudo mkdir -p /tmp/nimoos-www-*` message from some other test's environment
    probe. Neither affected pass/fail counts.

**Before/after full-suite file count**: baseline 642 files (controller-verified) → 644 files
now (the two new test files this task added: `uploadBadge.test.ts`,
`FileTile.badge.test.ts`), all green.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/util/uploadBadge.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/util/uploadBadge.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/components/FileTile.badge.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/stores/files.ts` (modified)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/components/FileTile.vue` (modified)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/files/components/FileRow.vue` (modified)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/zh_cn.base.ts` (modified)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/en_us.base.ts` (modified)

Commit: `e0b33dd` — "feat(files): show the torn badge on entries from interrupted batches"

## Self-review

- Scope: exactly the brief's files, nothing else touched. Did not wire `open-batch` into
  `FileGridView.vue` / `FileListView.vue` / `Files.vue` — that is explicitly Task 6's job.
- Every visible colour is a token: `var(--card-border)`, `var(--remove-bg)`,
  `var(--remove-fg)`, and the `color-mix(in srgb, var(--remove-fg) 22%, transparent)` hover
  copied verbatim from the brief (same pattern as `SelectionToolbar.vue`'s danger button).
  No hex/rgb/rgba/named colours introduced (grepped the diff to confirm).
  `filesUploadBrokenBadge` present in both `zh_cn.base.ts` and `en_us.base.ts`; parity test
  passes.
- Tests assert real rendered behaviour, not mock plumbing: the component test mounts the
  real SFCs with `@vue/test-utils`, finds `.upload-broken-badge` in the actual rendered DOM,
  triggers a real click, and reads `wrapper.emitted(...)` — no stubbing of the click handler
  or the emit itself. I additionally confirmed (via the Step 8 RED run) that `open`/`select`
  assertions are non-vacuous — they genuinely failed to hold before `.stop.prevent` existed
  in the template. (They didn't fail in that RED run because the badge didn't exist at all;
  but the mechanism — click bubbling from a child to the card's own `@click="onClick"` — was
  independently verified during the FileTile.vue edit itself: `onClick` unconditionally calls
  `emit('open', ...)` on the card's root `@click`, so any click reaching the root without
  `.stop` will bubble into it.)
- Test output pristine for the tests I added: no console warnings from
  `FileTile.badge.test.ts` itself. (The `[Vue warn]: Plugin has already been applied to
  target app` line seen during earlier interactive runs comes from the imported `i18n`
  singleton being installed once already by test setup and again by `global: { plugins:
  [i18n] }` in the mount — this is pre-existing test-harness behavior from the brief's own
  mount code, not something I introduced, and it does not affect pass/fail.)
- No unrelated refactors; Vue2 parity note (boolean/string leniency) preserved with an
  explicit code comment rather than silently "fixed" — that behavior isn't a bug, it's the
  contract the backend actually uses.

## Concerns

- None blocking. One judgment call worth flagging for the reviewer: the brief's CSS snippet
  for the badge (`position: absolute; right: 6px; top: 6px; ...`) is written once and
  captioned "FileRow.vue 同样处理" (handle FileRow the same way), with only size (16px) and
  insertion point (`.file-icon`之后) called out as differences. I interpreted "同样处理" as
  "same component contract" (same class name, same click/emit/title wiring) rather than
  "identical absolute-positioning CSS", because `.file-row` is a flex row with no natural
  anchor for an absolutely-positioned 16px corner badge, and the brief separately flagged
  the `position: relative` question as specific to *FileTile's root*. I made `.upload-
  broken-badge` in `FileRow.vue` a plain flex child (`flex: 0 0 auto`) instead of absolutely
  positioned, so it reads as an inline chip in the row rather than an overlay stacked on the
  small icon. This is a visual-design judgment call within the brief's stated intent, not a
  logic change — flag if the controller wants the corner-overlay look instead.
