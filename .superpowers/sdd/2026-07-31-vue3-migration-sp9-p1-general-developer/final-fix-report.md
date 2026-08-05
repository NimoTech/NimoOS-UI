# Final whole-branch review — fix wave report

Base commit: `19b61be` (branch `master`, repo `NimoOS-New-UI`).
Applied in one commit: `b9a86b1`.

## Fix 1 (Important) — UpdateDialog failure messages were invisible

**File**: `src/settings/components/UpdateDialog.vue`

- Added a local `error` ref, rendered as `<p v-if="error" class="set-danger">{{ error }}</p>`
  inside `.upd-body`, following the existing `WebUiHttpsDialog.vue` precedent. No new CSS,
  reused the existing `.set-danger` class already pulled in via `../styles/settings.css`.
- Added a small helper `errMsg(e, fallbackKey)` that reads `e.message` when `e instanceof Error`
  and it is non-empty, else falls back to `t(fallbackKey)`. Both catch blocks
  (`startDownload()` and `upgrade()`) now do `error.value = errMsg(e, 'settingsUpgradeFailed')`.
  Per the brief, `settingsUpgradeFailed` is reused for the download-trigger path too (rather than
  `settingsSaveFailed`, which reads "Failed to save configuration" — the wrong sentence for a
  failed download); no new i18n key was added.
- `error.value = ''` is set: (a) in the `watch(() => props.open, ...)` handler's opening branch,
  (b) at the top of `startDownload()`, (c) at the top of `upgrade()`.
- Left the existing `toast.show(...)` calls untouched for the success paths (`settingsDownloaded`
  on trigger-success and on the MessageBus `done` event, `settingsDownloadCancelled`/
  `settingsDownloadCancelFailed` in `cancel()`) — those fire while the dialog is closing or in a
  path not covered by this brief, so left as-is per "no unrelated refactor" discipline.

**Tests added** (`src/settings/components/UpdateDialog.test.ts`):
- `触发下载失败:内联显示后端的失败消息(不是不可见的 toast)` — mocks `getOsVersion` to reject
  with `new Error('upgrade already running')`, asserts `.set-danger` text contains it.
- `升级失败:内联显示后端的失败消息(不是不可见的 toast)` — reuses the existing
  `state.updateOsFail` mock (throws `new Error('boom')`), asserts `.set-danger` text contains
  `'boom'`.

## Fix 2 (Important) — three silent-failure writes now toast

**Files**:
- `src/settings/panels/general/TimezoneRow.vue` — added `useToast()` import/instance; catch
  block for `patchSystemConfig` now also calls `toast.show(t('settingsSaveFailed'))` (kept the
  `console.warn`).
- `src/settings/panels/general/DiskStandbyRow.vue` — added the same toast to the **config-write**
  leg's catch (the command-dispatch leg further down already had it and was left unchanged;
  the misleading "config already stored" comment there is correctly scoped to that second leg
  only, not this one).
- `src/stores/locale.ts` — `persist()`'s catch now calls `useToast()` (imported from
  `./toast`) and `i18n.global.t('settingsSaveFailed')` (not `useI18n()`, since this runs
  outside component setup). `persist()`'s contract (doesn't rethrow) is unchanged, so both
  callers (`LanguageRow.vue`, `Welcome.vue`) get the toast automatically.

