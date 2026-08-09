# Task 3 Report: 共享包补 `uploadImage` / `setImageFromPath`

## What was implemented

- `packages/service/src/types.ts`: added `UserImageResult { path, file_name, online_path }`.
- `packages/service/src/users.ts`:
  - imported `UserImageResult` in the top type-import list.
  - added `uploadImage(key, file)` — `POST /users/current/image/{key}` with `FormData` (`file` field), unwraps the standard envelope.
  - added `setImageFromPath(key, path)` — `PUT /users/current/image/{key}` with `{ path }` JSON body, unwraps the standard envelope.
  - rewrote the stale end-of-file "kept out of the package" comment: it now only lists `deleteAllUser()` and `deleteUserImage()`, plus a note that `uploadImage`/`setImageFromPath` moved off that list because SP11 is now their consumer.
- `packages/service/src/users.test.ts`: appended the `describe('user image (SP11 wallpaper)', ...)` block from the brief verbatim, with the three placeholder error codes replaced by real values (see below).

All code blocks (implementation and doc comments) were taken verbatim from the brief, per instructions.

## The three error-code values

Looked up in `/home/nimo/NimoTech/NimoOS-Common/utils/common_err/e.go`:

- `FILE_DOES_NOT_EXIST = 60001` — `e.go:48` (message `"File does not exist"` at `e.go:102`)
- `NOT_IMAGE = 10009` — `e.go:20` (message `"Not an image"` at `e.go:75`)
- `IMAGE_TOO_LARGE = 10010` — `e.go:21` (message `"Image is too large"` — brief/test uses `"Image too large"`, a paraphrase; assertions pin on `message` from the mock, not the Go constant's exact string, so this is fine per the brief's own note that message wording is what's asserted, code values just need to be real and distinct)

Note: `FILE_DOES_NOT_EXIST` (60001) happened to already match the brief's placeholder. `NOT_IMAGE` and `IMAGE_TOO_LARGE` placeholders (10017/10018) were replaced with the real 10009/10010.

The brief's directory hint (`NimoOS-Common/model/common_err/`) was stale — the actual package lives at `NimoOS-Common/utils/common_err/`.

## TDD evidence

**RED** — `pnpm vitest run packages/service/src/users.test.ts` (before implementation):
```
Test Files  1 failed (1)
     Tests  5 failed | 23 passed (28)
 FAIL  ... uploadImage posts multipart with the file under `file`
   TypeError: users.uploadImage is not a function
 FAIL  ... setImageFromPath puts the nas path as json
   TypeError: users.setImageFromPath is not a function
 FAIL  ... setImageFromPath rejects on success=60001/10009/10010 ...
   TypeError: users.setImageFromPath is not a function
```
Matches the brief's expected failure reason exactly.

**GREEN** — after implementation:
```
pnpm vitest run packages/service/src/users.test.ts
 Test Files  1 passed (1)
      Tests  28 passed (28)
```
```
pnpm exec vue-tsc --noEmit
(exit 0, no output)
```

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/packages/service/src/types.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/packages/service/src/users.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/packages/service/src/users.test.ts`

Commit: `0046f5c` "feat(service): add user image upload and set-from-path" — committed with `git commit -o <the 3 paths above>` exactly as the brief specified; `git status` confirms the 3 permanently-staged `design-export/*.html` deletions are untouched (still staged, not part of this commit).

## Self-review

- Completeness: both methods, the type, the import, and the end-of-file comment rewrite are all present and match the brief's code blocks verbatim. No consumer wired yet (correct — that's Task 4).
- YAGNI: no extra methods, options, or abstractions added beyond what the brief specified (no `getImage`/`deleteImage`, matching the brief's scope).
- Naming: `UserImageResult`, `uploadImage`, `setImageFromPath` all match the interface signature required by common-constraints.md's cross-task consistency note.
- Tests verify real behavior, not the mock: the two success-path tests assert on the *request* shape sent to `http` (URL, `FormData` instance, exact key `file`, JSON body shape) — these fail if the implementation changes verb, path, or encoding, not just because the mock says so. The `it.each` error-path tests exercise the real `unwrap()` function (not re-mocked), so they verify that `success !== 200` responses actually throw with the given message — this is the behavior the brief's comment specifically calls out (backend returns HTTP 200 on every image-endpoint failure, so a naive `res.data` read would misread failure as success).
- Output cleanliness: `git show HEAD` diff contains only the intended 3-file change, no stray whitespace or unrelated edits picked up.
- Language: all new comments are English per the CLAUDE.md hard rule; commit message is English.

## Concerns

- None blocking. One minor note already covered above: the brief's line-number citations in the doc comments (`user.go:928-961`, `user.go:888/891/896/905`, `user.go:904`) were used verbatim per instructions and not independently re-verified against the UserService source — the task brief said these code blocks (including doc comments) are to be used verbatim, so no verification was performed on those specific line numbers.
