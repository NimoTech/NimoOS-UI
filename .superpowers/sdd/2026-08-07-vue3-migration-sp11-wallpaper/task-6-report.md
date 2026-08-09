# Task 6 report — 弹窗接上传与「从 NAS 选择」

## What I implemented

- `src/settings/panels/account/NasImagePicker.vue`: widened the `pick` emit
  contract from `[src: string]` to `[{ path: string; src: string }]`, and
  updated the one emit site (`onItemClick`) to send both halves.
- `src/settings/panels/AccountPanel.vue`: `onNasPick` now takes the `{ path,
  src }` object and uses `picked.src` (unchanged behaviour, just destructured
  from the new shape).
- `src/components/WallpaperDialog.vue`:
  - Replaced the two inert buttons in `.wp-actions` with a working pair: an
    Upload button that clicks a hidden `<input type="file">`, and a "choose
    from NAS" button that swaps in a `NasImagePicker` sub-view (`v-if
    ="!nasOpen"` / `v-else`).
  - `onFile`: validates via `wp.uploadAndPreview(file)`; the store throws for
    oversized files, caught and mapped to `wpTooLarge` vs `wpUploadFailed`.
  - `onNasPick`: calls `wp.setFromNasPath(picked.path)`, then **`wp.beginPreview()`**
    to reset the rollback snapshot (see deviation note below), then closes the
    NAS sub-view. Errors are shown inline using the backend's own message.
  - Added `.wp-file { display: none }` and `.wp-nas { max-height: 46vh;
    overflow: auto }`. No raw colour literals introduced.
  - Updated the stale header comment that said the two buttons "have no click
    behaviour yet" (now describes Task 5 vs Task 6 split accurately).

## Every consumer of the `pick` event, and how it was updated

Searched for every `NasImagePicker` reference and every `pick`/`@pick` site in
the repo (not just the brief's list) to be sure nothing was missed:

1. **`src/settings/panels/AccountPanel.vue:100`** (brief-listed) — `onNasPick`
   signature updated to `{ path, src }`, uses `picked.src`.
2. **`src/settings/panels/AccountPanel.test.ts`** (brief-listed) — the "从 NAS
   选中图片" test's `vm.$emit('pick', ...)` call updated to the object payload.
3. **`src/settings/panels/account/NasImagePicker.test.ts`** — **not listed in
   the brief's file list, but it directly asserts on the old bare-string
   payload** (`点图片发 pick,src 是 /v1/image 的 original URL`). This is
   NasImagePicker's own emit-site test, and it went red the moment Step 1
   landed. Updated the `toEqual` to the new `{ path, src }` shape. This is the
   one gap in the brief's stated file list — flagging it explicitly since the
   controller instructions asked me to verify by search rather than trust the
   list.
4. **`src/settings/panels/account/OwnerCard.test.ts`** (brief flagged as
   "only if it asserts the pick payload") — checked: this file only asserts
   `choose-from-nas` (a *different*, unrelated event on `OwnerCard`, not
   `NasImagePicker`'s `pick`) and `pick-local-file`. No `pick` assertion here.
   Left untouched, per the brief's own conditional.
5. Everything else found under `emit('pick', ...)` / `@pick` in the repo
   (`PlaceCoverPicker.vue`, `PlacesRail.vue`, `MentionPopover.vue`,
   `McpServerGroup.vue`, `SkillGroup.vue`, `FolderBrowser.vue`, and their
   tests) is an unrelated component that happens to also name its event
   `pick` — none of them import or reference `NasImagePicker`. Not touched.

## Deviations from the brief's literal text

1. **Step 5's `<div class="wp-actions"><slot name="sources" /></div>` no
   longer exists to replace** — Task 5 already shipped the two real buttons
   directly (per the controller's ruling recorded in
   `common-constraints.md`). Per this task's controller override #1, I
   *edited* the existing `.wp-actions` block in place (added the hidden
   input, wired `@click` on the two already-shipped buttons, added the
   `v-if`/`v-else` NAS-subview split) instead of replacing a slot. `data-test`
   attributes and labels are exactly what Task 5 shipped.
2. **Added `wp.beginPreview()` after a successful `onNasPick`** — the brief's
   code block omits this call but its own prose right below it says it must
   be there (backend already persisted the file; a later Cancel must not
   pretend to roll it back). Per controller override #2, implemented with the
   call and an inline English comment explaining why.
3. **`WallpaperDialog.test.ts`'s new NAS test uses `w.findComponent(...)`,
   not `body().findComponent(...)`** — first attempt matched the brief
   literally (querying through the `document.body` `DOMWrapper`, same as
   every other query in this test file, since `DialogPortal` teleports the
   content). That failed with "Cannot call vm on an empty VueWrapper": `Teleport`
   only relocates rendered DOM nodes, not the Vue component (VNode) tree, and
   `DOMWrapper.findComponent` cannot walk that tree at all. Switched to
   `mountOpen()`'s returned root `VueWrapper` for the `findComponent` call
   only, keeping `body().find(...)` for every DOM assertion (mirroring how
   `AccountPanel.test.ts` already does this against the same
   `{ name: 'NasImagePicker' }` lookup, which works there because
   `<script setup>` SFCs get `.type.__name` set by `@vitejs/plugin-vue`, which
   `findComponent({ name })` reads). Added a one-line comment recording this.
   The assertions themselves are exactly the brief's.
4. **`oss/forbidden.mjs` whitelist entry added** (file not in the brief's
   list, extended per controller instruction #4/note about the OSS leak
   guard). The brief's own Step 3 test body contains the literal string
   `'/DATA/Gallery/a.png'`, which trips the `gallery` word scanner the same
   way `206b13a`/Task 5x already handled for `wallpaper.test.ts` and
   `users.test.ts`. Added one `exactLine()` entry for the new hit, following
   the exact style/comment convention of the neighboring SP11 entries. Did
   not touch the word list itself, did not reword the source line.
5. **Header comment in `WallpaperDialog.vue` updated** (not requested by the
   brief, but the old comment was now factually wrong — it said the two
   buttons "have no click behaviour yet"). Small accuracy fix, not a
   rewrite of unrelated code.

No other deviations. `WallpaperRecord`/`BuiltinId`/`UserImageResult` shapes,
store action names, and the two i18n locale files were all left untouched (no
new i18n keys were needed — `wpUpload`/`wpFromNas`/`wpTooLarge`/
`wpUploadFailed`/`wpSaveFailed` all already existed from Task 5).

## TDD evidence

### RED — Step 2 (contract change)

Command: `pnpm vitest run src/settings/panels/AccountPanel.test.ts src/settings/panels/account`

```
 × AccountPanel.test.ts > 从 NAS 选中图片 → 进 state 4,src 是 /v1/image URL 且不产生 objectURL
 × NasImagePicker.test.ts > 点图片发 pick,src 是 /v1/image 的 original URL(plan C11:不走 arraybuffer)
 Test Files  2 failed | 5 passed (7)
      Tests  2 failed | 113 passed (115)
