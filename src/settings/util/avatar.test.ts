import { describe, it, expect, beforeEach } from 'vitest'
import { isAllowedImageFile, readAccessToken } from './avatar'

describe('readAccessToken', () => {
  beforeEach(() => localStorage.clear())
  it('读 localStorage 的 access_token', () => {
    localStorage.setItem('access_token', 'abc')
    expect(readAccessToken()).toBe('abc')
  })
  it('没有则返回 null(<img> 会拿到不带 token 的 URL;localhost 免鉴权时仍然通)', () => {
    expect(readAccessToken()).toBeNull()
  })
})

describe('isAllowedImageFile —— 1:1 对位 Vue2 onFileSelected(:252-259)', () => {
  it('mime 命中即通过', () => {
    expect(isAllowedImageFile('whatever.bin', 'image/png')).toBe(true)
  })
  it('mime 不命中但扩展名命中也通过(Vue2 是 || 关系)', () => {
    expect(isAllowedImageFile('photo.WEBP', 'application/octet-stream')).toBe(true)
  })
  it('两者都不命中则拒绝', () => {
    expect(isAllowedImageFile('doc.pdf', 'application/pdf')).toBe(false)
  })
  it('扩展名大小写不敏感', () => {
    expect(isAllowedImageFile('a.JPG', '')).toBe(true)
  })
  it('无扩展名且无 mime 时拒绝', () => {
    expect(isAllowedImageFile('noext', '')).toBe(false)
  })
  it('六种扩展名与五种 mime 与 Vue2 逐字一致,svg 不在任何名单里', () => {
    for (const e of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']) {
      expect(isAllowedImageFile(`x.${e}`, '')).toBe(true)
    }
    for (const m of ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']) {
      expect(isAllowedImageFile('x.zzz', m)).toBe(true)
    }
    expect(isAllowedImageFile('x.svg', 'image/svg+xml')).toBe(false)
  })
})
