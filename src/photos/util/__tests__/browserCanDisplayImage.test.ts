import { describe, it, expect } from 'vitest'
import { browserCanDisplayImage } from '../browserCanDisplayImage'
it('允许常见可解码类型(大小写不敏感)', () => {
  expect(browserCanDisplayImage('image/JPEG')).toBe(true)
  expect(browserCanDisplayImage('image/webp')).toBe(true)
  expect(browserCanDisplayImage('image/avif')).toBe(true)
})
it('HEIC/TIFF/RAW/空 → false(须回退大图缩略图)', () => {
  expect(browserCanDisplayImage('image/heic')).toBe(false)
  expect(browserCanDisplayImage('image/tiff')).toBe(false)
  expect(browserCanDisplayImage('')).toBe(false)
  expect(browserCanDisplayImage(null)).toBe(false)
})
