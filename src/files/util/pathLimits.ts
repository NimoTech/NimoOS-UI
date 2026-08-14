import { joinPath } from './pathOps'

// Linux limits: single path segment NAME_MAX = 255 bytes; full path PATH_MAX = 4096 bytes
// (inclusive of trailing NUL, usable 4095). Counted as UTF-8 bytes (Chinese 3 bytes/char).
// Backend discards errors on ENAMETOOLONG, only returns literal "Fail" (route/v1/file.go
// MkdirAll / service/system.go); TUS uploads silently fail in async ingest — frontend
// pre-validation is the only place that can provide clear feedback (bug.txt #2).
const NAME_MAX = 255
const PATH_MAX = 4095
const bytes = (s: string) => new TextEncoder().encode(s).length

export function nameTooLong(name: string): boolean { return bytes(name) > NAME_MAX }
export function pathTooLong(path: string): boolean { return bytes(path) > PATH_MAX }

/** Check if creating name under dir will exceed limits. 'name' = name itself too long; 'path' = concatenated full path too long. */
export function createBlocked(dir: string, name: string): 'name' | 'path' | null {
  if (nameTooLong(name)) return 'name'
  if (pathTooLong(joinPath(dir, name))) return 'path'
  return null
}
