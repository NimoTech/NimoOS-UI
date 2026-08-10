### Task 3 report: upload panel visible/auto-opening for file operations

**Commit:** `3a747a4` — "feat(files): let the upload panel open for file operations too"

**What changed**

- `src/files/components/UploadPanel.vue`:
  - Imported and instantiated `useFileOpsStore()` as `ops`.
  - Added `opsCount = computed(() => ops.active.length)` and
    `panelVisible = computed(() => totalCount.value > 0 || opsCount.value > 0)`,
    with the comment from the brief explaining why gating on `totalCount` alone
    would hide the file-operation group.
  - Added a second `watch(opsCount, ...)` that reuses the existing
    `shouldAutoOpenUploadList` helper to pop the panel open on an
    empty→non-empty transition of the ops queue, exactly mirroring the
    existing upload-queue watch.
  - Template: outer `v-if="totalCount"` → `v-if="panelVisible"`; collapsed
    toggle button counter `({{ totalCount }})` → `({{ totalCount + opsCount }})`.
  - **Untouched per the brief's explicit warning:** the header `up-title` span
    text, and the "delete all" button's `v-if="totalCount"` (verified by grep
    after edits — still reads `v-if="totalCount"`, unchanged from before).

  One deviation from a literal reading of the brief's Step 3 snippet: the
  brief shows the `watch(opsCount, ...)` block placed directly after the first
  `watch` (i.e., before `opsCount` is declared, since that watch snippet
  appears earlier in the diff than the `const opsCount = ...` snippet). Placed
  verbatim in that order, Vue's `<script setup>` throws `ReferenceError: Cannot
  access 'opsCount' before initialization` at mount (caught immediately by the
  test run — see below). I moved the `watch(opsCount, ...)` block to
  immediately after the `panelVisible` computed (declaration order fixed,
  logic and code text otherwise identical to the brief). This is a purely
  mechanical reordering, not a change of intent.

- `src/files/components/UploadPanel.test.ts` **already existed** in this
  worktree (a prior task's file with 5 tests: leak-check, byte display,
  auto-open-on-upload-queue-growth, error-code mapping, and a
  conflict-dialog-removal source guard). The brief's "does not exist yet"
  premise from the parent prompt was stale relative to this worktree's state.
  I appended the brief's `describe('UploadPanel visibility', ...)` block
  (verbatim test bodies) to the end of the existing file rather than
  overwriting it, adding the needed imports (`useFileOpsStore`, `FileTask`
  type, the shared `i18n` instance aliased as `sharedI18n` to avoid colliding
  with the file's existing local `i18n` `createI18n(...)` instance) and the
  `opsTask()` helper. All 5 pre-existing tests plus the 3 new ones now live in
  one file, 8 tests total.

**Exact test commands run and output summary**

1. Before implementation (Step 2, confirming red):
   `pnpm exec vitest run src/files/components/UploadPanel.test.ts`
   → 8 tests | 2 failed (the two new visibility tests), 6 passed. Failures
   were `expected false to be true` on `.upload-panel-wrap` / `.upload-panel`
   existence — the correct reason (panel not gated/opening on ops queue yet).

2. After implementation (Step 4, confirming green):
   Same command → **8 passed (8)**.

3. Wider suite (Step 5):
   `pnpm exec vitest run src/files/`
   → **121 test files passed, 943 tests passed**, no failures.
   (Run twice — once right after implementation, once again after the
   mutation-and-restore cycle — both times 121/943 green.)

**Mutation check (Step 6)**

- Mutated `panelVisible = computed(() => totalCount.value > 0 || opsCount.value > 0)`
  to `panelVisible = computed(() => totalCount.value > 0)` (dropped the
  `opsCount` clause, i.e. reverted the gating fix).
- Re-ran `pnpm exec vitest run src/files/components/UploadPanel.test.ts`:
  **2 failed, exactly** the two new tests — `appears for file operations
  alone, with no uploads queued at all` and `opens itself when a file
  operation starts while the panel sits collapsed` — same
  `expected false to be true` failure mode as the pre-implementation run.
  The other 6 tests (including the pre-existing upload-queue auto-open test)
  stayed green, confirming the mutation was isolated to the new behavior and
  didn't accidentally also break unrelated coverage.
- Restored `panelVisible` to the two-clause form and re-ran the same test file:
  **8 passed (8)** — confirmed restored-green.

**Honesty disclosure**

All 5 pre-existing tests in `UploadPanel.test.ts` (leak-check, byte display,
upload-queue auto-open, error-code mapping, conflict-dialog-removal guard)
passed both before and after this task's change — they exercise the upload
queue path only and were not expected to be affected by, or to detect, this
task's change. Only the 3 new tests in the `UploadPanel visibility` describe
block are new coverage for this task's behavior, and those are the ones that
went red pre-implementation and red again under mutation.

**Concerns**

- None blocking. The one deviation (moving the `opsCount` watch below its
  declaration) is a straightforward fix for a declaration-order bug in the
  brief's snippet ordering, not a change in behavior or test intent — verified
  by the mutation check landing on the same two tests either way.
- The test file's pre-existing local `createI18n` instance (named `i18n`)
  coexists with the brief's expected shared `i18n` import; I imported the
  shared one under the alias `sharedI18n` to avoid a naming collision, and
  used it only for the new `describe` block exactly as the brief's test code
  does functionally (mounting with `global: { plugins: [i18n] } }` per the
  brief becomes `global: { plugins: [sharedI18n] } }` here). Test bodies and
  assertions are otherwise verbatim from the brief.

---

### Fix round 1 (review finding: redundant i18n plugin install)

**Finding (Important, from review):** the three new `UploadPanel visibility`
tests passed `global: { plugins: [sharedI18n] }` into `mount()`, but
`vitest.setup.ts` already installs that exact same singleton globally via
`config.global.plugins` for every mount in the suite. `@vue/test-utils`
concatenates `configGlobal.plugins` with `mountGlobal.plugins` rather than
replacing them, so the same plugin object got `app.use()`'d twice per mount.
Vue dedupes by identity and warns `[Vue warn]: Plugin has already been applied
to target app.` — invisible under the default reporter (which hides stderr on
passing tests), only surfaced with `--reporter=verbose`. Ruling recorded by
the controller: this is a defect in the task-3 brief's test snippet (that's
where the redundant `global: { plugins: [i18n] }` option came from), not a
deliberate design choice, so removing it is correct.

**Fix applied:**
- `src/files/components/UploadPanel.test.ts`: dropped `{ global: { plugins:
  [sharedI18n] } }` from all three `UploadPanel visibility` mounts (now plain
  `mount(UploadPanel)`), and removed the now-unused
  `import { i18n as sharedI18n } from '../../i18n'` line. The five
  pre-existing tests and their local `createI18n` instance were not touched.
- No change to `UploadPanel.vue` — this was a test-only defect.

**Verification (Step 1 — foreground, verbose reporter):**

Command: `pnpm exec vitest run src/files/components/UploadPanel.test.ts --reporter=verbose`

Relevant output:

```
stderr | src/files/components/UploadPanel.test.ts > UploadPanel > renders active item without leaking /DATA
[Vue warn]: Component "i18n-t" has already been registered in target app.
[Vue warn]: Component "I18nT" has already been registered in target app.
[Vue warn]: Component "i18n-n" has already been registered in target app.
[Vue warn]: Component "I18nN" has already been registered in target app.
[Vue warn]: Component "i18n-d" has already been registered in target app.
[Vue warn]: Component "I18nD" has already been registered in target app.
[Vue warn]: Directive "t" has already been registered in target app.
... (same block repeats for the other 3 pre-existing tests that mount with the
    local `i18n` instance)

 ✓ src/files/components/UploadPanel.test.ts > UploadPanel > renders active item without leaking /DATA 36ms
 ✓ src/files/components/UploadPanel.test.ts > UploadPanel > shows uploaded / total bytes on an active row 7ms
 ✓ src/files/components/UploadPanel.test.ts > UploadPanel > auto-opens the panel when the queue grows from empty 6ms
 ✓ src/files/components/UploadPanel.test.ts > UploadPanel > maps error codes to zh_cn text for a problem item 5ms
 ✓ src/files/components/UploadPanel.test.ts > UploadPanel > no longer imports the per-file conflict Dialog or references its resolveConflict path 1ms
 ✓ src/files/components/UploadPanel.test.ts > UploadPanel visibility > stays hidden when neither uploads nor file operations are running 1ms
 ✓ src/files/components/UploadPanel.test.ts > UploadPanel visibility > appears for file operations alone, with no uploads queued at all 4ms
 ✓ src/files/components/UploadPanel.test.ts > UploadPanel visibility > opens itself when a file operation starts while the panel sits collapsed 7ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Confirmed: **all 8 tests pass**, and the specific `[Vue warn]: Plugin has
already been applied to target app.` warning is **gone** — it no longer
appears anywhere in the output, including on the three `UploadPanel
visibility` tests it previously appeared on. The `Component "i18n-t" has
already been registered...` warnings visible above are a *different*,
pre-existing issue confined to the five untouched pre-existing tests (which
mount with their own local `createI18n` instance layered on top of the
globally-installed one from `vitest.setup.ts`) — out of scope per the
controller's instruction not to touch those tests or their local i18n
instance, and unrelated to the finding being fixed here (that finding was
specifically about the *same singleton object* being `app.use()`'d twice, not
about two different i18n instances registering overlapping component names).

**Mutation re-check (Step 2):** mutated `panelVisible` in `UploadPanel.vue`
back to `computed(() => totalCount.value > 0)` (dropping the `opsCount`
clause) and re-ran the same command. Result: **2 failed** — exactly `appears
for file operations alone, with no uploads queued at all` and `opens itself
when a file operation starts while the panel sits collapsed` (the third,
auto-open test, confirming the fix did not weaken it), same
`expected false to be true` failure mode as before. The other 6 tests
(including the pre-existing upload-queue auto-open test) stayed green.
Restored `panelVisible` to `totalCount.value > 0 || opsCount.value > 0` and
re-ran: **8/8 passed** again. Also re-ran the wider suite,
`pnpm exec vitest run src/files/`: **121 test files / 943 tests, all passed.**

**Commit:** `f0cf4de` — "fix(files): stop double-installing i18n in UploadPanel visibility tests"
