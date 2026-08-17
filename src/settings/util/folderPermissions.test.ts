import { describe, it, expect } from 'vitest'
import {
  aiPatternFor, coveringEnabledRoot, denyGlobFor, isUnder,
  pathFromAiPattern, pathFromDenyGlob, planToggle,
  type FolderPermSnapshot,
} from './folderPermissions'

// Empty snapshot factory: each test case only overrides the fields it cares about.
function snap(over: Partial<FolderPermSnapshot> = {}): FolderPermSnapshot {
  return {
    candidates: [],
    searchRoots: [],
    wikiRoots: [],
    denyRules: [],
    blacklist: [],
    photos: { auto: false, dirs: [], stale: false },
    offline: { search: false, knowledge: false, ai: false, photos: false },
    ...over,
  }
}

describe('canonical form construction and reverse parsing', () => {
  it('aiPatternFor appends /** (agent gitignore/PathSpec semantics)', () => {
    expect(aiPatternFor('/DATA/Docs')).toBe('/DATA/Docs/**')
  })
  it('denyGlobFor appends /* (Parser fnmatch, * crosses /)', () => {
    expect(denyGlobFor('/DATA/Docs')).toBe('/DATA/Docs/*')
  })
  it('pathFromAiPattern parses back to the directory', () => {
    expect(pathFromAiPattern('/DATA/Docs/**')).toBe('/DATA/Docs')
  })
  it('pathFromAiPattern rejects non-absolute paths / non-/** endings / wildcards in the middle segment', () => {
    expect(pathFromAiPattern('DATA/Docs/**')).toBeNull()
    expect(pathFromAiPattern('/DATA/Docs')).toBeNull()
    expect(pathFromAiPattern('/DATA/*/x/**')).toBeNull()
    expect(pathFromAiPattern('/**')).toBeNull() // empty string after the slice
    expect(pathFromAiPattern(42)).toBeNull() // not a string
  })
  it('pathFromDenyGlob parses back the /* form, and likewise rejects non-canonical values', () => {
    expect(pathFromDenyGlob('/DATA/Docs/*')).toBe('/DATA/Docs')
    expect(pathFromDenyGlob('/DATA/Docs')).toBeNull()
    expect(pathFromDenyGlob('/DATA/*/x/*')).toBeNull()
    // '/**' matches endsWith('/*'); slicing off the trailing * leaves '/DATA/Docs/*', which still contains * → null
    expect(pathFromDenyGlob('/DATA/Docs/**')).toBeNull()
    expect(pathFromDenyGlob(null)).toBeNull()
  })
})

describe('isUnder — must compare by path segment, not a bare startsWith', () => {
  it('a true descendant returns true', () => {
    expect(isUnder('/DATA/Docs/a', '/DATA/Docs')).toBe(true)
  })
  it('a path is not its own descendant', () => {
    expect(isUnder('/DATA/Docs', '/DATA/Docs')).toBe(false)
  })
  it('a sibling directory with the same prefix does not count as a descendant (/DATA/DocsOld is not under /DATA/Docs)', () => {
    expect(isUnder('/DATA/DocsOld', '/DATA/Docs')).toBe(false)
  })
})

describe('coveringEnabledRoot — takes the longest match, and only considers enabled roots', () => {
  const roots = [
    { id: 1, path: '/DATA', enabled: true },
    { id: 2, path: '/DATA/Docs', enabled: true },
    { id: 3, path: '/DATA/Media', enabled: false },
  ]
  it('the longest match wins', () => {
    expect(coveringEnabledRoot('/DATA/Docs/a', roots)?.id).toBe(2)
  })
  it('a path equal to the root itself also counts as covered', () => {
    expect(coveringEnabledRoot('/DATA/Docs', roots)?.id).toBe(2)
  })
  it('a disabled root does not cover — falls back to a shorter enabled root', () => {
    expect(coveringEnabledRoot('/DATA/Media/x', roots)?.id).toBe(1)
  })
  it('returns null when no enabled root covers the path', () => {
    expect(coveringEnabledRoot('/mnt/x', roots)).toBeNull()
  })
})

