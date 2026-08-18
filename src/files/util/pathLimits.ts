import { joinPath } from './pathOps'

// Backend-measured limits, not guessed from Linux headers. Probed on the real
// device on 2026-08-13 against `POST /v1/folder` and the tus upload landing
// path (`/v2/nimoos/file/upload-tus/`); pathLimits.test.ts pins the numbers so
// "match the backend" stays a checkable claim:
//   - one path segment: 255 bytes accepted, 256 rejected  (Linux NAME_MAX)
//   - whole path:      4095 bytes accepted, 4096 rejected (PATH_MAX, incl. NUL)
// Both boundaries are byte-counted, never character-counted: 85 CJK characters
// are 255 bytes and pass, 86 are 258 bytes and fail.
//
// The frontend has to own this check because the two backend entry points
// disagree about how they *report* the failure, and neither report is usable:
//   - POST /v1/folder answers HTTP 500 with the bare literal "Fail" — no errno,
//     no hint which of the two limits was hit (NimoOS route/v1/file.go MkdirAll).
//   - the tus path answers 201 Created, then 204 No Content — both read as
//     success — and drops the file during async ingest, so nothing lands on
//     disk while the UI happily reports "upload complete".
// That asymmetry is what makes create and upload *feel* like they enforce
// different limits even though the byte boundary is identical (bug.txt #2).
export const NAME_MAX_BYTES = 255
export const PATH_MAX_BYTES = 4095

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

export function nameTooLong(name: string): boolean { return byteLength(name) > NAME_MAX_BYTES }
export function pathTooLong(path: string): boolean { return byteLength(path) > PATH_MAX_BYTES }

export type LimitViolation = 'name' | 'path'

/**
 * The single rule every write entry point shares — create, rename, upload.
 *
 * `rel` may be a bare name or a multi-segment relative path. Each segment is
 * measured against NAME_MAX first, then the joined absolute path against
 * PATH_MAX, so the reported violation always names the tighter limit. Measuring
 * per segment rather than over the whole string matters: the backend's MkdirAll
 * builds the chain link by link, and each link only has to fit NAME_MAX on its
 * own — a two-segment 401-byte relative path is perfectly creatable.
 *
 * 'name' | 'path' map 1:1 onto the `filesNameTooLong` / `filesPathTooLong`
 * copy keys, which is how create and upload end up saying the same thing.
 */
export function relBlocked(dir: string, rel: string): LimitViolation | null {
  if (rel.split('/').some(nameTooLong)) return 'name'
  if (pathTooLong(joinPath(dir, rel))) return 'path'
  return null
}

/** Creating `name` under `dir`. A named alias so the create call site reads plainly. */
export function createBlocked(dir: string, name: string): LimitViolation | null {
  return relBlocked(dir, name)
}
