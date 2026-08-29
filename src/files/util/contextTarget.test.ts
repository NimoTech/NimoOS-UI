import { describe, it, expect } from 'vitest'
import { contextTargets } from './contextTarget'
import type { FileEntry } from '../stores/files'

const f = (name: string): FileEntry => ({ name, path: `/DATA/${name}`, is_dir: false })
const A = f('a.txt')
const B = f('b.txt')
const C = f('c.txt')

describe('contextTargets', () => {
  it('acts on the clicked entry alone when it is outside the selection (the F11 regression)', () => {
    expect(contextTargets(A, [B, C])).toEqual([A])
  })

  it('acts on the entire selection when the clicked entry is in it and selection has >1 item', () => {
    expect(contextTargets(B, [B, C])).toEqual([B, C])
  })

  it('acts on the clicked entry only when selection has exactly one item, even if the clicked entry is that one item', () => {
    // Vue2 ContextMenu.vue:274 gates on length > 1; when selection has one item we take the single-item path,
    // so the menu renders its single-item shape (rename/copy path enabled).
    expect(contextTargets(B, [B])).toEqual([B])
  })

  it('acts on the clicked entry when selection is empty', () => {
    expect(contextTargets(A, [])).toEqual([A])
  })

  it('returns the selection unchanged when there is no clicked entry (toolbar batch entry point)', () => {
    expect(contextTargets(null, [B, C])).toEqual([B, C])
  })

  it('returns empty array when there is no clicked entry and selection is empty', () => {
    expect(contextTargets(null, [])).toEqual([])
  })

  it('membership in selection is determined by path, not object identity', () => {
    const bCopy = { ...B }
    expect(contextTargets(bCopy, [B, C])).toEqual([B, C])
  })
})
