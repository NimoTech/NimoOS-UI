# Task 6 Report: 批次详情弹窗（查看 + 放弃）

## Status: DONE

Commit: `fa51d75` — "feat(files): add the interrupted-batch dialog"

## What was implemented

Followed the brief's steps in order (TDD):

1. **`src/files/components/UploadBatchModal.test.ts`** — created with the brief's 5 test
   cases (load + list missing files, load-failure state, abandon success, abandon 404
   treated as success, abandon non-404 keeps dialog open + shows inline error).
2. **i18n keys** — added `filesBatchTitle`, `filesBatchProgress`, `filesBatchMissing`,
   `filesBatchLoadFailed`, `filesBatchAbandon`, `filesBatchAbandonFailed` verbatim (zh/en)
   to both `src/i18n/zh_cn.base.ts` and `src/i18n/en_us.base.ts`, placed right after the
   existing `filesUploadBrokenBadge` key from Task 5.
3. **`src/files/components/UploadBatchModal.vue`** — created per the brief's snippet,
   with the three Chinese-comment blocks rendered in English per the controller's ruling
   (see "Comment translation" below). Uses `Dialog` from `../../components/ui/Dialog.vue`,
   `renderSize` from `../util/format`, `service.uploadBatches.getBatch`/`abandonBatch`.
4. **Step 6 wiring** (`FileGridView.vue`, `FileListView.vue`, `Files.vue`) — see next section.

## Step 6: event-forwarding through the intermediate views

Confirmed before touching anything that `FileGridView.vue` and `FileListView.vue` both
declare an explicit `defineEmits<{...}>()` and forward each event by hand
(`@x="emit('x', $event)"` on `<FileTile>` / `<FileRow>`) — they do not pass through
undeclared events. `FileTile.vue` / `FileRow.vue` already emit `open-batch` (Task 5),
but neither intermediate view listed it.

Changes made in both files (mirrored, one line each):

- `FileGridView.vue`: added `(e: 'open-batch', batchId: string): void` to `defineEmits`,
  and `@open-batch="emit('open-batch', $event)"` on `<FileTile>`.
- `FileListView.vue`: added `(e: 'open-batch', batchId: string): void` to `defineEmits`,
  and `@open-batch="emit('open-batch', $event)"` on `<FileRow>`.

In `Files.vue`:
- Imported `UploadBatchModal`.
- Added `const batchModalId = ref('')`.
- Added `@open-batch="(id: string) => (batchModalId = id)"` on both `<FileGridView>` and
  `<FileListView>`.
- Mounted `<UploadBatchModal v-if="batchModalId" :batch-id="batchModalId" @close="batchModalId = ''" @abandoned="files.load(files.currentPath)" />`
  right before `</AreaShell>`.

