import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useViewer } from './useViewer'
import type { FileEntry } from '../stores/files'

const entry = (name: string): FileEntry => ({ name, path: '/DATA/' + name, is_dir: false } as FileEntry)

describe('useViewer 历史集成(返回键只关预览)', () => {
  let back: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const v = useViewer()
    if (v.open.value) v.close() // 单例复位
    back.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('打开预览压入一条历史记录;popstate(返回键)只关预览', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const v = useViewer()
    expect(v.openItem(entry('a.png'), [entry('a.png')])).toBe(true)
    expect(push).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(v.open.value).toBe(false)
    expect(back).not.toHaveBeenCalled() // 记录已被返回键消耗,不再补 back
  })

  it('X/ESC 主动关闭时吃掉压入的记录(history.back 恰好一次)', () => {
    const v = useViewer()
    v.openItem(entry('a.png'), [entry('a.png')])
    v.close()
    expect(v.open.value).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('预览内切换文件不重复压栈', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const v = useViewer()
    v.openItem(entry('a.png'), [entry('a.png'), entry('b.png')])
    v.openItem(entry('b.png'), [entry('a.png'), entry('b.png')])
    expect(push).toHaveBeenCalledTimes(1)
    v.close()
  })
})
