import { describe, it, expect } from 'vitest'
import { joinPath, renameTo } from './pathOps'

describe('pathOps', () => {
  it('joinPath 拼接,折叠重复斜杠', () => {
    expect(joinPath('/DATA/Docs', 'a.txt')).toBe('/DATA/Docs/a.txt')
    expect(joinPath('/DATA/Docs/', 'a.txt')).toBe('/DATA/Docs/a.txt')
  })
  it('joinPath 根目录', () => {
    expect(joinPath('/', 'New Folder')).toBe('/New Folder')
  })
  it('renameTo 替换末段保留父目录', () => {
    expect(renameTo('/DATA/Docs/old.txt', 'new.txt')).toBe('/DATA/Docs/new.txt')
  })
  it('renameTo 顶层项', () => {
    expect(renameTo('/DATA', 'HD')).toBe('/HD')
  })
})
