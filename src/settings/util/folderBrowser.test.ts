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
  it('keeps only non-hidden dirs and sorts by name', () => {
    expect(dirEntries(content)).toEqual([
      { name: 'Apple', path: '/DATA/Apple' },
      { name: 'Zed', path: '/DATA/Zed' },
    ])
  })
  it('null / undefined → empty array', () => {
    expect(dirEntries(null)).toEqual([])
    expect(dirEntries(undefined)).toEqual([])
  })
})

describe('pickerRoots', () => {
  it('uses the candidates when present; falls back to path when label is missing', () => {
    expect(pickerRoots([{ path: '/DATA', label: 'NimoOS-HD' }, { path: '/mnt/x' }])).toEqual([
      { path: '/DATA', label: 'NimoOS-HD' },
      { path: '/mnt/x', label: '/mnt/x' },
    ])
  })
  it('falls back to the built-in three roots when candidates are empty / null (this snapshot period is always empty, so this is the only real-device shape)', () => {
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
  it('the root crumb has an empty-string path, accumulating segment by segment', () => {
    expect(crumbsFor('/a/b', 'ROOT')).toEqual([
      { label: 'ROOT', path: '' },
      { label: 'a', path: '/a' },
      { label: 'b', path: '/a/b' },
    ])
  })
  it('an empty path yields only the root crumb', () => {
    expect(crumbsFor('', 'ROOT')).toEqual([{ label: 'ROOT', path: '' }])
  })
})
