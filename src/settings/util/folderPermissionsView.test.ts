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

describe('coveredBy —— 取最短祖先(最外层的那个才是「覆盖者」)', () => {
  it('多个祖先时取最短的', () => {
    expect(coveredBy('/DATA/A/B/C', ['/DATA/A/B', '/DATA/A', '/other'])).toBe('/DATA/A')
  })
  it('没有祖先返回 null', () => {
    expect(coveredBy('/DATA/A', ['/DATA/AB', '/mnt'])).toBeNull()
  })
  it('自己不算自己的祖先', () => {
    expect(coveredBy('/DATA/A', ['/DATA/A'])).toBeNull()
  })
})

describe('searchItems', () => {
  it('按路径排序,并标出被谁覆盖', () => {
    const s = snap({ searchRoots: ['/DATA/A/B', '/DATA/A'] })
    expect(searchItems(s)).toEqual([
      { path: '/DATA/A', coveredBy: null },
      { path: '/DATA/A/B', coveredBy: '/DATA/A' },
    ])
  })
  it('不改动原数组(slice 后再 sort)', () => {
    const roots = ['/b', '/a']
    searchItems(snap({ searchRoots: roots }))
    expect(roots).toEqual(['/b', '/a'])
  })
})

describe('knowledgeRootItems', () => {
  it('按 path localeCompare 排序,enabled 归一成布尔', () => {
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
  it('只收 action=deny、能反解成路径的规则,并按路径排序', () => {
    const s = snap({
      denyRules: [
        { id: 1, root_id: 1, path_glob: '/DATA/Z/*', action: 'deny' },
        { id: 2, root_id: 1, path_glob: '/DATA/A/*', action: 'deny' },
        { id: 3, root_id: 1, path_glob: '/DATA/X/*', action: 'allow' }, // 非 deny,丢
        { id: 4, root_id: 1, path_glob: '*.key', action: 'deny' }, // 反解不出路径,丢
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
  it('路径本身就是根 → root(即便该根是停用的)', () => {
    expect(knowledgeKindOf('/DATA/Off', s)).toBe('root')
  })
  it('在启用根之下 → subdir', () => {
    expect(knowledgeKindOf('/DATA/Docs', s)).toBe('subdir')
  })
  it('不在任何启用根之下 → uncovered', () => {
    expect(knowledgeKindOf('/mnt/X', s)).toBe('uncovered')
  })
})

describe('aiItems —— 目录项与 glob 规则分流', () => {
  it('能反解成目录的进 items(排序 + coveredBy),其余只计数', () => {
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
  it('空黑名单 → items 空、globCount 0', () => {
    expect(aiItems(snap())).toEqual({ items: [], globCount: 0 })
  })
})

describe('photosItems', () => {
  it('排序 + coveredBy', () => {
    const s = snap({ photos: { auto: false, dirs: ['/DATA/G/Sub', '/DATA/G'], stale: false } })
    expect(photosItems(s)).toEqual([
      { path: '/DATA/G', coveredBy: null },
      { path: '/DATA/G/Sub', coveredBy: '/DATA/G' },
    ])
  })
})