```
Expected and correct: both tests still emitted/asserted the old bare-string
`pick` payload against a component that now emits `{ path, src }`.

Updated both assertions to the new payload shape → re-ran → 7 files / 115
tests passed.

### RED — Step 4 (new WallpaperDialog tests)

Command: `pnpm vitest run src/components/WallpaperDialog.test.ts`

```
 × rejects an oversized upload inline without hitting the network
   → Cannot call element on an empty DOMWrapper.
 × a successful upload previews the uploaded image without persisting
   → Cannot call element on an empty DOMWrapper.
 × the nas button swaps in the picker, and a pick previews then returns to the grid
   → expected false to be true
 Test Files  1 failed (1)
      Tests  3 failed | 9 passed (12)
```
Expected and correct: `[data-test="wp-file"]` and `[data-test="wp-nas-picker"]`
did not exist yet.

### GREEN — after implementation

Command: `pnpm vitest run src/components/WallpaperDialog.test.ts`
```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```
(One intermediate fix needed: the third new test's
`findComponent({ name: 'NasImagePicker' })` had to run on the root
`VueWrapper`, not the `document.body` `DOMWrapper` — see deviation #3.)

### GREEN — full required scope

Command: `pnpm vitest run src/components/WallpaperDialog.test.ts src/settings oss/ --reporter=verbose`
```
 Test Files  68 passed (68)
      Tests  898 passed (898)
