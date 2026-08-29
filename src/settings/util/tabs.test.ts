import { describe, it, expect } from 'vitest'
import {
  SETTINGS_TABS,
  RAIL_TABS,
  DEFAULT_TAB,
  TAB_LABEL_KEY,
  isSettingsTab,
  railTabsFor,
} from './tabs'

describe('settings tabs model', () => {
  it('has 10 tabs in Vue2 order (8 rail items + account + developer)', () => {
    expect(SETTINGS_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'lan-devices',
      'folder-permissions',
      'account',
      'developer',
    ])
  })

  it('the rail holds 8 items -- account has its own entry, developer sits inside general', () => {
    expect(RAIL_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'lan-devices',
      'folder-permissions',
    ])
  })

  it('default tab is general', () => {
    expect(DEFAULT_TAB).toBe('general')
  })

  it('every tab has a label key', () => {
    for (const t of SETTINGS_TABS) {
      expect(typeof TAB_LABEL_KEY[t], t).toBe('string')
      expect(TAB_LABEL_KEY[t].length, t).toBeGreaterThan(0)
    }
  })

  it('isSettingsTab only recognizes known ids', () => {
    expect(isSettingsTab('general')).toBe(true)
    expect(isSettingsTab('system-status')).toBe(true)
    expect(isSettingsTab('nope')).toBe(false)
    expect(isSettingsTab('')).toBe(false)
    expect(isSettingsTab(undefined)).toBe(false)
    expect(isSettingsTab(null)).toBe(false)
    expect(isSettingsTab(['general'])).toBe(false)
  })

  it('admin sees all 8 rail items', () => {
    expect(railTabsFor('admin')).toEqual(RAIL_TABS)
  })

  it('a non-admin does not see folder-permissions (Vue2 visibleTabs L1034)', () => {
    expect(railTabsFor('user')).not.toContain('folder-permissions')
    expect(railTabsFor('user')).toHaveLength(7)
  })

  it('a missing role is treated as non-admin (conservative: does not leak admin entries)', () => {
    expect(railTabsFor(undefined)).not.toContain('folder-permissions')
  })
})
