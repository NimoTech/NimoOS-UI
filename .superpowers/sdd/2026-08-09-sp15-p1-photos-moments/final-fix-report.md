# SP15-P1 · Final whole-branch review — fix wave report

Date: 2026-08-09 · Branch: `sp15-photos-moments` · Base: `5f51060`

Six findings plus one unregistered deviation, applied in one pass. **All six findings were
verified against the sources they rest on before being implemented; all six held.** Nothing was
declined. Two caveats are carried forward for device acceptance (§Concerns).

---

## Finding 1 (Important) — a reorder drag also opens the moment

**Verified before implementing.** Two independent claims had to be checked:

1. *The composable exposes `isDragging()` and the sibling album grid uses it.* True —
   `src/photos/composables/useAlbumDragSort.ts:20-21,83-85` exposes it;
   `src/views/PhotosAlbumDetail.vue:160-163` consults it as the first statement of
   `onTileClick`, under a comment citing Vue 2 `:380-384`. `PhotosSmartViews.vue` did not.
2. *Sortable's own protection does not cover a drag that reorders.* True, read out of
   `node_modules/sortablejs/modular/sortable.esm.js`:
   - `:1596` `ignoreNextClick = true` — set when a **fallback** drag starts. This band uses
     `forceFallback: true`, so it is always the fallback path.
   - `:1013-1023` a capture-phase `document` click listener swallows one click while the flag
     is up; the source comment is *"#1184 fix - Prevent click event on fallback if dragged but
     item not changed position"*.
   - `:1741` `ignoreNextClick = false` inside `_onDragOver`. Any drag that actually moves the
     card past a neighbour fires dragover, so exactly the drags that reorder are unprotected.

**One correction to the finding's framing.** The finding implies this is a port miss. It is not:
Vue 2's Moments band has no guard either — `899af59b:PhotosSmartViewsView.vue:563-575` creates
Sortable with no `onStart` flag, and `:604-608` `onOpenMoment` only checks the AI switch. So
Vue 2 has the same defect. The fix is still right (branch rule: *the interface 1:1, the logic
correct*, and Vue 2's own **album** grid does guard) — but it is a **deviation from Vue 2 and
had to be registered as one**, which the finding did not ask for. Registered at
`PhotosSmartViews.vue` file header entry 5 and in full above `onMomentOpen`.

**Changed** (`src/views/PhotosSmartViews.vue`):
- `onMomentOpen` returns early when `drag.isDragging()`.
- Moved the function below the `useAlbumDragSort` call (it was above it), matching
  `PhotosAlbumDetail.vue`'s ordering and removing a read-before-declaration for the reader.
- File-header deviation 5 + a full rationale block above the function, including the Sortable
  line numbers above so the next reader does not have to re-derive them.

**Not changed, deliberately:** `useAlbumDragSort`'s `void nextTick(() => { dragging = false })`
reset — see §Concerns.

**Test** (`src/views/PhotosSmartViews.moments.test.ts`): *"a drag in progress suppresses the
card click, so a reorder does not also open the moment"* — captures the mocked Sortable options,
calls `onStart()`, clicks a card, asserts the route did not move off `/`.
`CapturedSortableOptions` gained `onStart`.

## Finding 2 (Important) — `doDelete` had no re-entrance guard

**Verified.** Vue 2 `899af59b:PhotosMomentDetail.vue:387-389`: `doDelete()` sets
`this.confirmDeleteOpen = false` as its **first** statement, before `await
photosService.deleteMoment(...)`. So the button is gone before a second press can land, and
Vue 2 genuinely needed no guard. Registered deviation 17 (keep the dialog open) is what opens
the window. Confirmed the sibling `pinning` / `removing` / `exporting` all guard.

**Changed** (`src/views/PhotosMomentDetail.vue`):
- New `deleting` ref: `if (deleting.value) return` at the top of `doDelete`, cleared in a new
  `finally`, and bound to the confirm button's `:disabled` (restoring the pending feedback).
- `.sv-confirm-ok:disabled { opacity: 0.5; cursor: not-allowed; }` — the same treatment
  `.sv-action-btn:disabled` already gives the action bar, so the disabled state is visible.
- **Ledger minor A:** the success path now sets `confirmDeleteOpen = false` explicitly instead
  of relying on `router.push` unmounting the page (Vue 2 `:388`,
  `PhotosSmartViewDetail.vue:332` both close unconditionally).
- **Ledger minor B:** the success toast `photosMoDeleted` now has an assertion.
- File-header deviation 22.

**Tests** (`src/views/PhotosMomentDetail.test.ts`), three new:
1. *"double-clicking Delete sends exactly one request"* — the two `trigger('click')` calls are
   deliberately **not awaited between**. Awaiting flushes nextTick, `:disabled` lands, and
   `@vue/test-utils`' `trigger()` then declines to dispatch on a disabled element — which would
   leave the case green with the JS guard deleted. Back to back, the JS guard is the only thing
   that can stop the second call. (This is what makes the mutation check below meaningful.)
2. *"disables the confirm button while the delete is in flight, and re-enables it after a
   failure"* — the `:disabled` half, plus proof the button comes back (the dialog stays up, so a
   stuck-disabled button would be a dead end).
