import { describe, it, expect } from 'vitest'
import zh from './zh_cn'

describe('i18n zh_cn messages', () => {
  it('provides required skeleton keys', () => {
    expect(zh.backToOld).toBe('← 返回主应用')
    expect(zh.cpu).toBe('处理器')
    expect(zh.collecting).toBe('采集中…')
  })
})
