# Task 5 report: album detail "..." menu (five entries) + sidebar container + fixed positioning

## What was implemented

`src/views/PhotosAlbumDetail.vue`:

1. **Built `.sv-side-actions`** at the top of `aside.sv-detail-side`, above the About section
   (target 33b05636:PhotosAlbumDetail.vue :211-283). Holds a single child (the "..." button +
   menu) — New-UI never carries a Slideshow button; the target's own version only ever popped a
   "coming soon" toast, and no tile-fullscreen player exists in this codebase to open. Kept
   `flex-wrap` anyway to match the target's own container shape (restated CSS, since scoped
   styles don't cross SFCs in this repo, per the phase's standing KEEP-THE-DUPLICATION ruling).
2. **Moved the "..." menu** out of its Task-3 parking spot in the header's `.sv-actions` into the
   new container. `morePopRef` (click-outside wrapper) stayed; added the new `moreBtnRef` bound
   directly to the `<button>`, per the brief — the composable only reads the button's rect, it
   doesn't touch open/close.
3. **Expanded the menu to five entries**, in the target's fixed order: Rename, Duplicate,
   Download as ZIP, Convert, Delete. Titles shortened per #117 (Rename album→Rename, Convert to
   Smart Album→Convert, Delete album→Delete); desc lines kept the longer disambiguating copy.
4. **Wired T1's `useFixedMenuPosition(menuOpen, moreBtnRef)`**, binding the returned `menuStyle`
   to the menu root's `:style`. The menu is now `position: fixed`, computed from the button's
   rect, and no longer clips against the sidebar's own `overflow-y: auto`.
5. **New handlers**: `duplicateAlbum()` (thin wrapper around T2's `albums.duplicateAlbum`) and
   `downloadZip()` (GET+token navigation via T2's `service.photos.exportAlbumZipUrl`).
6. **Folded-in fix**: `onPickerConfirm`'s success-toast name now comes from a new
   `pickerAlbumName` ref, snapshotted alongside `pickerAlbumId` in `openPicker()`, instead of
   reading the live `album.value?.title` computed at resolve time.
7. Added CSS: `.sv-side-actions` (restated from Vue2 photos-smartview.scss) and
   `.sv-action-btn-icon` (restated from `PhotosSmartViewDetail.vue:1018`) for the icon-only
   toggle button.

## The Vue2 target vs the brief — where they disagreed

The brief pointed at `PhotosSmartViewDetail.vue`'s `downloadZip` as the precedent for the ZIP
entry's navigation mechanism. Reading that function shows it does a `fetch` + `Authorization`
header + blob download — because that endpoint (`/v1/photos/smart-views/:id/export`) is
**POST-only and not JWT-exempt**. Reading the actual Vue2 target's `runExportZip`
(33b05636:PhotosAlbumDetail.vue:736-738) shows the opposite: `window.location.href =
photosService.exportAlbumZipUrl(this.album.id)` — a plain GET+token navigation, matching this
page's own `exportAlbumZipUrl` (T2, JWT-exempt via query token, same shape as
`favorites.ts`'s `exportZip`). **Followed the target and `favorites.ts`, not the brief's
pointer** — the two backend endpoints have genuinely different contracts, and copying
`downloadZip`'s fetch+blob mechanism here would have been solving a problem (missing
Authorization header) that this endpoint doesn't have.

Test-technique consequence: `window.location.href = ...` throws jsdom's "Not implemented:
navigation" to stderr (it doesn't actually navigate or update `location.href` in jsdom) — the
exact same behaviour `favorites.ts`'s own `exportZip` already produces in its existing tests
(`src/photos/stores/__tests__/favorites.test.ts`, `src/views/__tests__/PhotosFavorites.test.ts`).
Rather than asserting on the (jsdom-unreliable) `location.href` value, the new test asserts the
service call instead (`expect(svc.photos.exportAlbumZipUrl).toHaveBeenCalledWith('a1')`), which
is assertable without depending on real navigation — this is the established pattern in this
codebase for the same class of GET+token export link.

No other target/brief disagreements found. The brief's five-entry table, key names, and
`~3.2 MB/photo` constant all held up against the target; only the concrete i18n key *names*
in the brief's table turned out to be mostly replaceable by existing keys (see below).

## i18n — new vs reused

Grepped `zh_cn.photos.ts`/`en_us.photos.ts` before adding anything, then cross-checked every
candidate against the actual Vue2 target's `src/assets/lang/zh_CN.json` (not just its English
literal) to confirm exact-text reuse, not a near-synonym:

