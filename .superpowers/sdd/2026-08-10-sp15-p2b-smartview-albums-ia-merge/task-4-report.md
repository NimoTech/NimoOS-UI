# Task 4 report: 创建融合(嵌入式智能创建表单)

## What was implemented

- `src/photos/components/SmartViewCreateDialog.vue`:
  - Added `embedded?: boolean` (default `false`) and `initialName?: string` (default `''`) props,
    and a new `close` emit (embedded-only dismissal channel).
  - `effectiveName` computed: `embedded ? initialName : draft.name`, trimmed. `canSubmit` and
    `confirm()` now use it instead of `draft.name.trim()` directly.
  - `close()` branches: embedded emits `close`; standalone keeps `update:open(false)`.
  - `onRootClick()` (new): standalone still closes on scrim self-click; embedded is a no-op
    (the host owns its scrim).
  - The Escape `document.addEventListener` in the `watch(() => props.open)` handler is now
    gated on `!props.embedded` — Escape belongs to the host in embedded mode. The two
    `removeEventListener` calls (else-branch and `onUnmounted`) stay unconditional per the
    dispatch's explicit instruction.
  - `confirm()` on success: embedded emits `created` + `close`; standalone emits `created` +
    `update:open(false)` (unchanged).
  - Template: root wrapper class/data-test switches between `sv-embed-host`/`sv-modal-scrim`;
    `.sv-modal` gets a `.sv-modal-embedded` modifier; the head block and the Name field are
    `v-if="!embedded"`; the submit button label swaps between `photosSvCreateSmartAlbum`
    (embedded) and `photosSvCreateSmartView` (standalone, unchanged).
  - CSS: added `.sv-embed-host { display: contents }` and `.sv-modal.sv-modal-embedded` (strips
    fixed width/radius/border/shadow/max-height, keeps flex column + overflow:hidden, adds
    `flex: 1 1 auto; min-height: 0`).

- `src/views/PhotosAlbums.vue`:
  - `SourceId` gains `'nimo'`; `sourceOptions` gets a 4th entry (`photosSvLetNimoDraft` /
    `photosSvLetNimoDraftHint`).
  - `selectSource(s)`: no-op click guard when `s.id === 'nimo' && aiSmartViewOff` (reuses the
    existing `aiSmartViewOff` computed directly, no synonym added). Source buttons now call
    `selectSource(s)` instead of the old inline `newAlbumSource = s.id`, and carry
    `:disabled`/`:title` for the nimo option when smart views are off.
  - `confirmCreate()` short-circuits at the top when `newAlbumSource.value === 'nimo'`.
  - `onSmartAlbumCreated()`: just calls `closeCreate()` (the store already unshifted the new
    card; no navigation).
  - Template: `.albums-modal` gets `.albums-modal-wide` when `newAlbumSource === 'nimo'`; the
    footer (`v-else`) is replaced by an embedded `<SmartViewCreateDialog :open="true" embedded
    :initial-name="newAlbumTitle" @created="onSmartAlbumCreated" @close="closeCreate" />` when
    `newAlbumSource === 'nimo'`.
  - CSS: `.albums-modal.albums-modal-wide` (width 820px, flex column, `overflow: hidden`,
    `max-height: calc(100vh - 80px)`) and `.albums-source-item:disabled`.
  - **Folded-in fix (dispatch correction 3)**: the section-subtitle flash guard now reads
    `albums.albumsLoaded && smartViews.listLoaded && mixedItems.length === 0` (was
    `albums.albumsLoaded` alone). Comment updated to explain why both are needed.

- `src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts`: 4 new keys, inserted alphabetically
  among neighbouring `photosSv*` keys —
  - `photosSvCreateSmartAlbum`: 创建智能相册 / Create Smart Album
  - `photosSvLetNimoDraft`: 让 Nimo 起稿 / Let Nimo draft it
  - `photosSvLetNimoDraftHint`: 你描述主题，交给 AI 填充 / Describe the theme, let AI fill it in
  - `photosSvSmartViewsOffCreateHint`: 智能视图已关闭——请在「设置 · AI 行为」中重新开启后再创建。
    / Smart Views are turned off — re-enable them in Settings · AI behavior to create new ones.

