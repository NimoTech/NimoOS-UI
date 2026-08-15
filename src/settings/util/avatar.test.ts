import { describe, it, expect, beforeEach } from 'vitest'
import { isAllowedImageFile, readAccessToken } from './avatar'

describe('readAccessToken', () => {
  beforeEach(() => localStorage.clear())
  it('reads access_token from localStorage', () => {
    localStorage.setItem('access_token', 'abc')
    expect(readAccessToken()).toBe('abc')
  })
  it('returns null when absent (<img> gets a URL without a token; still works when localhost is exempt from auth)', () => {
    expect(readAccessToken()).toBeNull()
  })
})

describe('isAllowedImageFile -- 1:1 mirrors Vue2 onFileSelected (:252-259)', () => {
  it('passes when mime matches', () => {
    expect(isAllowedImageFile('whatever.bin', 'image/png')).toBe(true)
  })
  it('also passes when mime does not match but the extension does (Vue2 uses an || relationship)', () => {
    expect(isAllowedImageFile('photo.WEBP', 'application/octet-stream')).toBe(true)
  })
  it('rejects when neither matches', () => {
    expect(isAllowedImageFile('doc.pdf', 'application/pdf')).toBe(false)
  })
  it('extension matching is case-insensitive', () => {
    expect(isAllowedImageFile('a.JPG', '')).toBe(true)
  })
  it('rejects when there is no extension and no mime', () => {
    expect(isAllowedImageFile('noext', '')).toBe(false)
  })
  it('six extensions and five mime types match Vue2 exactly, svg is on neither list', () => {
    for (const e of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']) {
      expect(isAllowedImageFile(`x.${e}`, '')).toBe(true)
    }
    for (const m of ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']) {
      expect(isAllowedImageFile('x.zzz', m)).toBe(true)
    }
    expect(isAllowedImageFile('x.svg', 'image/svg+xml')).toBe(false)
  })
})