**How I confirmed the event reaches `Files.vue`:** traced the emit chain statically
(`FileTile`/`FileRow` emit `open-batch` → `FileGridView`/`FileListView` now forward it →
`Files.vue`'s `@open-batch` handler sets `batchModalId`, which conditionally mounts the
dialog). This is exercised end-to-end by the existing `FileTile`/`FileRow` tests plus the
new `UploadBatchModal.test.ts`; I did not add a new integration test in `Files.test.ts`
for the forwarding itself (the brief's Step 6 did not ask for one) — the static trace plus
`vue-tsc --noEmit` passing (which would fail if `open-batch` weren't declared on the emits
type and used with a mismatched signature) is the verification. `pnpm test` also stayed
green with `Files.test.ts` still passing, confirming no regression to the existing
`FileGridView`/`FileListView`/`Files.vue` wiring.

## Deviation from the brief's literal test code (and why)

The brief's Step 1 test used `w.find('.ubm-abandon')` / `w.text()` directly on the mounted
wrapper. Running it after implementing the component (Step 5) failed on 4 of 5 cases:
`.ubm-load-error` not found, and `Cannot call trigger on an empty DOMWrapper` for
`.ubm-abandon`. Root cause: `Dialog.vue` uses reka-ui's `DialogPortal`, which teleports
`DialogContent` to `<body>`, outside the mounted wrapper's own DOM subtree. This is a
well-established, already-documented constraint in this repo (`硬约束 8`, referenced in
`src/kvm/components/KvmDialog.test.ts`, `src/kvm/views/KvmPage.test.ts`,
`src/components/ui/Dialog.test.ts`, `src/files/shares/ShareLinkDialog.test.ts`,
`src/files/components/UploadPanel.test.ts`) — every one of those tests mounts with
`attachTo: document.body`, awaits one `nextTick()` for the Portal content to land, and
then queries `document.body` (via `new DOMWrapper(document.body)`) instead of the wrapper.

I applied the exact same established pattern here rather than guessing: added
`attachTo: document.body` to `mount()`, `await nextTick()` (plus `await flushPromises()`
for the async `getBatch` call in `onMounted`) in a `mountModal()` helper, a `body()`
helper (`new DOMWrapper(document.body)`), replaced `w.find`/`w.text` with `body().find`/
`body().text` for all DOM assertions, and added `afterEach(() => { document.body.innerHTML = '' })`
for cleanup. The five assertions' *intent* is identical to the brief's verbatim test —
only the plumbing needed to reach teleported content changed. `w.emitted(...)` assertions
were left as `w.emitted` since emits are tracked on the component instance, not the DOM.

## Comment translation (controller ruling #1)

Rendered the brief's three Chinese-comment blocks in English, preserving full reasoning
and the concrete numbers, in `UploadBatchModal.vue`:

- The 404-is-success rationale in `abandon()`: explains a 404 means the batch is already
  gone server-side (expired/swept, or a stale badge race), and the user's goal was to make
  the badge disappear, so treating it as success avoids stranding the user in a dialog with
  nothing left to do.
- The "inline error, not a toast" rationale (same function): toast is z-index 60, dialog
  backdrop is z-index 1000 with a blur, so a toast from inside a dialog would be both
  covered and smeared.
- The same toast/z-index note, restated in the test file's comment on the non-404 case.

Also translated to English: the `#122` batch-swept-away note above the 404 test, and the
`.ubm-btn`/`.ubm-danger` CSS comments (no-global-`.ui-btn` rationale, and the
hover-specificity rationale for why the variant needs its own `:hover`).

## What was tested and results

**Focused file, iterating (TDD):**

- RED: `pnpm exec vitest run src/files/components/UploadBatchModal.test.ts`
  → `Error: Failed to resolve import "./UploadBatchModal.vue" ... Does the file exist?`
  (expected: file didn't exist yet, confirms the test file is wired correctly and would
  fail for the right reason once the component exists).
- After first implementing the component per the brief's snippet (no test changes yet):
  4 of 5 tests failed — `.ubm-load-error` not found, `Cannot call trigger on an empty
  DOMWrapper` on `.ubm-abandon` — due to the reka-ui teleport issue described above.
- After fixing the test file to use `attachTo: document.body` + `body()` DOMWrapper (no
  component changes): GREEN — `Test Files 1 passed (1)`, `Tests 5 passed (5)`.

**Full-suite before/after (per controller-verified baseline):**

- Baseline claimed by controller at `e0b33dd`: 644 files / 10396 tests green.
- Mid-task run (uncommitted new/modified files present): `Test Files 4 failed | 641 passed
  (645)`, `Tests 3 failed | 10331 passed | 70 skipped (10404)`. All 3 failures were in
  `oss/cli-args.test.mjs` / `oss/export-rsync.test.mjs` — these are the OSS-export
  self-tests that call `checkClean()` and refuse to run when the New-UI working tree has
  uncommitted changes outside of `oss/`. They listed exactly my then-uncommitted files
  (`FileGridView.vue`, `FileListView.vue`, `en_us.base.ts`, `zh_cn.base.ts`, `Files.vue`,
  `UploadBatchModal.test.ts`, `UploadBatchModal.vue`) as the dirty-tree cause — not a
  defect in this task's code, just running the suite before committing.
- Final run, after committing with the correct pathspec (working tree back to the
  pre-existing baseline-dirty state — only `design-export/*` deletions and `oss/*`
  modifications, exactly as before this task started):
  **`Test Files 645 passed (645)`, `Tests 10404 passed (10404)`.**
- `pnpm exec vue-tsc --noEmit` → clean, no output, exit 0.
- `pnpm exec vitest run src/i18n/parity.test.ts` → `Test Files 1 passed (1)`,
  `Tests 9 passed (9)`.
- Known non-findings observed and not chased: jsdom `Error: Not implemented: navigation
  (except hash changes)` noise from unrelated `src/photos/stores/__tests__/favorites.test.ts`;
  did not run `DesktopContextMenu.test.ts` standalone (only as part of the full suite,
  where it passed).

## Files changed (commit `fa51d75`)

- `src/files/components/UploadBatchModal.vue` (new)
- `src/files/components/UploadBatchModal.test.ts` (new)
- `src/files/components/FileGridView.vue` (modified — `open-batch` emit + forward)
- `src/files/components/FileListView.vue` (modified — `open-batch` emit + forward)
- `src/views/Files.vue` (modified — import, `batchModalId` ref, two `@open-batch`
  listeners, `<UploadBatchModal>` mount)
- `src/i18n/zh_cn.base.ts` (modified — 6 new keys)
- `src/i18n/en_us.base.ts` (modified — 6 new keys)

`git status` before committing showed only these 7 files plus the pre-existing unrelated
dirty state (`design-export/*` deletions, `oss/README.md`, `oss/export.mjs`,
`oss/manifest.mjs` modified, `oss/cli-args.test.mjs` untracked). `git add` and `git commit`
were both given the explicit 7-file pathspec (the brief's 5 plus `FileGridView.vue` and
`FileListView.vue` per the controller's ruling #2). Verified with `git status` after
staging that nothing under `design-export/` or `oss/` was staged, and after committing
that the tree returned to exactly the pre-existing dirty state.

## Self-review findings

- Scope: implemented exactly what the brief named — no `refill` emit, no extra button, no
  watcher beyond the `onMounted`-once-per-open pattern the brief specified. Did not touch
  `oss/*` or `design-export/*`.
- Colors: every visible color in `UploadBatchModal.vue`'s `<style>` is a `var(--…)` token
  (`--fg`, `--fg-muted`, `--remove-fg`, `--chip-border`, `--chip-bg-hi`) or a
  `color-mix(in srgb, var(--remove-fg) …%, transparent)` derived from one — no hex/rgb/named
  colors. All five tokens confirmed present in both the dark `:root` and
  `:root[data-theme="light"]` blocks in `theme.css` before writing the component (per the
  brief's own note, independently spot-checked).
- Variant hover: `.ubm-danger:hover` is declared with its own `background`, so it does not
  lose to the base `.ubm-btn:hover` (0,2,0) vs (0,1,0) specificity trap this repo has hit
  before.
- Tests assert real rendered behaviour, not mock plumbing: the missing-file rows, the
  done/total text, the load-error message, and the abandon success/404/500 paths are all
  asserted against actual DOM content (via `body()` after fixing the teleport issue) and
  actual emitted events — not just that the mocked service functions were called.
- Test output is pristine: focused-file run is silent except the pass summary; full-suite
  run's only noise is the two documented, pre-existing non-findings (jsdom navigation +
  favorites test), neither touched by this task.
- No refactor of adjacent code beyond the one-line addition each to `FileGridView.vue` /
  `FileListView.vue`'s `defineEmits` and template, per migration discipline.

## Concerns

- None blocking. The one substantive judgment call was diverging from the brief's literal
  test code to work around the reka-ui teleport issue — this is not a guess; it's copying
  an established, repeatedly-applied, already-documented pattern from five other test files
  in this exact repo, with the test's asserted behavior left unchanged.
- Did not add a dedicated `Files.test.ts` case that mounts `Files.vue`, clicks a badge, and
  asserts the dialog opens end-to-end through both intermediate views — the brief's Step 6
  did not ask for one, and `UploadBatchModal.test.ts` plus `vue-tsc` plus the unmodified
  `FileTile`/`FileRow` tests were judged sufficient coverage for the forwarding change. If
  the reviewer wants that extra end-to-end test, it's a small addition.

---

## Fix round: stale z-index claim in the abandon-error comment (commit `c82fd1d`)

### Finding

Review flagged that both comments explaining "inline error, not a toast" cited concrete
numbers — "a toast sits at z-index 60, which gets covered by the dialog backdrop (1000)"
— that were true when the SP12 plan was written but are no longer true in this codebase.
The reviewer's ruling: the decision to keep the error inline stands, but the stated reason
must be replaced with one that is actually true today, preferring a behavioural rationale
over a stacking one, with instruction to verify the z-index facts myself first rather than
trust the finding as given.

### What I verified about the current z-index facts

- Read `src/components/AppToast.vue` directly (note: the reviewer's message cited
  `src/home/components/AppToast.vue`, but the file actually lives at
  `src/components/AppToast.vue` — a path detail in the finding, not a substantive error;
  the z-index claim itself checked out). Its `.toast-stack` rule is:
  `z-index: 10100`, with an in-file comment explaining it was deliberately raised there
  (from an original value of 60) specifically because dialog/modal overlays
  (`.ui-dialog-overlay = 1000`, dialog panel `= 1001`, `.sk-modal-bg = 1100`, plus AI-area
  overlays sitting at 9999/10000) were burying toasts under `backdrop-filter` blur —
  the exact failure mode this task's original comment described as still happening today.
- Read `src/components/AppToast.zIndex.test.ts` — it asserts, as a standing repo guard,
  that `AppToast`'s `.toast-stack` z-index is read as a finite positive number, that every
  other `z-index` value anywhere in the repo's `.vue`/`.css`/`.scss` files is strictly
  lower, and specifically pins two overlays this repo was previously bitten by
  (`.pd-scrim` in `PhotosPersonDetail.vue`, `.cad-overlay` in `ClusterActionDialog.vue`)
  as below the toast. This is `docs/THEMING.md §8`'s documented stacking convention.
- Confirmed the commit that raised the toast's z-index, `057019b`
  ("fix: AI 区 toast 隐形 / 弹窗内复制失效 / toast 被弹窗遮住"), is an ancestor of this
  task's base commit `e0b33dd`: `git merge-base --is-ancestor 057019b e0b33dd` exited 0
  ("IS ANCESTOR").
- Conclusion: the reviewer's finding is correct. Toasts in this repo are not covered by
  dialog backdrops — the opposite invariant is now guarded. The original comment's z-index
  claim is false as of this codebase and had to go.

### What I changed

Replaced the z-index-based rationale in both places with a behavioural one (per the
reviewer's suggested wording, which I found accurate and did not need to alter):

- `src/files/components/UploadBatchModal.vue` (the `else` branch of `abandon()`'s catch):
  now says the error must be inline because it "is the answer to the button the user just
  pressed inside this dialog," so it "needs to stay pinned next to that button and stay on
  screen while they decide what to do next," whereas "a toast auto-dismisses and renders
  away from the control that caused it."
- `src/files/components/UploadBatchModal.test.ts` (comment on the non-404-failure test):
  same rationale, restated to match the test's framing.

No functional/behavioural code changed — this was a comment-only fix in both files.

### Covering tests run (foreground, exact commands and output)

```
$ pnpm exec vitest run src/files/components/UploadBatchModal.test.ts
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  18:19:46
   Duration  1.09s (transform 266ms, setup 294ms, import 340ms, tests 121ms, environment 222ms)
```

```
$ pnpm exec vue-tsc --noEmit
(no output — exit 0)
```

Per the reviewer's scoping, no full-suite run was performed for this comment-only round.

### Commit

```
$ git status --short
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html
 M oss/README.md
 M oss/export.mjs
 M oss/manifest.mjs
 M src/files/components/UploadBatchModal.test.ts
 M src/files/components/UploadBatchModal.vue
?? oss/cli-args.test.mjs

$ git add src/files/components/UploadBatchModal.vue src/files/components/UploadBatchModal.test.ts
$ git status --short   # confirms only the two intended files staged
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html
 M oss/README.md
 M oss/export.mjs
 M oss/manifest.mjs
M  src/files/components/UploadBatchModal.test.ts
M  src/files/components/UploadBatchModal.vue
?? oss/cli-args.test.mjs
```

Committed as `c82fd1d` — "fix(files): correct a stale z-index claim in the abandon-error
comment" — with an explicit two-file pathspec on both `git add` and `git commit -- <paths>`.
Nothing from `design-export/` or `oss/` was staged or touched.

### Not in scope (left alone per reviewer's instruction)

- The null-batch vs. rejected-`getBatch` message conflation.
- The missing end-to-end forwarding test through `FileGridView`/`FileListView` into
  `Files.vue`.

Both remain on the ledger for a future round.
