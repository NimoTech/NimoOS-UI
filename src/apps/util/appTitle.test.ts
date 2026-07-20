import { describe, it, expect } from 'vitest'
import { resolveAppTitle, resolveAppText } from './appTitle'

describe('resolveAppTitle', () => {
  it('容忍语言键大小写:zh_cn > en_us > en_US > zh_CN > 任意值 > fallback', () => {
    expect(resolveAppTitle({ zh_cn: '甲', en_US: 'A' }, 'x')).toBe('甲')
    expect(resolveAppTitle({ en_US: 'Actual Budget' }, 'x')).toBe('Actual Budget') // 真机实证:store 应用只有大写 en_US
    expect(resolveAppTitle({ de_DE: 'B' }, 'x')).toBe('B')
    expect(resolveAppTitle({}, 'jellyfin')).toBe('jellyfin')
    expect(resolveAppTitle(undefined, 'jellyfin')).toBe('jellyfin')
  })
})

describe('resolveAppText', () => {
  it('镜像 Vue2 ice_i18n:custom > 当前 lang > en_us > en_US > 任意值 > fallback', () => {
    expect(resolveAppText({ custom: '我的名', zh_cn: '甲' }, 'zh_cn')).toBe('我的名')
    expect(resolveAppText({ zh_cn: '甲', en_us: 'A' }, 'zh_cn')).toBe('甲')
    expect(resolveAppText({ zh_cn: '甲', en_us: 'A' }, 'en_us')).toBe('A')
    expect(resolveAppText({ en_us: 'Jellyfin' }, 'zh_cn')).toBe('Jellyfin') // 真机实证:title 常只有 en_us
    expect(resolveAppText({ en_US: 'Actual Budget' }, 'zh_cn')).toBe('Actual Budget')
    expect(resolveAppText({ de_de: 'B' }, 'zh_cn')).toBe('B')
    expect(resolveAppText({}, 'zh_cn', 'jellyfin')).toBe('jellyfin')
    expect(resolveAppText(undefined, 'zh_cn')).toBe('')
  })
})
