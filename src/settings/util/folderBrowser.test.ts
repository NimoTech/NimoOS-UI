import { describe, it, expect } from 'vitest'
import { crumbsFor, dirEntries, pickerRoots } from './folderBrowser'
import type { FolderEntry } from '@nimotech/nimoos-service'

describe('dirEntries', () => {
  const content = [
    { name: 'Zed', path: '/DATA/Zed', is_dir: true },
    { name: 'Apple', path: '/DATA/Apple', is_dir: true },
    { name: '.hidden', path: '/DATA/.hidden', is_dir: true },
    { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
  ] as FolderEntry[]
  it('只留非隐藏目录并按名字排序', () => {
    expect(dirEntries(content)).toEqual([
      { name: 'Apple', path: '/DATA/Apple' },
      { name: 'Zed', path: '/DATA/Zed' },
    ])
  })
  it('null / undefined → 空数组', () => {
    expect(dirEntries(null)).toEqual([])
    expect(dirEntries(undefined)).toEqual([])
  })
})

describe('pickerRoots', () => {
  it('有候选时用候选,label 缺失回退成 path', () => {
    expect(pickerRoots([{ path: '/DATA', label: 'NimoOS-HD' }, { path: '/mnt/x' }])).toEqual([
      { path: '/DATA', label: 'NimoOS-HD' },
      { path: '/mnt/x', label: '/mnt/x' },
    ])
  })
  it('候选为空 / null 时回退到内置三根(本期快照恒空,这条就是真机唯一形态)', () => {
    const fallback = [
      { path: '/DATA', label: 'System (/DATA)' },
      { path: '/media', label: '/media' },
      { path: '/mnt', label: '/mnt' },
    ]
    expect(pickerRoots([])).toEqual(fallback)
    expect(pickerRoots(null)).toEqual(fallback)
  })
})

describe('crumbsFor', () => {
  it('根 crumb 的 path 是空串,逐段累加', () => {
    expect(crumbsFor('/a/b', 'ROOT')).toEqual([
      { label: 'ROOT', path: '' },
      { label: 'a', path: '/a' },
      { label: 'b', path: '/a/b' },
    ])
  })
  it('空路径只有根 crumb', () => {
    expect(crumbsFor('', 'ROOT')).toEqual([{ label: 'ROOT', path: '' }])
  })
})