describe('planToggle — search column', () => {
  it('turning on: merges and sorts', () => {
    const s = snap({ searchRoots: ['/DATA/Z', '/DATA/A'] })
    expect(planToggle('/DATA/M', 'search', true, s)).toEqual([
      { svc: 'search', op: 'putRoots', roots: ['/DATA/A', '/DATA/M', '/DATA/Z'] },
    ])
  })
  it('turning on an already-present entry: state is already on, returns an empty plan', () => {
    const s = snap({ searchRoots: ['/DATA/A'] })
    expect(planToggle('/DATA/A', 'search', true, s)).toEqual([])
  })
  it('turning off: removes it from the list', () => {
    const s = snap({ searchRoots: ['/DATA/A', '/DATA/B'] })
    expect(planToggle('/DATA/A', 'search', false, s)).toEqual([
      { svc: 'search', op: 'putRoots', roots: ['/DATA/B'] },
    ])
  })
  it('an entry inherited from an ancestor is not actionable — returns an empty plan (inherited-on)', () => {
    const s = snap({ searchRoots: ['/DATA'] })
    expect(planToggle('/DATA/Docs', 'search', false, s)).toEqual([])
  })
  it('service offline → not actionable', () => {
    const s = snap({ offline: { search: true, knowledge: false, ai: false, photos: false } })
    expect(planToggle('/DATA/A', 'search', true, s)).toEqual([])
  })
})

describe('planToggle — photos column', () => {
  it('turning on: merges and sorts, and includes needsMaterialize=auto', () => {
    const s = snap({ photos: { auto: true, dirs: ['/DATA/Gallery'], stale: false } })
    expect(planToggle('/DATA/Pics', 'photos', true, s)).toEqual([
      { svc: 'photos', op: 'putWatchDirs', dirs: ['/DATA/Gallery', '/DATA/Pics'], needsMaterialize: true },
    ])
  })
  it('turning off the last one → dirs becomes an empty array (the caller should show a "back to auto mode" confirmation based on this)', () => {
    const s = snap({ photos: { auto: false, dirs: ['/DATA/Gallery'], stale: false } })
    expect(planToggle('/DATA/Gallery', 'photos', false, s)).toEqual([
      { svc: 'photos', op: 'putWatchDirs', dirs: [], needsMaterialize: false },
    ])
  })
  it('stale (old Photos backend) → not actionable', () => {
    const s = snap({ photos: { auto: true, dirs: [], stale: true } })
    expect(planToggle('/DATA/Pics', 'photos', true, s)).toEqual([])
  })
})

describe('planToggle — ai column (inverted semantics: on = not blacklisted)', () => {
  it('not blacklisted by default → turning off = add pattern', () => {
    expect(planToggle('/DATA/Secret', 'ai', false, snap())).toEqual([
      { svc: 'ai', op: 'addPattern', pattern: '/DATA/Secret/**' },
    ])
  })
  it('already blacklisted → turning on = remove pattern by entryId', () => {
    const s = snap({ blacklist: [{ id: 7, pattern: '/DATA/Secret/**' }] })
    expect(planToggle('/DATA/Secret', 'ai', true, s)).toEqual([
      { svc: 'ai', op: 'removePattern', id: 7 },
    ])
  })
  it('ancestor already blacklisted → inherited-off, not actionable', () => {
    const s = snap({ blacklist: [{ id: 7, pattern: '/DATA/**' }] })
    expect(planToggle('/DATA/Secret', 'ai', true, s)).toEqual([])
  })
})

describe('planToggle — knowledge column (three kinds)', () => {
  it('kind=root: the toggle directly flips the enabled flag on the root', () => {
    const s = snap({ wikiRoots: [{ id: 2, path: '/DATA/Docs', enabled: false }] })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([
      { svc: 'wiki', op: 'enableRoot', id: 2 },
    ])
    const s2 = snap({ wikiRoots: [{ id: 2, path: '/DATA/Docs', enabled: true }] })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s2)).toEqual([
      { svc: 'wiki', op: 'disableRoot', id: 2 },
    ])
  })
  it('kind=uncovered: turning on = create root; turning off = nothing to do', () => {
    expect(planToggle('/mnt/X', 'knowledge', true, snap())).toEqual([
      { svc: 'wiki', op: 'createRoot', path: '/mnt/X' },
    ])
    expect(planToggle('/mnt/X', 'knowledge', false, snap())).toEqual([])
  })
  it('kind=subdir and currently on: turning off = add a deny rule', () => {
    const s = snap({ wikiRoots: [{ id: 1, path: '/DATA', enabled: true }] })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('kind=subdir and already denied: turning on = remove that deny rule by id', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 1, path_glob: '/DATA/Docs/*', action: 'deny' }],
    })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([
      { svc: 'parser', op: 'removeDeny', id: 33 },
    ])
  })
  it('a deny rule attached to a different root → not recognized (root_id must match the covering root)', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 99, path_glob: '/DATA/Docs/*', action: 'deny' }],
    })
    // currently still on, desired=true → empty plan; only desired=false adds a new deny
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([])
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('a rule whose action is not deny does not count (an allow rule cannot be used as a deny)', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 1, path_glob: '/DATA/Docs/*', action: 'allow' }],
    })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('knowledge offline → not actionable', () => {
    const s = snap({ offline: { search: false, knowledge: true, ai: false, photos: false } })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([])
  })
})
