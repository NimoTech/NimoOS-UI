// Final review, structural fix. The open-source strip manifest enumerates the photos-area
// files one by one, and four separate times a new test file was added without being
// registered (see the SERVICE_DELETE comments: "Third time for this exact omission"). Every
// time it was caught by the slowest gate at the very end of the run — the export-then-scan
// leak guard in tree.test.mjs — and reported as `Cannot find module`, which does not read
// like "you forgot a manifest line". Every keyword/forbidden-word guard is blind to it by
// construction: they scan the *produced tree* for leaked words, so a file that was never
// stripped only shows up as a pile of word hits somewhere else, or not at all when the file
// happens to contain no listed keyword.
//
// The enumeration itself is deliberately kept — it gives staleness detection in the other
// direction (a listed path that no longer exists exits 1 during the export). What was
// missing is this direction: for every photos file on disk, is it listed at all? That check
// is a plain directory read, costs milliseconds, and names both the file and the list it
// belongs in.
//
// Scope is the three directories where the omissions actually happened — the two view
// directories and the inlined service package's source root. `src/photos/**` needs no check:
// the manifest deletes that whole directory in one entry, so a new file there is covered the
// moment it is created.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { DELETE, SERVICE_DELETE, NEW_UI } from './manifest.mjs'

// A path is covered either by its own entry or by a directory entry above it — the manifest
// uses both forms ('src/photos' covers the whole area, 'src/views/Photos.vue' is a leaf).
function covered(list, rel) {
  return list.includes(rel) || list.some((e) => rel.startsWith(`${e}/`))
}

// Files whose basename mentions photos, relative to `base`, non-recursive.
function photoFilesIn(base, dir) {
  const abs = path.join(base, dir)
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isFile() && /photo/i.test(e.name))
    .map((e) => `${dir}/${e.name}`)
    .sort()
}

const CASES = [
  { base: NEW_UI, dir: 'src/views', list: DELETE, listName: 'DELETE' },
  { base: NEW_UI, dir: 'src/views/__tests__', list: DELETE, listName: 'DELETE' },
  { base: path.join(NEW_UI, 'packages/service'), dir: 'src', list: SERVICE_DELETE, listName: 'SERVICE_DELETE' },
]

describe('every photos file on disk is registered in the strip manifest', () => {
  for (const { base, dir, list, listName } of CASES) {
    it(`${dir} — all photo* files appear in ${listName}`, () => {
      const found = photoFilesIn(base, dir)
      // A guard that finds nothing to check is not a passing guard. If this ever trips, the
      // directory moved and the case above has to move with it.
      expect(found.length, `no photo* files found under ${dir} — has it moved?`).toBeGreaterThan(0)

      const missing = found.filter((rel) => !covered(list, rel))
      expect(
        missing,
        `these photos files would ship in the open-source export — add each to oss/manifest.mjs's ${listName}:\n`
          + missing.map((m) => `  '${m}',`).join('\n'),
      ).toEqual([])
    })
  }
})
