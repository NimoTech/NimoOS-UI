import { describe, it, expect } from 'vitest'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import { deriveDegrade } from './degrade'

function agg(warnings: string[]): NormalizedAggregate {
  return {
    semantic: [], filenames: [], images: [], notes: [],
    stats: { fileindexStatus: 'ready', totalCandidates: 0 }, warnings,
  }
}

describe('deriveDegrade', () => {
  it('Normal real device behavior: images_unavailable + has results → show notice bar, do not show empty state', () => {
    expect(deriveDegrade(agg(['images_unavailable']), 2)).toEqual({
      unavailableSources: ['images'], unknownWarnings: [], empty: 'none',
    })
  })

  it('Multiple sources unavailable all listed, order follows warnings', () => {
    const d = deriveDegrade(agg(['semantic_unavailable', 'images_unavailable']), 1)
    expect(d.unavailableSources).toEqual(['semantic', 'images'])
  })

  it('notes_unavailable filtered out — this round we do not request notes source at all, reporting it would only confuse users', () => {
    const d = deriveDegrade(agg(['notes_unavailable', 'images_unavailable']), 1)
    expect(d.unavailableSources).toEqual(['images'])
    // notes_unavailable must completely disappear — neither in unavailableSources nor in unknownWarnings.
    // (If we only assert unavailableSources, after deleting the notes special case it will silently leak into unknownWarnings,
    //  and this test case will still pass — we actually hit this bug during mutation verification, so we added this assertion.)
    expect(d.unknownWarnings).toEqual([])
  })

  it('no_accessible_roots → empty state no_roots (distinguish from "no match"), and do not count as unavailable source', () => {
    const d = deriveDegrade(agg(['no_accessible_roots']), 0)
    expect(d.empty).toBe('no_roots')
    expect(d.unavailableSources).toEqual([])
    // no_accessible_roots must be consumed by this branch's continue, cannot fall through to unknownWarnings.
    // (If we delete the continue after noRoots=true, it will skip the endsWith('_unavailable') check
    //  and leak into unknownWarnings, while empty/unavailableSources happen not to be affected — if we don't assert here,
    //  all 10 cases will still pass; we actually hit this bug during mutation verification, so we added this assertion.)
    expect(d.unknownWarnings).toEqual([])
  })

  it('no_accessible_roots takes priority over backend_not_ready (even when sources are unavailable at the same time)', () => {
    const d = deriveDegrade(agg(['no_accessible_roots', 'images_unavailable']), 0)
    expect(d.empty).toBe('no_roots')
    expect(d.unknownWarnings).toEqual([])
  })

  it('Zero results + has warning → backend_not_ready (not "no match")', () => {
    expect(deriveDegrade(agg(['semantic_unavailable']), 0).empty).toBe('backend_not_ready')
  })

  it('Zero results + no warning → no_match', () => {
    expect(deriveDegrade(agg([]), 0).empty).toBe('no_match')
  })

  it('Has results + no warning → show nothing', () => {
    expect(deriveDegrade(agg([]), 3)).toEqual({ unavailableSources: [], unknownWarnings: [], empty: 'none' })
  })

  it('Unrecognized warning passed through as-is, not silently discarded', () => {
    const d = deriveDegrade(agg(['quota_exceeded', 'images_unavailable']), 1)
    expect(d.unknownWarnings).toEqual(['quota_exceeded'])
    expect(d.unavailableSources).toEqual(['images'])
  })

  it('Zero results + only unrecognized warning → still counts as backend_not_ready', () => {
    expect(deriveDegrade(agg(['quota_exceeded']), 0).empty).toBe('backend_not_ready')
  })
})

