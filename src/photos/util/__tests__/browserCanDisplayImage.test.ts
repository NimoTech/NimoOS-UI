import { describe, it, expect } from 'vitest'
import { browserCanDisplayImage } from '../browserCanDisplayImage'
it('allows common decodable types (case-insensitive)', () => {
  expect(browserCanDisplayImage('image/JPEG')).toBe(true)
  expect(browserCanDisplayImage('image/webp')).toBe(true)
  expect(browserCanDisplayImage('image/avif')).toBe(true)
})
it('HEIC/TIFF/RAW/empty → false (must fall back to the large thumbnail)', () => {
  expect(browserCanDisplayImage('image/heic')).toBe(false)
  expect(browserCanDisplayImage('image/tiff')).toBe(false)
  expect(browserCanDisplayImage('')).toBe(false)
  expect(browserCanDisplayImage(null)).toBe(false)
})
