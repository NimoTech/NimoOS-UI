# Task 10 report: save a moment as an album, and delete a moment

Commit: `ae577c7` — "feat(photos): save a moment as an album, and delete a moment"
(4 files staged exactly as the brief's commit command lists: `PhotosMomentDetail.vue`,
`PhotosMomentDetail.test.ts`, `zh_cn.photos.ts`, `en_us.photos.ts`. `progress.md` was left
untouched — it is not in the brief's file list and is controller-owned.)

## What was implemented

`src/views/PhotosMomentDetail.vue`:

- **Save as Album** button (`mo-save-album`) in the action bar, disabled while `exporting` is
  true. Calls `store.exportAlbum(momentId)`; on success shows a toast with an "Open" action
  that navigates to `/photos/albums/:id`; on failure shows a danger toast, with the 409
  (name-clash) case getting its own wording instead of the generic failure message.
- **More menu** (`mo-more` button → `mo-more-menu` dropdown → `mo-delete` item), reusing
  `PhotosSmartViewDetail.vue`'s `.sv-export-menu`/`.sv-export-item*` classes and its
  `sv-menu` transition, restated in this file's own `<style scoped>` block (scoped styles do
  not cross component boundaries in this repo — same technique this file already used for the
  action bar and photo grids).
- **Document mousedown listener** (`onDocumentMouseDown`) that closes the more menu when a
  click lands outside it — registered in `onMounted`, removed in `onBeforeUnmount`. This is
  the debt Task 7 deliberately left for this task (no menu existed yet at T7, so the listener
  would have had a dead body).
- **Delete confirmation dialog** (`mo-delete-confirm` scrim → `mo-delete-go`/`mo-delete-cancel`
  buttons), structure and CSS classes (`sv-confirm-*`) copied verbatim from
  `PhotosSmartViewDetail.vue`'s own delete dialog, per the task's explicit "do not build a
  second dialog idiom" instruction. `doDelete()` calls `store.remove(momentId)`; on success
  toasts and navigates to `/photos/smart-views`; **on failure it does NOT close the dialog and
  does NOT toast** — it sets `deleteError`, rendered as `mo-delete-error` inside the dialog,
  right above the Cancel/Delete buttons.

## TDD evidence

**RED** — reverted the `.vue` file to its pre-T10 state (`git stash` on that one file only,
kept the i18n/test edits), then ran the new + existing tests:

```
$ pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose
...
 Test Files  1 failed (1)
      Tests  11 failed | 40 passed (51)
```

All 11 new tests failed for the expected reason (`Cannot call trigger on an empty DOMWrapper` —
`mo-save-album`/`mo-more`/`mo-delete*` did not exist yet; the listener-teardown test failed
because 0 mousedown listeners were registered). All 40 pre-existing tests still passed,
confirming the revert didn't collaterally break anything already in place.

**GREEN** — restored the T10 implementation (`git stash pop`) and reran:

```
$ pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose
...
 Test Files  2 passed (2)
      Tests  60 passed (60)
```

60 = 51 in `PhotosMomentDetail.test.ts` (40 pre-existing + 11 new for this task) + 9 in
`parity.test.ts`. The brief predicted "37" for the detail-page file total — actual is 51; per
the standing note, brief counts are estimates and have been wrong every task so far.

Two fixes were needed to get from RED to GREEN cleanly, both in the test file (not the brief's
literal snippet, which turned out to be wrong on both counts):

1. **The 409 test's expected substring was wrong.** The brief's draft asserted
   `toContain('已存在')`, but Vue 2's own `zh_CN.json` (899af59b:src/assets/lang/zh_CN.json:1960)
   translates "An album with this name already exists" as `已有同名相册` — which does not
   contain `已存在`. Asserting that substring would check a mistranslation, not Vue 2's real
   copy. Fixed to `toContain('已有同名')`, with a mutation-check line confirming the generic
   failure message does not also satisfy it (so a regression collapsing the 409 branch into the
   generic one would still fail the test). Also had to add `mountDetail('m1', 'zh_cn')` — the
   brief's snippet called `mountDetail()` with no locale, which defaults to `en_us` and could
   never have matched a Chinese substring in the first place.