- Tests appended: `SmartViewCreateDialog.test.ts` (7 new cases in a new `嵌入模式(SP15-P2b Task
  4)` describe block — the 5 from the brief plus 2 I added: one asserting embedded `confirm()`
  emits `close` (not `update:open`), and one for the submit-label swap) and
  `PhotosAlbums.test.ts` (1 new flash-guard race test, 7 new host-side cases in a new
  `embedded smart-album creation (SP15-P2b Task 4)` describe block — the 5 from the brief plus
  a `close`-emit-on-cancel case and an `initial-name` wiring case).

## TDD evidence

### RED (dialog embedded mode)

```
pnpm exec vitest run src/photos/components/__tests__/SmartViewCreateDialog.test.ts --reporter=verbose
```
6 of 6 new tests failed before implementation (component had no `embedded` prop): e.g.
`expected '' to be undefined` (scrim/name-field existence checks failing because nothing was
conditional yet), `Cannot call trigger on an empty DOMWrapper` (`[data-test="sv-embed-host"]`
did not exist), `expected [ [ false ] ] to be undefined` (Escape always emitted `update:open`).

### GREEN (dialog embedded mode)

Same command after implementation: `Test Files 1 passed (1)` / `Tests 51 passed (51)`.

### RED (folded-in flash guard)

```
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts -t "does not flash the none-yet copy when albums resolve but smart views are still pending"
```
Failed before the fix: `expected '还没有相册...' to be '你创建的相册'`.

### GREEN (folded-in flash guard)

Same command after the fix: `Tests 1 passed`.

### RED (host side)

```
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts -t "embedded smart-album creation"
```
7 of 7 new tests failed before implementation: `expected false to be true` (no `source-nimo`
option), `Cannot call trigger on an empty DOMWrapper` (`[data-test="source-nimo"]` /
`[data-test="sv-embed-host"]` did not exist).

### GREEN (host side)

Same command after implementation: `Test Files 1 passed (1)` / `Tests 37 passed (37)`.

### GREEN (combined + gates)

```
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts \
  src/photos/components/__tests__/SmartViewCreateDialog.test.ts src/styles src/i18n/parity.test.ts
```
`Test Files 7 passed (7)` / `Tests 1172 passed (1172)`.

```
pnpm exec vue-tsc --noEmit
```
Clean, no output.

## Mutation self-review

Ran each of the four required mutations, confirmed RED, then reverted (via the `Edit` tool, not
`git checkout` — see the "issues" section for why that distinction mattered this round):

1. **`effectiveName` reads `draft.name` unconditionally in embedded mode** (dropped the
   `props.embedded ? props.initialName : ...` branch) → RED on "embedded mode submits the
   host-supplied name, live as the host edits it" (`expected '' to be undefined`, the confirm
   button stayed disabled after `initialName` was set because the draft's own empty `name`
   field was still being read).
2. **Removed the `!props.embedded` condition from the Escape listener** → the brief's literal
   test text (`expect(w.emitted('update:open')).toBeUndefined()`) stayed GREEN even with the
   mutation — a real test gap, found and fixed (see "issues" below) before re-confirming RED with
   the strengthened assertion (`expect(w.emitted('close')).toBeUndefined()` also required).
3. **Deleted the `confirmCreate` short-circuit** (`if (newAlbumSource.value === 'nimo') return`)
   → RED on "never creates an empty manual album when nimo is the picked source"
   (`svc.photos.createAlbum` was called with `["Trip"]` when it should never have been called).
4. **Dropped the smart-views half of the widened flash guard** (back to `albums.albumsLoaded &&
   mixedItems.length === 0`) → RED on "does not flash the none-yet copy when albums resolve but
   smart views are still pending" (`expected '还没有相册...' to be '你创建的相册'`).

All four reverted back to the correct implementation after confirming RED; final state re-verified
GREEN across the full relevant suite (1172/1172).

## Short-viewport clipping reasoning

Vue2's own comment (`PhotosSmartAlbumCreate.vue:1-30`) explains the exact failure mode this
prevents: the wrapper div (`sv-embed-host`/`sv-modal-embed-host`) sits between the host panel
and `.sv-modal`. If that wrapper kept normal block layout, it would be sized by its content's
natural height and then get clipped by the host's `overflow: hidden` on a short viewport — the
submit button (in `.sv-modal-foot`, the last child of `.sv-modal`) would be pushed below the
visible area with no way to scroll to it, because nothing in the chain had `overflow-y: auto`
engaged (the wrapper's own height, not `.sv-modal`'s internal scroll regions, would be what's
clipped).