```
(Run pre-commit this reports 3 `oss/` suite files failing purely on the
"working tree not clean" pre-flight guard inside `export.mjs`, which refuses
to run against uncommitted `src/`/`settings/` changes regardless of
`--allow-dirty-oss` — that flag only tolerates dirty files under `oss/`
itself. Verified this was the *only* reason via the printed `git status`
output in the failure message, then confirmed `oss/forbidden.test.mjs`
(the actual leak-word scanner, which doesn't shell out to `export.mjs`) was
green throughout. After committing, re-ran `pnpm vitest run oss/` standalone:
6 files / 141 tests, all green, including the leak guard and the "export
tree builds with `pnpm install` + `vue-tsc`" check.)

`pnpm exec vue-tsc --noEmit`: exit 0, no output.

Scanned stderr with `--reporter=verbose` for the new tests specifically: the
only `[Vue warn]` lines are the pre-existing i18n-plugin double-registration
noise (`Component "i18n-t" has already been registered...`) that appears
identically on every test in this file, before and after my changes — not
something introduced here.

## Files changed

- `src/settings/panels/account/NasImagePicker.vue`
- `src/settings/panels/account/NasImagePicker.test.ts`
- `src/settings/panels/AccountPanel.vue`
- `src/settings/panels/AccountPanel.test.ts`
- `src/components/WallpaperDialog.vue`
- `src/components/WallpaperDialog.test.ts`
- `oss/forbidden.mjs`

Commit: `ad5fc9d` — "feat(wallpaper): wire upload and choose-from-NAS into the
picker", created with:
```
git commit -o src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/settings oss/forbidden.mjs -m "..."
```
(pathspec extended with `oss/forbidden.mjs` beyond the brief's literal
command, per the brief's own "extend if you had to touch a file it didn't
list" allowance). Verified via `git show --stat HEAD` that exactly these 7
files were committed, and via `git status --short` before and after that the
three permanently-staged `design-export/*.html` deletions were left
untouched.

## Self-review findings

- Checked for unused imports/dead code: all new refs (`fileEl`, `nasOpen`)
  and the new `NasImagePicker` import are used; no leftover code paths.
- Checked `wp.busy` disables the Upload button while an upload is in flight
  (matches the store's `busy` flag semantics from Task 4); the NAS button
  intentionally has no `:disabled="wp.busy"` guard because
  `setFromNasPath`'s own `busy` window is short and the NAS sub-view swap is
  itself a form of "busy" state (no double-submit surface — clicking pick
  items again would just re-fire `onNasPick`, which is idempotent apart from
  a wasted request).
- Verified no raw colour literals were introduced (`.wp-file`/`.wp-nas` rules
  contain no colours at all).
- Verified `MAX_UPLOAD_BYTES` / `wpTooLarge` wiring: the store throws
  `Error("Wallpaper file is too large (max N bytes)")` and the dialog's
  `/too large/i` regex matches it — confirmed by the passing oversized-upload
  test.
- Verified the `onNasPick` error path's `String((err as Error)?.message ||
  t('wpUploadFailed'))` matches `packages/service/src/users.ts`'s
  `setImageFromPath` doc comment and `unwrap.ts`'s actual throw (`new
  Error(body?.message || ...)`) — the inline comment about "HTTP 200 +
  success != 200" is accurate, not just copied prose.
- Confirmed `findComponent({ name: 'NasImagePicker' })` resolves for a
  `<script setup>` SFC in this repo's Vite/vue-test-utils versions (it does,
  via `.type.__name`) rather than assuming the controller's warning applied
  unconditionally — verified empirically instead of guessing.
- Ran `oss/forbidden.mjs`'s `scanText` directly (via a one-off `node -e`
  import) against every file this task touched before committing, to confirm
  zero un-whitelisted hits, rather than discovering it only via the slower
  `pnpm vitest run oss/` failure loop.
- Re-checked that `OwnerCard.test.ts` truly has no `pick`-payload assertion
  (only `choose-from-nas` / `pick-local-file`, both different events on a
  different component) before leaving it untouched, per the brief's own
  conditional instruction.

## Concerns

None outstanding. The only friction was the brief's file list missing
`NasImagePicker.test.ts` and `oss/forbidden.mjs` as required edits, and the
`findComponent`/`DOMWrapper` teleport interaction in the new test — both
resolved and documented above as deviations, not weakened assertions.
