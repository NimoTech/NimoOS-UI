import { describe, it, expect } from 'vitest'
import { joinPath, renameTo } from './pathOps'

describe('pathOps', () => {
  it('joinPath concatenates and collapses repeated slashes', () => {
    expect(joinPath('/DATA/Docs', 'a.txt')).toBe('/DATA/Docs/a.txt')
    expect(joinPath('/DATA/Docs/', 'a.txt')).toBe('/DATA/Docs/a.txt')
  })
  it('joinPath root directory', () => {
    expect(joinPath('/', 'New Folder')).toBe('/New Folder')
  })
  it('renameTo replaces last segment and preserves parent directory', () => {
    expect(renameTo('/DATA/Docs/old.txt', 'new.txt')).toBe('/DATA/Docs/new.txt')
  })
  it('renameTo top-level item', () => {
    expect(renameTo('/DATA', 'HD')).toBe('/HD')
  })
})
