import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { useLayoutStore } from '../stores/layout'
import { resizePreview, useDragResize } from './useDragResize'

describe('resizePreview', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('wysiwyg when target size fits in free space', () => {
    const s = useLayoutStore(); s.replaceAll([{ kind: 'widget', key: 'cpu', c: 1, r: 1, w: 2, h: 2 }])
    const id = s.items[0].id
    const it = s.items[0]
    expect(resizePreview(it, 3, 2, s.items, { cols: 12, rows: 8 }).mode).toBe('wysiwyg')
    void id
  })
  it('ghost when target overlaps another item', () => {
    const s = useLayoutStore(); s.replaceAll([
      { kind: 'widget', key: 'cpu', c: 1, r: 1, w: 2, h: 2 },
      { kind: 'app', key: 'files', c: 3, r: 1, w: 1, h: 1 },
    ])
    const it = s.items[0]
    const p = resizePreview(it, 4, 2, s.items, { cols: 12, rows: 8 }) // 盖住 files
    expect(p.mode).toBe('ghost')
    expect(p.ok).toBe(true) // files 能让位
  })
})

describe('useDragResize drag commit', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('committing a drag applies the plan and saves', () => {
    const s = useLayoutStore(); s.replaceAll([{ kind: 'app', key: 'files', c: 1, r: 1, w: 1, h: 1 }])
    const saveSpy = vi.spyOn(s, 'save').mockImplementation(() => {})
    const dr = useDragResize({ cell: ref(84), gap: ref(16), cols: 12, rows: 8, gridEl: ref(null) })
    const it = s.items[0]
    // 模拟:按下 → 目标格 (5,5) → 松手
    dr.onPointerDown({ clientX: 0, clientY: 0, pointerId: 1, preventDefault() {}, target: { setPointerCapture() {} } } as any, it, 'drag', { x: 0, y: 0 })
    dr.commitDragForTest(5, 5) // 测试友好提交:见 Interfaces/实现
    expect(s.items[0]).toMatchObject({ c: 5, r: 5 })
    expect(saveSpy).toHaveBeenCalled()
  })
})
