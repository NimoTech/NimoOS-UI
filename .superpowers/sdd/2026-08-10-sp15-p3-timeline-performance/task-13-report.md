# Task 13 report — closeout: lazy-load sweep, 'doc'→'ocr' cleanup, six gates, ledger, acceptance checklist

## What changed

1. **`src/views/PhotosAlbumDetail.vue:817`** — added `loading="lazy"` to the album-detail tile
   `<img>`. This was the last grid in the photos area still eagerly loading every thumbnail;
   `PhotosGrid.vue` and `PhotosSmartViewDetail.vue` already had it. Purely additive, no other
   behavior touched.

2. **Swept the fictional `'doc'` tab id** (added item A, not in the original brief — surfaced
   by the controller during Task 7's review and left for this task):
   - `src/photos/util/gridMetrics.ts` — reworded `skeletonItemCount`'s final-branch comment to
     name the real tab id `'ocr'` explicitly, note there is no `'doc'` tab
     (`PhotosToolbar.vue:32-35` lists `all/photo/ocr/video`), and explain plainly why an
     unloaded month has no OCR estimate and stays hidden until it loads.
   - `src/photos/util/__tests__/gridMetrics.test.ts` — swapped the one `tab: 'doc'` fixture to
     `tab: 'ocr'` and reworded its description. Behavior is unchanged: `skeletonItemCount` only
     special-cases `'all'/'video'/'photo'`; every other string (including both the old `'doc'`
     and the real `'ocr'`) falls through to the same `return 0`, so the assertion still holds
     with the real tab id, and now it actually exercises `'ocr'` instead of an unused string.
   - `src/photos/components/__tests__/PhotosGrid.test.ts` — two fixes:
     - The "hides an unloaded month" test: `tab: 'doc'` → `tab: 'ocr'`. Same reasoning as
       above — `hasContent()` for an unloaded month is driven by `skeletonCountOf`, which
       falls through identically for both strings.
     - The "disables the tick of a month the current tab hides" test: this one is NOT a
       mechanical rename. The old comment explained that a *plain* photo (no `hasOcr`) was
       needed to give the "has content on this tab" month something to match under `'doc'`,
       because `'doc'` fell through to the same branch as `'photo'`
       (`!isVideo && !hasOcr`). The real `'ocr'` tab in `matchesTab` is a dedicated branch
       (`tab === 'ocr' ? p.hasOcr : ...`) that requires `hasOcr: true` — the *opposite*
       condition. So the fixture's photo had to flip from plain to `{ hasOcr: true }`, and I
       rewrote the comment to explain the real matching rule instead of the fictional one. I
       re-ran this test in isolation before and after the flip to confirm a plain photo would
       have made it fail (it does — filtered length would be 0, `hasContent` false, and the
       scrubber's own `v-if="anyContent"` would unmount the whole block, same failure mode the
       old comment described for the wrong reason).
   - Verified with `grep -rn "'doc'"` across `src/photos/` and `src/views/Photos*.vue`: the only
     remaining hit is the new comment in `gridMetrics.ts` that explicitly says the tab does not
     exist — no other leaks found.

3. **Ledger append**: added a "收官（Task 13）" closing section to
   `.superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/progress.md` (see below).

4. **Acceptance checklist**: wrote
   `docs/superpowers/2026-08-10-sp15-p3-acceptance.md` (see below).

## Six gates — real numbers (run in the foreground, on commit `85383b4`, clean tree)

| Gate | Command | Result |
|---|---|---|
| Type check | `pnpm exec vue-tsc --noEmit` | 0 errors, 19.5s |
| Full test suite | `pnpm test` | **689** test files / **11086** tests, all passed, 167.13s wall |
| Open-source export | `pnpm test oss` | **21** test files / **487** tests, all passed, 18.76s |
| Build | `pnpm build` (vue-tsc + vite build) | passed, 37.3s total (`vite build` itself 17.04s), 2727 modules |

`git status --short` was confirmed empty before `pnpm test oss` (the export gate aborts on a
dirty tree). color-guard and the strip-coverage structural guard both run inside `pnpm test` /
`pnpm test oss` — not separately timed.

Noise observed, matches the known-non-defect list, not chased: repeated jsdom
`Error: Not implemented: navigation (except hash changes)` stack traces from
`src/photos/stores/favorites.ts:207` (`exportZip`'s `location.href =` assignment) surfacing
during `favorites.test.ts` and elsewhere — jsdom does not implement real navigation, this is
pre-existing and unrelated to this task's changes. No other unexpected failures.

## Merge rehearsal

```
git merge-tree --write-tree master HEAD | head -3
```
Exit 0, single-line output: `4a2f9f05bf8f09d03ebc8c2f2637971759b01118`. No conflict. Did not
run an actual merge.

## Acceptance doc (`docs/superpowers/2026-08-10-sp15-p3-acceptance.md`)

Five steps mirroring spec §6.3, each with 点击路径/看什么/期望什么. Facts stated up front,
all verified against the brief/spec/ledger rather than assumed:
- Steps 1–4 need the owner's already-deployed backend (`/usr/bin/nimoos-photos`, built
  2026-08-10 18:48, contains `/timeline/buckets` and `/timeline/bucket`).
- Step 5 (legacy 404-fallback + 10-minute backoff) is explicitly marked as **no longer
  runnable on this device** once the new backend is live — I did not write a step that
  cannot pass just to hit a step count. Framed it as "verify now if you haven't deployed yet,
  and don't manufacture an old-backend environment just to re-run this."
- Device library is tiny (14 media files in `/DATA/Gallery`, ~785 cached thumbnail assets) —
  called out that nothing will look faster; each step verifies a mechanism (single
  `timeline/buckets` request, per-month `timeline/bucket` requests appearing on scroll and not
  repeating, `.tile` count rising/falling in Elements, scrollbar not jumping, favorites/trash
  paging with an exact total and the "based on loaded" hint, bulk actions paging in the rest
  before printing a number).
- Called out the 10-minute probe backoff and that a hard refresh is the fix if the page still
  looks old right after a backend deploy.
- Verified the exact i18n copy used in the favorites/trash "based on loaded" hint and load-more
  button against `src/i18n/zh_cn.photos.ts` (`photosLoadedSubsetHint`: "统计基于已加载的前
  {n} 项", `photosLoadMore`: "加载更多") rather than paraphrasing from memory, so the
  checklist's quoted UI text is what will actually be on screen.

## Ledger write-up

Appended "收官（Task 13）" to `progress.md` with:
- Commit range `43006b9..85383b4` (22 commits).
- The six gates' real numbers (table above).
- **Plan defects found during execution: 4** — (1) the T4-review-found
  `PhotosAlbums.vue`/`PhotosLibraryPicker.vue` empty-guard gap that became Task 8b, (2) T8's
  Chinese-comment-vs-English-rule violation resolved via the CLAUDE.md rule, (3) T8b's brief
  snippet having a real parallel-fetch ordering bug the implementer caught via TDD, (4) this
  task's fictional `'doc'` tab id sweep. Distinguished these from the plan's own two
  self-acknowledged rough edges (T2's cross-type bridge to `Month`, T8's two-month scrubber
  fixture requirement) which the plan flagged and pre-handled in advance — not counted as
  "found during execution" since the plan already knew about them.
- **Review findings by severity**: 17 minor (deferred, accepted risk — enumerated per task),
  13 Important-or-above (all closed via fix rounds, 0 left open at phase end), 0 Critical.
- All five spec §5 registered limitations, transcribed.
- The newly-registered limitations surfaced during execution (the `filteredCount`
  tab-mismatch left to T8's scope decision, Task 9's stale-bucket-count residual window, Task
  11's console-only load-more failure, Task 12's two trash-bulk-action asymmetries).
- The three spec §8 backend tickets (BE-P3-1/2/3).
- Final status line: branch `sp15-photos-moments`, not deployed, not pushed, not merged, clean
  merge rehearsal, awaiting the owner's unified acceptance pass.

## Files changed

- `src/views/PhotosAlbumDetail.vue` (+1 attribute)
- `src/photos/util/gridMetrics.ts` (comment only)
- `src/photos/util/__tests__/gridMetrics.test.ts` (1 fixture + description)
- `src/photos/components/__tests__/PhotosGrid.test.ts` (2 fixtures + 2 comments)
- `docs/superpowers/2026-08-10-sp15-p3-acceptance.md` (new)
- `.superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/progress.md` (appended)
- `.superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/task-13-report.md` (this file)

Commits:
- `85383b4` — `fix(photos): add lazy loading to album detail tiles, sweep fictional 'doc' tab`
  (code + test changes, item 1 and 2 above)
- a second `docs(sp15)` commit for the acceptance doc, ledger, and this report (see below)

## Self-review findings

- Re-ran the two touched test files in isolation before running the full suite: both green
  (59 tests across `gridMetrics.test.ts` + `PhotosGrid.test.ts`).
- Confirmed via `grep -rn "'doc'" src/photos/ src/views/Photos*.vue` that no other fictional
  `'doc'` tab reference survives outside the one comment that explicitly documents its
  non-existence.
- Confirmed the `matchesTab` direction flip (plain photo → `hasOcr: true`) is not just a
  cosmetic rename by re-reading `tabFilter.ts`'s branch order line by line: `'ocr'` requires
  `p.hasOcr`, so the un-flipped fixture would have silently broken the test's premise (both
  months contentless, scrubber unmounted) — this was worth the extra care the brief called out.
- No color/token changes, nothing to check against the theming rule.
- Did not touch `NimoOS-Photos`, did not deploy, did not push, did not merge — confirmed via
  `git status`/`git log` before finishing.

## Concerns

- None blocking. The one soft note: this task's own comment-and-fixture sweep did not go
  through a separate implementer/reviewer pass (I did the work and the self-review directly,
  as instructed for a closeout task) — flagged as such in the ledger's severity tally so it
  isn't silently folded into the phase's counted review-finding numbers.
