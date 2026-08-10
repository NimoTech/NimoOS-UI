# Task 4 report: 「文件操作」分组 + 头部三态接线

## Status: DONE

## Commit

`86cd807` — feat(files): show file-operation progress inside the upload panel

## What changed

- `src/files/components/UploadPanel.vue`
  - Imported the four pure functions from `../util/opsRow` (`opsTaskPercent`,
    `opsTaskLabelKey`, `opsTaskBasename`, `resolveUploaderHeader`).
  - Added `headerText` computed, wired to `t(resolveUploaderHeader({ uploadCount: totalCount.value, opsCount: opsCount.value }))`;
    `.up-title` now renders `headerText` instead of the hardcoded `filesUploadTitle`.
  - Inserted the new "file operations" `.up-zone` (gated on `opsCount`) between
    the problem zone and the active-upload zone, exactly as the brief specifies:
    a `.up-zone-head` with the zone title + a `.up-ops-cancel-all` button calling
    `ops.cancelAll()`, and one `.up-ops-item` row per `ops.active` task showing
    `opsTaskLabelKey` + `opsTaskBasename(task.processing_path)`, a conditional
    `.up-item-pct` (only when `opsTaskPercent(task) !== null`), and a progress
    bar reusing the existing `.up-progress`/`.up-progress-fill` classes.
  - Added one CSS rule, `.up-zone-head { display: flex; align-items: center; justify-content: space-between; }`.
    No new colors; reused existing token-based rules for everything else.
  - **Extra fix beyond the brief** (see Concerns below): changed the initial
    `open` ref computation from
    `ref(shouldAutoOpenUploadList(0, store.queue.length))` to also OR in
    `shouldAutoOpenUploadList(0, ops.active.length)`, so a mount with file
    operations already in flight shows the panel open immediately instead of
    silently staying collapsed until some later transition event that would
    never fire.
- `src/files/components/UploadPanel.test.ts` — appended the
  `describe('UploadPanel file-operation group', ...)` block from the brief,
  with one deliberate deviation instructed by the task: **no**
  `global: { plugins: [i18n] }` passed to any new `mount(UploadPanel)` call
  (the shared i18n singleton is already installed by `vitest.setup.ts`; passing
  it again double-installs the plugin and triggers a hidden `[Vue warn]`, a
  regression this file was previously fixed for). The one test that needs
  translated text (`i18n.global.t('filesUploadHeaderProcessing')`) reads the
  shared singleton directly, without passing it to `mount`.
- `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts` — added
  `filesUploadZoneOps: '文件操作'` / `'File operations'`, placed directly after
  `filesUploadZoneProblem` in both files (same position, keeping the two files
  in lockstep for `parity.test.ts`).

## Test commands run and results

1. Step 2 (red baseline), before any implementation:
   `pnpm exec vitest run src/files/components/UploadPanel.test.ts`
   → 5 new tests FAIL (all for real reasons — no `.up-ops-item` rendered / empty
   header text state), 8 pre-existing tests still PASS.

2. After the i18n key + template/script implementation, first attempt:
   `pnpm exec vitest run src/files/components/UploadPanel.test.ts src/i18n/parity.test.ts src/styles/`
   → still 5 FAIL. Root cause found (see Concerns): the panel's initial `open`
   ref only considered `store.queue.length` at setup time, not `ops.active`,
   so a test that pre-populates `ops.active` *before* `mount()` (mirroring how
   the brief's tests are written, and how the existing "renders active item"
   upload test already behaves for uploads) never got the panel expanded and
   every assertion against `.up-ops-item`/`.up-title` hit an empty DOM.

3. After fixing the initial `open` computation:
   `pnpm exec vitest run src/files/components/UploadPanel.test.ts src/i18n/parity.test.ts src/styles/`
   → **6 test files passed, 1326/1326 tests passed.**

4. Step 6 mutation check:
   - Mutated `v-if="opsTaskPercent(task) !== null"` → `v-if="true"` and the
     interpolation `opsTaskPercent(task)` → `opsTaskPercent(task) ?? 0`.
   - Reran `pnpm exec vitest run src/files/components/UploadPanel.test.ts`:
     exactly **1** test went red —
     `UploadPanel file-operation group > omits the percentage entirely when the total size is unknown`
     (`AssertionError: expected '复制 · big.iso0%' not to contain '%'`), all
     other 12 tests in the file stayed green.
   - Reverted the mutation, reran
     `pnpm exec vitest run src/files/components/UploadPanel.test.ts src/i18n/parity.test.ts src/styles/`:
     **6 files / 1326 tests, all green** — confirms the assertion is doing real
     work and the revert is clean.

