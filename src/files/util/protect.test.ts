import { describe, it, expect } from 'vitest'
import { PROTECTED, canOperate } from './protect'
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
