import { describe, it, expect } from 'vitest'
import { resolveAppTitle, resolveAppText } from './appTitle'

describe('resolveAppTitle', () => {
  it('tolerate language key case-insensitivity: zh_cn > en_us > en_US > zh_CN > any value > fallback', () => {
    expect(resolveAppTitle({ zh_cn: '甲', en_US: 'A' }, 'x')).toBe('甲')
    expect(resolveAppTitle({ en_US: 'Actual Budget' }, 'x')).toBe('Actual Budget') // verified on device: store apps only have uppercase en_US
    expect(resolveAppTitle({ de_DE: 'B' }, 'x')).toBe('B')
    expect(resolveAppTitle({}, 'jellyfin')).toBe('jellyfin')
    expect(resolveAppTitle(undefined, 'jellyfin')).toBe('jellyfin')
  })
})

describe('resolveAppText', () => {
  it('mirror Vue2 ice_i18n: custom > current lang > en_us > en_US > any value > fallback', () => {
    expect(resolveAppText({ custom: '我的名', zh_cn: '甲' }, 'zh_cn')).toBe('我的名')
    expect(resolveAppText({ zh_cn: '甲', en_us: 'A' }, 'zh_cn')).toBe('甲')
    expect(resolveAppText({ zh_cn: '甲', en_us: 'A' }, 'en_us')).toBe('A')
    expect(resolveAppText({ en_us: 'Jellyfin' }, 'zh_cn')).toBe('Jellyfin') // verified on device: title often only has en_us
    expect(resolveAppText({ en_US: 'Actual Budget' }, 'zh_cn')).toBe('Actual Budget')
    expect(resolveAppText({ de_de: 'B' }, 'zh_cn')).toBe('B')
    expect(resolveAppText({}, 'zh_cn', 'jellyfin')).toBe('jellyfin')
    expect(resolveAppText(undefined, 'zh_cn')).toBe('')
  })
})
