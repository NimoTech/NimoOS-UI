import { describe, it, expect } from 'vitest'
import { FileDigester } from './digester'
import type { ReceivedFile } from './protocol'

describe('FileDigester', () => {
  it('filled bytes trigger callback, assemble Blob, progress monotonic', () => {
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
  it('when size=0, progress NaN normalizes (Vue2 behavior)', () => {
    let called = false
    const d = new FileDigester({ name: 'e', mime: '', size: 0 }, () => { called = true })
    d.unchunk(new Uint8Array(0).buffer)
    expect(d.progress).toBe(1)
    expect(called).toBe(true) // 0 >= 0, immediately complete
  })
})
