// src/files/stores/clipboard.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useClipboardStore } from './clipboard'

describe('clipboard store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('operate(copy) 写入 operateObject,item 只含 from(真实路径)', () => {
    const c = useClipboardStore()
    c.operate('copy', ['/DATA/a.txt', '/DATA/b.txt'])
    expect(c.operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/a.txt' }, { from: '/DATA/b.txt' }] })
    expect(c.hasPasteData).toBe(true)
  })

  it('operate(move) 写 type:move', () => {
    const c = useClipboardStore()
    c.operate('move', ['/DATA/x'])
    expect(c.operateObject?.type).toBe('move')
  })

  it('isCut 仅在 move 且路径匹配时为 true;copy 永不灰显', () => {
    const c = useClipboardStore()
    c.operate('copy', ['/DATA/a'])
    expect(c.isCut('/DATA/a')).toBe(false) // copy 不算 cut
    c.operate('move', ['/DATA/a', '/DATA/b'])
    expect(c.isCut('/DATA/a')).toBe(true)
    expect(c.isCut('/DATA/c')).toBe(false)
  })

  it('clear 清空,hasPasteData 变 false', () => {
    const c = useClipboardStore()
    c.operate('move', ['/DATA/a'])
    c.clear()
    expect(c.operateObject).toBeNull()
    expect(c.hasPasteData).toBe(false)
    expect(c.isCut('/DATA/a')).toBe(false)
  })
})
