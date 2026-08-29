import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useViewer } from './useViewer'
import type { FileEntry } from '../stores/files'

const entry = (name: string): FileEntry => ({ name, path: '/DATA/' + name, is_dir: false } as FileEntry)

describe('useViewer history integration (back button only closes preview)', () => {
  let back: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const v = useViewer()
    if (v.open.value) v.close() // singleton reset
    back.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('Opening preview pushes one history entry; popstate (back button) only closes preview', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const v = useViewer()
    expect(v.openItem(entry('a.png'), [entry('a.png')])).toBe(true)
    expect(push).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(v.open.value).toBe(false)
    expect(back).not.toHaveBeenCalled() // history entry already consumed by back button, no need to supplement with back()
  })

  it('X/ESC manually closing consumes the pushed entry (history.back exactly once)', () => {
    const v = useViewer()
    v.openItem(entry('a.png'), [entry('a.png')])
    v.close()
    expect(v.open.value).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('Switching files inside preview does not duplicate push to stack', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const v = useViewer()
    v.openItem(entry('a.png'), [entry('a.png'), entry('b.png')])
    v.openItem(entry('b.png'), [entry('a.png'), entry('b.png')])
    expect(push).toHaveBeenCalledTimes(1)
    v.close()
  })
})
