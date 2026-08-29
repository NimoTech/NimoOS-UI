import { describe, it, expect } from 'vitest'
import {
  aiItems, coveredBy, knowledgeExcludeItems, knowledgeKindOf,
  knowledgeRootItems, photosItems, searchItems,
} from './folderPermissionsView'
import type { FolderPermSnapshot } from './folderPermissions'

function snap(over: Partial<FolderPermSnapshot> = {}): FolderPermSnapshot {
  return {
    candidates: [], searchRoots: [], wikiRoots: [], denyRules: [], blacklist: [],
    photos: { auto: false, dirs: [], stale: false },
    offline: { search: false, knowledge: false, ai: false, photos: false },
    ...over,
  }
}

describe('coveredBy — takes the shortest ancestor (the outermost one is the "coverer")', () => {
  it('takes the shortest one when there are multiple ancestors', () => {
    expect(coveredBy('/DATA/A/B/C', ['/DATA/A/B', '/DATA/A', '/other'])).toBe('/DATA/A')
  })
  it('returns null when there is no ancestor', () => {
    expect(coveredBy('/DATA/A', ['/DATA/AB', '/mnt'])).toBeNull()
  })
  it('a path does not count as its own ancestor', () => {
    expect(coveredBy('/DATA/A', ['/DATA/A'])).toBeNull()
  })
})

describe('searchItems', () => {
  it('sorts by path and marks what covers each one', () => {
    const s = snap({ searchRoots: ['/DATA/A/B', '/DATA/A'] })
    expect(searchItems(s)).toEqual([
      { path: '/DATA/A', coveredBy: null },
      { path: '/DATA/A/B', coveredBy: '/DATA/A' },
    ])
  })
  it('does not mutate the original array (slices, then sorts)', () => {
    const roots = ['/b', '/a']
    searchItems(snap({ searchRoots: roots }))
    expect(roots).toEqual(['/b', '/a'])
  })
})

describe('knowledgeRootItems', () => {
  it('sorts by path via localeCompare, and normalizes enabled to a boolean', () => {
    const s = snap({
      wikiRoots: [
        { id: 2, path: '/DATA/Z', enabled: 1 as unknown as boolean },
        { id: 1, path: '/DATA/A', enabled: false },
      ],
    })
    expect(knowledgeRootItems(s)).toEqual([
      { path: '/DATA/A', enabled: false, rootId: 1 },
      { path: '/DATA/Z', enabled: true, rootId: 2 },
    ])
  })
})

describe('knowledgeExcludeItems', () => {
  it('keeps only action=deny rules that resolve back to a path, sorted by path', () => {
    const s = snap({
      denyRules: [
        { id: 1, root_id: 1, path_glob: '/DATA/Z/*', action: 'deny' },
        { id: 2, root_id: 1, path_glob: '/DATA/A/*', action: 'deny' },
        { id: 3, root_id: 1, path_glob: '/DATA/X/*', action: 'allow' }, // not deny, dropped
        { id: 4, root_id: 1, path_glob: '*.key', action: 'deny' }, // cannot resolve to a path, dropped
      ],
    })
    expect(knowledgeExcludeItems(s)).toEqual([
      { id: 2, path: '/DATA/A' },
      { id: 1, path: '/DATA/Z' },
    ])
  })
})

describe('knowledgeKindOf', () => {
  const s = snap({
    wikiRoots: [
      { id: 1, path: '/DATA', enabled: true },
      { id: 2, path: '/DATA/Off', enabled: false },
    ],
  })
  it('the path itself is a root → root (even if that root is disabled)', () => {
    expect(knowledgeKindOf('/DATA/Off', s)).toBe('root')
  })
  it('under an enabled root → subdir', () => {
    expect(knowledgeKindOf('/DATA/Docs', s)).toBe('subdir')
  })
  it('not under any enabled root → uncovered', () => {
    expect(knowledgeKindOf('/mnt/X', s)).toBe('uncovered')
  })
})

describe('aiItems — splits directory entries from glob rules', () => {
  it('entries that resolve to a directory go into items (sorted + coveredBy), the rest are only counted', () => {
    const s = snap({
      blacklist: [
        { id: 1, pattern: '/DATA/Z/**' },
        { id: 2, pattern: '/DATA/A/**' },
        { id: 3, pattern: '/DATA/A/B/**' },
        { id: 4, pattern: '*.key' },
        { id: 5, pattern: '**/node_modules/**' },
      ],
    })
    expect(aiItems(s)).toEqual({
      items: [
        { id: 2, path: '/DATA/A', coveredBy: null },
        { id: 3, path: '/DATA/A/B', coveredBy: '/DATA/A' },
        { id: 1, path: '/DATA/Z', coveredBy: null },
      ],
      globCount: 2,
    })
  })
  it('empty blacklist → items empty, globCount 0', () => {
    expect(aiItems(snap())).toEqual({ items: [], globCount: 0 })
  })
})

describe('photosItems', () => {
  it('sorts + coveredBy', () => {
    const s = snap({ photos: { auto: false, dirs: ['/DATA/G/Sub', '/DATA/G'], stale: false } })
    expect(photosItems(s)).toEqual([
      { path: '/DATA/G', coveredBy: null },
      { path: '/DATA/G/Sub', coveredBy: '/DATA/G' },
    ])
  })
})
