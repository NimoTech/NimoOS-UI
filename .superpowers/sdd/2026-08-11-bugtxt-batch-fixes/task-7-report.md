# Task 7 Report — Bug 2: preflight NAME_MAX/PATH_MAX + real error detail

## Status: DONE

## What changed

1. **New `src/files/util/pathLimits.ts`** (+ `pathLimits.test.ts`): `nameTooLong`,
   `pathTooLong`, `createBlocked(dir, name)` — Linux NAME_MAX (255 bytes) / PATH_MAX
   (4095 usable bytes), measured via `TextEncoder` UTF-8 byte length, not `.length`
   (JS string length counts UTF-16 code units, which undercounts multi-byte CJK).

2. **`src/files/composables/useFileOps.ts`**:
   - `errMsg` now delegates to `folderListErrorMsg` (detail → response.data.data →
     message) instead of only reading `.message`, and remaps the literal string
     `'Fail'` (the backend's uninformative ENAMETOOLONG stand-in) to the caller's
     fallback. This affects every toast built with `errMsg` (create/rename/
     remove/paste) — intended per the brief.
   - `createFolder` / `createFile` each preflight with `createBlocked(files.currentPath,
     name)` right after the snapshot-view guard and before the network call; on a hit
     they toast `filesNameTooLong` or `filesPathTooLong` and return without calling
     `service.folder.create` / `service.file.create`.

3. **`src/views/Files.vue` `commitSelectedFiles`**: inserted a length filter between
   `normalized` (from `toSelectedFiles`) and `splitProtectedUploads`. `fitsLimits`
   rejects an entry if any path segment exceeds `NAME_MAX` or the full target path
   (`joinPath(targetPath, relativePath)`) exceeds `PATH_MAX`; `splitProtectedUploads`
   now runs on `withinLimits` instead of `normalized`. A `filesUploadPathTooLong`
   toast (with `{count}`) fires when anything was dropped. Applied to file entries
   only, per the brief's explicit scope note — Task 6's `emptyDirs` batch is
   untouched.

4. **i18n**: added `filesNameTooLong` / `filesPathTooLong` / `filesUploadPathTooLong`
   to both `src/i18n/zh_cn.base.ts` and `src/i18n/en_us.base.ts`, next to
   `filesOpFailed`. Parity test passes.

5. **`src/files/composables/useFileOps.test.ts`**: three new `createFolder` cases —
   over-long name toasts `filesNameTooLong` and never calls `folderCreate`; a
   rejection whose message is the literal `'Fail'` toasts `filesOpFailed` (zh: 操作
   失败) instead of showing `'Fail'`; a rejection carrying `detail` shows the detail
   text verbatim. No existing test asserted the raw `'Fail'` string being shown, so
   nothing needed to flip.

## RED → GREEN evidence

RED (module doesn't exist yet):
```
FAIL  src/files/util/pathLimits.test.ts [ src/files/util/pathLimits.test.ts ]
Error: Failed to resolve import "./pathLimits" from "src/files/util/pathLimits.test.ts".
```

GREEN after implementing `pathLimits.ts`:
```
Test Files  1 passed (1)
     Tests  4 passed (4)
```

Full required set, after wiring `useFileOps.ts` + `Files.vue` + i18n + new
`useFileOps.test.ts` cases:
```
$ pnpm vitest run src/files/util/pathLimits.test.ts src/files/composables/useFileOps.test.ts src/views/Files.upload.test.ts src/i18n/parity.test.ts

Test Files  4 passed (4)
     Tests  66 passed (66)
```

Type check:
```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

## Full suite caveat (not a regression)

`pnpm test` (full suite) reported `3 failed | 11163 passed | 70 skipped` — all three
failures are inside `oss/*.test.mjs` export-guard tests that hard-require a clean git
tree before they'll run their fixture export, and at the moment the full run started
the tree had my (then-uncommitted) diff plus two pre-existing untracked scratch files
(`bug.txt`, `docs/superpowers/plans/2026-08-11-bugtxt-batch-fixes.md`, both present
before this task started, unrelated to Task 7). Verified this is pre-existing and
unrelated to this change: stashed everything (including my committed diff) and ran
`pnpm vitest run oss/` again — `oss/tree.test.mjs` still fails on its own, independent
of any Task 7 file, on a leak-guard false positive against a comment string in
`src/home/composables/useAddPanel.ts` (a file this task never touches). Flagging as a
pre-existing, out-of-scope issue rather than fixing it here.

## Files touched

- Create: `src/files/util/pathLimits.ts`, `src/files/util/pathLimits.test.ts`
- Modify: `src/files/composables/useFileOps.ts`, `src/files/composables/useFileOps.test.ts`
- Modify: `src/views/Files.vue`
- Modify: `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts`

## Commit

`a06ce844` — `fix(files): preflight NAME_MAX/PATH_MAX and surface real error detail`

## Fix round 1 — review finding closed

**Finding (Important):** the `withinLimits`/`tooLong` branch added to `Files.vue`'s
`commitSelectedFiles` (per-segment NAME_MAX check, joined-path PATH_MAX check,
`filesUploadPathTooLong` count toast) had zero test coverage — grep for
`filesUploadPathTooLong`/`nameTooLong`/`pathTooLong` in `Files.upload.test.ts` came
back empty. Verified only by code reading.

**Fix:** added two cases to `src/views/Files.upload.test.ts`, following the file's
existing mount/mock/spy conventions (same `makeRouter` + `mount(Files, ...)` +
`vi.spyOn(uploads, 'addFilesToQueue')` + `vi.spyOn(toast, 'show')` pattern already
used by the neighboring `enqueues a selected file` / `toasts a protected rejection`
tests):

1. `drops an entry whose relativePath segment exceeds NAME_MAX and toasts
   filesUploadPathTooLong, but still enqueues the normal one` — submits one file
   with a 256-byte name plus one normal file through `handleSelectedFiles`; asserts
   `addFilesToQueue` is called exactly once with only the normal entry, and that the
   toast fires with `zh.filesUploadPathTooLong` interpolated to count 1.
2. `does not toast filesUploadPathTooLong when every entry is within limits` — two
   ordinary files; asserts both reach `addFilesToQueue` in one call and the toast
   is never called with anything matching the `filesUploadPathTooLong` template's
   fixed suffix.

Took the option the finding explicitly allowed: only the per-segment NAME_MAX
dimension is exercised here (via a 256-byte `webkitRelativePath`/name). The joined
full-path PATH_MAX dimension is not separately simulated in this harness — it
already has direct unit coverage in `pathLimits.test.ts` (`createBlocked`'s `'path'`
case, and `pathTooLong` directly), and `Files.vue`'s `fitsLimits` calls the exact
same `pathTooLong`/`joinPath` combination the brief specifies, so there is no
additional integration risk left uncovered by reasoning + that existing unit test.

Commands run (foreground):
```
$ pnpm vitest run src/views/Files.upload.test.ts src/files/util/pathLimits.test.ts

Test Files  2 passed (2)
     Tests  14 passed (14)

$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

Commit: `29edad3a` — `test(files): cover the upload path-length filter in
commitSelectedFiles`

## Outstanding (backend, out of scope per brief)

- `route/v1/file.go` MkdirAll / PostCreateFile discard the real error and answer
  literal `"Fail"`.
- `service/system.go:283` MkdirAll's return value is discarded.
- tus ingest failures have no frontend-visible signal at all (would need task-status
  polling or an event) — this task only prevents the client from queuing an upload
  that would hit that failure mode for path-length reasons; it does not add any new
  visibility into async ingest failures for other causes.
