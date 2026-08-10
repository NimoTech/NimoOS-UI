# Task 2 report: service `exportAlbumZipUrl` + store `duplicateAlbum`

## What was implemented

- `packages/service/src/photos.ts` — `exportAlbumZipUrl(id: string | number): string`, added
  right after `exportFavoritesUrl`. Same shape: `` `/v1/photos/albums/${id}/export${tokenQ('?')}` ``.
  Comment records that the backend endpoint already exists and is JWT-exempt
  (`NimoOS-Photos route/router.go:52, :178`, handler `route/v1/albums.go:84`), correcting the
  Vue2 source's stale "in parallel development" comment.
- `src/photos/stores/albums.ts` — `duplicateAlbum(id: string | number): Promise<RawAlbum>` +
  `duplicateBusy` ref, added right after `saveAsAlbum`. Both added to the store's returned
  object and to `__resetForTest`.

## Naming rule — read from the Vue2 target, not the brief's skeleton

The brief's skeleton left the new album's name as a hole (`/* name per the target's rule */`).
Read from `git -C NimoOS-UI show 33b05636:src/views/Photos/PhotosAlbumDetail.vue`, method
`duplicateAlbum` (lines 708-730):

```js
async duplicateAlbum() {
  this.moreOpen = false
  const name = `${this.album.title} copy`
  const assetIds = (this.$store.state.photos.albumAssetsByID[this.album.id] || []).map(p => p.id)
  ...
  const newAlbum = await this.$store.dispatch('photos/saveAsAlbum', { name, assetIds })
  ...
}
```

Two facts settled from this:
- **Name rule:** `${title} copy` — literal English suffix `" copy"`, no i18n, no numbering.
- **No cover copying:** the method never touches `coverAssetId`. Backend `createAlbum` picks
  its own default cover from the first added asset; Vue2 does nothing extra, so neither does
  this port.

Since this store keeps **raw** backend album objects (field `name`, seen throughout the
existing tests' fixtures, e.g. `{ id: 7, name: 'A' }`), not the view-mapped object Vue2's
`this.album.title` reads, I computed the equivalent as
`(source.name as string) || (source.title as string) || ''`, mirroring the same fallback order
used where this store's raw objects get mapped for display
(`src/photos/util/albumView.ts:61`: `(a.name as string) || (a.title as string) || untitled`).

## Reuse-vs-rewrite decision on `saveAsAlbum` — reuse

The brief's Step 4 skeleton sketched `duplicateAlbum` as a fresh
`createAlbum(name)` + `addAssetsToAlbum(created.id, assetIds)` combination (both *store*
actions). Reading the actual Vue2 target changed this: Vue2's `duplicateAlbum` is a **thin
wrapper** that computes `name` + `assetIds` and dispatches the store's existing
`photos/saveAsAlbum` action directly — not a create+addAssets combination.

This repo's `saveAsAlbum` (`albums.ts:205`) already matches that exact Vue2 action 1:1:
`service.photos.createAlbum(name)` → `service.photos.batchAddToAlbum(created.id, assetIds)` →
`fetchAlbums()` → return created. The store's own `addAssetsToAlbum` action (the skeleton's
second call) has genuinely different semantics that Vue2's duplicateAlbum never exercises:
optimistic `assetCount` patch, then `fetchAlbumAssets(id)` to populate `albumAssetsByID` for
that one album, then reconciling the count from the real fetched length. Using it here would
silently change duplicateAlbum's behaviour (an extra fetch, different count-settling path)
from what Vue2 actually does.

**Decision: reuse `saveAsAlbum` verbatim**, not the skeleton's create+addAssets combo. This
is exactly the "if two write paths' semantics differ, don't force the fit" case the brief
itself flagged, resolved by favoring the real Vue2 source over the brief's prose (global
constraint 1).

## Prepend-without-refetch — verified, no extra frontend logic needed

The brief claimed `createAlbum` "already prepends the new album into the list… confirm this
still holds before implementing." Reading the store's actual `createAlbum` action shows it
does **not** literally prepend — it calls `fetchAlbums()`, a full list replace from the
backend response. The claim only holds because of a *backend* contract: `NimoOS-Photos
service/album.go:83` — `GROUP BY a.id ORDER BY a.created_at DESC` — so a freshly created album
is always first in the next `ListAlbums` response. Since `duplicateAlbum` reuses `saveAsAlbum`,
which itself calls `fetchAlbums()` after the batch-add, the just-duplicated album lands at
index 0 through that backend ordering — no manual `unshift` needed in the frontend. This is
recorded in the implementation comment; the corresponding test seeds the mocked `listAlbums`
response with the new album first, matching that real ordering contract rather than assuming
it via test-author fiat.

## Fixture conventions — copied from existing files, not invented

Per the phase-wide caution against inventing fixtures, both existing test files were read
before writing:

- `packages/service/src/photos.favorites.test.ts` — showed `createPhotos(http, getToken)`
  takes an **injected getToken callback** (`() => 'T1'` / `noToken = () => null`), not a
  mutable `setToken(...)` global as the brief's sketch guessed. Used that real pattern.
