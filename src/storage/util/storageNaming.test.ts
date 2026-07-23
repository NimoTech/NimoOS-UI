import { describe, it, expect } from 'vitest'
import { DEFAULT_STORAGE_NAME, computeNextStorageName } from './storageNaming'

describe('computeNextStorageName', () => {
  it('无冲突时返回 base 本身', () => {
    expect(computeNextStorageName()).toBe('Main-storage')
    expect(computeNextStorageName('Main-storage', [])).toBe('Main-storage')
  })
  it('冲突时追加递增序号,取第一个空位', () => {
    expect(computeNextStorageName('Main-storage', ['Main-storage'])).toBe('Main-storage1')
    expect(computeNextStorageName('Main-storage', ['Main-storage', 'Main-storage1'])).toBe('Main-storage2')
    // 序号有洞取最小
    expect(computeNextStorageName('Main-storage', ['Main-storage', 'Main-storage2'])).toBe('Main-storage1')
  })
  it('大小写不敏感去重', () => {
    expect(computeNextStorageName('Main-storage', ['MAIN-STORAGE'])).toBe('Main-storage1')
  })
  it('忽略空值项', () => {
    expect(computeNextStorageName('Main-storage', ['', 'Main-storage'])).toBe('Main-storage1')
  })
  it('默认名常量导出', () => {
    expect(DEFAULT_STORAGE_NAME).toBe('Main-storage')
  })
})
