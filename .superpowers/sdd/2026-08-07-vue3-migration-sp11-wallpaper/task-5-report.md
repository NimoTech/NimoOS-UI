# Task 5 report: 弹窗骨架 —— 四个预设 + 实时预览 + 取消/应用

## What was implemented

- `src/components/WallpaperDialog.vue` — new component. A reka-ui `DialogRoot`
  (`:modal="false"`, no overlay, bottom-anchored sheet), following
  `SearchDialog.vue`'s pattern instead of the shared `components/ui/Dialog.vue`
  (whose overlay would blur the very wallpaper being previewed).
  - Four preset tiles: `wp-preset-blue` / `wp-preset-light` (clear the
    wallpaper via `wp.preview(NONE)` and flip the theme via
    `theme.setTheme(...)`), and `wp-preset-w01` / `wp-preset-w02` (builtin
    wallpapers via `wp.preview({ kind: 'builtin', id })`, theme left alone).
  - Two source-entry buttons: `wp-upload` (`t('wpUpload')`) and `wp-nas`
    (`t('wpFromNas')`) — plain `<button type="button">`, no click handler yet
    (Task 6 scope per the controller override).
  - `wp-apply` calls `wp.commit()` then `wp.closeDialog()`; on failure shows
    `t('wpSaveFailed')` in `wp-error` and leaves the dialog open.
  - `wp-cancel` and Esc/outside-dismiss (`@update:open`) both route through the
    same `cancel()` → `wp.cancelPreview()` + `wp.closeDialog()`.
  - Active tile is marked with `.on` via a computed `activeId` derived from
    `wp.record` (falling back to the current theme for the two base tiles).
- `src/components/WallpaperDialog.test.ts` — new test file, 9 cases per the
  brief (adapted for reka-ui teleport timing, see deviations below).
- `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts` — added the 14 keys from
  the brief's table verbatim, appended after the existing `tmRailJumpTo` entry
  in each file.
- `src/styles/theme.css` — added the four new tokens
  (`--app-bg-preview-blue`, `--app-bg-preview-light`,
  `--wallpaper-tile-label-bg`, `--wallpaper-tile-label-fg`) to both the dark
  `:root` block and the `:root[data-theme="light"]` block, exactly as
  specified in the brief's Step 5 (including the "first two values identical
  across themes" comment).

## Deviations from the brief's literal code, with reasons

1. **Controller override (given, not discovered): dropped `<slot name="sources" />`,
   added real `wp-upload` / `wp-nas` buttons in Task 5.** The brief's Step 2
   test asserts both buttons exist; its Step 4 component only has the slot.
   Implemented exactly as instructed: plain `<button type="button" class="bar-btn">`
   with the right `data-test` and label, no click handler, no `disabled`, no
   TODO stub — Task 6 wires behaviour.

2. **Test query mechanism: `DOMWrapper` on `document.body` instead of
   `wrapper.find(...)`.** Confirmed by reading `SearchDialog.vue` and this
   repo's own precedent comment in `UpdateDialog.test.ts` (and the same note
   in `KvmDialog.test.ts`): `DialogPortal` teleports `DialogContent` to
   `document.body`, outside the subtree `mount()` returns. Added `attachTo:
   document.body` to the mount call, replaced `w.find(...)` with `body().find(...)`
   where `body = () => new DOMWrapper(document.body)`, and added `afterEach`
   cleanup (`activeWrapper?.unmount()` + `document.body.innerHTML = ''`) so
   instances don't leak between tests. The assertions themselves are
   byte-for-byte the brief's.

3. **Test timing: `mountOpen` made `async` with `await nextTick()` after
   `mount()`, every call site awaited.** Verified against this repo's own
   `KvmDialog.test.ts`, which documents the same fact for this reka-ui
   version: `DialogPortal`/`DialogContent` teleport their content into
   `document.body` on the microtask *after* mount, not synchronously. Run as
   literally written, the brief's synchronous `mountOpen()` + immediate
   `w.find(...)` fails on every single test (`Cannot call trigger on an empty
   DOMWrapper` / `expected false to be true`) for a timing reason that has
   nothing to do with the component's behaviour — confirmed by reproducing it
   first (see RED evidence below) before making the change. No assertion
   content changed.

No other deviations: all referenced tokens (`--card-border`, `--radius-sm`,
`--popup-bg`, `--blur`, `--card-shadow-hi`, `--fg`, `--card`, `--radius-xs`,
`--accent-soft-bd`, `--accent`, `--on-accent`, `--remove-fg`, `--ease`) and the
`.bar-btn` class already existed in `theme.css`/globally exactly as named, so
no substitutions were needed there. `reka-ui` does export `DialogRoot` /
`DialogPortal` / `DialogContent` / `DialogTitle` (confirmed via `SearchDialog.vue`'s
existing imports).

## TDD evidence