2. **`router.isReady()` doesn't wait for a *second* navigation.** The save-as-album success
   test calls the toast action's `onClick`, which fires `router.push(...)`. `router.isReady()`
   had already resolved during `mountDetail`'s own initial navigation, so awaiting it again
   returns almost immediately and does not wait for the push triggered by `onClick`. Swapped to
   `flushPromises()`. Also had to register a matching route (`/photos/albums/:id`) in the test's
   router — vue-router 4 does not move `currentRoute` off an unmatched path, it stays put and
   only warns "No match found", so the original two-route fixture would have made the assertion
   fail regardless of the wait-strategy fix.

## Listener teardown verification

Added a dedicated test (`removes its document mousedown listener on unmount, leaking none`)
that spies on `document.addEventListener`/`removeEventListener`, counts how many `'mousedown'`
registrations happened during mount, calls `wrapper.unmount()`, and asserts the same count of
`'mousedown'` removals happened. This is stronger than "a listener exists" — it fails if the
listener is installed but never torn down, which is exactly the leak this task was warned about
owing from Task 7.

## PhotosSmartViewDetail.vue dialog: reused vs. added

**Reused verbatim** (classes and structure, `<style scoped>` bodies copied unchanged):
`sv-export-menu`/`sv-more-menu`/`sv-export-item`/`sv-export-icon`/`sv-export-title`/
`sv-export-desc`/`sv-export-item-danger`/`sv-export-icon-danger`, the `sv-menu` transition, and
the entire `sv-confirm-*` family (`scrim`/`panel`/`icon`/`title`/`body`/`foot`/`cancel`/`ok`) plus
its `sv-confirm` transition. The `@click.self="closeDeleteConfirm"` overlay-dismiss pattern on
the scrim is identical too.

**Added, not present in the source dialog**: `.mo-delete-error` — the inline failure paragraph
(deviation 17). `PhotosSmartViewDetail.vue`'s own delete flow has no inline error state (its
`doDelete` closes the dialog unconditionally and toasts on both outcomes), so there was nothing
to reuse there; this is new CSS using `var(--remove-fg)`, matching the danger family already
used by the confirm button beside it.

**Not reused**: the keydown-Escape system (`onDocumentKeydown`/`anyOverlayOpen` watcher) that
`PhotosSmartViewDetail.vue` has for its richer three-overlay setup (export menu + more menu +
confirm dialog). Vue 2's moment component (899af59b:PhotosMomentDetail.vue) never had Escape
handling either — only the mousedown-closes-more-menu listener — so porting the richer pattern
here would be adding behavior Vue 2 never had, not reproducing it. Confirmed by reading Vue 2's
`mounted()`/`beforeDestroy()`, which register/unregister only the one mousedown listener.

## Deviations from Vue 2 (file-header deviations 16-19, logged in the `.vue` file itself)

16. The document mousedown listener is Task 7's deferred debt — now installed with its
    teardown, not left dangling.
17. A failed delete's message is inline in the dialog (`deleteError`), not a toast — Vue 2
    closes the dialog and toasts, which reads as "it worked" for the second or so before the
    toast text registers.
18. The 409 case gets its own wording (`photosMoAlbumExists`) rather than the generic failure —
    same branch Vue 2 already has.