The two-part fix breaks that chain: `display: contents` on the wrapper removes it from the box
model entirely, so `.sv-modal.sv-modal-embedded` becomes a direct flex child of
`.albums-modal-wide` (which is `display: flex; flex-direction: column; overflow: hidden;
max-height: calc(100vh - 80px)`). `.sv-modal.sv-modal-embedded` then gets `flex: 1 1 auto;
min-height: 0` — instead of being sized by its content, it is now sized to *exactly* the
remaining vertical space the host panel has left after its head/name-field/source-list. Because
`.sv-modal` was already `display: flex; flex-direction: column; overflow: hidden` (unchanged),
and `.sv-modal-body`/`.sv-modal-form`/`.sv-modal-side` already had `overflow-y: auto` (unchanged,
pre-existing rules from the standalone mode), the *internal* content (name field, chips,
threshold slider, preview rail) is what scrolls on a short viewport — `.sv-modal-foot` (holding
the submit button) is a sibling flex item of `.sv-modal-body` inside the now-fixed-height
`.sv-modal`, so it always stays at its natural height at the bottom, never pushed off-screen.

I did not verify this with a real short-viewport screenshot (no dev server / browser session in
this task's scope), but traced the CSS chain rule-by-rule against the DOM structure the template
actually produces and confirmed every rule in the chain (`display: contents` → flex parent →
`flex: 1 1 auto; min-height: 0` → existing `overflow-y: auto` on the three inner panes) is
present and unbroken. This is the same reasoning Vue2's own header comment gives for why it
moved from a zero-CSS `sv-embed`/`sv-embed-panel` approach (which lost this scroll structure) to
the `display: contents` + modifier-class approach ported here.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/components/SmartViewCreateDialog.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/photos/components/__tests__/SmartViewCreateDialog.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosAlbums.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/__tests__/PhotosAlbums.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/zh_cn.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/en_us.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/.superpowers/sdd/2026-08-10-sp15-p2b-smartview-albums-ia-merge/progress.md`

Commit: `0597929 feat(photos): fold smart-album creation into the New album panel`.

## Self-review findings

All the self-review checklist items pass:

- Embedded mode drops scrim + head + name field (v-if guards on all three) — confirmed by test.
- `effectiveName` is used by both `canSubmit` and `confirm()` (not just one of them).
- Standalone mode's markup/behaviour is byte-for-byte unchanged (head/name-field always render,
  scrim self-click still closes, Escape still handled, button label still
  `photosSvCreateSmartView`) — confirmed by the "standalone mode still owns its scrim, header and
  name field" test plus the pre-existing 45 tests all staying green.
- Fourth source is present, `disabled` + `title` when `aiSmartViewOff`, and click-guarded via
  `selectSource()`.
- Panel widened (`.albums-modal-wide`) exactly when `newAlbumSource === 'nimo'`.
- Host footer hidden (`v-else` on the same condition that mounts the embedded dialog) — exactly
  one of the two can ever be in the DOM.
- `confirmCreate()` short-circuits before touching `newAlbumTitle`/`creating` state.
- Success (`@created`) just calls `closeCreate()` — no `router.push`, confirmed by the "closes the
  whole panel once the embedded form reports success" test's explicit
  `expect(push).not.toHaveBeenCalledWith(...)`.
- Flash guard now requires both `albums.albumsLoaded` and `smartViews.listLoaded`.

One thing I found and fixed during self-review, beyond what was asked: the brief's literal test
text for "embedded mode leaves Escape to the host" only asserted `update:open` stayed undefined,
but that assertion is satisfied even if the Escape listener *does* fire in embedded mode — because
`close()` itself already branches on `embedded` and would emit `close` (not `update:open`)
regardless of whether the listener should have been attached at all. I strengthened the test to
also assert `close` stays undefined, confirmed it still passes with the correct implementation,
and confirmed it goes red with the `!props.embedded` guard removed (whereas the original,
unstrengthened assertion did not go red under that same mutation — verified both ways before
finalizing).

## Issues or concerns

- **Tooling near-miss, self-corrected**: while running mutation check (a), I used `git checkout
  -- src/photos/components/SmartViewCreateDialog.vue` intending to revert only a `sed`-applied
  one-line mutation. Since the file was already modified relative to HEAD (my entire Task 4
  implementation), this reverted *all* of my changes to that file, not just the mutation. Caught
  immediately via `git diff`/`grep` showing the file back at its pre-Task-4 state, and re-applied
  every edit from scratch using the `Edit` tool (verified against the diff I had already reviewed).
  No data was lost since nothing had been committed yet, but it cost a redo cycle. For the
  remaining three mutation checks I used the `Edit` tool exclusively for both the mutation and the
  revert, which is safe regardless of the file's prior modification state.
- **`pnpm test` full-suite run before commit could not be made to pass** as the dispatch's Step 8
  literally requests ("run once before the final commit"): the `oss/` export test suite's fixtures
  call `export.mjs`, which refuses to run against a dirty git working tree by design (a real
  guard against accidentally publishing a partial state to the public mirror, not a bug). Since
  my task's own changes are themselves the source of that "dirty" state until committed, running
  `pnpm test` pre-commit necessarily fails 3 assertions + 2 whole-file skips, all inside `oss/`,
  all traceable to `git status` and nothing else. Confirmed by stashing my changes and re-running
  just those files (6/6 pass on a clean tree). Resolved by running the brief's exact focused-test
  list (Step 8's literal command) + `vue-tsc` before commit (both clean), committing, then running
  the full `pnpm test` once more on the now-clean/committed tree:
  ```
  pnpm test
  ...
   Test Files  685 passed (685)
        Tests  10900 passed (10900)
  ```
  All 685 files / 10900 tests pass. `pnpm exec vue-tsc --noEmit` re-confirmed clean post-commit
  as well.

## Fix report (review round 1)

The review confirmed spec compliance on all three dispatch overrides and independently verified
`effectiveName`, the CSS flex chain, the two-exit contract, and the strengthened Escape test. It
found one Important and four cheap Minors; all five addressed below.

### Important — embedded Cancel path was untested, and a test title claimed otherwise

**Root cause**: the embedded/standalone dismissal decision was written twice — once in `close()`,
once inline in `confirm()`'s success handler. `close()`'s copy is what the ghost Cancel button and
the header X button call; `confirm()`'s copy only runs on successful submit. A test titled
`'embedded mode emits close (not update:open) on cancel and on successful create'` only exercised
the confirm-success path, never clicking Cancel — so the Cancel path had zero coverage while the
title claimed otherwise. The reviewer's own reproduction was exact: reverting `close()`'s embedded
branch to an unconditional `emit('update:open', false)` left every existing test green.

**Fix**:
1. Extracted a single `dismiss()` function (`SmartViewCreateDialog.vue`) holding the
   embedded/standalone branch, and routed every caller through it: the header close button, the
   Cancel button, `onRootClick()`, `onDocumentKeydown()`, and `confirm()`'s success handler. Removed
   the now-redundant `close()` wrapper entirely rather than keeping it as a thin alias, so there is
   exactly one place this decision can be written.
2. Added the missing test (`'embedded mode emits close (not update:open) when Cancel is clicked'`):
   mounts embedded, clicks `.sv-btn-ghost`, asserts `close` is truthy and `update:open` stays
   undefined.
3. Retitled the pre-existing test to `'embedded mode emits close (not update:open) on successful
   create'` — it only ever covered the confirm-success path, so the title no longer overclaims.

**Covering test run**:
```
pnpm exec vitest run src/photos/components/__tests__/SmartViewCreateDialog.test.ts --reporter=verbose
```
`Test Files 1 passed (1)` / `Tests 52 passed (52)` (51 previous + 1 new Cancel test).

**Mutation check on the new Cancel test** (exactly as the reviewer specified): changed `dismiss()`
to unconditionally `emit('update:open', false)`, ignoring `props.embedded`:
```
pnpm exec vitest run src/photos/components/__tests__/SmartViewCreateDialog.test.ts -t "embedded mode emits close \(not update:open\) when Cancel is clicked" --reporter=verbose
```
RED: `AssertionError: expected undefined to be truthy` on `expect(w.emitted('close')).toBeTruthy()`
— the new test does catch the exact regression the reviewer described. Reverted the mutation
immediately after confirming red; re-ran the same command to confirm green again before moving on.

### Minor 2 — weak "no navigation" assertion (`PhotosAlbums.test.ts`)

Changed `expect(push).not.toHaveBeenCalledWith('/photos/smart-views/sv-new')` to
`expect(push).not.toHaveBeenCalled()` in `'closes the whole panel once the embedded form reports
success'`. Verified `push` is never called anywhere in that test's path up to the assertion (the
one `router.push('/photos/albums')` call inside `mountAlbums()` happens *before* the `push` spy is
attached to the router instance, so it does not count) — the stronger assertion is not a false
tightening.