5. Type check: `pnpm exec vue-tsc --noEmit` — 2 pre-existing errors in
   `src/settings/panels/LanDevicesPanel.vue` (unrelated `LanDevice` /
   `getLanDiscovery` typing gaps). Verified these predate this task by
   `git stash` + rerunning `vue-tsc` on the unmodified tree — same 2 errors,
   confirming they are not introduced by this change.

6. Full suite, foreground, run twice:
   - **Before commit** (`pnpm test`): 684/688 files passed, 11015/11088 tests
     passed, 3 failed — all 3 failures were in `oss/export-rsync.test.mjs` and
     related OSS-export guard tests, failing because the working tree had
     uncommitted files (`git status` non-clean) and the export guard
     deliberately aborts on a dirty tree (`--allow-dirty-oss` only tolerates
     dirtiness under `oss/`, not elsewhere). This is expected pre-commit
     behavior, not a regression in the feature.
   - **After commit `86cd807`** (`pnpm test`, tree clean): **688/688 test
     files passed, 11088/11088 tests passed, 0 failed.**

All commands were run in the foreground and their full output was read before
drawing any conclusion; nothing was backgrounded and left unchecked (two
`pnpm test` runs did exceed the 120s default Bash timeout and were
auto-moved to background by the harness — both were then waited on via a
blocking `until grep ... ; done` background monitor and their completion
notifications and full logs were read before proceeding, never assumed).

## Mutation-check summary (Step 6, for quick reference)

- Mutated: `opsTaskPercent(task) !== null` guard replaced with `true`, and
  `opsTaskPercent(task)` interpolation replaced with `opsTaskPercent(task) ?? 0`.
- Test that went red: `omits the percentage entirely when the total size is
  unknown` (and only that one).
- Restored-green confirmation: yes, full local suite (`UploadPanel.test.ts` +
  `parity.test.ts` + `src/styles/`) green again after revert, 1326/1326.

## Concerns

**One real behavioral gap found and fixed, not in the original brief:**
Task 3 (per this task's stated context) had already wired
`const opsCount = computed(...)`, `panelVisible`, and a `watch(opsCount, ...)`
for auto-open, but the panel's *initial* `open` ref (set once at `<script
setup>` evaluation time) only ever looked at `store.queue.length`:

```ts
const open = ref(shouldAutoOpenUploadList(0, store.queue.length))
```

`shouldAutoOpenUploadList(prev, cur)` is just `cur > prev`. Because the ref is
computed once at mount with a hardcoded `prev = 0`, this line's real job is
"was the upload queue already non-empty when the panel first mounted?" — but
it never asked the equivalent question about `ops.active`. The `watch(opsCount, ...)`
Task 3 added only fires on a *subsequent* transition from empty to non-empty;
a component that mounts with `ops.active` **already populated** (which is
exactly the setup the brief's own tests use — `ops.active = [...]` is set
before `mount(UploadPanel)`) never crosses that empty→non-empty boundary after
mount, so the watcher never runs and the panel stays collapsed. This meant 4 of
the 5 brief tests (everything that asserts on `.up-ops-item` or `.up-title`
inside the open panel) failed even with a fully correct template/script
implementation of Step 4's diff, until I extended the initial `open`
computation:

```ts
const open = ref(
  shouldAutoOpenUploadList(0, store.queue.length) || shouldAutoOpenUploadList(0, ops.active.length),
)
```

I did not weaken any assertion to work around this — the brief's tests are
written exactly as given, unmodified in intent (I only dropped the redundant
`global: { plugins: [i18n] }` per this task's explicit override instructions).
This one-line fix in the initial-`open` expression was necessary and correct:
it makes the panel's mount-time behavior for file operations consistent with
its pre-existing, already-tested behavior for uploads (see the existing test
`renders active item without leaking /DATA`, which relies on the exact same
pattern — seed the store before mount, expect the panel already open).

No test passed both before and after my change without a real reason — all 5
new tests were genuinely red at Step 2 and are genuinely exercising real
render paths at Step 5/6.

`vue-tsc --noEmit` reports 2 pre-existing errors in
`src/settings/panels/LanDevicesPanel.vue`, confirmed present on the
unmodified tree via `git stash` — unrelated to this task, not introduced or
touched by it.
