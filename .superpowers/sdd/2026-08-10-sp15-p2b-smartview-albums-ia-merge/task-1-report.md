# Task 1 report: 数据层（service + store + AlbumView 扩字段）

## Step 1: backend contract check (read-only)

Ran from `/home/nimo/NimoTech/NimoOS-Photos`:

```
$ sed -n '230,265p' route/v1/smartviews.go
type fromAlbumReq struct {
	AlbumID       string   `json:"albumId"`
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Conds         []string `json:"conds"`
	Threshold     int      `json:"threshold"`
	IncludeVideos bool     `json:"includeVideos"`
}
func (h *SmartViewsHandler) FromAlbum(c echo.Context) error {
	var req fromAlbumReq
	if err := c.Bind(&req); err != nil || req.AlbumID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "albumId is required")
	}
	sv, err := h.svc.SmartViews().ConvertFromAlbum(service.ConvertFromAlbumInput{...})
	if errors.Is(err, service.ErrNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "album not found")
	}
	...
	return c.JSON(http.StatusOK, sv)
}
```

```
$ sed -n '286,315p' route/v1/albums.go
type fromSmartViewReq struct {
	SmartViewID string `json:"smartViewId"`
}
// POST /v1/photos/albums/from-smartview
func (h *AlbumsHandler) FromSmartView(c echo.Context) error {
	var req fromSmartViewReq
	if err := c.Bind(&req); err != nil || req.SmartViewID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "smartViewId is required")
	}
	album, err := h.svc.SmartViews().ConvertToAlbum(req.SmartViewID)
	if errors.Is(err, service.ErrNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "smart view not found")
	}
	if errors.Is(err, service.ErrAlbumNameExists) {
		return echo.NewHTTPError(http.StatusConflict, "album name already exists")
	}
	...
	return c.JSON(http.StatusOK, album)
}
```

```
$ grep -n "CreatedAt" service/smartview.go
23:	CreatedAt     time.Time  `json:"createdAt"`
134:		&sv.ID, &sv.Name, &desc, &rawJSON, &sv.Threshold, &liveI, &vidI, &evaluatedAt, &sv.CreatedAt)
```

**Result: all three findings match the brief's predicted conclusions exactly.**
`FromAlbum` receives `{albumId, name?, description, conds?, threshold, includeVideos?}` and
returns the full `SmartView`; `FromSmartView` receives `{smartViewId}` and returns the full
`Album`, with a 409 on album-name collision (`ErrAlbumNameExists`); `CreatedAt` is present on
the DTO at `service/smartview.go:23`. Proceeded with the plan as written.

Also verified (used later, in Step 12): `AlbumView.videoCount` maps to
`NimoOS-Photos/service/types.go:179` — `VideoCount int \`json:"videoCount"\`` with no
`omitempty`, confirming the brief's comment about the wire contract for that field.

## What was implemented

- `packages/service/src/photos.ts` — two new methods `convertAlbumToSmart` /
  `convertSmartToAlbum`, inserted between `previewSmartView` and the SP15-P2a asset-actions
  comment, verbatim per the brief.
- `packages/service/src/photos.convert.test.ts` — new file, 4 tests, verbatim per the brief.
- `oss/manifest.mjs` — registered the new test file in the `SERVICE_DELETE` enumeration next
  to its `smartviewAssets.test.ts` sibling, with a comment following the pattern of the two
  prior omissions logged in that same block.
- `src/photos/stores/smartViews.ts` — `SmartView.createdAt: string`, `toSmartView` normalises
  it (`String(r.createdAt ?? '')`), and a new `convertFromAlbum` action placed after
  `duplicateSmartView` and exported from the store's `return {}`.
- `src/photos/stores/albums.ts` — new `convertFromSmartView` action placed after
  `saveAsAlbum` and exported from the store's `return {}`.
- `src/photos/util/albumView.ts` — `AlbumView.videoCount: number` and
  `AlbumView.dateStart: string | null`, both populated in `albumToView`.