### Minor 3 — hardcoded Chinese literal in an assertion (`PhotosAlbums.test.ts`)

Changed `expect(opt.attributes('title')).toContain('智能视图已关闭')` to
`expect(opt.attributes('title')).toContain(zh.photosSvSmartViewsOffCreateHint)`, matching the
sibling assertions in the same file that reference the imported `zh` module.

### Minor 4 — new `describe` title in Chinese (`SmartViewCreateDialog.test.ts`)

Translated `describe('嵌入模式(SP15-P2b Task 4)', ...)` to
`describe('embedded mode (SP15-P2b Task 4)', ...)`. Left every pre-existing Chinese `describe`
title in the same file untouched, per the brief's "translate only what you're editing" rule.

### Full covering-test + type-check run after all five fixes

```
pnpm exec vitest run src/photos/components/__tests__/SmartViewCreateDialog.test.ts src/views/__tests__/PhotosAlbums.test.ts --reporter=verbose
```
`Test Files 2 passed (2)` / `Tests 89 passed (89)` (52 dialog + 37 host).

```
pnpm exec vue-tsc --noEmit
```
Clean, no output.

Per the coordinator's explicit instruction, the full `pnpm test` suite was **not** re-run for this
fix round — the two files above plus the type gate are the stated scope.

Commit: `e66e4e6 fix(photos): unify embedded/standalone dismissal into one function` (3 files
changed, 45 insertions, 25 deletions).