3. *"a successful delete closes the confirmation itself and reports it with a toast"* —
   `router.push` is stubbed precisely so the unmount cannot mask the dialog's own state.

## Finding 3 (Minor) — the `:id` watcher reset only the asset fields

**Verified.** `removeSelected` reads `momentId.value` at call time (not captured at selection
time), so the described cross-moment write is real.

**Changed** (`src/views/PhotosMomentDetail.vue`): the watcher now also resets `selecting`,
`selectedIds`, `pickerOpen`, `moreOpen`, `confirmDeleteOpen`, `deleteError`, `exporting` — plus
`deleting`, which did not exist when the review was written. File-header deviation 21.

**One judgement call, recorded:** resetting `deleting` (and `exporting`) drops a re-entrance
guard mid-flight. It is safe here and I chose it for consistency: after an `:id` change the
button targets a *different* moment id, so a second press is a different request, not a
duplicate — whereas leaving the flag up would disable the new moment's Delete button for the
duration of an unrelated in-flight request, which is the stuck-control failure the T9 review
already flagged once. Both handlers' own `finally` still runs either way. Reasoning is in the
watcher comment.

**Tests**, two new: *"a selection does not survive an `:id` change"* (asserts selection **mode**
is off, not merely that the bar is hidden — re-pressing Select must reveal an empty selection)
and *"an open library picker and an open delete confirmation do not survive an `:id` change"*.

## Finding 4 (Important) — "Save as Album" lost Vue 2's primary styling

**Verified, both halves.**
- `899af59b:src/views/Photos/PhotosMomentDetail.vue:20` — `<button class="sv-action-btn"
  data-primary="true" :disabled="exporting" @click="saveAsAlbum">`.
- `899af59b:src/views/Photos/photos-smartview.scss:553-557` —
  `.photos-root .sv-action-btn[data-primary="true"] { background: linear-gradient(135deg,
  var(--accent), var(--accent-hi)); color: white; border-color: transparent; }`.
- The port emitted a plain `.sv-action-btn`, identical to Add photos / Select.
- The agreed substitute in `src/views/PhotosSmartViewDetail.vue:493-494,703-715` was read
  rather than taken on description, and matched exactly: `data-primary="true"` stays on the DOM
  for parity, styling hangs off `.sv-action-btn-primary`, and the hover rule is the **compound**
  `.sv-action-btn.sv-action-btn-primary:hover` at specificity (0,3,0) so it beats the base
  `.sv-action-btn:hover` (0,2,0) structurally rather than by source order.

**Changed** (`src/views/PhotosMomentDetail.vue`): the button carries `data-primary="true"` +
`sv-action-btn-primary`; the two CSS rules copied with a comment explaining the substitute and
the specificity choice. Colours are `var(--accent)` / `var(--on-accent)` only — `--on-accent` is
legal here because the fill is a solid accent. File-header deviation 23. Colour guard passes
(1075/1075).

**Tests**, two new: a DOM one (this button carries the marker and the class; Add photos and
Select must **not**) and a stylesheet one via the existing `cssCascade` helper
(`.sv-action-btn-primary` fills from `var(--accent)`; the winning hover selector contains
`:hover`, contains `sv-action-btn-primary`, and scores specificity **3**).

## Finding 5 (Minor) — `allLoading` raised only after `await store.ensureLoaded()`