- Tests appended to `src/photos/stores/__tests__/smartViews.test.ts`,
  `src/photos/stores/__tests__/albums.test.ts`, `src/photos/util/__tests__/albumView.test.ts`.
- Test-directory location confirmed via `ls src/photos/stores/__tests__/
  src/photos/util/__tests__/` (Step 1's instruction) — both are sibling `__tests__/`
  directories, matching the existing files in the same dirs; no new location created.

### Ambiguity resolution used (Step 7)

Took the brief's first-offered route: drove `fetchSmartViews` through the existing
`listSmartViews` service mock with raw objects that do/don't carry `createdAt`, then
asserted `store.smartViews[0].createdAt` / `store.smartViews[1].createdAt`. `toSmartView`
remains module-private, not exported; no test backdoor beyond the pre-existing
`__resetForTest` was added.

## TDD evidence

### Batch 1 — service layer (`photos.convert.test.ts`)

RED:
```
$ pnpm exec vitest run packages/service/src/photos.convert.test.ts
FAIL ... TypeError: a.photos.convertAlbumToSmart is not a function (x2)
FAIL ... TypeError: a.photos.convertSmartToAlbum is not a function
Test Files  1 failed (1)
     Tests  4 failed (4)
```
Expected: the two methods did not exist yet on the `createPhotos` return object.

GREEN (after adding `convertAlbumToSmart`/`convertSmartToAlbum` to `photos.ts`):
```
$ pnpm exec vitest run packages/service/src/photos.convert.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)
```

### Batch 2 — `SmartView.createdAt`

RED (added `createdAt` assertions to the "toSmartView 兜底" describe block, plus extended
`FULL_SV` fixture and its exact-equality test to keep that test internally consistent once
the field lands):
```
$ pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts
FAIL ... toSmartView 兜底 > 完整字段原样归一 — actual object missing "createdAt" key
FAIL ... toSmartView 兜底 > createdAt is normalised off the wire ... — expected undefined to be '2026-01-02T03:04:05Z'
Tests  2 failed | 51 passed (53)
```
Expected: the interface field and the `toSmartView` normalisation line did not exist yet.

GREEN (after adding the interface field + `createdAt: String(r.createdAt ?? '')`):
```
$ pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts
Test Files  1 passed (1)
     Tests  53 passed (53)
```

### Batch 3 — store actions (`convertFromAlbum` / `convertFromSmartView`)

RED:
```
$ pnpm exec vitest run src/photos/stores
FAIL src/photos/stores/__tests__/albums.test.ts > convertFromSmartView > unshifts... — TypeError: s.convertFromSmartView is not a function
FAIL src/photos/stores/__tests__/albums.test.ts > convertFromSmartView > rethrows... — TypeError: s.convertFromSmartView is not a function
FAIL src/photos/stores/__tests__/smartViews.test.ts > convertFromAlbum > unshifts... — TypeError: s.convertFromAlbum is not a function
FAIL src/photos/stores/__tests__/smartViews.test.ts > convertFromAlbum > rethrows... — TypeError: s.convertFromAlbum is not a function
Test Files  2 failed | 9 passed (11)
     Tests  4 failed | 345 passed (349)
```
Expected: neither action existed on either store yet.

GREEN (after adding both actions and wiring them into each store's `return {}`):
```
$ pnpm exec vitest run src/photos/stores
Test Files  11 passed (11)
     Tests  349 passed (349)
```
(One benign pre-existing jsdom stderr line — "Not implemented: navigation" from
`favorites.ts:exportZip` — prints during `favorites.test.ts` regardless of this task's
changes; the test it comes from still passes. Confirmed unrelated by running
`favorites.test.ts` alone before touching any Task 1 code.)

### Batch 4 — `AlbumView.videoCount` / `AlbumView.dateStart`

RED:
```
$ pnpm exec vitest run src/photos/util/__tests__/albumView.test.ts
FAIL ... carries videoCount and dateStart through... — expected undefined to be 3
FAIL ... defaults videoCount to 0 and dateStart to null when absent — expected undefined to be 0
Tests  2 failed | 18 passed (20)
```
Expected: neither field existed on `AlbumView` yet.

GREEN:
```
$ pnpm exec vitest run src/photos/util/__tests__/albumView.test.ts
Test Files  1 passed (1)
     Tests  20 passed (20)
```

## Mutation check (self-review)

Reverted `createdAt: String(r.createdAt ?? '')` in `toSmartView` back out and re-ran:
```
$ pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts
FAIL ... createdAt is normalised off the wire ... — expected undefined to be '2026-01-02T03:04:05Z'
Tests  2 failed | 53 passed (55)
```
Confirms the new test is load-bearing (fails when the implementation is broken). Restored
the line and re-ran green (55 passed).

## Files changed

- `packages/service/src/photos.ts` (implementation)
- `packages/service/src/photos.convert.test.ts` (new)
- `src/photos/stores/smartViews.ts` (implementation)
- `src/photos/stores/albums.ts` (implementation)
- `src/photos/stores/__tests__/smartViews.test.ts` (tests)
- `src/photos/stores/__tests__/albums.test.ts` (tests)
- `src/photos/util/albumView.ts` (implementation)
- `src/photos/util/__tests__/albumView.test.ts` (tests)
- `oss/manifest.mjs` (registration)
- Fallout fixture fixes required to keep `vue-tsc --noEmit` green after widening
  `SmartView`/`AlbumView` (see "Corrections" below):
  `src/photos/components/__tests__/SearchSaveSmartView.test.ts`,
  `src/photos/components/__tests__/SmartViewCard.test.ts`,
  `src/photos/components/__tests__/SmartViewCreateDialog.test.ts`,
  `src/photos/components/__tests__/SmartViewSidePanel.test.ts`,
  `src/views/PhotosSmartViewDetail.assets.test.ts`

Commit: `85efc7d feat(photos): add the album <-> smart view conversion data layer`

## Self-review findings

- **Completeness**: all 13 brief steps executed in order. Both stores' `return {}` blocks
  updated (`convertFromAlbum` exported from `smartViews.ts`, `convertFromSmartView` from
  `albums.ts`) — verified reachable via the store test files calling them directly on the
  returned object.
- **Quality**: signatures match the "Interfaces" list verbatim
  (`convertAlbumToSmart(albumId, payload)`, `convertSmartToAlbum(smartViewId)`,
  `SmartView.createdAt: string`, `convertFromAlbum(albumId, {description, threshold})`,
  `convertFromSmartView(smartViewId): Promise<Record<string, unknown>>`,
  `AlbumView.videoCount: number`, `AlbumView.dateStart: string | null`). All new comments are
  in English and explain *why* (deviation from Vue2, why no refetch/optimistic slot, why the
  fallback for videoCount only covers partial fixtures).
- **Discipline**: `mixedAlbums.ts` was not touched. `sortAlbums` was not deleted; the
  `'updated'` sort option is untouched (still present, its own test still asserts
  no-op-on-unknown/'updated' sort at line ~63 of `albumView.test.ts`, unmodified). No busy
  guards were added to either new store action, per the brief's explicit instruction — the
  test "rethrows so the caller can keep its dialog open" / "rethrows instead of swallowing
  the failure" would fail on a second call if a busy guard silently short-circuited retries,
  and neither test does a second-call check by design, matching the brief's stated reason
  for omitting the guard.
- **Testing**: mutation check above confirms the new `createdAt` test is load-bearing. All
  new test descriptions and comments are in English per the global constraint. Output is
  pristine except the one pre-existing/unrelated jsdom stderr line from `favorites.ts`
  (confirmed present before this task's changes, not introduced by it).

## Issues or concerns

- Hit the documented "hardlink broken by atomic write" trap (NimoOS-New-UI/CLAUDE.md):
  after editing `packages/service/src/photos.ts`, `vue-tsc --noEmit` reported
  `convertAlbumToSmart`/`convertSmartToAlbum` as missing on the `service.photos` type even
  though the object literal plainly had them. `stat -c '%i %n'` on the file vs. its
  `.pnpm`-linked counterpart showed different inodes (link broken by this session's earlier
  Edit-tool writes, unrelated to this specific edit). One `pnpm install` re-linked it; no
  `--force`, no cache-clear needed, consistent with the documented remedy.
- Two `oss/*.test.mjs` integration tests (`export-rsync.test.mjs`,
  `cli-args.test.mjs --publish`) fail whenever the working tree has *any* uncommitted change
  outside `oss/` — they explicitly refuse to export with `工作树不干净` (working tree not
  clean) and `--allow-dirty-oss` only tolerates dirtiness inside `oss/` itself. This is not a
  defect in this task's code; it is inherent to running `pnpm test` mid-TDD before committing.
  Final `pnpm test` run was executed after the commit landed to get a true signal (see below).
- One flaky, unrelated failure appeared in one of the full-suite runs taken mid-task:
  `src/home/components/DesktopContextMenu.test.ts > handles a right-click on blank canvas`.
  Confirmed pre-existing/unrelated: passes in isolation
  (`pnpm exec vitest run src/home/components/DesktopContextMenu.test.ts` → 6/6 green), and
  this task never touched anything under `src/home/`.

## Final verification (post-commit)

```
$ git status --short
(clean)
$ pnpm exec vue-tsc --noEmit
(no output, exit 0)
$ pnpm test
 Test Files  684 passed (684)
      Tests  10873 passed (10873)
```

Confirms the two `oss/*.test.mjs` dirty-tree failures and the `DesktopContextMenu.test.ts`
flake seen during mid-task runs were both transient/unrelated, not caused by this task's code.

## Corrections to the brief

1. **Step 7's suggested test description text used a Chinese-adjacent placeholder** ("该文件已有此形态" etc. — not actually wrong, just noting the ambiguity-resolution note in the task instructions pre-empted this; no correction needed here, the assigned route worked cleanly.)
2. **The brief's file list for Task 1 did not account for the fallout of widening `SmartView`/`AlbumView` on files outside the listed set.** Making `createdAt` a required (non-optional) field on `SmartView`, and `videoCount`/`dateStart` required fields on `AlbumView`, broke `vue-tsc --noEmit` in five files not in the brief's file list: `src/photos/components/__tests__/SearchSaveSmartView.test.ts`, `SmartViewCard.test.ts`, `SmartViewCreateDialog.test.ts`, `SmartViewSidePanel.test.ts` (all build inline `SmartView` fixtures), and `src/views/PhotosSmartViewDetail.assets.test.ts` (same, three call sites sharing one `SV` const). Each needed one line (`createdAt: ''`) added to its fixture. This is necessary fallout of the interface change the brief specifies, not scope creep — Step 13 requires a clean `vue-tsc --noEmit`, which is unreachable without these fixes.
3. **The `sortAlbums` describe block inside `albumView.test.ts` (a file already in Task 1's list) builds its own `AlbumView`-shaped fixture (`V(...)`) that the brief's Step 12 diff doesn't mention.** It also needed `videoCount: 0, dateStart: null` added to stay assignable to the now-wider `AlbumView` type. Fixed in the same file already scheduled for editing; did not touch `sortAlbums` itself, its `'updated'` branch, or delete anything from it, per the explicit "Task 2 only" boundary.
4. **`pnpm test` cannot be green while the working tree is dirty outside `oss/`** — two `oss/*.test.mjs` tests assert a clean tree as a precondition for a real export run. This means "run `pnpm test` once before your final commit" (from the parent task instructions) will show 2 unrelated failures by design; the meaningful signal comes from running it once more right after the commit. Worth flagging for later tasks in this same plan so they don't chase a phantom regression.
5. **Hit the repo's documented hardlink-breaks-on-atomic-write trap** while editing `packages/service/src/photos.ts` — not a brief error, but worth naming since it cost a `vue-tsc` debugging detour; the fix was the one-line `pnpm install` the project CLAUDE.md already prescribes.