| Slot | Key used | New or reused |
|---|---|---|
| Rename title | `photosSvRename` | Reused (PhotosSmartViewDetail's own short "Rename"; target zh_CN.json confirms `"Rename": "重命名"`) |
| Rename desc | `photosAlbumRenameHint` | Unchanged (already correct) |
| Duplicate title | `photosSvDuplicate` | Reused (target: `"Duplicate": "复制"`) |
| Duplicate desc | `photosAlbumDuplicateHint` | **New** — no existing key matched "Copy the photos as a new album" (target zh: "把照片复制为一个新相册") |
| Duplicate success toast | `photosSvDuplicatedNameOpenCopy` | Reused — target's own literal copy for this exact toast (`'Duplicated "{name}" — open the new copy from the list'`) already lives under this key for the smart-view sibling |
| Duplicate 409 toast | `photosAlbumNameExists` | Reused — target's `duplicateAlbum` reuses the same "name already exists" copy the rename path uses for its own 409 |
| Duplicate failure toast | `photosSvDuplicateFailed` | Reused (target: `"Duplicate failed": "复制失败"`) |
| ZIP title | `photosFavExport` | Reused (target: `"Download as ZIP": "下载为 ZIP"`) |
| ZIP desc | `photosSvNPhotosMbMb` | Reused — exact `'{n} 张照片 · 约 {mb} MB'` interpolation shape, already used by `PhotosSmartViewDetail.vue`'s own zip entry |
| ZIP toast | `photosSvPreparingZipNPhotos` | Reused (target: `"Preparing ZIP — {n} photos"`) |
| Convert title | `photosAlbumMenuConvert` | **New** — no existing generic "转换"/"Convert" key in the photos domain (`appsCustomConvert` exists but is a different domain/feature) |
| Convert desc | `photosAlbumConvertToSmartHint` | Unchanged (already used here; noted below) |
| Convert disabled tooltip | `photosSvSmartViewsOffCreateHint` | Already wired by Task 3 — no change needed |
| Delete title | `photosDelete` | Reused (target: `"Delete": "删除"`) — already used by `PhotosMomentDetail.vue`/`PhotosSmartViewDetail.vue` for the same "Delete" button copy |
| Delete desc | `photosAlbumDeleteHint` | Unchanged (already used here) |

**Net new keys: 2** — `photosAlbumMenuConvert` and `photosAlbumDuplicateHint`, added to both
`zh_cn.photos.ts` and `en_us.photos.ts`. The old long-form keys `photosAlbumRename` and
`photosAlbumConvertToSmart` lose their only reference in this file but were **not deleted** per
the brief's instruction (Task 11 does the orphan sweep). `photosAlbumDelete` keeps its second
reference (the delete-confirm modal's button) and is therefore not orphaned at all.

**Aside, out of scope**: while cross-checking against the target's zh_CN.json I found that this
page's existing `photosAlbumConvertToSmartHint` ("Nimo 会自动持续加入匹配的新照片") and
`photosAlbumDeleteHint` ("照片会保留在图库中") both drift slightly from the target's current
copy ("转为持续自动更新的智能相册" / "照片仍保留在你的图库中你的图库中"[sic, target has "你的
图库中"]). This predates Task 5 (an earlier task's decision) and the brief explicitly says to
keep desc lines unchanged here, so I left both as-is and am only flagging the drift for the
record.

## TDD evidence

**RED** — `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts` after writing all
nine new tests in the `P2c album more menu` describe block plus the folded-in toast-name
regression test, before touching the component:

```
Test Files  1 failed (1)
     Tests  8 failed | 72 passed (80)
```

(8 of 9 new menu tests failed for the expected reasons — missing entries, missing
`.sv-side-actions`, `Cannot call trigger on an empty DOMWrapper` for `album-menu-duplicate`/
`album-menu-zip`, `attributes('style')` undefined. The 9th — "closes the menu when clicking
outside it" — passed even before implementation, since that behaviour was already correct and
unaffected by this task; kept per the brief as an explicit regression check.)

**GREEN** — after implementing:
`pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles`:

```
Test Files  6 passed (6)
     Tests  1167 passed (1167)
```

Re-ran with `--reporter=verbose`: only pre-existing noise present — the file-wide
`[Vue warn]: Component "i18n-*"/"I18nT" has already been registered` lines (present on every
test in this file already, unrelated to this task) and one `Error: Not implemented: navigation`
per test that exercises `downloadZip` — the exact same jsdom limitation `favorites.ts`'s own
`exportZip` already produces in its existing tests. No new/unexpected stderr from this task's
own code (confirmed the re-entry catch in `duplicateAlbum` never logs for the expected-rejection
path).

## Mutation verification (Step 5) — all four confirmed load-bearing

1. **Swapped the Duplicate and Download-as-ZIP `<button>` blocks.**
   `pnpm exec vitest run ... -t "renders exactly five entries"` → red:
   `['重命名', '下载为 ZIP', '复制', '转换', '删除']` vs expected order. Reverted; suite green.
2. **Removed `:disabled="smartViewDisabled"` from the Convert entry.**
   `pnpm exec vitest run ... -t "disables Convert"` → red on **both** the pre-existing test
   ("disables Convert to Smart Album when smart views are off") and the new one (`expected
   undefined to be defined`). Reverted; suite green.
3. **Removed `:style="menuStyle"` from the menu root.**
   `pnpm exec vitest run ... -t "applies the fixed position style"` → red (`attributes('style')`
   undefined, assertion errors on the missing-value combination). Reverted; suite green.
4. **Folded-in fix — reverted `pickerAlbumName.value` back to live `album.value?.title ?? ''`.**
   `pnpm exec vitest run ... -t "names the success toast after the album"` → red:
   `expected "已添加 1 项到「Trip」" but got "已添加 1 项到「Other」"` — reproduces exactly the
   bug the fix addresses. Reverted; suite green.

Full re-run after all reverts: `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles` → **1167/1167 passed**.

## Type check

`pnpm exec vue-tsc --noEmit` — clean, **after** fixing a broken pnpm hardlink (see below).

**Hardlink gotcha hit during this task** (documented in this repo's own `CLAUDE.md`): the first
`vue-tsc` run failed with `Property 'exportAlbumZipUrl' does not exist on type '{...}'`, even
though `packages/service/src/photos.ts` clearly defines it (added in Task 2). `stat -c '%i'`
showed the working copy and the `.pnpm`-linked copy had different inodes — the hardlink had
been broken by an earlier atomic-write edit in this session, before I even touched this task.
`pnpm install` re-linked them (inodes matched afterward); `vue-tsc` then passed clean. Re-ran
the full targeted test file after the reinstall to make sure nothing else moved — still
1167/1167.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/PhotosAlbumDetail.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/views/__tests__/PhotosAlbumDetail.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/zh_cn.photos.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments/src/i18n/en_us.photos.ts`

## Self-review

- **Completeness**: five entries present in the target's order (verified by test + mutation);
  `.sv-side-actions` built at the top of the sidebar, above About (verified by a dedicated DOM-
  order test); menu physically moved out of the header (the old `.album-more-wrap` block and its
  "TEMPORARY HOME" comment are gone from `.sv-actions`); folded-in toast fix done and covered by
  a regression test.
- **Quality/YAGNI**: reused nine existing i18n keys before adding the two genuinely new ones;
  reused the sibling page's `.sv-action-btn`/`.sv-action-btn-icon` classes and dot-icon SVG for
  the toggle button (swapped from the Task-3 parking spot's plain "⋯" glyph + `.bar-btn`, which
  was explicitly a stopgap) rather than inventing new markup, so the two detail pages' more
  buttons now look and behave alike, matching this file's own repeated design intent comments.
- **No newly authored Chinese** outside i18n values: `git diff -- <changed files> | grep -nP
  '^\+.*[\x{4e00}-\x{9fff}]'` hits only (a) comments inside `zh_cn.photos.ts` (the locale file
  carve-out — every pre-existing Task 2-4 comment in that file is Chinese too) and (b) literal
  Chinese assertion strings in the test file (`'重命名'`, `'10 张照片 · 约 32 MB'`, etc.), which
  are locale-value assertions, not authored prose. The mirrored `en_us.photos.ts` comments are
  English.
- **No colour literals**: the two new CSS rules (`.sv-side-actions`, `.sv-action-btn-icon`) use
  only `display`/`flex-wrap`/`gap`/`margin-bottom`/`padding`/`min-width`/`justify-content` — no
  colour properties at all.
- **No `*` immediately before `/` in CSS comments**: checked both new comment blocks by hand —
  each has exactly one legitimate closing `*/`.
- **Click-outside still works with `position: fixed`**: unchanged `onDocMousedown` logic
  (`morePopRef.value.contains(e.target)`) still wraps both the button and the menu in the DOM;
  covered by the "closes the menu when clicking outside it" regression test in the new describe
  block (passes both before and after this task's changes, as expected — it was never broken by
  the `position: fixed` change).

## Concerns

- The `downloadZip` test necessarily triggers jsdom's "Not implemented: navigation" stderr
  (unavoidable given the mechanism the target actually specifies, and the same noise the
  sibling `favorites.ts` feature already produces) — flagged above as a known, pre-existing-
  pattern trade-off rather than a defect.
- Left two small pre-existing i18n-text drifts (`photosAlbumConvertToSmartHint`,
  `photosAlbumDeleteHint`) undisturbed, per the brief's explicit "keep desc unchanged" scope —
  recorded above for whoever eventually reconciles them.
