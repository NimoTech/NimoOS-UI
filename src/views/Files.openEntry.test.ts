import { describe, it, expect, vi } from 'vitest'
import { resolveOpen } from '../files/viewers/resolveOpen'
import type { FileEntry } from '../files/stores/files'

const img: FileEntry = { name: 'a.png', path: '/DATA/a.png', is_dir: false }
const zip: FileEntry = { name: 'a.zip', path: '/DATA/a.zip', is_dir: false }
const dir: FileEntry = { name: 'sub', path: '/DATA/sub', is_dir: true }

describe('resolveOpen', () => {
  it('目录 → 返回 { kind: "dir" }', () => {
    expect(resolveOpen(dir, [dir]).kind).toBe('dir')
  })
  it('命中查看器的文件 → { kind: "view" }', () => {
    expect(resolveOpen(img, [img, zip]).kind).toBe('view')
  })
  it('未命中的文件 → { kind: "download" }', () => {
    expect(resolveOpen(zip, [zip]).kind).toBe('download')
  })
})