- `src/photos/stores/__tests__/albums.test.ts` — showed the `vi.mock('@nimotech/nimoos-service')`
  shape, the `mockImplementationOnce` + `order: string[]` push pattern used by the existing
  `saveAsAlbum` describe block for asserting call ordering (not the nonexistent
  `toHaveBeenCalledBefore` matcher the brief's sketch used), and the `mockImplementationOnce(()
  => new Promise(resolve => ...))` pattern for asserting in-flight state before resolving.

All four sketched store tests and both sketched service tests were written out in full and are
passing — none were skipped.

## TDD evidence

**RED** (store layer) —
`pnpm exec vitest run src/photos/stores/__tests__/albums.test.ts` after writing the four
`duplicateAlbum` tests but before implementing the function:

```
FAIL  src/photos/stores/__tests__/albums.test.ts > photosAlbums store > duplicateAlbum > creates a new album with "<title> copy" and batch-adds the source members, create before add
TypeError: s.duplicateAlbum is not a function
FAIL  ... > prepends the duplicate to the album list so it is visible without a refetch
TypeError: s.duplicateAlbum is not a function
FAIL  ... > ignores a second duplicate call while the first is still in flight
TypeError: s.duplicateAlbum is not a function
FAIL  ... > clears the in-flight guard after a failure so a retry can proceed
TypeError: s.duplicateAlbum is not a function
Test Files  1 failed (1)
     Tests  4 failed | 38 passed (42)
```

Expected failure, exactly as predicted by the brief's Step 3 ("duplicateAlbum is not a
function"). Confirmed.

(The service-layer `exportAlbumZipUrl` tests were written together with the trivial one-line
implementation in the same edit pass — it is a direct copy of the existing
`exportFavoritesUrl` pattern with no new logic, so there was no meaningful RED window for it;
running it afterward showed both tests green immediately.)

**GREEN** — `pnpm exec vitest run packages/service/src/photos.albums.test.ts
src/photos/stores/__tests__/albums.test.ts --reporter=verbose`:

```
Test Files  2 passed (2)
     Tests  46 passed (46)
```

All 46 tests listed individually in verbose output, no `[Vue warn]` or other stderr noise from
passing tests.

## Mutation verification (Step 6) — all three confirmed load-bearing

1. **Removed the re-entry guard's `if (duplicateBusy.value) throw ...` line.**
   Ran: `pnpm exec vitest run src/photos/stores/__tests__/albums.test.ts -t "ignores a second duplicate call"`
   Result: red — `expected "vi.fn()" to be called 1 times, but got 2 times` (createAlbum called
   twice). Reverted; suite back to 46/46 green.

2. **Replaced `tokenQ('?')` with a hardcoded `''` in `exportAlbumZipUrl`.**
   Ran: `pnpm exec vitest run packages/service/src/photos.albums.test.ts -t "with the injected getToken"`
   Result: red — expected `'/v1/photos/albums/7/export?token=tok123'`, got
   `'/v1/photos/albums/7/export'`. Reverted; suite back to 46/46 green.

3. **Failure path does not clear the guard** (changed `try {...} finally { duplicateBusy.value
   = false }` to clear only on the success path, inside `try`, with a bare rethrowing `catch`).
   Ran: `pnpm exec vitest run src/photos/stores/__tests__/albums.test.ts -t "clears the in-flight guard after a failure"`
   Result: red — `Error: duplicate already in flight` thrown on the second call, because the
   guard from the first (failed) call was never cleared. Reverted; suite back to 46/46 green.

All three named tests are confirmed to actually test what their titles claim.

## Type check

`pnpm exec vue-tsc --noEmit` — clean, no output, exit 0.

## Files changed

- `packages/service/src/photos.ts` — `exportAlbumZipUrl`
- `packages/service/src/photos.albums.test.ts` — 2 new tests
- `src/photos/stores/albums.ts` — `duplicateAlbum`, `duplicateBusy`, return object,
  `__resetForTest`
- `src/photos/stores/__tests__/albums.test.ts` — 4 new tests

`git diff -- <these 4 files> | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'` — no hits. All new comments
and test descriptions are English.

## Self-review

- **Completeness:** both interfaces exist with the exact signatures the brief froze for T5;
  re-entry guard present and exported; `duplicateBusy` reset in `__resetForTest`.
- **Quality:** implementation comment documents the naming-rule source, the reuse decision and
  why, and the backend-ordering fact the prepend behaviour depends on — so a future reader
  does not have to re-derive any of this from the Vue2 source or the Go backend again.
- **Discipline (YAGNI):** no `unshift`/optimistic-list logic was added, since the backend's
  `created_at DESC` ordering plus `saveAsAlbum`'s existing `fetchAlbums()` already delivers the
  required "visible at index 0 without a manual refetch" behaviour. No cover-copying logic was
  added, since the Vue2 target has none.
- **Testing:** all four store tests and both service tests exercise the real store/service
  functions against mocked HTTP-layer calls (`service.photos.*`), not mocks of the code under
  test itself. Mutation testing confirms each of the three brief-specified mutations flips
  exactly the test its own description names.

## Concerns

None. The one place the brief's premises needed correcting (reuse target, and the mechanism
behind "already prepends") is fully documented above and in the code comments, per the global
constraint to trust the Vue2 source over the brief's prose.
