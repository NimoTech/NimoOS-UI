import { describe, it, expect, vi } from 'vitest'
import { blockedBySnapshotView } from './snapshotRestore'

describe('blockedBySnapshotView', () => {
  it('不在快照里 → 放行,不吐 toast', () => {
    const toast = vi.fn()
    expect(blockedBySnapshotView(false, toast, 'nope')).toBe(false)
    expect(toast).not.toHaveBeenCalled()
  })
  it('在快照里 → 拦截并吐 toast', () => {
    const toast = vi.fn()
    expect(blockedBySnapshotView(true, toast, '只读')).toBe(true)
    expect(toast).toHaveBeenCalledWith('只读')
  })
})
