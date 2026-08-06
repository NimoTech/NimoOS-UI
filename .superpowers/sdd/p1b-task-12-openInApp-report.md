# SP8-P1b Task 12: openInApp test coverage (final-review follow-up)

## Source

A Vue2 spec existed and was ported: `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Agent/services/__tests__/openInApp.spec.js`
(against `openInApp.js` in the same directory).

New file: `src/ai/services/openInApp.test.ts` (New-UI, TypeScript, vitest `globals: true`, no framework
mounting needed — pure functions + `window.open`/`localStorage` spies).

## Adjustments from the Vue2 spec (behavior differences already present in `openInApp.ts`, not introduced by this task)

- `filesPathUrl` / `openFileInNewTab`: New-UI targets its own Files page under the `/app/` mount
  (`/app/#/files?path=...&highlight=...`) instead of Vue2's root-mounted `/#/files?...`.
- `photosAssetUrl` / `photosSetUrl` / `openPhotoInNewTab` / `openPhotoSetInNewTab`: unchanged —
  both apps still deep-link to the old Vue2 Photos page (`/#/photos?...`), per the interim comment
  at the top of `openInApp.ts` (SP7 photos migration not yet merged into sp8-ai). Asserted as-is,
  out of scope to "fix".

All other assertions (URL shapes, encoding, fallback/guard behavior) ported verbatim.

## Cases covered

- `fileDirAndName`: normal absolute path, bare filename (no slash), trailing slash, top-level
  entry (`/DATA` → dir `/`), root path (`/`), multiple trailing slashes, empty/null/undefined/
  non-string input, unicode + spaces.
- `photosAssetUrl` / `filesPathUrl`: encoding of id / dir / name (spaces, `&`).
- `openPhotoInNewTab` / `openFileInNewTab`: happy path + empty/null/undefined guard (no-op, no
  `window.open` call).
- `photosSetUrl`: token + active id encoding.
- `openPhotoSetInNewTab`: stores id list under `nimo:photoset:<token>` and opens with the given
  active id; defaults active to first id when missing/not-in-set; falls back to single-asset
  open when the set is empty; no-op when set is empty and no active id; degrades to single-asset
  open when `localStorage.setItem` throws (new case, not in the Vue2 spec — exercises the
  `openInApp.ts` catch-block on quota/storage failure); prunes stale (>2min) photoset entries
  before writing a new one, leaving fresh/malformed-timestamp entries per the real pruning logic
  (new case, not in the Vue2 spec — the Vue2 file has no equivalent test for
  `pruneStalePhotoSets`).

No changes were made to `openInApp.ts` itself — test-only, per task instructions. The interim
`/#/photos` route (rather than New-UI's own Photos page) is asserted as current behavior, per
instructions (SP7-merge follow-up, out of scope here).

## Test results

- `pnpm test -- openInApp`: 1 test file, 23 tests, all passed.
- Full suite `pnpm test`: 234 test files, 1493 tests, all passed.
- `pnpm exec vue-tsc --noEmit`: no errors.
