import { describe, it, expect } from 'vitest'
import { isAlreadyShared, shareableFolders } from './shareGate'
import type { FileEntry } from '../stores/files'

const dir = (name: string, shared?: string): FileEntry => ({
  name,
  path: `/DATA/${name}`,
  is_dir: true,
  extensions: shared === undefined ? null : { share: { shared } },
})
const file = (name: string): FileEntry => ({ name, path: `/DATA/${name}`, is_dir: false })

describe('isAlreadyShared', () => {
  it('only entries with extensions.share.shared === "true" count as already shared', () => {
    expect(isAlreadyShared(dir('x', 'true'))).toBe(true)
  })

  it('string "false" does not count as already shared', () => {
    expect(isAlreadyShared(dir('x', 'false'))).toBe(false)
  })

  it('entries without extensions are not already shared', () => {
    expect(isAlreadyShared(dir('x'))).toBe(false)
  })

  it('extensions being null does not count as already shared (backend really returns null)', () => {
    expect(isAlreadyShared({ name: 'x', path: '/DATA/x', is_dir: true, extensions: null })).toBe(false)
  })
})

describe('shareableFolders', () => {
  it('all shareable → all go into targets, skipped is 0', () => {
    const r = shareableFolders([dir('a'), dir('b')])
    expect(r.targets.map((e) => e.name)).toEqual(['a', 'b'])
    expect(r.skipped).toBe(0)
  })

  it('some already shared → only unshareable remain, skipped counts the already-shared', () => {
    const r = shareableFolders([dir('a'), dir('b', 'true'), dir('c'), dir('d', 'true')])
    expect(r.targets.map((e) => e.name)).toEqual(['a', 'c'])
    expect(r.skipped).toBe(2)
  })

  it('all already shared → targets empty, skipped counts all', () => {
    const r = shareableFolders([dir('a', 'true'), dir('b', 'true')])
    expect(r.targets).toEqual([])
    expect(r.skipped).toBe(2)
  })

  it('non-folders are dropped and not counted in skipped (skipped only means "would be shared but already is")', () => {
    const r = shareableFolders([dir('a'), file('b.txt')])
    expect(r.targets.map((e) => e.name)).toEqual(['a'])
    expect(r.skipped).toBe(0)
  })

  it('empty input → empty targets, skipped is 0', () => {
    expect(shareableFolders([])).toEqual({ targets: [], skipped: 0 })
  })
})
