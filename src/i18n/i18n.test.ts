import { describe, it, expect } from 'vitest'
import { messages } from './zh_cn'

describe('i18n zh_cn messages', () => {
  it('provides required skeleton keys', () => {
    expect(messages.zh_cn.backToOld).toBe('← 返回主应用')
    expect(messages.zh_cn.cpu).toBe('处理器')
    expect(messages.zh_cn.collecting).toBe('采集中…')
  })
})
