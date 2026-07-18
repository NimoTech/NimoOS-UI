import { describe, it, expect } from 'vitest'
import { FileDigester } from './digester'
import type { ReceivedFile } from './protocol'

describe('FileDigester', () => {
  it('收满字节才回调,组装 Blob,进度单调', () => {
    let done: ReceivedFile | null = null
    const d = new FileDigester({ name: 'a.txt', mime: 'text/plain', size: 10 }, (f) => { done = f })
    d.unchunk(new Uint8Array(4).buffer)
    expect(d.progress).toBeCloseTo(0.4)
    expect(done).toBeNull()
    d.unchunk(new Uint8Array(6).buffer)
    expect(done).not.toBeNull()
    expect(done!.name).toBe('a.txt')
    expect(done!.size).toBe(10)
    expect(done!.blob.size).toBe(10)
  })
  it('size=0 时进度 NaN 归一(Vue2 行为)', () => {
    let called = false
    const d = new FileDigester({ name: 'e', mime: '', size: 0 }, () => { called = true })
    d.unchunk(new Uint8Array(0).buffer)
    expect(d.progress).toBe(1)
    expect(called).toBe(true) // 0 >= 0,立即完成
  })
})
