import { describe, it, expect } from 'vitest'
import {
  SETTINGS_TABS,
  RAIL_TABS,
  DEFAULT_TAB,
  TAB_LABEL_KEY,
  isSettingsTab,
  railTabsFor,
} from './tabs'

describe('settings tabs 模型', () => {
  it('9 个 tab,顺序与 Vue2 一致(rail 7 项 + account + developer)', () => {
    expect(SETTINGS_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'folder-permissions',
      'account',
      'developer',
    ])
  })

  it('rail 只有 7 项 —— account 走用户块、developer 走 general 页内入口(Vue2 L855-863/L13/L315)', () => {
    expect(RAIL_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'folder-permissions',
    ])
  })

  it('默认 tab 是 general', () => {
    expect(DEFAULT_TAB).toBe('general')
  })

  it('每个 tab 都有文案 key', () => {
    for (const t of SETTINGS_TABS) {
      expect(typeof TAB_LABEL_KEY[t], t).toBe('string')
      expect(TAB_LABEL_KEY[t].length, t).toBeGreaterThan(0)
    }
  })

  it('isSettingsTab 只认已知 id', () => {
    expect(isSettingsTab('general')).toBe(true)
    expect(isSettingsTab('system-status')).toBe(true)
    expect(isSettingsTab('nope')).toBe(false)
    expect(isSettingsTab('')).toBe(false)
    expect(isSettingsTab(undefined)).toBe(false)
    expect(isSettingsTab(null)).toBe(false)
    expect(isSettingsTab(['general'])).toBe(false)
  })

  it('admin 看到全部 7 项', () => {
    expect(railTabsFor('admin')).toEqual(RAIL_TABS)
  })

  it('非 admin 看不到 folder-permissions(Vue2 visibleTabs L1034)', () => {
    expect(railTabsFor('user')).not.toContain('folder-permissions')
    expect(railTabsFor('user')).toHaveLength(6)
  })

  it('role 缺失按非 admin 处理(保守:不泄漏管理项)', () => {
    expect(railTabsFor(undefined)).not.toContain('folder-permissions')
  })
})
