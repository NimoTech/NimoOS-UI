import { describe, it, expect } from 'vitest'
import { resolveAppTitle } from './appTitle'

describe('resolveAppTitle', () => {
  it('容忍语言键大小写:zh_cn > en_us > en_US > zh_CN > 任意值 > fallback', () => {
    expect(resolveAppTitle({ zh_cn: '甲', en_US: 'A' }, 'x')).toBe('甲')
    expect(resolveAppTitle({ en_US: 'Actual Budget' }, 'x')).toBe('Actual Budget') // 真机实证:store 应用只有大写 en_US
    expect(resolveAppTitle({ de_DE: 'B' }, 'x')).toBe('B')
    expect(resolveAppTitle({}, 'jellyfin')).toBe('jellyfin')
    expect(resolveAppTitle(undefined, 'jellyfin')).toBe('jellyfin')
  })
})
