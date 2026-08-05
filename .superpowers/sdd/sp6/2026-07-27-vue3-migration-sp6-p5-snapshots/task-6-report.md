# Task 6 report: 删除快照确认弹窗 + 时间线接线

## Summary

Implemented `SnapshotDeleteDialog.vue` (new) exactly per brief Step 3, wired it into
`SnapshotTimeline.vue`'s `.st-actions` slot (delete button + dialog state), and added the
3 new i18n keys (`snapDelete` / `snapDeleteTitle` / `snapDeleteMsg`) to both locale files,
copied verbatim from `task-7-brief.md` 附录 A, T6 rows (lines 146-148).

## TDD evidence

### RED

Created `src/storage/components/SnapshotDeleteDialog.test.ts` (brief Step 1 content, verbatim)
and appended the `describe('SnapshotTimeline 删除', …)` block to
`src/storage/components/SnapshotTimeline.test.ts`, plus the two mock-plumbing edits the brief's
note calls for (`removeMock` named forward instead of anonymous `remove: vi.fn()`, and
`document.body.innerHTML = ''` added to the existing `beforeEach`).

```
$ pnpm exec vitest run src/storage/components/SnapshotDeleteDialog.test.ts src/storage/components/SnapshotTimeline.test.ts
...
FAIL  src/storage/components/SnapshotDeleteDialog.test.ts
Error: Failed to resolve import "./SnapshotDeleteDialog.vue" ... Does the file exist?
FAIL src/storage/components/SnapshotTimeline.test.ts > SnapshotTimeline 删除 > 条目有删除按钮;点击弹确认框(此时还没发请求)
AssertionError: expected false to be true  (w.find('.st-delete').exists())
FAIL src/storage/components/SnapshotTimeline.test.ts > SnapshotTimeline 删除 > 确认后才发 remove(name, uuid) …
Error: Cannot call trigger on an empty DOMWrapper.
FAIL src/storage/components/SnapshotTimeline.test.ts > SnapshotTimeline 删除 > 取消 → 不发请求,条目还在
Error: Cannot call trigger on an empty DOMWrapper.

Test Files  2 failed (2)
     Tests  3 failed | 8 passed (11)
```

Confirms tests fail for the expected reason (component missing / no delete button yet), not
for an unrelated typo.

### GREEN

Implemented `SnapshotDeleteDialog.vue`, the `SnapshotTimeline.vue` wiring (import, `deleteOpen`/
`deleteTarget`/`deleteTimeText` state, `confirmDelete`/`onDeleteConfirmed`, template button +
mounted dialog, `.st-delete` styles), and the 6 i18n key additions.

```
$ pnpm exec vitest run src/storage/components/SnapshotDeleteDialog.test.ts src/storage/components/SnapshotTimeline.test.ts
Test Files  2 passed (2)
     Tests  15 passed (15)
```

## Full verification

```
$ pnpm exec vitest run src/storage/
Test Files  25 passed (25)
     Tests  242 passed (242)

$ pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
Test Files  2 passed (2)
     Tests  124 passed (124)

$ pnpm exec vue-tsc --noEmit
(no output — zero errors)

$ pnpm test
Test Files  246 passed (246)
     Tests  1496 passed (1496)
```

## Files changed

- `src/storage/components/SnapshotDeleteDialog.vue` (new) — brief Step 3 verbatim.
- `src/storage/components/SnapshotDeleteDialog.test.ts` (new) — brief Step 1 verbatim.
- `src/storage/components/SnapshotTimeline.vue` — added `SnapshotDeleteDialog` import,
  `deleteOpen`/`deleteTarget`/`deleteTimeText` state, `confirmDelete`/`onDeleteConfirmed`,
  the `.st-delete` button next to the preserved `[浏览]` deferral comment, the mounted
  `<SnapshotDeleteDialog>` at the root's end, and the `.st-delete` CSS rule.
- `src/storage/components/SnapshotTimeline.test.ts` — `remove: vi.fn()` → named `removeMock`
  forwarding wired through `service.snapshot.remove`; `beforeEach` now also clears
  `document.body.innerHTML`; appended the `SnapshotTimeline 删除` describe block (brief
  verbatim).
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` — added `snapDelete` / `snapDeleteTitle` /
  `snapDeleteMsg` immediately after `snapTypePreop`, copied character-for-character from
  `task-7-brief.md` 附录 A T6 rows. `storageCancel` reused as-is, no new key.

## Self-review

- Class contract check: `.sdd-msg`, `.sdd-ok`, `.sdd-cancel`, `.st-delete` all present
  verbatim, confirmed by grep and by the passing tests that assert on them via
  `document.body.querySelector`.
- Color-guard: only `var(--…)` tokens used in both new/changed `<style>` blocks
  (`--fg-muted`, `--chip-border`, `--chip-bg`, `--fg`, `--remove-fg`) — all pre-existing
  tokens already used by `RaidDeleteDialog.vue`, no new token needed.
- i18n parity: `parity.test.ts` passed with the 3 new keys in both files, and the zh_cn
  values were diffed character-by-character against 附录 A (including the `,`/`。`
  punctuation and the `{time}` placeholder) before writing.
- Store contract: component code only calls `store.removeSnapshot(props.volumeUuid,
  target.name)` and reads `store.deletingName` — no `useToast()`, no `console.*` added in
  either component. Toast/log stays entirely inside `snapshot.ts` (untouched).
- Portal/body cleanup: `SnapshotDeleteDialog.test.ts`'s `beforeEach` clears
  `document.body.innerHTML`, matching the `FormatDialog.test.ts` pattern; verified no
  cross-test leakage by running the two dialog test files together (15/15 pass, no stray
  `.sdd-*` nodes tripping up unrelated assertions).
- `Array.prototype.at()`: not used anywhere in the new/changed code.
- Did not touch `src/storage/stores/snapshot.ts`, `src/storage/util/snapshotView.ts`,
  `src/components/ui/Dialog.vue`, or `SnapshotPanel.vue` — confirmed via `git status`/`git
  diff --stat` before commit (only the 6 files in the Files-changed list above were
  staged).

## Deviations from Vue2

None beyond the one already called out and pre-approved in the brief itself: Vue2's
`$buefy.dialog.confirm(...)` (title/message/confirm/cancel/danger-styled, imperative API)
has no New-UI equivalent, so it is replaced by the declarative `SnapshotDeleteDialog.vue`
component built on the shared `Dialog.vue` base — same confirmation strength (single click,
no type-to-confirm, matching Vue2's own single-click danger confirm for this action), same
message semantics (`snapDeleteMsg` interpolates `{time}` exactly as Vue2's
`new Date(item.createdAt).toLocaleString()` inline i18n call did), same in-flight guard
(`store.deletingName !== null` disables the delete button and both dialog buttons, mirroring
Vue2's `:disabled="deletingName !== null"` / `:loading="deletingName === item.name"` on its
`b-button`). Vue2's `[Browse]` button and the `deleted` event emit are out of scope for this
task (browse is the already-documented deferred file-browsing suite; `deleted`-event
propagation is superseded by the store directly calling `loadVolume` after a successful
delete, per T2's design — no parent listener is needed in New-UI's store-centric model).

No Vue2 bugs were found in `confirmDelete`/`doDelete` (:145-176) to intentionally not
replicate — the logic ports cleanly.
