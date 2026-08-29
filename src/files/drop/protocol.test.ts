import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE, MAX_PARTITION_SIZE, encodeText, decodeText } from './protocol'

describe('drop protocol', () => {
  it('constants match Vue2 exactly', () => {
    expect(CHUNK_SIZE).toBe(64000)
    expect(MAX_PARTITION_SIZE).toBe(1e6)
  })
  it('text encoding/decoding matches Vue2 btoa(unescape(encodeURIComponent)) and round-trips', () => {
    // When Vue2 sends "3" (file count) on the wire, btoa("3") === "Mw=="
    expect(encodeText('3')).toBe('Mw==')
    expect(decodeText('Mw==')).toBe('3')
    const cjk = '中文文件名📁'
    expect(decodeText(encodeText(cjk))).toBe(cjk)
    // Exact byte-for-byte match with Vue2 algorithm
    const vue2Encode = (t: string) => btoa(unescape(encodeURIComponent(t)))
    expect(encodeText(cjk)).toBe(vue2Encode(cjk))
  })
})
