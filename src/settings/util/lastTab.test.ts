import { describe, it, expect, beforeEach } from 'vitest'
import { LAST_TAB_KEY, readLastTab, writeLastTab } from './lastTab'

describe('设置区「上次 tab」记忆', () => {
  beforeEach(() => localStorage.clear())

  it('沿用 Vue2 的 localStorage 键名', () => {
    expect(LAST_TAB_KEY).toBe('nimoos_settings_last_tab')
  })

  it('空存储 → general', () => {
    expect(readLastTab()).toBe('general')
  })

  it('读回写入的合法 tab', () => {
    writeLastTab('network')
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('network')
    expect(readLastTab()).toBe('network')
  })

  it('存了非法值 → 回落 general(不是崩,也不是原样返回)', () => {
    localStorage.setItem(LAST_TAB_KEY, 'bogus')
    expect(readLastTab()).toBe('general')
  })

  it('localStorage 抛错(隐私模式/配额)也不炸,回落 general', () => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('denied')
    }
    try {
      expect(readLastTab()).toBe('general')
    } finally {
      Storage.prototype.getItem = orig
    }
  })

  it('写入抛错被吞掉,不影响调用方', () => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      expect(() => writeLastTab('apps')).not.toThrow()
    } finally {
      Storage.prototype.setItem = orig
    }
  })
})