**RED** — `pnpm vitest run src/components/WallpaperDialog.test.ts` (component
file did not exist yet):
```
FAIL  src/components/WallpaperDialog.test.ts [ src/components/WallpaperDialog.test.ts ]
Error: Failed to resolve import "./WallpaperDialog.vue" from "src/components/WallpaperDialog.test.ts".
  Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```
Expected and correct: the component doesn't exist yet.

**Intermediate RED** (component implemented, test still using brief's literal
synchronous `mountOpen`/`w.find`) — confirms the deviation-2/3 diagnosis before
fixing the test:
```
FAIL > renders four presets plus upload and nas entries
  AssertionError: blue: expected false to be true
FAIL > picking a builtin previews live without persisting
  Error: Cannot call trigger on an empty DOMWrapper.
... (8 of 9 failing this way)
Test Files  1 failed | 8 passed (9)   [color-guard/i18n already green]
     Tests  8 failed | 1225 passed (1233)
```

**GREEN** — after adapting the test's DOM query mechanism (attachTo +
DOMWrapper + awaited `nextTick`), everything required by Step 6 passes:
```
pnpm vitest run --reporter=verbose src/components/WallpaperDialog.test.ts src/styles/color-guard.test.ts src/i18n
...
Test Files  9 passed (9)
     Tests  1233 passed (1233)

pnpm exec vue-tsc --noEmit
(exit 0, no output)
```
`--reporter=verbose` was used to check for stray `[Vue warn]` output. The only
warnings seen (`Component "i18n-t" has already been registered in target
app.` etc.) are a pre-existing repo-wide characteristic of reusing one
module-scoped `createI18n()` instance across repeated `mount()` calls in a
test file — the same warnings appear in `UpdateDialog.test.ts` (161 lines of
identical warnings when run standalone), unrelated to this component.

A full-repo `pnpm vitest run` was also kicked off as a broader confidence
check beyond what Step 6 requires; see the Concerns section for its status at
report time.

## Files changed

- `src/components/WallpaperDialog.vue` (new)
- `src/components/WallpaperDialog.test.ts` (new)
- `src/i18n/zh_cn.base.ts` (+14 keys)
- `src/i18n/en_us.base.ts` (+14 keys)
- `src/styles/theme.css` (+4 tokens × 2 theme blocks)

Commit: `aaf912d` — "feat(wallpaper): add the picker sheet with four presets",
created with `git commit -o <the five files above>`, leaving the three
pre-existing staged `design-export/*.html` deletions untouched (verified via
`git status --short` before and after).

## Self-review findings

- Checked for unused imports/dead code in `WallpaperDialog.vue`: all imports
  (`computed`, `ref`, `useI18n`, the four reka-ui primitives, `useWallpaperStore`,
  `BUILTIN_IDS`, `NONE`, `builtinUrl`, `BuiltinId`, `useThemeStore`, `Theme`)
  are used.
- `activeId`'s `'image'` branch has no matching tile in this task (there is no
  `data-test="wp-preset-image"`), so no tile will ever show `.on` while an
  uploaded/NAS image is active. This is intentional and forward-looking: Task
  6 introduces the image source, and the brief's own Step 4 code carries the
  same branch. Not dead code — it's inert until Task 6 lands, at which point
  it already does the right thing (no preset tile falsely highlighted while a
  custom image is the active wallpaper).
- Verified no raw color literals were introduced outside `theme.css` — the
  component's `<style scoped>` block uses only `var(--...)` tokens.
- Verified no i18n key collisions before adding (`grep` for each of the 14 new
  keys across `src/i18n/*.ts` returned nothing prior to the edit).
- Confirmed the `git commit -o` pathspec matches the brief exactly and that
  the always-staged `design-export/*.html` deletions were not swept in.
- No lint script exists in this repo (`package.json` has no `lint` entry,
  unlike sibling `NimoOS-UI`); `vue-tsc --noEmit` is the applicable static
  check here and is clean.

## Concerns

- A full-repo `pnpm vitest run` (not required by Step 6, run as an extra
  confidence check) finished with **1 failed / 10366 tests** —
  `oss/tree.test.mjs`'s leak guard trips because `src/assets/wallpaper/wallpaper01.jpg`
  (2,281,371 bytes) exceeds the guard's 2 MiB (2,097,152 byte) scan threshold
  and gets skipped, which the guard treats as a hard failure requiring manual
  review rather than an auto-pass.
  **This is pre-existing and out of scope for Task 5**: the asset was added in
  Task 1 (`c4e63bd feat(wallpaper): add record model, url derivation and dom
  application`), which this task's diff does not touch — confirmed via
  `git show aaf912d --stat` (only the 5 files listed above) and `git log --
  src/assets/wallpaper/wallpaper01.jpg` (last touched at `c4e63bd`). Every
  suite Step 6 actually names (`WallpaperDialog.test.ts`, `color-guard.test.ts`,
  `src/i18n`) plus `vue-tsc --noEmit` is fully green. Flagging so whoever owns
  Task 1/the OSS export step is aware the asset needs either compression under
  2 MiB or an explicit guard allowlist entry — not something to silently work
  around inside Task 5.