**Test-gap fold-in** — added toast assertions to failure tests that lacked them (asserting the
resolved i18n text via each test's own `i18n` instance, not a hardcoded string):
- `src/settings/panels/general/rows.test.ts`: new test for TimezoneRow save failure; new test
  for DiskStandbyRow **config-write** failure (distinct from the pre-existing command-dispatch
  failure test, which already asserted toast).
- `src/settings/panels/general/switchRows.test.ts`: added toast assertions to the existing
  "落库失败时弹回" (recommend-apps SwitchRow) and "下发失败时开关弹回原状态" (UsbAutoMountRow)
  failure tests.
- `src/settings/panels/DeveloperPanel.test.ts`: added toast assertion to the existing "下发失败时
  开关弹回" (HTTPS toggle) failure test.
- `src/stores/locale.test.ts`: new test asserting `persist()` toasts on `setCustomStorage`
  rejection, while confirming the locale still switches client-side (`setLocale` runs first).

## Fix 3 (Minor) — power buttons no longer keyboard-reachable during overlay phases

**Files**:
- `src/settings/components/PowerFlow.vue` — added `:disabled="phase !== 'idle'"` to both the
  shutdown and restart buttons.
- `src/settings/components/PowerOverlay.vue` — added `role="dialog"` and `aria-modal="true"` to
  `.pf-overlay`. No focus trap was built, per the brief.

**Test added** (`src/settings/components/PowerFlow.test.ts`): confirms shutdown, triggers a
non-idle phase (`shutting`), asserts both `.pf-shutdown` and `.pf-restart` carry the `disabled`
attribute.

## Fix 4 (Minor) — Chinese disk-standby "never" string

- `src/i18n/zh_cn.sp9.ts`: `settingsStandbyNever` changed from `'从未'` to `'从不'` (matches
  Vue2's inline `standbyOptions` array). `en_us.sp9.ts` untouched, per instructions.
- `src/settings/panels/general/rows.test.ts`: updated the assertion `expect(opts[0].text())` from
  `'从未'` to `'从不'`.

## Fix 5 (Minor) — cancelling the news-feed consent dialog no longer permanently disables hydrate

**File**: `src/settings/panels/general/SwitchRow.vue`

- Moved `touched = true` out of `onToggle()` (which ran unconditionally, including when only
  opening the confirm dialog) and into `save()` (which only runs once a save is actually
  initiated — either directly for the no-confirm/close direction, or via `onConfirm()` → `save(true)`).

**Test added** (`src/settings/panels/general/switchRows.test.ts`, in the news-feed describe
block): holds `getCustomStorage` pending, toggles to open the confirm dialog, cancels via
`update:open` → `false`, then resolves the hydrate with `{ rss_switch: true }` — asserts the
switch ends up `aria-checked="true"` (the server's value), proving the cancel no longer
permanently blocks hydrate.

Verified the existing interleaving-guard tests for USB/recommend-apps (which assert a direct,
un-confirmed user action still wins over a late hydrate) still pass unchanged — `touched` is
still set synchronously as the very first statement inside `save()`, before any `await`, so the
timing for the no-confirm path is identical to before.

## Fix 6 (Minor) — misleading test title

- `src/settings/panels/general/GeneralPanel.integration.test.ts`: renamed the row-order test
  title from `'11 行 + 开发者入口,顺序逐条对位 Vue2'` to `'10 行 + 开发者入口,顺序逐条对位 Vue2'`
  (the assertion itself already only checked 10 entries; the device card and developer-entry row
  are asserted in separate tests).

## Commands run

```
pnpm exec vue-tsc --noEmit     # exit 0, no output — zero errors
pnpm test                       # 288 Test Files passed (288); 2189 Tests passed (2189)
```

Before this fix wave (baseline stated in the brief): 288 files / 2182 tests.
After: **288 files / 2189 tests** — 7 new tests added (2 UpdateDialog, 1 PowerFlow, 1 SwitchRow
interleaving regression, 2 rows.test.ts, 1 locale.test.ts), all passing; the 5 toast-assertion
additions to *existing* tests did not add new test cases, only assertions.

`vue-tsc --noEmit`: zero errors, confirmed twice (once mid-way, once after the final commit).

## Commit(s)

- `b9a86b1` — `fix(settings): 全仓终审 fix wave —— 六处失败提示/可达性/文案对位偏差(SP9-P1)`
  (15 files changed, 176 insertions, 10 deletions).

### Note on a self-caught mistake

The first commit attempt (`a694058`) ran `git commit -m "..."` **without** a trailing pathspec,
even though the files had been `git add`ed individually. Since pathspec-less `git commit`
commits the *entire index* (not just what was just `git add`ed), it accidentally swept in the
3 pre-existing staged `design-export/*.html` deletions that must never be touched. Caught this
immediately by diffing `HEAD~1..HEAD` on `design-export/`, fixed it with a non-destructive
`git reset --soft HEAD~1` (restores the prior commit boundary, keeps the index exactly as it
was — no working-tree changes, no `stash`, no `restore`), then recommitted with the pathspec
given explicitly on the `git commit` invocation itself (`git commit -m "..." -- <15 files>`),
which is confirmed (via a scratch-repo experiment) to leave unrelated already-staged paths out
of the resulting commit. Final commit `b9a86b1` contains exactly the 15 intended files.

## Confirmation: the 3 design-export deletions are untouched

`git status --short` before starting and after the final commit both show, unchanged:

```
D  "design-export/Audio Speaker Segmentation.html"
D  design-export/audio-waveform-design-kit.html
D  design-export/design-final.html
```

still staged (not committed, not restored, not stashed), plus the untracked
`docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md`, also untouched.

## Concerns / deviations from the brief

None. All six fixes were applied as specified; no ambiguity required a stop-and-ask. The one
process error (pathspec-less commit sweeping in unrelated staged deletions) was caught and
corrected before reporting completion, and is documented above for transparency.
