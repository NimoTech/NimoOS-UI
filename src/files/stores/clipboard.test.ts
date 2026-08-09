// src/files/stores/clipboard.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useClipboardStore } from './clipboard'

describe('clipboard store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('operate(copy) 写入 operateObject,item 含 from(真实路径)+is_dir', () => {
    const c = useClipboardStore()
    c.operate('copy', [{ path: '/DATA/a.txt', is_dir: false }, { path: '/DATA/b.txt', is_dir: false }])
    expect(c.operateObject).toEqual({
      type: 'copy',
      item: [{ from: '/DATA/a.txt', is_dir: false }, { from: '/DATA/b.txt', is_dir: false }],
    })
    expect(c.hasPasteData).toBe(true)
  })

  it('operate(move) 写 type:move', () => {
    const c = useClipboardStore()
    c.operate('move', [{ path: '/DATA/x', is_dir: false }])
    expect(c.operateObject?.type).toBe('move')
  })

  it('records is_dir alongside the path so paste can tell folders from files', () => {
    const store = useClipboardStore()
    store.operate('copy', [
      { path: '/DATA/Trip', is_dir: true },
      { path: '/DATA/a.txt', is_dir: false },
    ])
    expect(store.operateObject?.item).toEqual([
      { from: '/DATA/Trip', is_dir: true },
      { from: '/DATA/a.txt', is_dir: false },
    ])
  })

  it('isCut 仅在 move 且路径匹配时为 true;copy 永不灰显', () => {
    const c = useClipboardStore()
    c.operate('copy', [{ path: '/DATA/a', is_dir: false }])
    expect(c.isCut('/DATA/a')).toBe(false) // copy 不算 cut
    c.operate('move', [{ path: '/DATA/a', is_dir: false }, { path: '/DATA/b', is_dir: false }])
    expect(c.isCut('/DATA/a')).toBe(true)
    expect(c.isCut('/DATA/c')).toBe(false)
  })

  it('isCut still matches on the real path only', () => {
    const store = useClipboardStore()
    store.operate('move', [{ path: '/DATA/Trip', is_dir: true }])
    expect(store.isCut('/DATA/Trip')).toBe(true)
    expect(store.isCut('/DATA/other')).toBe(false)
  })

  it('clear 清空,hasPasteData 变 false', () => {
    const c = useClipboardStore()
    c.operate('move', [{ path: '/DATA/a', is_dir: false }])
    c.clear()
    expect(c.operateObject).toBeNull()
    expect(c.hasPasteData).toBe(false)
    expect(c.isCut('/DATA/a')).toBe(false)
  })
})
