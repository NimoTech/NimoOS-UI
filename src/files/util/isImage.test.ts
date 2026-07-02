import { describe, it, expect } from 'vitest'
import { isImageEntry } from './isImage'

describe('isImageEntry', () => {
  it('true for image files (case-insensitive)', () => {
    expect(isImageEntry({ name: 'p.png', is_dir: false })).toBe(true)
    expect(isImageEntry({ name: 'P.JPG', is_dir: false })).toBe(true)
    expect(isImageEntry({ name: 'a.webp', is_dir: false })).toBe(true)
  })
  it('false for non-images and directories', () => {
    expect(isImageEntry({ name: 'a.txt', is_dir: false })).toBe(false)
    expect(isImageEntry({ name: 'v.mp4', is_dir: false })).toBe(false)
    expect(isImageEntry({ name: 'Pics', is_dir: true })).toBe(false)
  })
})
