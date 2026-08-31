// Guard for `wikiViewHelpers.ts`.
//
// Inherit all behavior from the Vue 2 panel's
// `src/views/AI/Knowledge/__tests__/wikiViewHelpers.spec.js` (main@7a6ee6b7, 119 lines / 9 cases)
// (governance §4.3 / ruling R10: only inherit this one Vue2 spec this period),
// with additional refinement per governance §9.16.
//
// 🔴 §9.16 — `buildWikiTree` is the place most prone to writing logic with zero
// discriminative power: on the same "pre-sorted, well-leveled" sample, several
// wrong implementations give **identical results** ("directly slice one level up
// using `lastIndexOf('/')`" produces the same result on a well-leveled tree as
// the correct implementation). Therefore, the four discriminative cases in this
// file come from the four topologies in the wiki-tree fixture:
// crossLevel / missingParent / duplicate / unsorted, with two RED probes in the
// report:
//   ① Replace `findParent` with "only slice one level" → crossLevel case must red;
//   ② Delete `sort` → unsorted case must red.
//
// 🔴 §9.15 — **XSS cases for `renderWikiMarkdown` belong to component layer T7**
// (mount `WikiView` and check real DOM). This file has only one assertion that
// "just forwards `renderMarkdown`", and **does not mock** `renderMarkdown`
// (governance rule: forbidden to mock away `renderMarkdown` and then claim XSS
// is verified).
//
// 🔴 Three environmental pitfalls — verbatim follow the established solutions
// from `knowledgeStyles.test.ts:1-17` (not encountering them anew):
// ① This repo's `package.json` is `"type": "module"` ⇒ `__dirname` unavailable in ESM,
//    use equivalent via `import.meta.url` + `fileURLToPath`;
// ② Type declarations for `node:fs` / `node:path` / `node:url` come from
//    `@types/node`, already installed in this repo
//    ⇒ `vue-tsc --noEmit`(one of the task gates) passes directly, **no need for**
//    `@ts-expect-error` suppression; suppression lines that existed on sp8-ai
//    branch were deleted during merge;
// ③ 🔴 **Don't use Vite's `?raw` as substitute for `node:fs`** — vitest's
//    CSSEnablerPlugin makes `?raw` return empty string, assertions on empty
//    string "falsely pass" (iron law).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WikiRoot, WikiTreeNode } from '@nimotech/nimoos-service'
import {
  baseName,
  buildWikiTree,
  trailFor,
  opToType,
  parseTs,
  rootForPath,
  renderWikiMarkdown,
} from './wikiViewHelpers'
import { renderMarkdown } from '../../markdown/renderMarkdown'

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 Fixture copy (governance P5c §4.4: copy into test + comment source + programmatically
//    verify byte-for-byte equivalence; fixtures are copied into this file verbatim rather
//    than read from disk at runtime — `?raw` is always empty under vitest).
// 🔴 **Take data fields only**, convert `__meta` to comments.
// ═══════════════════════════════════════════════════════════════════════════
//
// ── FIXTURE-COPY-BEGIN: wiki-tree ──────────────────────────────────────────
// 🔴 Three-level source label (`__meta.label`) = **`.CONSTRUCTED`** — **not real-device data**,
//    don't use it to overturn naming conclusions from N46 (fixtures README §0 / governance §9.18-2).
// `__meta.why`: "GET /v1/wiki/tree local test timeout after 90s, 0 bytes (D1) ⇒ no real-device sample."
// `__meta.built_from`: "Anonymous struct `sk` from NimoOS-Wiki/route/v1/wiki.go:126-132
//    (**snake_case json tag**): path / level / ai_label / user_notes_updated_at / last_modified"
// `__meta.value_units`: "ai_label empty string is valid; last_modified is RFC3339 local
//    timezone string, backend formatTS(ms<=0) returns **empty string**(wiki.go:47-52) — not '1970'"
// `__meta.normalized_shape`: "After the shared HTTP client's src/wiki.ts:102 normalizeTreeNode →
//    camelCase { path, level, aiLabel, userNotesUpdatedAt, lastModified }.
//    store.loadWikiTree() produces **flat array**, that's what buildWikiTree consumes"
// `__meta.topologies`: "Three samples per governance §9.16: normal(well-leveled tree)/
//    crossLevel(cross-level)/ missingParent(parent missing)/ duplicate(duplicate row)/
//    unsorted(unsorted)"
interface WikiTreeNodeRaw {
  path: string
  level: string
  ai_label: string
  user_notes_updated_at: string
  last_modified: string
}
const WIKI_TREE_RAW: Record<string, WikiTreeNodeRaw[]> = {
  normal: [
    { path: '/DATA',           level: 'space',   ai_label: '主数据盘',   user_notes_updated_at: '', last_modified: '2026-08-05T11:32:01+08:00' },
    { path: '/DATA/Documents', level: 'project', ai_label: '文档',       user_notes_updated_at: '', last_modified: '2026-08-05T10:12:00+08:00' },
    { path: '/DATA/Documents/Specs', level: 'project', ai_label: '', user_notes_updated_at: '', last_modified: '' },
  ],
  crossLevel: [
    { path: '/a',     level: 'space',   ai_label: '', user_notes_updated_at: '', last_modified: '' },
    { path: '/a/b/c', level: 'project', ai_label: '', user_notes_updated_at: '', last_modified: '' },
  ],
  missingParent: [
    { path: '/x/y/z', level: 'project', ai_label: '', user_notes_updated_at: '', last_modified: '' },
  ],
  duplicate: [
    { path: '/dup', level: 'space', ai_label: 'first',  user_notes_updated_at: '', last_modified: '' },
    { path: '/dup', level: 'space', ai_label: 'second', user_notes_updated_at: '', last_modified: '' },
  ],
  unsorted: [
    { path: '/u/b', level: 'project', ai_label: '', user_notes_updated_at: '', last_modified: '' },
    { path: '/u',   level: 'space',   ai_label: '', user_notes_updated_at: '', last_modified: '' },
    { path: '/u/a', level: 'project', ai_label: '', user_notes_updated_at: '', last_modified: '' },
  ],
}
// ── FIXTURE-COPY-END: wiki-tree ────────────────────────────────────────────
//
// ── FIXTURE-COPY-BEGIN: wiki-roots-normalized ──────────────────────────────
// 🔴 Three-level source label (`__meta.label`) = **`.CONSTRUCTED`** — **not real-device data**.
// `__meta.why`: "Same as wiki-roots.CONSTRUCTED.json — /roots timeout locally, no real-device sample."
// `__meta.built_from`: "Pass each field of wiki-roots.CONSTRUCTED.json raw_response through
//    the shared HTTP client's src/wiki.ts:85 normalizeRoot"
// `__meta.shape`: "🔴 camelCase — this is the output shape of store.state.wikiRoots,
//    RootsView / WikiView mocks all follow it (N46)"
// `__meta.note`: "enabled normalized to boolean via `!!r.Enabled`;
//    scanIntervalS/createdAt/lastScanAt fallback via `|| 0`"
const WIKI_ROOTS_NORMALIZED: WikiRoot[] = [
  {
    id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
    path: '/DATA',
    level: 'space',
    watchMode: 'auto',
    storageMode: 'inline',
    enabled: true,
    scanIntervalS: 21600,
    createdAt: 1754280000000,
    lastScanAt: 1754386321000,
    needsReconcile: false,
  },
  {
    id: '9b1c77e0aa2f4d3e8c5106b4f7d2a318',
    path: '/DATA/Documents',
    level: 'project',
    watchMode: 'scan_only',
    storageMode: 'inline',
    enabled: false,
    scanIntervalS: 3600,
    createdAt: 1754281000000,
    lastScanAt: 0,
    needsReconcile: false,
  },
]
// ── FIXTURE-COPY-END: wiki-roots-normalized ────────────────────────────────

/**
 * Fixture is **HTTP raw snake_case**; `buildWikiTree` consumes **store output camelCase**
 * (`store.loadWikiTree()`, normalization in shared package `src/wiki.ts:102
 * normalizeTreeNode`). This function only does **key mapping**, doesn't re-implement
 * normalization logic (N46: the two naming styles are the easiest to get wrong this period).
 */
function toStoreShape(r: WikiTreeNodeRaw): WikiTreeNode {
  return {
    path: r.path,
    level: r.level,
    aiLabel: r.ai_label,
    userNotesUpdatedAt: r.user_notes_updated_at,
    lastModified: r.last_modified,
  }
}
const TOPO = {
  normal: WIKI_TREE_RAW.normal.map(toStoreShape),
  crossLevel: WIKI_TREE_RAW.crossLevel.map(toStoreShape),
  missingParent: WIKI_TREE_RAW.missingParent.map(toStoreShape),
  duplicate: WIKI_TREE_RAW.duplicate.map(toStoreShape),
  unsorted: WIKI_TREE_RAW.unsorted.map(toStoreShape),
}

/** Blueprint samples only write `{path, level}`; this repo type is shared package `WikiTreeNode` (all five fields). */
function flatNode(path: string, over: Partial<WikiTreeNode> = {}): WikiTreeNode {
  return {
    path,
    level: '',
    aiLabel: '',
    userNotesUpdatedAt: '',
    lastModified: '',
    ...over,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// baseName — blueprint `wikiViewHelpers.js:6-11`
// ═══════════════════════════════════════════════════════════════════════════
describe('baseName', () => {
  // Inherit four cases from Vue2 spec `:76-81` "baseName is defensive".
  it('Vue2 spec inherit: /a/b/c → c · /a/b/ → b · / → / · "" → ""', () => {
    expect(baseName('/a/b/c')).toBe('c')
    expect(baseName('/a/b/')).toBe('b')
    expect(baseName('/')).toBe('/')
    expect(baseName('')).toBe('')
  })

  it('Empty / non-string all return "" (blueprint :7 runtime defense, narrowed to string never reachable)', () => {
    expect(baseName(undefined)).toBe('')
    expect(baseName(null)).toBe('')
    expect(baseName(0)).toBe('')
    expect(baseName(123)).toBe('')
    expect(baseName({ path: '/a' })).toBe('')
    expect(baseName([])).toBe('')
  })

  it('Single char "/" not consumed by trailing-slash normalization (blueprint :8 `p.length > 1 ?` branch)', () => {
    // Only replace if length > 1 ⇒ '/' preserved ⇒ lastIndexOf('/') === 0 ⇒ slice(1) === '' ⇒ `|| s` fallback to '/'.
    expect(baseName('/')).toBe('/')
    // Discriminative: if `p.length > 1 ?` is removed, '/' becomes '', result becomes ''.
    expect(baseName('/')).not.toBe('')
  })

  it('Multiple trailing slashes all stripped (blueprint :8 /\\/+$/)', () => {
    expect(baseName('/a/b///')).toBe('b')
    expect(baseName('/DATA//')).toBe('DATA')
  })

  it('No slash means entire string is basename (blueprint :10 `i < 0` branch)', () => {
    expect(baseName('DATA')).toBe('DATA')
    expect(baseName('a')).toBe('a')
  })

  it('🔴 Fallback of `slice(i + 1) || s`: string ending with / after stripping trailing slashes', () => {
    // '//' → length > 1 ⇒ replace(/\/+$/) strips **entire string** to '' ⇒ lastIndexOf('/') === -1 ⇒ `i < 0` returns ''.
    expect(baseName('//')).toBe('')
    // True hit of `|| s` fallback is "lastIndexOf hit at position 0 and nothing after", i.e. single char '/'.
    expect(baseName('/')).toBe('/')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// buildWikiTree — blueprint `:18-37` + module-private `findParent`(`:39-47`)
// ═══════════════════════════════════════════════════════════════════════════
describe('buildWikiTree — Vue2 spec inherit', () => {
  // Verbatim from Vue2 spec `:8-14` `flat` (unsorted, contains two trees).
  const flat = [
    flatNode('/DATA/Wiki/Work', { level: 'dir' }),
    flatNode('/DATA', { level: 'root' }),
    flatNode('/DATA/Wiki', { level: 'dir' }),
    flatNode('/Backup', { level: 'root' }),
    flatNode('/DATA/Downloads', { level: 'dir' }),
  ]

  it('assembles a forest from the unsorted flat list (Vue2 spec :16-22)', () => {
    const { roots, byPath } = buildWikiTree(flat)
    expect(roots.map((r) => r.path)).toEqual(['/Backup', '/DATA'])
    expect(byPath['/DATA'].children.map((c) => c.path)).toEqual(['/DATA/Downloads', '/DATA/Wiki'])
    expect(byPath['/DATA/Wiki'].children.map((c) => c.path)).toEqual(['/DATA/Wiki/Work'])
  })

  it('Top-level roots use full path as name, child nodes use basename (Vue2 spec :24-28)', () => {
    const { byPath } = buildWikiTree(flat)
    expect(byPath['/DATA'].name).toBe('/DATA')
    expect(byPath['/DATA/Wiki/Work'].name).toBe('Work')
  })

  it('Ignore duplicates and empty paths (Vue2 spec :38-44)', () => {
    const { roots } = buildWikiTree([flatNode('/x'), flatNode('/x'), flatNode(''), null])
    expect(roots).toHaveLength(1)
  })

  it('Input null / undefined / empty array all return empty forest (blueprint :19 `(list || [])`)', () => {
    expect(buildWikiTree(null)).toEqual({ roots: [], byPath: {} })
    expect(buildWikiTree(undefined)).toEqual({ roots: [], byPath: {} })
    expect(buildWikiTree([])).toEqual({ roots: [], byPath: {} })
  })

  it('Do not modify input array (blueprint :21 `.slice()` before sort)', () => {
    const input = [flatNode('/z'), flatNode('/a')]
    const before = input.map((n) => n.path)
    buildWikiTree(input)
    expect(input.map((n) => n.path)).toEqual(before)
  })
})

describe('buildWikiTree — 🔴 governance §9.16: four topologies that "discriminate wrong implementations" (from .CONSTRUCTED fixture)', () => {
  it('normal (well-leveled tree) — three-level chain, and other fields of flat nodes pass through as-is to tree nodes (blueprint :28 `{ ...n }`)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.normal)
    expect(roots.map((r) => r.path)).toEqual(['/DATA'])
    expect(byPath['/DATA'].children.map((c) => c.path)).toEqual(['/DATA/Documents'])
    expect(byPath['/DATA/Documents'].children.map((c) => c.path)).toEqual(['/DATA/Documents/Specs'])
    // Pass-through fields (T6 reads aiLabel / lastModified, blueprint WikiView.vue:191/:193).
    expect(byPath['/DATA'].aiLabel).toBe('主数据盘')
    expect(byPath['/DATA'].level).toBe('space')
    expect(byPath['/DATA'].lastModified).toBe('2026-08-05T11:32:01+08:00')
    expect(byPath['/DATA/Documents/Specs'].lastModified).toBe('')
  })

  it('🔴 ② crossLevel: /a and /a/b/c exist, /a/b does not ⇒ parent is /a (criterion: replace findParent with "only slice one level" → this case must red)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.crossLevel)
    // Wrong implementation of "only slice one level" makes /a/b/c unable to find byPath['/a/b'] ⇒ it becomes second root, name becomes full path.
    expect(roots.map((r) => r.path)).toEqual(['/a'])
    expect(byPath['/a'].children.map((c) => c.path)).toEqual(['/a/b/c'])
    expect(byPath['/a/b/c'].name).toBe('c')
    expect(byPath['/a/b']).toBeUndefined()
  })

  it('🔴 ① missingParent: only /x/y/z ⇒ becomes root and name is full path (blueprint :34 `t.name = n.path`)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.missingParent)
    expect(roots).toHaveLength(1)
    expect(roots[0].path).toBe('/x/y/z')
    expect(roots[0].name).toBe('/x/y/z')
    expect(roots[0].name).not.toBe('z') // Not basename — this is the discriminant of "top-level roots show full path"
    expect(byPath['/x/y/z']).toBe(roots[0])
  })

  it('🔴 ③ duplicate: two rows with same path ⇒ create only one node, **first one** wins (blueprint :27 `continue`)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.duplicate)
    expect(roots).toHaveLength(1)
    expect(Object.keys(byPath)).toEqual(['/dup'])
    // Wrong implementation of "later overwrites" would give 'second'.
    expect(byPath['/dup'].aiLabel).toBe('first')
    expect(byPath['/dup'].children).toEqual([])
  })

  it('🔴 ④ unsorted: /u/b comes before /u ⇒ still only one root (criterion: delete sort → this case must red)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.unsorted)
    // Without sort, /u/b processed first, can't find parent ⇒ becomes own root (roots becomes ['/u/b','/u']).
    expect(roots.map((r) => r.path)).toEqual(['/u'])
    expect(byPath['/u'].children.map((c) => c.path)).toEqual(['/u/a', '/u/b'])
    expect(byPath['/u/b'].name).toBe('b')
  })

  it('🔴 sort is by path lexicographic order, not "input order" — child node order is constant regardless of input', () => {
    const forward = buildWikiTree(TOPO.unsorted)
    const reversed = buildWikiTree([...TOPO.unsorted].reverse())
    expect(reversed.roots.map((r) => r.path)).toEqual(forward.roots.map((r) => r.path))
    expect(reversed.byPath['/u'].children.map((c) => c.path)).toEqual(['/u/a', '/u/b'])
  })

  it('Object in byPath is same reference as in roots/children (T6 uses this for in-place selection)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.normal)
    expect(byPath['/DATA']).toBe(roots[0])
    expect(byPath['/DATA/Documents']).toBe(roots[0].children[0])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// trailFor — blueprint `:52-62`
// ═══════════════════════════════════════════════════════════════════════════
describe('trailFor', () => {
  const { byPath } = buildWikiTree(TOPO.normal)

  it('Vue2 spec inherit: ancestor chain root-most first, includes self', () => {
    expect(trailFor(byPath, '/DATA/Documents/Specs').map((n) => n.path)).toEqual([
      '/DATA',
      '/DATA/Documents',
      '/DATA/Documents/Specs',
    ])
  })

  it('Vue2 spec inherit: intermediate nodes missing are filtered, known ones remain', () => {
    expect(trailFor(byPath, '/DATA/Other/Deep').map((n) => n.path)).toEqual(['/DATA'])
  })

  it('Vue2 spec inherit: empty string → []', () => {
    expect(trailFor(byPath, '')).toEqual([])
  })

  it('Non-string / undefined / null → [] (blueprint :53 runtime defense)', () => {
    expect(trailFor(byPath, undefined)).toEqual([])
    expect(trailFor(byPath, null)).toEqual([])
    expect(trailFor(byPath, 42)).toEqual([])
    expect(trailFor(byPath, ['/DATA'])).toEqual([])
  })

  it('Entire chain not in index → []', () => {
    expect(trailFor(byPath, '/Nowhere/At/All')).toEqual([])
  })

  it('Extra slashes consumed by `filter(Boolean)`, chain still matches (blueprint :54)', () => {
    expect(trailFor(byPath, '//DATA//Documents//').map((n) => n.path)).toEqual([
      '/DATA',
      '/DATA/Documents',
    ])
  })

  it('Returned object is same reference from byPath, not a copy', () => {
    expect(trailFor(byPath, '/DATA')[0]).toBe(byPath['/DATA'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// opToType — blueprint `:65-70` (N58: `modify` + any unknown value → 'mod' fallback copied)
// ═══════════════════════════════════════════════════════════════════════════
describe('opToType', () => {
  it('Vue2 spec inherit: four branches + unknown value fallback', () => {
    expect(opToType('create')).toBe('add')
    expect(opToType('modify')).toBe('mod')
    expect(opToType('delete')).toBe('del')
    expect(opToType('rename')).toBe('ren')
    expect(opToType('surprise')).toBe('mod')
  })

  it('🔴 N58: `modify` and any unknown value fall to same mod fallback (copy as-is, don\'t split into explicit modify branch with unknown taking another path)', () => {
    // `wiki-node.CONSTRUCTED.json` recent_changes intentionally embedded unknown op `chmod`.
    for (const unknown of ['chmod', '', 'CREATE', 'Delete', 'move', 'modify']) {
      expect(opToType(unknown)).toBe('mod')
    }
  })

  it('Case-sensitive — only recognizes lowercase (blueprint uses ===)', () => {
    expect(opToType('Create')).not.toBe('add')
    expect(opToType('DELETE')).not.toBe('del')
    expect(opToType('Rename')).not.toBe('ren')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseTs — blueprint `:73-77`
// 🔴 Returns **milliseconds**; downstream `fmtAgo(ms)`(`knowledgeStore.ts:190`) consumes ms.
//    Feeding wrong unit doesn't error, silently calculates as 1970 (see governance §9.13).
// ═══════════════════════════════════════════════════════════════════════════
describe('parseTs', () => {
  // Original value of normal[0].last_modified from fixture `wiki-tree.CONSTRUCTED.json`.
  const RFC = '2026-08-05T11:32:01+08:00'
  const EXPECT_MS = Date.UTC(2026, 7, 5, 3, 32, 1) // +08:00 11:32:01 ⇒ 03:32:01 UTC

  it('Vue2 spec inherit: valid RFC3339 > 0 · "" → 0 · undefined → 0 · garbage string → 0', () => {
    expect(parseTs('2026-07-20T10:00:00+08:00')).toBeGreaterThan(0)
    expect(parseTs('')).toBe(0)
    expect(parseTs(undefined)).toBe(0)
    expect(parseTs('not-a-date')).toBe(0)
  })

  it('null also goes to `!s` branch → 0 (backend formatTS(ms<=0) returns empty string, not "1970")', () => {
    expect(parseTs(null)).toBe(0)
  })

  it('🔴 Unit is milliseconds, not seconds — pin down each digit', () => {
    expect(parseTs(RFC)).toBe(EXPECT_MS)
    // Milliseconds side: 13-digit epoch.
    expect(String(parseTs(RFC))).toHaveLength(13)
    expect(parseTs(RFC)).toBeGreaterThan(1e12)
    // Seconds side: if implementation divides by 1000 extra (or backend switches to second-level epoch without updating here), below holds — must not hold.
    expect(parseTs(RFC)).not.toBe(EXPECT_MS / 1000)
    expect(String(parseTs(RFC))).not.toHaveLength(10)
  })

  it('Timezone offset truly participates in calculation (same moment in two formats must be same value)', () => {
    expect(parseTs('2026-08-05T11:32:01+08:00')).toBe(parseTs('2026-08-05T03:32:01Z'))
    expect(parseTs('2026-08-05T11:32:01+08:00')).not.toBe(parseTs('2026-08-05T11:32:01Z'))
  })

  it('🔴 `Number.isFinite` branch: illegal but non-empty string all become 0, don\'t leak NaN', () => {
    for (const bad of ['not-a-date', 'xxxx-yy-zz', '2026-13-45T99:99:99+08:00', '不是时间']) {
      const ms = parseTs(bad)
      expect(ms).toBe(0)
      expect(Number.isNaN(ms)).toBe(false)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// rootForPath — blueprint `:82-90`
// Mock level: `store.state.wikiRoots` = **camelCase** (fixtures README §3 / N46)
// ═══════════════════════════════════════════════════════════════════════════
describe('rootForPath', () => {
  const roots = WIKI_ROOTS_NORMALIZED
  const DATA = roots[0].id
  const DOCS = roots[1].id

  it('Vue2 spec inherit: longest prefix wins · exact match', () => {
    expect(rootForPath(roots, '/DATA/Documents/Specs')?.id).toBe(DOCS)
    expect(rootForPath(roots, '/DATA/Downloads')?.id).toBe(DATA)
    expect(rootForPath(roots, '/DATA')?.id).toBe(DATA)
    expect(rootForPath(roots, '/DATA/Documents')?.id).toBe(DOCS)
  })

  it('Longest wins regardless of array order (blueprint :86 `r.path.length > best.path.length`)', () => {
    expect(rootForPath([...roots].reverse(), '/DATA/Documents/Specs')?.id).toBe(DOCS)
  })

  it('🔴 Non-prefix but same-name prefix — /DATA2 should not match /DATA (criterion: remove `.replace(/\\/+$/,"") + "/"` → this case must red)', () => {
    // Without that added '/', `'/DATA2/x'.startsWith('/DATA')` would be true ⇒ incorrectly treated as /DATA child.
    expect(rootForPath(roots, '/DATA2/x')).toBeNull()
    expect(rootForPath(roots, '/DATA2')).toBeNull()
    expect(rootForPath(roots, '/DATA/DocumentsX/y')?.id).toBe(DATA) // Same-name prefix only affects second level
    expect(rootForPath(roots, '/DATA/DocumentsX/y')?.id).not.toBe(DOCS)
  })

  it('Completely unrelated path → null (Vue2 spec :113)', () => {
    expect(rootForPath(roots, '/Elsewhere')).toBeNull()
    expect(rootForPath(roots, '')).toBeNull()
  })

  it('root.path with trailing slash still matches after normalization (blueprint :85 replace)', () => {
    // 🔴 This case's root is **locally constructed variant** (both roots in fixture have no trailing slash),
    //    only path field changed, other fields from fixture first row.
    const trailing: WikiRoot[] = [{ ...roots[0], id: 'trail', path: '/Backup/' }]
    expect(rootForPath(trailing, '/Backup/notes')?.id).toBe('trail')
    expect(rootForPath(trailing, '/Backup/')?.id).toBe('trail') // Exact match branch
    expect(rootForPath(trailing, '/Backup2/x')).toBeNull()
    // ⚠️ Blueprint only normalizes `startsWith` branch, exact match compares **original** path ⇒ without-slash format doesn't match.
    expect(rootForPath(trailing, '/Backup')).toBeNull()
  })

  it('Empty roots / null / undefined → null (blueprint :83 `roots || []`)', () => {
    expect(rootForPath([], '/DATA/x')).toBeNull()
    expect(rootForPath(null, '/DATA/x')).toBeNull()
    expect(rootForPath(undefined, '/DATA/x')).toBeNull()
  })

  it('null / missing path in array skipped without error (blueprint :84 runtime defense)', () => {
    const dirty = [null, { ...roots[0], path: '' }, undefined, roots[0]]
    expect(rootForPath(dirty, '/DATA/x')?.id).toBe(DATA)
  })

  it('Returned object is same root object from array (T6 uses `root.id` to send rescan)', () => {
    expect(rootForPath(roots, '/DATA/Downloads')).toBe(roots[0])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// renderWikiMarkdown — blueprint `:94-96`
// 🔴 Governance §9.15: **XSS cases belong to component layer T7** (mount WikiView and
//    check real DOM). This block only pins "just forwards", and **throughout does not**
//    **mock** `renderMarkdown`.
// ═══════════════════════════════════════════════════════════════════════════
describe('renderWikiMarkdown', () => {
  it('🔴 Just forwards renderMarkdown — output for each input identical to direct call', () => {
    const inputs = [
      '# Title\n\n- item **bold**\n',
      '',
      'plain text',
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n',
      '[link](https://example.com)',
      '`code` and\n\n```js\nconst a = 1\n```\n',
    ]
    for (const src of inputs) {
      expect(renderWikiMarkdown(src)).toBe(renderMarkdown(src))
    }
  })

  it('Vue2 spec inherit: rendered output truly has markdown structure, empty string still empty string', () => {
    const html = renderWikiMarkdown('# Title\n\n- item **bold**\n')
    expect(html).toContain('<h1>')
    expect(html).toContain('<li>')
    expect(html).toContain('<strong>bold</strong>')
    expect(renderWikiMarkdown('')).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 "Auto-prime" guard (governance §9.19 / plan T3-3)
//
// `views/WikiView.vue` built by **T6**, doesn't exist yet ⇒ this block **currently takes lazy branch**
// (assertions still execute, not `it.skip` / `it.todo`); once T6 creates the file, immediately
// primes it, forces it to `import ... from '../util/wikiViewHelpers'`.
//
// §9.19 cross-task conflict argument: **no conflict** — governance §5.1 relative path spec
// already stated ""`views/WikiView.vue` → helpers: `import { buildWikiTree, trailFor, opToType,
// parseTs, rootForPath, renderWikiMarkdown } from '../util/wikiViewHelpers'`"",
// and plan T6 scope is "verbatim port WikiView and write script imports"
// ⇒ this guard doesn't demand anything from T6 it lacks authority to write (contrast with
// P5e T5↔T6 conflict: that time guard demanded T6-unauthorized markup, took ruling R25 to unlock).
//
// 🔴 Predicate bans bare substring (per ruling **R19**: T2 misfired because `includes('<style')`
// hit comment) — this block's predicate **strips comments first, then anchors line-start to
// import statement**, with "written in comment but not truly imported" edge case.
// RED probe (temporarily build WikiView.vue → red → delete restore → green) in task report.
// ═══════════════════════════════════════════════════════════════════════════
const __dirname = dirname(fileURLToPath(import.meta.url))
const VIEWS_DIR = resolve(__dirname, '../views')
const WIKI_VIEW = resolve(VIEWS_DIR, 'WikiView.vue')
const HELPERS_SPEC = '../util/wikiViewHelpers'

/**
 * Replace comment content with **equal amount of spaces**, preserve line breaks (line-preserving
 * version per P5e §9 "assertions reporting line numbers use line-preserving version").
 * Covers `<!-- -->`(template) · `/* *​/`(script) · entire-line `//`.
 * 🔴 `//` only handles **entire-line** line comments — distinguishing inline `//` from `https://`
 * in strings not worth the effort (same stance as `ParserTest.test.ts:159`;
 * `knowledgeStyles.test.ts:2047` also entire-line only).
 */
function blankComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * "Does this source have **real** import statement importing from `spec`".
 * Line-start anchored, two writing forms each have one branch:
 *   ① Single-line: `import { a, b } from '<spec>'`
 *   ② Multi-line: `import {\n  a,\n} from '<spec>'` — from clause takes own line, starts with `}`
 * Optional `.ts` suffix allowed.
 */
function importsModule(src: string, spec: string): boolean {
  const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    String.raw`^[ \t]*(?:import\b.*|\}[ \t]*)from[ \t]*['"]${escaped}(?:\.ts)?['"]`,
    'm',
  )
  return re.test(blankComments(src))
}

describe('T3 auto-prime guard — if views/WikiView.vue exists, it must import ../util/wikiViewHelpers', () => {
  // 🔴 Vacuum-guard ①: path base must be real. Without this, "file doesn't exist" branch
  // degenerates to "tests nothing", and path errors (missing `..`, dir renamed) never discovered.
  it('Vacuum-guard ① — views directory exists and has .vue files (else "file not exist" branch is vacuous)', () => {
    const vues = readdirSync(VIEWS_DIR).filter((f: string) => f.endsWith('.vue'))
    expect(vues.length, 'no .vue files in views directory — path base wrong?').toBeGreaterThan(0)
    expect(vues).toContain('SearchView.vue')
  })

  // 🔴 Vacuum-guard ②: predicate has discriminative power in both directions on **real files**
  // (not always true / always false). Positive example from this repo's real view with that import,
  // not propped up by comment text (lesson of ruling R19).
  it('Vacuum-guard ② — predicate discriminates on real files (SearchView truly imports searchAggregate, doesn\'t import wikiViewHelpers)', () => {
    const src = readFileSync(resolve(VIEWS_DIR, 'SearchView.vue'), 'utf8')
    expect(src.length, 'SearchView.vue read as empty — node:fs method broken?').toBeGreaterThan(0)
    expect(importsModule(src, '../util/searchAggregate')).toBe(true)
    expect(importsModule(src, HELPERS_SPEC)).toBe(false)
  })

  // 🔴 Vacuum-guard ③: multi-line import form must also be recognized (T6 very likely writes multi-line — blueprint is multi-line).
  it('Vacuum-guard ③ — multi-line import form recognized on real file (IndexedFilesView with `} from \'reka-ui\'`)', () => {
    const src = readFileSync(resolve(VIEWS_DIR, 'IndexedFilesView.vue'), 'utf8')
    expect(src.length).toBeGreaterThan(0)
    expect(importsModule(src, 'reka-ui')).toBe(true)
  })

  // 🔴 Two edge cases (ruling R19: written in comment but no real import ⇒ must be false).
  it('🔴 Edge case A — import statement written in comment but no real import ⇒ false (bare-substring predicate misfires here)', () => {
    const commentOnly = [
      '<script setup lang="ts">',
      "// import { buildWikiTree } from '../util/wikiViewHelpers'",
      '/*',
      " * import { trailFor } from '../util/wikiViewHelpers'",
      ' */',
      'const a = 1',
      '</script>',
      '<template><!-- import x from \'../util/wikiViewHelpers\' --></template>',
    ].join('\n')
    expect(importsModule(commentOnly, HELPERS_SPEC)).toBe(false)
    // Control: bare-substring predicate on same source would be true — this is exactly the form R19 protects against.
    expect(commentOnly.includes(HELPERS_SPEC)).toBe(true)
  })

  it('🔴 Edge case B — real import (single-line / multi-line / with .ts suffix / double quote) all true', () => {
    const single = `<script setup lang="ts">\nimport { buildWikiTree } from '${HELPERS_SPEC}'\n</script>`
    const multi = `<script setup lang="ts">\nimport {\n  buildWikiTree,\n  trailFor,\n} from '${HELPERS_SPEC}'\n</script>`
    const withExt = `<script setup lang="ts">\nimport { parseTs } from '${HELPERS_SPEC}.ts'\n</script>`
    const dq = `<script setup lang="ts">\nimport { opToType } from "${HELPERS_SPEC}"\n</script>`
    const typeOnly = `<script setup lang="ts">\nimport type { WikiViewTreeNode } from '${HELPERS_SPEC}'\n</script>`
    for (const src of [single, multi, withExt, dq, typeOnly]) {
      expect(importsModule(src, HELPERS_SPEC)).toBe(true)
    }
    // Wrong module name must not slip through.
    expect(importsModule(single, '../util/wikiViewHelpersX')).toBe(false)
  })

  it('🔴 Primary condition assertion: WikiView.vue absent ⇒ lazy pass (not skip/todo); once exists must truly import', () => {
    let exists = true
    try {
      statSync(WIKI_VIEW)
    } catch {
      exists = false
    }
    if (!exists) {
      // Lazy branch: assertion still executes, just criterion vacuously true. Moment T6 creates file, this case auto-primes.
      expect(exists, 'WikiView.vue not yet created (T6 task) — this case in "primed standby" state').toBe(false)
      return
    }
    const src = readFileSync(WIKI_VIEW, 'utf8')
    expect(src.length, 'WikiView.vue read as empty — node:fs method broken?').toBeGreaterThan(0)
    expect(
      importsModule(src, HELPERS_SPEC),
      `WikiView.vue doesn't import from ${HELPERS_SPEC} — governance §5.1 requires buildWikiTree / trailFor / ` +
        'opToType / parseTs / rootForPath / renderWikiMarkdown all via util, not rewritten in .vue',
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 **Addition** (ruling **R22** — Important I-1 from T3 review assigned to this blade)
//
// ⚠️ This file to T6 is **extremely narrow allowance: additions only, zero changes to existing lines**
// (ruling R22). 🔴 **`wikiViewHelpers.ts` product code untouched** — review verified every byte as
// **correct**, what's missing was always the guard ("product code right, guard zero" nth instance).
//
// [What to add] `buildWikiTree` "**same-prefix sibling directories**" topology.
//   Review evidence: replace `findParent` with "**longest string prefix, no `'/'` boundary check**"
//   wrong implementation, **all 49 existing cases still green** — zero discriminative power.
//   Real consequence: `/DATA/Media` and `/DATA/MediaBackup` **wrongly hung as parent-child**
//   (latter becomes child of former), Wiki left tree levels thenceforth wrong.
//   ⚠️ `rootForPath` has identical `/DATA2` boundary guard (case above "non-prefix but same-prefix"),
//   **`buildWikiTree` side previously empty**.
//
// [Why existing four topologies can't catch it] fixture normal / crossLevel / missingParent /
//   duplicate / unsorted five groups have **no pair of same-prefix siblings** —
//   `/DATA` vs `/DATA/Documents` are true parent-child; `/u/a` vs `/u/b` prefixes don't contain.
//   "Longest string prefix" wrong implementation **same result as correct** on these five groups.
//
// [Sample source] 🔴 **locally constructed in this file** (not sampled from a fixture) —
//   paths specified by ruling R22 (`/DATA/Media` + `/DATA/MediaBackup`), constructed with this
//   file's existing `flatNode()` per shared package `WikiTreeNode` shape.
//   Precedent: `rootForPath` case above "root.path with trailing slash" also locally constructed variant.
//
// [Criterion] replace `findParent` with this wrong implementation → **this group must red**:
//   ```ts
//   function findParent(byPath, path) {
//     let best = null
//     for (const k of Object.keys(byPath)) {
//       if (k !== path && path.startsWith(k) && (!best || k.length > best.length)) best = k
//     }
//     return best ? byPath[best] : null
//   }
//   ```
//   (Confirmed via RED output and an md5sum restore.)
// ═══════════════════════════════════════════════════════════════════════════
describe('buildWikiTree — 🔴 sibling directories with same prefix must not be wrongly hung as parent-child (ruling R22)', () => {
  // `/DATA/MediaBackup` is **string prefix** of `/DATA/Media`, but **not** its subdirectory
  // (after `/DATA/Media` comes `B` not `/`). Correct parent is `/DATA`.
  const siblings = [
    flatNode('/DATA', { level: 'space' }),
    flatNode('/DATA/Media', { level: 'project' }),
    flatNode('/DATA/MediaBackup', { level: 'project' }),
  ]

  it('🔴 Parent of /DATA/MediaBackup is /DATA, **not** /DATA/Media', () => {
    const { roots, byPath } = buildWikiTree(siblings)
    expect(roots.map((r) => r.path)).toEqual(['/DATA'])
    // Both are direct children of /DATA (lexicographic: Media < MediaBackup).
    expect(byPath['/DATA'].children.map((c) => c.path)).toEqual([
      '/DATA/Media',
      '/DATA/MediaBackup',
    ])
    // 🔴 Discriminant: wrong implementation stuffs MediaBackup into Media's children.
    expect(
      byPath['/DATA/Media'].children,
      '/DATA/MediaBackup wrongly hung as /DATA/Media child — findParent lost "/" boundary check',
    ).toEqual([])
    expect(byPath['/DATA/MediaBackup'].children).toEqual([])
  })

  it('🔴 Each one\'s true subdirectories still hung correctly (boundary check not tricked by "never hang")', () => {
    const deeper = [
      ...siblings,
      flatNode('/DATA/Media/Movies', { level: 'project' }),
      flatNode('/DATA/MediaBackup/2026', { level: 'project' }),
    ]
    const { byPath } = buildWikiTree(deeper)
    expect(byPath['/DATA/Media'].children.map((c) => c.path)).toEqual(['/DATA/Media/Movies'])
    expect(byPath['/DATA/MediaBackup'].children.map((c) => c.path)).toEqual([
      '/DATA/MediaBackup/2026',
    ])
    // Reverse: Movies mustn't go under MediaBackup, 2026 mustn't go under Media.
    expect(byPath['/DATA/Media'].children.map((c) => c.path)).not.toContain('/DATA/MediaBackup/2026')
    expect(byPath['/DATA/MediaBackup'].children.map((c) => c.path)).not.toContain('/DATA/Media/Movies')
    expect(byPath['/DATA'].children.map((c) => c.path)).toEqual(['/DATA/Media', '/DATA/MediaBackup'])
  })

  it('🔴 Same-prefix but **parent missing** must not attach to sibling: only /DATA/Media and /DATA/MediaBackup (no /DATA)', () => {
    const noParent = [
      flatNode('/DATA/Media', { level: 'project' }),
      flatNode('/DATA/MediaBackup', { level: 'project' }),
    ]
    const { roots, byPath } = buildWikiTree(noParent)
    // Neither has ancestors in table ⇒ **each becomes root**, name degenerates to full path (blueprint `:34`).
    expect(roots.map((r) => r.path)).toEqual(['/DATA/Media', '/DATA/MediaBackup'])
    expect(roots.map((r) => r.name)).toEqual(['/DATA/Media', '/DATA/MediaBackup'])
    expect(byPath['/DATA/Media'].children).toEqual([])
  })

  it('🔴 Single-char diff same-prefix (/a vs /ab) also must not hang as parent-child', () => {
    const { roots, byPath } = buildWikiTree([flatNode('/a'), flatNode('/ab'), flatNode('/a/b')])
    expect(roots.map((r) => r.path)).toEqual(['/a', '/ab'])
    expect(byPath['/a'].children.map((c) => c.path)).toEqual(['/a/b'])
    expect(byPath['/ab'].children, '/ab wrongly hung as /a child or vice versa').toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 **Addition · correction block** (ruling **R22** Minor M-1) — "reverse not delete"
//
// Subject of correction: case above in `rootForPath`
// "root.path with trailing slash still matches after normalization"
// — conclusion: "blueprint only normalizes `startsWith` branch, exact match compares
// **original** path ⇒ without-slash format doesn't match".
// 🔴 **Conclusion itself unchanged** (copy blueprint, don't record, don't change product code);
// what changes is **reason**.
//
// ~~T3's reason (data layer, **time-limited**): "both roots in local fixture have no trailing slash
//   ⇒ doesn't affect practice."~~
// 🔴 **Corrected to (backend layer, no time limit)**: backend **cannot store root path with
// trailing slash** — `NimoOS-Wiki/service/roots/manager.go` `Create()` runs
// `args.Path = filepath.Clean(args.Path)` before storage, Go's `filepath.Clean` strips all
// trailing `/` (real test: `"/DATA/"` → `"/DATA"`, `"/DATA//"` → `"/DATA"`,
// `"/Backup///"` → `"/Backup"`).
//   ⇒ `wikiRoots` can **never** have path with trailing slash, regardless of "what local
// fixture looks like", and won't become invalid switching fixtures/devices in future.
// 🔴 Original output from two independent measurements (per **R21**: not allowed single result).
// 🔴 This block **comment-only**: above case's assertions unchanged, product code unchanged.
// ═══════════════════════════════════════════════════════════════════════════
