import { describe, it, expect } from 'vitest'
import { resolveOpen } from '../files/viewers/resolveOpen'
import type { FileEntry } from '../files/stores/files'

const img: FileEntry = { name: 'a.png', path: '/DATA/a.png', is_dir: false }
const zip: FileEntry = { name: 'a.zip', path: '/DATA/a.zip', is_dir: false }
const dir: FileEntry = { name: 'sub', path: '/DATA/sub', is_dir: true }

describe('resolveOpen', () => {
  it('a directory → returns { kind: "dir" }', () => {
    expect(resolveOpen(dir, [dir]).kind).toBe('dir')
  })
  it('a file matched by a viewer → { kind: "view" }', () => {
    expect(resolveOpen(img, [img, zip]).kind).toBe('view')
  })
  it('a file with no matching viewer → { kind: "download" }', () => {
    expect(resolveOpen(zip, [zip]).kind).toBe('download')
  })
})
