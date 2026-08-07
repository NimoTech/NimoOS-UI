# Task 4 Report: 人物方法

## Status: COMPLETE ✓

## Commits
- **SHA:** `64082df`
- **Message:** `photos 域:人物全套(封面/合并建议/重聚类/摘除)`

## Test Results
```
Test Files  25 passed (25)
Tests  145 passed (145)
```
- Photos persons tests: **5/5 passed** (列表/详情/更新/封面, 删除/彻底清除/恢复, 资产分页/关系/地点, 合并建议流, personFaceThumbnailUrl)
- Full suite: **145/145 passed** (all pre-existing + new)

## TDD Flow
- **RED:** 5 failing tests in `src/photos.persons.test.ts` (missing methods)
- **GREEN:** All 5 tests passing after implementation
- **BUILD:** TypeScript compilation successful with no errors

## Files Changed
1. **src/photos.ts** (+73 lines)
   - Appended 16 persons methods inside `createPhotos()` return object
   - Methods organized under `// ─── 人物 ───` section comment

2. **src/photos.persons.test.ts** (new, +71 lines)
   - Copied `capture()` helper and `noToken` from existing photos.test.ts
   - 5 test cases covering all persons methods

## Implementation Details

### Methods Added (16 total)
All follow spec from brief exactly; key details:

#### CRUD + Cover
- `listPersons()` → GET `/photos/persons` (uses `loose<>` for array)
- `getPerson(id)` → GET `/photos/persons/{id}`
- `updatePerson(id, patch)` → PUT with patch body
- `setPersonCover(id, assetId)` → PUT to `/cover` with `{assetId}`
- `resetPersonCover(id)` → DELETE `/cover`

#### Lifecycle
- `deletePerson(id)` → DELETE
- `purgePerson(id)` → **DELETE with `?purge=true` in URL** ✓
- `restorePerson(id)` → POST with empty body `{}`

#### Pagination + Relations
- `getPersonAssets(id, limit=100, offset=0)` → GET with params
- `personRelations(id)` → GET
- `personPlaces(id)` → GET

#### Merge & Clustering
- `mergePersons(fromId, intoId)` → POST `/merge` with **snake_case body: `{from_id, into_id}`** ✓
- `mergeSuggestions()` → GET `/merge-suggestions` (uses `loose<>`)
- `rejectMergeSuggestion(fromId, intoId)` → POST `/merge-suggestions/reject` with **snake_case body** ✓
- `reclusterFaces()` → POST `/recluster` with empty body
- `detachAssetsFromPerson(personId, assetIds)` → POST `/detach` with `{assetIds}`

#### URL Generator
- `personFaceThumbnailUrl(id)` → returns `/v1/photos/persons/{id}/face-thumbnail` with **`tokenQ('?')` token appended** ✓

### Key Conventions Met
✓ Uses existing `loose<T>()` and factory `tokenQ(sep)` — no redefinition  
✓ Reuses `unwrap<>()` for single-item responses  
✓ GET with pagination uses `{ params: {...} }`  
✓ Merge bodies use `from_id`/`into_id` snake_case (not camelCase)  
✓ `purgePerson` URL has `?purge=true` (not a body param)  
✓ `personFaceThumbnailUrl` uses `tokenQ('?')` separator  
✓ TypeScript NodeNext — relative imports use `.js` extension  
✓ Chinese commit message  

## Self-Review Checklist
- [x] Test file copied `capture()` helper and `noToken` from existing test
- [x] All 16 methods signatures match brief exactly
- [x] HTTP verbs, URLs, and body shapes match test assertions
- [x] Snake_case `from_id`/`into_id` in merge requests
- [x] `?purge=true` in URL (not body) for `purgePerson`
- [x] `personFaceThumbnailUrl` uses `tokenQ('?')`
- [x] `loose<>` for list endpoints, `unwrap<>` for single items
- [x] No extraneous code beyond what brief specifies
- [x] All tests passing (5/5 + 140 existing)
- [x] Build clean
- [x] Commit message in Chinese

## Concerns
None. Task follows spec precisely; all requirements met.