**Verified.** Vue 2 `:292-293`: `async loadAll() { this.allLoading = true; try { … } }` — first
statement. Also verified the described path is reachable: `moments.ts:165-176` `ensureLoaded()`
was changed in an earlier fix round to `if (inFlight) { await inFlight; return }` rather than
returning early, so with `listLoaded` already true *and* a refetch in flight, the await really
does suspend while the header renders real data.

**Changed** (`src/views/PhotosMomentDetail.vue`): `allLoading.value = true` hoisted above the
await. The staleness guard is intact and slightly sharpened — the combined
`if (epoch !== loadEpoch || !moment.value) return` was split so the flag is **cleared** only
when this epoch is still current:

```
allLoading.value = true
await store.ensureLoaded()
if (epoch !== loadEpoch) return                     // a newer load owns the flag — do not clear
if (!moment.value) { allLoading.value = false; return }
```

File-header deviation 20.

**Test:** *"says 'loading' rather than 'no photos yet' while a list refetch is still in flight
underneath"* — puts a real `fetchMoments()` in flight with `listLoaded` already true, then
mounts; asserts the header is real **and** the grid shows loading, not the empty state.

> **Process note:** the first edit for this finding accidentally dropped the
> `await store.ensureLoaded()` line itself. Five pre-existing tests went red immediately and it
> was fixed before anything was committed. Recorded because the file-level test run is what
> caught it, not review.

## Finding 6 (Minor) — the three failure idioms were undocumented

**Changed** (`src/views/PhotosMomentDetail.vue` file header): a new *"How this page reports
failures"* block. It states the rule as a property of **where the user's attention already is**,
so the next task can pick without guessing:

- **toast, danger tier** — pin / exclude / export: the control is page chrome and stays put.
- **inline in the dialog** — delete (deviation 17): the user is inside a modal they must
  answer; the reply must sit by the button and must not time out.
- **page state with a retry** — the list itself (deviation 12): there is no content to put a
  message beside, so the page becomes the message and carries its own way out.

## Unregistered deviation — the MomentCard badge star

**Verified.** `899af59b:src/views/Photos/PhotosIcon.vue:1-7,189-199`: the root `<svg>` takes
`:fill="fillOverride"` and `:stroke="strokeOverride"` with `stroke-width` defaulting to **1.6**
and `stroke-linecap`/`stroke-linejoin` `round`; `fillOverride` returns the colour for `'star'`
and `strokeOverride` returns it for everything except `'play'` — so Vue 2 both fills *and*
strokes the star. `:27-29` confirms the path data is byte-identical to the port's.

**Changed:** one register entry only (`src/photos/components/MomentCard.vue` header, deviation
6). **The SVG is untouched**, as instructed — at 9px the 1.6px outline is sub-pixel.

---

## Mutation checks

Each mutation was applied to the source, the suite run, then the file restored from a byte-copy
backup. The three the brief required, plus two extra:

| # | Mutation | Result |
|---|---|---|
| **1** (required) | Deleted `if (drag.isDragging()) return` from `onMomentOpen` | `PhotosSmartViews.moments.test.ts` **1 failed / 12 passed** — only *"a drag in progress suppresses the card click…"* |
| **2** (required) | Deleted `if (deleting.value) return` from `doDelete`, kept `:disabled` | `PhotosMomentDetail.test.ts` **1 failed / 58 passed** — only *"double-clicking Delete sends exactly one request"*. Confirms the test is testing the JS guard, not the disabled attribute |
| **2b** | Deleted `confirmDeleteOpen.value = false` from the success path | **1 failed / 58** — only *"a successful delete closes the confirmation itself…"* |
| **4a** (required) | Reverted the button to plain `class="sv-action-btn"`, no `data-primary` | **1 failed / 58** — only *"is the bar's one primary action…"* |
| **4b** (required) | Weakened `.sv-action-btn.sv-action-btn-primary:hover` → `.sv-action-btn-primary:hover` | **1 failed / 58** — only *"fills that button from the accent token, and its hover rule beats the neutral base rule structurally"* (specificity 2, expected 3) |
| **3** | Deleted the watcher's eight interaction-flag resets | **2 failed / 57** — both new `:id`-change cases |
| **5** | Moved `allLoading.value = true` back below the await | **1 failed / 58** — only the new loading-state case |

Restored to green after every one (59/59).

## Command output

