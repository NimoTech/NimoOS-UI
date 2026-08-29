import { describe, it, expect, beforeEach } from 'vitest'
import { LAST_TAB_KEY, readLastTab, writeLastTab } from './lastTab'

describe('settings tab "last tab" memory', () => {
  beforeEach(() => localStorage.clear())

  it('reuses the Vue2 localStorage key name', () => {
    expect(LAST_TAB_KEY).toBe('nimoos_settings_last_tab')
  })

  it('empty storage → general', () => {
    expect(readLastTab()).toBe('general')
  })

  it('reads back a written, valid tab', () => {
    writeLastTab('network')
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('network')
    expect(readLastTab()).toBe('network')
  })

  it('stored an invalid value → falls back to general (not a crash, not returned as-is)', () => {
    localStorage.setItem(LAST_TAB_KEY, 'bogus')
    expect(readLastTab()).toBe('general')
  })

  it('localStorage throwing (private mode / quota) does not blow up either -- falls back to general', () => {
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

  it('a write throwing is swallowed and does not affect the caller', () => {
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
