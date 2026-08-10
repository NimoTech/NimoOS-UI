# Task 7 report: SV detail sidebar action section + unified five-entry "..." menu

## What was implemented

`src/views/PhotosSmartViewDetail.vue`:

- New `.sv-side-actions` container at the top of `aside.sv-detail-side`, holding **Refine in
  Search** + the **"..." menu trigger** — moved verbatim (same handlers, same copy) from the
  header's `.sv-actions` row, where Task 6 had parked them.
- The header's Export button/menu and the separate "..." button/menu are both gone from
  `.sv-actions`. Their markup is now the sidebar's unified menu.
- The "..." menu is now **exactly five entries, in the target's order**: Rename · Duplicate ·
  Download as ZIP · Convert · Delete.
  - ZIP is the old Export section's `sv-export-zip` item, folded in unchanged (same
    `downloadZip` handler, same copy) as the new menu's third entry, data-test renamed to
    `sv-more-zip`.
  - "Save as static album" (`exportAlbumAction` / `sv-export-album`) is **deleted**, not
    re-homed — see "Convert vs save-as-static-album" below.
  - Rename/Duplicate/Convert/Delete keep their existing handlers and data-test ids
    (`sv-more-rename`/`sv-more-duplicate`/`sv-more-convert`/`sv-more-delete`) unchanged.