19. **Six of the brief's thirteen proposed i18n keys were duplicates of existing keys**, found by
    checking Vue 2's own `zh_CN.json`/`en_US.json` against this repo's existing `photos*.ts`
    content before adding anything new (the task's own instruction: "before adding a key, check
    whether an existing one already says the same thing"):
    - `photosMoOpen` → **`photosPlacesToastOpen`** ('打开'/'Open') — same toast-action use as
      `PhotosPlaces.vue:306`.
    - `photosMoPhotosStay` → **`photosSvPhotosStayLibrary`** ('照片仍保留在你的图库中') — the
      more-menu delete item's own description, word for word, already added for the smart-view
      page's identical menu item.
    - `photosMoDeleteTitle` → **`photosSvDeleteName`** ('Delete "{name}"?') — same `{name}` param,
      same literal Vue 2 string used for both moments and smart views.
    - `photosMoDeleteFailed` → **`photosSvDeleteFailed`** ('删除失败').
    - `photosMoCancel` → **`photosCancel`** ('取消') — the same reuse
      `PhotosSmartViewDetail.vue`'s own confirm dialog already makes.
    - `photosMoDelete` → **`photosDelete`** ('删除') — likewise.

    The seven genuinely new keys (`photosMoSaveAsAlbum`, `photosMoAlbumCreated`,
    `photosMoAlbumExists`, `photosMoAlbumFailed`, `photosMoDeleteMoment`, `photosMoDeleteBody`,
    `photosMoDeleted`) are all Vue 2's own `zh_CN.json`/`en_US.json` copy, taken verbatim
    (899af59b:src/assets/lang/{zh_CN,en_US}.json), not retranslated.

## Gate results

- `pnpm exec vue-tsc --noEmit` — **clean**, no output.
- `pnpm exec vitest run src/i18n/parity.test.ts` — **9/9 passed**.
- `pnpm exec vitest run src/styles` — **1075/1075 passed** (matches the brief's predicted count
  exactly, for once).
- `pnpm exec vitest run oss` — ran twice:
  - Before committing: 375 passed / 3 failed / 70 skipped (448 total) — the 3 failures were the
    tree-must-be-clean precondition tripping on the controller's `progress.md` plus my own
    then-uncommitted files.
  - After committing (only `progress.md` still dirty, which is controller-owned and out of
    scope for this task — **not stashed, per instruction**): same 375/3/70 split, still the
    `progress.md` dirty-tree failure. This matches the brief's stated 448-clean-tree total; the
    3 failures are a pre-existing condition of this worktree, not something this task
    introduced or can fix without touching a file it was told not to touch.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosMomentDetail.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosMomentDetail.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/zh_cn.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/en_us.photos.ts`

Also deleted (not committed, not tracked): a reappeared `.superpowers/sdd/.gitignore` containing
a single `*`, per instruction 10 — it blocks nothing tracked, just removed and left alone.

## Self-review

- **Document listener removed on unmount?** Yes — verified by a dedicated test spying on
  `addEventListener`/`removeEventListener` counts across mount→unmount, not just "a listener
  exists somewhere".
- **Does a failed delete really keep the user on the page with the dialog open and the message
  inline?** Yes, and strengthened beyond the brief: the test also asserts
  `expect(show).not.toHaveBeenCalled()` — i.e. this isn't "a toast that just hasn't rendered
  yet", no toast call happens on this path at all.
- **Is the export button genuinely disabled while in flight?** Yes — checked via
  `element.disabled` (not just the presence of the `disabled` attribute string) both while the
  mocked promise is pending and after it resolves (re-enabled).
- **Would the 409-wording and inline-error tests still pass if the behavior were removed?**
  Checked by construction: the 409 test asserts a substring (`已有同名`) that is provably absent
  from the generic-failure string (asserted inline in the same test), so collapsing the two
  branches fails it. The inline-error test asserts both presence of `mo-delete-error` and
  absence of any toast call, so "close the dialog and toast instead" (Vue 2's actual behavior)
  would fail on the second assertion even if it happened to also render some element.
- **Pristine test output?** Yes — reran with `grep -i "warn\|stderr\|error"` after fixing the
  409 test's unmuted `console.error` (it now uses `muteConsoleError()`, matching every other
  rejected-promise test in this file); no `[Vue warn]` anywhere.

## Concerns

None outstanding. The two test-file corrections (409 substring, router-wait strategy) are
documented inline in the test file itself and above, so a future reader hitting the same brief
text won't repeat the same dead end.
