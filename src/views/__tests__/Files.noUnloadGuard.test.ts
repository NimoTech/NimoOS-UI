// Guard: installUnloadGuard must live at the app level (src/App.vue), not
// here. It used to be mounted/unmounted with Files.vue, which meant the
// upload queue -- an app-lifetime Pinia store -- kept transferring after
// navigating to any other route with no interrupt signal sent and no
// leave-site prompt shown on tab close. This test pins the removal so
// nobody reinstalls it in Files.vue later and ends up sending two interrupt
// signals per pagehide (one from App.vue, one from here).
//
// Reads the source file directly with node:fs rather than a `?raw` import --
// this repo's vitest setup resolves `?raw` imports to an empty string, which
// has silently no-op'd a guard like this before (see SP12 Plan A retro).
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const FILES_VUE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Files.vue')

describe('Files.vue does not install its own unload guard', () => {
  it('no longer imports installUnloadGuard -- that lives at app level now', () => {
    const src = fs.readFileSync(FILES_VUE, 'utf8')
    expect(src).not.toMatch(/installUnloadGuard/)
  })
})
