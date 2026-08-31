// Deep link key coverage gate.
//
// Why it's needed: Vue2 has been retired, so its `/photos` query keys will never be caught by
// their own components again — missing even one
// silently breaks old bookmarks. These missing items **cannot be caught by ordinary behavior tests**:
// no behavior test will "fail because a key is missing". A similar pitfall hit before with a
// whitelist-based check that only did a one-way comparison and let CSS blocks slip through
// undetected, so we're setting up a **two-way** gate here:
//   Forward — every key in Vue2 key set checklist must be read in the dispatcher;
//   Backward — except active/spot two attached keys, every key must enter watch array
//             (otherwise only recognized on full-page mount, address bar edits no-op —
//             this exact defect was caught during hands-on device testing);
//   Self-check — checklist itself non-empty and no duplicates (prevent gate forever green after accidental clearance).
//
// This gate reads source code text instead of importing modules: what we assert is "which getters
// are registered in the watch array" — a **structural** fact that cannot be obtained at runtime
// (watch's dependency list is not an observable value). Behavior correctness is the responsibility
// of 55 test cases in usePhotosDeepLinks.test.ts, no overlapping division of labor.
// Reading disk always via node:fs — `?raw` is always empty in this repo's test environment (color-guard once spun empty because of it).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// All query keys supported by Vue2 `/photos`, each with source coordinates (the Vue 2 panel).
// Verify source: PhotosTimeline.vue:368-374 (mounted dispatch) + :475-506 (_applyUrlDeepLinks)
// + PhotosAlbumsView.vue:264 + PhotosSmartViewsView.vue:337-348.
const VUE2_QUERY_KEYS: Array<[key: string, source: string]> = [
  ['photoset', 'PhotosTimeline.vue:368-374 mounted dispatch'],
  ['active', 'PhotosTimeline.vue:368-374 — attached key for photoset'],
  ['asset', 'PhotosTimeline.vue:368-374 mounted dispatch'],
  ['view', 'PhotosTimeline.vue:479-481 NAV_KEYS'],
  ['tab', 'PhotosTimeline.vue:482-484 TAB_KEYS'],
  ['settings', 'PhotosTimeline.vue:485-488'],
  ['q', 'PhotosTimeline.vue:491-494'],
  ['place', 'PhotosTimeline.vue:496-498 → :527-554'],
  ['spot', 'PhotosTimeline.vue:496-498 — attached key for place'],
  ['person', 'PhotosTimeline.vue:500-502 → :509-523'],
  ['photo', 'PhotosTimeline.vue:504-506 → :556-571'],
  ['album', 'PhotosAlbumsView.vue:264 (album list page reads itself in mounted)'],
  ['smartview', 'PhotosSmartViewsView.vue:337-348 (smart view page reads itself in mounted)'],
]

// Attached keys: read together with main key (active with photoset, spot with place),
// no need for separate handling branches. However, spot still enters watch array
// (changing only spot is real user action), active does not (it's only read once when photoset
// is handed off, changing it alone has no meaning).
const ATTACHED_NO_WATCH = new Set(['active'])

const SRC = fs.readFileSync(path.resolve(__dirname, '../usePhotosDeepLinks.ts'), 'utf8')

describe('Deep link key coverage gate · forward (Vue2 key set → dispatcher)', () => {
  it('Every Vue2 query key is read in the dispatcher', () => {
    const missing = VUE2_QUERY_KEYS
      .filter(([k]) => !SRC.includes(`query.${k}`))
      .map(([k, source]) => `${k} — verify source ${source}`)
    expect(missing).toEqual([])
  })
})

describe('Deep link key coverage gate · backward (dispatcher → watch array)', () => {
  it('Every key entered watch array (except attached key active)', () => {
    const watchStart = SRC.indexOf('  watch(')
    expect(watchStart, 'watch( block not found — gate data collection method is broken, fix gate first before changing code').toBeGreaterThan(0)
    const watchBlock = SRC.slice(watchStart)

    const missing = VUE2_QUERY_KEYS
      .filter(([k]) => !ATTACHED_NO_WATCH.has(k))
      .filter(([k]) => !watchBlock.includes(`route.query.${k}`))
      .map(([k]) => k)
    expect(missing).toEqual([])
  })

  it('No keys in watch array outside checklist (reverse direction also disallows extras — extras are unregistered new keys)', () => {
    const watchStart = SRC.indexOf('  watch(')
    const watchEnd = SRC.indexOf('    ],', watchStart)
    const watchBlock = SRC.slice(watchStart, watchEnd)

    const watched = [...watchBlock.matchAll(/route\.query\.(\w+)/g)].map((m) => m[1])
    const known = new Set(VUE2_QUERY_KEYS.map(([k]) => k))
    const extra = watched.filter((k) => !known.has(k))
    expect(extra).toEqual([])
  })
})

describe('Deep link key coverage gate · self-check', () => {
  it('Checklist non-empty and no duplicates (prevent gate forever green after accidental clearance)', () => {
    const keys = VUE2_QUERY_KEYS.map(([k]) => k)
    expect(keys.length).toBe(13)
    expect(new Set(keys).size).toBe(13)
  })

  it('Each entry has source coordinates (entries without coordinates cannot be verified later)', () => {
    const noSource = VUE2_QUERY_KEYS.filter(([, source]) => !source || !source.includes('.vue:'))
    expect(noSource).toEqual([])
  })
})
