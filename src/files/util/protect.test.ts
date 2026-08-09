import { describe, it, expect } from 'vitest'
import { PROTECTED, canOperate, splitProtectedUploads } from './protect'
import type { FileEntry } from '../stores/files'

function e(p: Partial<FileEntry>): FileEntry {
  return { name: 'x', path: '/DATA/x', is_dir: false, ...p }
}

describe('protect', () => {
  it('PROTECTED 列出 5 个系统默认文件夹', () => {
    expect(PROTECTED).toEqual(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media'])
  })
  it('保护:系统默认文件夹(dir 且 name 命中)不可操作', () => {
    expect(canOperate(e({ name: 'Documents', is_dir: true, path: '/DATA/Documents' }))).toBe(false)
  })
  it('同名文件(非 dir)不受保护', () => {
    expect(canOperate(e({ name: 'Documents', is_dir: false }))).toBe(true)
  })
  it('普通文件夹可操作', () => {
    expect(canOperate(e({ name: 'MyStuff', is_dir: true }))).toBe(true)
  })
  it('已分享的目录不可操作', () => {
    expect(canOperate(e({ name: 'Shared', is_dir: true, extensions: { share: { shared: 'true' } } }))).toBe(false)
  })
  it('挂载点不可操作', () => {
    expect(canOperate(e({ name: 'Disk', is_dir: true, extensions: { mounted: true } as any }))).toBe(false)
  })
})

// Must stay byte-for-byte equivalent to the rule inside uploads.addFilesToQueue
// (`PROTECTED.includes(relativePath.split('/')[0])`). The store keeps its own
// copy as a last line of defence; this one exists so callers can reject before
// asking the user anything.
describe('splitProtectedUploads', () => {
  const u = (relativePath: string) => ({ relativePath, file: { size: 1 } })

  it('rejects an upload whose top segment is a protected folder', () => {
    const { accepted, rejected } = splitProtectedUploads([u('AppData/db.sqlite')])
    expect(accepted).toEqual([])
    expect(rejected).toEqual(['AppData/db.sqlite'])
  })

  it('rejects however deep the entry sits under the protected top segment', () => {
    const { rejected } = splitProtectedUploads([u('Documents/2026/q3/report.pdf')])
    expect(rejected).toEqual(['Documents/2026/q3/report.pdf'])
  })

  it('rejects a bare entry that IS a protected name, matching the store rule', () => {
    // A single file literally called "Media" has 'Media' as its top segment, so
    // the store rejects it too. Diverging here would let it through the prompt
    // only to be dropped one step later.
    expect(splitProtectedUploads([u('Media')]).rejected).toEqual(['Media'])
  })

  it('accepts a folder whose protected-looking name is not the top segment', () => {
    const { accepted, rejected } = splitProtectedUploads([u('Trip/Documents/a.txt')])
    expect(rejected).toEqual([])
    expect(accepted.map((a) => a.relativePath)).toEqual(['Trip/Documents/a.txt'])
  })

  it('keeps the surviving entries in order and hands back the very same objects', () => {
    const a = u('a.txt')
    const b = u('Gallery/pic.jpg')
    const c = u('c.txt')
    const { accepted, rejected } = splitProtectedUploads([a, b, c])
    expect(accepted).toEqual([a, b, c].filter((x) => x !== b))
    expect(accepted[0]).toBe(a)
    expect(accepted[1]).toBe(c)
    expect(rejected).toEqual(['Gallery/pic.jpg'])
  })

  it('returns two empty lists for an empty batch', () => {
    expect(splitProtectedUploads([])).toEqual({ accepted: [], rejected: [] })
  })
})
