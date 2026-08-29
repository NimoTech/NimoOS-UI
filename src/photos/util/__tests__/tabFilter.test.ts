import { describe, it, expect } from 'vitest'
import { matchesTab } from '../tabFilter'
import { assetToPhoto } from '../assetToPhoto'

function photo(opts: Partial<{ isVideo: boolean; hasOcr: boolean }> = {}) {
  return assetToPhoto({
    id: 'x',
    mimeType: opts.isVideo ? 'video/mp4' : 'image/jpeg',
    hasOcr: opts.hasOcr,
  })
}

describe('matchesTab', () => {
  it("tab='all' matches everything", () => {
    expect(matchesTab(photo(), 'all')).toBe(true)
    expect(matchesTab(photo({ isVideo: true }), 'all')).toBe(true)
    expect(matchesTab(photo({ hasOcr: true }), 'all')).toBe(true)
  })

  it("tab='video' matches only isVideo", () => {
    expect(matchesTab(photo({ isVideo: true }), 'video')).toBe(true)
    expect(matchesTab(photo(), 'video')).toBe(false)
    expect(matchesTab(photo({ hasOcr: true }), 'video')).toBe(false)
  })

  it("tab='ocr' matches only hasOcr", () => {
    expect(matchesTab(photo({ hasOcr: true }), 'ocr')).toBe(true)
    expect(matchesTab(photo(), 'ocr')).toBe(false)
    expect(matchesTab(photo({ isVideo: true }), 'ocr')).toBe(false)
  })

  it("tab='photo' (and any other value) matches plain photos: not video, not OCR", () => {
    expect(matchesTab(photo(), 'photo')).toBe(true)
    expect(matchesTab(photo({ isVideo: true }), 'photo')).toBe(false)
    expect(matchesTab(photo({ hasOcr: true }), 'photo')).toBe(false)
    // Vue2 branch order falls through to the photo-like predicate for any
    // unrecognized tab string too — preserved verbatim.
    expect(matchesTab(photo(), 'bogus')).toBe(true)
    expect(matchesTab(photo({ isVideo: true }), 'bogus')).toBe(false)
  })
})
