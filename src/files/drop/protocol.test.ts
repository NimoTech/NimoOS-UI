import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE, MAX_PARTITION_SIZE, encodeText, decodeText } from './protocol'

describe('drop protocol', () => {
  it('常量与 Vue2 逐字一致', () => {
    expect(CHUNK_SIZE).toBe(64000)
    expect(MAX_PARTITION_SIZE).toBe(1e6)
  })
  it('文本编解码与 Vue2 btoa(unescape(encodeURIComponent)) 一致且可往返', () => {
    // Vue2 发送 "3"(文件计数)时 wire 上是 btoa("3") === "Mw=="
    expect(encodeText('3')).toBe('Mw==')
    expect(decodeText('Mw==')).toBe('3')
    const cjk = '中文文件名📁'
    expect(decodeText(encodeText(cjk))).toBe(cjk)
    // 与 Vue2 算法逐字对拍
    const vue2Encode = (t: string) => btoa(unescape(encodeURIComponent(t)))
    expect(encodeText(cjk)).toBe(vue2Encode(cjk))
  })
})