```
$ pnpm exec vitest run src/views/PhotosMomentDetail.test.ts \
      src/views/PhotosSmartViews.moments.test.ts --reporter=verbose
 Test Files  2 passed (2)
      Tests  72 passed (72)
```
(`PhotosMomentDetail.test.ts` 51 → **59**; `PhotosSmartViews.moments.test.ts` 12 → **13**.)

```
$ pnpm exec vue-tsc --noEmit
(no output, exit 0)

$ pnpm exec vitest run src/styles
 Test Files  4 passed (4)
      Tests  1075 passed (1075)          # unchanged, as expected

$ pnpm exec vitest run src/i18n/parity.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)                # unchanged — this wave adds no i18n keys

$ pnpm exec vitest run src/photos src/views/__tests__
 Test Files  122 passed (122)
      Tests  2464 passed (2464)          # album pages and the other photos views undisturbed
```

Full suite (`pnpm exec vitest run`) before committing: **674 passed / 4 failed files,
10742 passed / 3 failed / 70 skipped**. All four failing files are under `oss/` and all fail for
one reason, printed by the export script itself: `工作树不干净,导出中止` — the open-source
export refuses to run against a dirty working tree. They are not related to this wave (nothing
under `oss/` was touched). Re-run after the commit: see the post-commit line at the bottom.

## Files changed

| File | What |
|---|---|
| `src/views/PhotosSmartViews.vue` | F1: drag guard on `onMomentOpen`, function moved below `drag`, header deviation 5 + rationale block |
| `src/views/PhotosSmartViews.moments.test.ts` | F1: one new case, `CapturedSortableOptions` gains `onStart` |
| `src/views/PhotosMomentDetail.vue` | F2 `deleting` guard + `:disabled` + `:disabled` style + unconditional close; F3 watcher resets; F5 hoisted `allLoading` + split epoch check; F4 `data-primary` + primary class + two CSS rules; F6 failure-idiom block; header deviations 20-23 |
| `src/views/PhotosMomentDetail.test.ts` | 8 new cases (F2 ×3, F3 ×2, F4 ×2, F5 ×1), `?raw` + `cssCascade` imports |
| `src/photos/components/MomentCard.vue` | Register entry only (deviation 6). No SVG change |
| `.superpowers/sdd/.gitignore` | **Deleted** — the single-`*` file had reappeared (constraint 8). Untracked, so it was silently re-ignoring this phase's ledgers. `.superpowers/.gitignore:11 *.diff` still legitimately ignores the review diffs |
| `.superpowers/sdd/2026-08-09-sp15-p1-photos-moments/final-fix-report.md` | This file |

`src/files/**` untouched. No i18n keys added (checked first: `photosMoDeleted`,
`photosMoDeleteBody`, `photosSvDeleteFailed` all already exist in both locale files). No
`progress.md` stash.

## Concerns for device acceptance

1. **The drag guard's reset timing is unproven on a real browser** (carried forward from the
   review, deliberately not acted on). `useAlbumDragSort`'s reset is
   `void nextTick(() => { dragging = false })` — a **microtask**, which flushes between the
   `mouseup` task and the `click` task the browser dispatches afterwards. If that ordering is
   what actually happens, `dragging` is already `false` by the time the click lands and the
   guard does nothing in production, even though the unit test (which drives `onStart`/`onEnd`
   directly) passes. The correct fix would be `setTimeout(…, 0)` — **but that changes the
   composable, and therefore the album pages, which are outside this branch's remit; it would
   also mean the album grid has been unguarded all along.** Left alone on purpose. **Acceptance
   step: on the device, drag a Moments card to a new slot and release — the order must persist
   and the app must stay on the smart-views page.** If it navigates into the moment, the reset
   needs to become a macrotask, in a change that owns the album pages too.
2. **Neither the band nor this page can be exercised on the device yet** — the real `moments`
   table is 0 rows (spec §2), so the band does not render at all until a recompute is triggered
   from the console first. This is the acceptance list's step 0 and it applies to finding 1's
   check above.
3. **`.sv-confirm-ok.danger:hover` still lightens a disabled confirm button.** The base
   `.sv-action-btn:hover` in this file has the same property, so this matches the established
   idiom rather than introducing a new inconsistency; noted rather than fixed, to keep the edit
   surgical on a file four reviews have gone through line by line.