## Corrections to the brief that turned out to be wrong or incomplete

1. **The brief's CSS class names for the embedded wrapper don't match the actual Vue2 source.**
   I read the real `939a7d3a:src/views/Photos/PhotosSmartAlbumCreate.vue` and
   `photos-smartview.scss` directly (not just the dispatch's paraphrase) and found Vue2's real
   class names are `sv-modal-embed-host` (wrapper) and `sv-modal.sv-modal-embedded` (modifier) —
   not `sv-embed-host` as the brief's Step 3 CSS block writes. I kept the brief's `sv-embed-host`
   name for the wrapper (its test fixtures hard-code that `data-test` string) and registered the
   naming discrepancy in a CSS comment; the modifier class (`sv-modal-embedded`) does match Vue2
   verbatim. This is cosmetic only — no behavioural difference — but worth flagging since the
   brief presented it as if quoting Vue2 literally.
2. **Vue2's `PhotosSmartAlbumCreate.vue` has no `update:open` contract at all** — I read further
   into the file than the dispatch's quoted line ranges and found `closeCreate()` unconditionally
   emits `'close'` for every dismissal path (button, Cancel, scrim), because this Vue2 component
   was never used standalone with prop-driven visibility; it only ever existed embedded, controlled
   by the host's own `v-if`. The "keep `update:open` for standalone, add `close` for embedded"
   design in the dispatch is therefore not a literal port of a Vue2 branch — it's a novel
   adaptation forced by the fact that New-UI merged two separate Vue2 files (the embedded-only
   `PhotosSmartAlbumCreate.vue` and the standalone dialog embedded in
   `PhotosSmartViewsView.vue`) into one Vue3 component with one shared prop contract. The dispatch
   already told me this ("Vue2 never had a v-model contract to begin with") but I'm restating it
   here with the source citation since it's easy to misread the brief's `:322`/`:325` line
   references as implying a literal `update:open` branch exists somewhere in Vue2 — it does not.
3. **Two i18n key insertion points needed judgment calls** since the existing `photosSv*` block in
   both locale files is not strictly alphabetical (confirmed by reading ~150 lines of existing
   keys before inserting) — I placed the four new keys at the alphabetically-closest existing
   neighbours (`photosSvCopyQuerySv`/`photosSvCreateSmartView`, `photosSvLastUpdatedTime`/
   `photosSvLive`, and right after `photosSvSmartViewsAutoUpdate`), matching the file's general
   (if imperfect) ordering convention rather than either strict alphabetical order or pure
   append-at-end.
4. **A real test-coverage gap in the brief's own test text** (documented above under "mutation
   self-review" item 2 and "self-review findings") — the brief's literal "leaves Escape to the
   host" test body does not actually distinguish "the listener never fired" from "it fired and
   took the embedded branch", because `close()` already branches on `embedded`. This is exactly
   the kind of gap the dispatch's own closing instruction ("A test that stays green through its
   own mutation is worse than no test") warns about, and it was present in the brief's supplied
   test code, not something I introduced. Fixed by adding the `close`-emit assertion.