- Wired `useFixedMenuPosition(moreOpen, moreBtnRef)` (T1's composable) and bound `menuStyle` to
  the menu root's `:style`, matching `PhotosAlbumDetail.vue`'s own wiring (Task 5). `morePopRef`
  wraps the button + menu for click-outside; `moreBtnRef` only feeds the composable's rect calc.
- `<Transition name="sv-menu">` is **kept** around the unified menu, matching the Vue2 target
  (33b05636 :78), even though `PhotosAlbumDetail.vue`'s own copy of this menu (Task 5) dropped
  the transition wrapper without a registered reason. Per the phase rule ("target wins over
  brief/sibling precedent when they disagree"), the target's own transition wins here — flagged
  as a possible follow-up to bring the album page in line, not fixed in this task.

## Convert vs save-as-static-album in the target

Opened the target (`33b05636:src/views/Photos/PhotosSmartViewDetail.vue`) and grepped its own
comment history rather than guessing. The target's file **already contains the answer, dated
2026-07-31 in its own comments**: "Save as static Album 子项整体删除" ("the Save as static
Album entry is deleted entirely") — Vue2 itself killed this exact button in the same commit
range that produced the five-entry menu, keeping only the backend endpoint
(`photosService.exportSmartViewAlbum`) with no frontend caller. The target's final menu has
**five** entries, not six: Rename, Duplicate, Download as ZIP, Convert, Delete — Convert is the
sole survivor and it means "freeze the current matches into a regular album," which is a
different action from "export the current matches as a *new* static album" (the deleted one)
only in the sense that Convert also retires the smart view itself; functionally they overlap
enough that Vue2's own team judged the export-copy redundant once Convert existed.

Following the same empirically-verified precedent (not a guess), this task deletes New-UI's
`exportAlbumAction`/`sv-export-album` the same way: the function is removed from the component
entirely (was the only caller of `store.exportAlbum`). `store.exportAlbum` (`smartViews.ts`) and
`service.photos.exportSmartViewAlbum` are left untouched, mirroring Vue2's choice to keep the
backend capability while dropping the frontend trigger — same shape Vue2's own history leaves
behind. Convert (`askConvertToAlbum`/`doConvertToAlbum` → `albums.convertFromSmartView`) was
already correct and unchanged; it already matched the target's Convert semantics exactly
(freeze + stop auto-updates + navigate to the new album).

## Where the Vue2 target disagreed with the brief

The brief's own text flagged this as open ("检查它是否仍存在... 若不是同一件事,保留"). The
target settled it: there is no sixth "save as static album" entry in the final Vue2 state, so
New-UI's `exportAlbumAction` is deleted rather than folded in as a sixth menu item. This is the
only brief/target disagreement surfaced in this task.

## Five folded-in findings

**(a)** — `sortBy`/`density` are display preferences, not view-keyed write-consequential state
(unlike `edit`/`selectedIds`/`pickerOpen`/`excludedOpen`, nothing downstream reads them keyed to
a specific smart-view id, so carrying them across a navigation cannot mislabel a request).
Corrected the route watcher's comment to carve them out explicitly rather than reset them,
matching `PhotosAlbumDetail.vue`'s own route-id watcher (Task 3/4), which likewise resets
`selected`/`titleEditing`/`titleDraft`/`edit`/`pickerOpen` but leaves its own `sortBy` (and
`density`) untouched — verified by grep (`density.value =` / `sortBy.value =` never appear in
that watcher). No test added (no behavioural change; comment-only fix), consistent with the
sibling page's precedent.

**(b)** — One line in `toggleEdit`: `sortMenuOpen.value = false`, unconditional. Added a
regression test ("does not leave the sort menu stuck open after toggling edit mode via the Edit
button") and confirmed it reddens when the line is reverted (mutation below).

**(c)** — `PhotosSmartViewDetail.assets.test.ts`: renamed `enterEdit(w)` → `toggleEdit(w)`
(all 16 call sites via `sed`), matching the component's own `toggleEdit` naming. Rewrote the
"leaving edit mode clears what was selected" test's two consecutive calls with comments that add
information (`// leaves edit mode, clearing selectedIds` / `// re-enters it`) instead of
restating the old function name.

**(d)** — Added `getSmartViewExcluded: vi.fn()` to the main test file's `svc.photos` mock (with a
`mockReset().mockResolvedValue([])` in `beforeEach`), removing 77 caught-`TypeError`
`console.error` lines per run. Left `getConfig` alone, as instructed — verified it is genuinely
unmocked in the main test file and that its 79 caught-TypeError lines (from `PhotosSidebar`'s own
`fetchAiFeatures` call, not this page) are pre-existing and unrelated to this task.

**(e)** — Corrected the `sortAlbumPhotos` import comment: `albumView.ts:88` returns
`[...photos]` (a fresh shallow copy) on the fallback branch, not the list "untouched" — order is
untouched, reference is not. Verified against the actual source line.

## i18n

**Zero new keys.** Every menu-entry copy key the unified menu needs already existed and was
already in use by this page's own (now-removed) Export/More menus:
`photosSvRename`/`photosSvChangeSmartViewName`, `photosSvDuplicate`/`photosSvCopyQuerySv`,
`photosFavExport`/`photosSvNPhotosMbMb`, `photosSvConvertToAlbum`/`photosSvConvertToAlbumHint`,
`photosSvDeleteSmartView`/`photosSvPhotosStayLibrary`, and `photosSvRefineSearch` for the Refine
button. Verified each exists in `src/i18n/zh_cn.photos.ts` before writing any template code.
`photosSvSaveStaticAlbum`/`photosSvSnapshotCurrentMatchesStops`/`photosSvNameSnapshotSavedAlbum`
(the deleted capability's copy) are left in place per the "no orphan sweep this task" rule —
Task 11's job.

## TDD evidence

RED (`pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts`, before any
component changes, after test-file edits): **10 failing** — all 6 of the brief's required tests
plus the 4 re-homed tests (ZIP entries via `sv-more-zip`, the Transition-block count).

GREEN (same command, after implementation): **1200 passed (7 files)**, up from a baseline of
1197 (net +3 after re-homing/deletions — see the table below for the net accounting).

## Per-mutation results

| Mutation | Command | Result |
|---|---|---|
| Remove `:style="menuStyle"` from the menu root | `-t "applies the fixed position style"` | RED — `expected '' to contain 'position: fixed'` |
| Swap the Duplicate/ZIP entries' `data-test` (scrambles the order assertion without touching the DOM order) | `-t "renders exactly five menu entries"` | RED — order mismatch reported exactly at the swapped pair |
| Revert finding (b)'s one-line fix in `toggleEdit` | `-t "does not leave the sort menu stuck open"` | RED — `expected true to be false` (sort menu reappears after leaving edit mode) |

All three mutations reverted; full suite re-confirmed green (1200/1200) after each revert.

## Assertion re-homing table (original → new home)

| Original | New home |
|---|---|
| `导出菜单与 more 菜单 > 点导出按钮 → 菜单出现两项(ZIP / 静态相册)` | Split: ZIP existence → new `SP15-P2c Task 7 > renders exactly five menu entries in the target order`; static-album absence → new `SP15-P2c Task 7 > no longer renders a separate export section in the menu` |
| `导出菜单与 more 菜单 > photosSvNPhotosMbMb 的 {mb} 在 count=1000 时是千分位 "3,200"` | `more 菜单 > (same title)`, `sv-export-toggle`/`sv-export-zip` → `sv-more-toggle`/`sv-more-zip` |
| `导出 ZIP` describe's 3 tests (fetch+Authorization / `<a download>` / 401 toast) | Same describe, same titles/assertions, `sv-export-toggle`/`sv-export-zip` → `sv-more-toggle`/`sv-more-zip` |
| `导出相册` describe's 2 tests (success/failure toast) | **Deleted**, not re-homed — capability removal, see "Convert vs save-as-static-album" above |
| `浮层 > 先开 export 再开 more,一次 Esc 两者都关` | `浮层 > opens the sort menu then the more menu, and one Escape closes both` — same invariant (independent `if`s, no early return), re-paired onto sort-menu+more-menu since the export menu no longer exists as an independent overlay |
| `浮层 > 点菜单外部(mousedown,bubbles:true)→ 关闭` | `SP15-P2c Task 7 > still closes the menu on an outside click` (brief's own required title), `sv-export-toggle`/`sv-export-menu` → `sv-more-toggle`/`sv-more-menu` |
| `<Transition> 包裹 > 导出菜单 / more 菜单的 data-test... (expects 2 blocks)` | `the more menu's data-test marker sits inside its <Transition name="sv-menu"> pair` (expects 1 block, `sv-more-menu` only) |

Net test count: 1197 (baseline) − 2 (`导出相册` deleted) − 1 (`点菜单外部` merged into the
brief's own required test) + 6 (brief's 6 required tests) = 1200. Matches the observed count.

## Files changed

- `src/views/PhotosSmartViewDetail.vue` — sidebar action section, unified menu, script wiring,
  five folded-in-finding fixes, comment English-only fixes.
- `src/views/__tests__/PhotosSmartViewDetail.test.ts` — new Task 7 describe block (6 brief tests
  + 1 finding-(b) regression test), re-homed/deleted tests per the table above, finding-(d) mock.
- `src/views/PhotosSmartViewDetail.assets.test.ts` — finding-(c) rename.
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` — **untouched** (no new keys needed).

## Self-review

- **Completeness**: five entries present in the target's order (test-verified), sidebar
  container built and matches `PhotosAlbumDetail.vue`'s shape, header controls actually removed
  (verified no `sv-export-toggle`/`sv-export-menu` remain), all five folded-in findings addressed
  with either a fix+test (b) or a comment/mock/rename fix (a, c, d, e).
- **Quality/YAGNI**: no new CSS needed beyond `.sv-side-actions`/`.sv-more-wrap` — every menu-item
  visual class (`.sv-export-item`, `.sv-export-icon`, `.sv-export-sep`, `-danger` variants) was
  already present and is reused verbatim.
- **Discipline**: `.sv-action-btn-primary` (the deleted Export button's only consumer) is left in
  place, flagged with a comment, rather than pruned along with its dedicated hover-cascade test —
  same posture this phase already uses for i18n orphans (Task 11's job).
- **Testing**: TDD RED→GREEN shown above; 3 mutations named in the brief plus finding (b)'s own,
  all confirmed red then reverted; `--reporter=verbose` run confirms no new stderr noise (finding
  (d)'s fix actually reduced it, verified by exact TypeError-line counts before/after).
- No newly authored Chinese: `git diff --cached | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'` (before
  staging, run against the working diff) surfaced only (i) verbatim-relocated pre-existing
  Chinese comment blocks (F7 magnifier-glyph note, the danger-color-literal note) that were moved
  but not edited, (ii) one pre-existing Chinese sentence fragment left in place because only the
  comment's closing delimiter moved around it, (iii) a direct quotation of the Vue2 target's own
  Chinese comment text used as cited evidence (with an English gloss added alongside it), and
  (iv) my own English re-homing comments quoting old Chinese test-title strings for
  grep-traceability (an established convention already present in this file before this task).
  No new Chinese prose was authored.
- No color literals introduced (grepped the diff for hex/rgb/rgba outside `color-mix`).
- No `*` immediately before `/` in any new CSS comment (checked both `*/` occurrences in the
  diff — both are the intended closing delimiters).
- Click-outside still dismisses the now-`position:fixed` menu: `morePopRef` wraps both the
  button and the menu exactly as it did before (as `moreWrapRef`), and
  `onDocumentMouseDown`'s logic is unchanged apart from the rename — test-verified
  ("still closes the menu on an outside click").
- Each menu entry calls this page's own backend, not the album page's: Duplicate →
  `store.duplicateSmartView` (smartViews.ts:342), ZIP → this page's own `downloadZip`
  (POST+Authorization, not JWT-exempt), Convert → `askConvertToAlbum`/
  `albums.convertFromSmartView` (smart→regular, opposite direction from the album page's
  `AlbumConvertToSmartDialog`) — all pre-existing handlers on this page, none borrowed from
  `PhotosAlbumDetail.vue`.

## Concerns

- `PhotosAlbumDetail.vue`'s own more-menu does **not** wrap its menu in `<Transition
  name="sv-menu">`, while the Vue2 target and this page (after this task) both do. This is a
  divergence between the two "matching" detail pages that pre-dates this task (Task 5's own
  choice, unexplained in its comments) and is now slightly more visible because this task
  explicitly registered the target's transition as the tie-breaker. Not fixed here — out of this
  task's file scope — but flagged for whoever next touches the album page's menu.
- `.sv-action-btn-primary` and its dedicated hover-cascade test are now dead code (their only
  template consumer, the Export button, is deleted). Left in place and flagged in a comment,
  matching this phase's existing posture on i18n orphans, but it is still dead code sitting in
  the file until someone sweeps it.
