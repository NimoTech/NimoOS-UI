import { describe, it, expect } from 'vitest'
import {
  aiPatternFor, coveringEnabledRoot, denyGlobFor, isUnder,
  pathFromAiPattern, pathFromDenyGlob, planToggle,
  type FolderPermSnapshot,
} from './folderPermissions'

// 空快照工厂:每个用例只覆盖它关心的那几个字段。
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

describe('规范形态构造与反解', () => {
  it('aiPatternFor 拼 /**(agent 的 gitignore/PathSpec 语义)', () => {
    expect(aiPatternFor('/DATA/Docs')).toBe('/DATA/Docs/**')
  })
  it('denyGlobFor 拼 /*(Parser fnmatch,* 会跨 /)', () => {
    expect(denyGlobFor('/DATA/Docs')).toBe('/DATA/Docs/*')
  })
  it('pathFromAiPattern 反解出目录', () => {
    expect(pathFromAiPattern('/DATA/Docs/**')).toBe('/DATA/Docs')
  })
  it('pathFromAiPattern 拒非绝对路径 / 非 /** 结尾 / 含通配的中段', () => {
    expect(pathFromAiPattern('DATA/Docs/**')).toBeNull()
    expect(pathFromAiPattern('/DATA/Docs')).toBeNull()
    expect(pathFromAiPattern('/DATA/*/x/**')).toBeNull()
    expect(pathFromAiPattern('/**')).toBeNull() // slice 后是空串
    expect(pathFromAiPattern(42)).toBeNull() // 非字符串
  })
  it('pathFromDenyGlob 反解 /* 形态,同样拒非规范值', () => {
    expect(pathFromDenyGlob('/DATA/Docs/*')).toBe('/DATA/Docs')
    expect(pathFromDenyGlob('/DATA/Docs')).toBeNull()
    expect(pathFromDenyGlob('/DATA/*/x/*')).toBeNull()
    // '/**' 会被 endsWith('/*') 命中,slice 掉尾部 * 后剩 '/DATA/Docs/*',含 * → null
    expect(pathFromDenyGlob('/DATA/Docs/**')).toBeNull()
    expect(pathFromDenyGlob(null)).toBeNull()
  })
})

describe('isUnder —— 必须按分段判,不能是裸 startsWith', () => {
  it('真子孙为 true', () => {
    expect(isUnder('/DATA/Docs/a', '/DATA/Docs')).toBe(true)
  })
  it('自己不是自己的子孙', () => {
    expect(isUnder('/DATA/Docs', '/DATA/Docs')).toBe(false)
  })
  it('同前缀的兄弟目录不算子孙(/DATA/DocsOld 不属于 /DATA/Docs)', () => {
    expect(isUnder('/DATA/DocsOld', '/DATA/Docs')).toBe(false)
  })
})

describe('coveringEnabledRoot —— 取最长匹配,且只看启用的根', () => {
  const roots = [
    { id: 1, path: '/DATA', enabled: true },
    { id: 2, path: '/DATA/Docs', enabled: true },
    { id: 3, path: '/DATA/Media', enabled: false },
  ]
  it('最长匹配胜出', () => {
    expect(coveringEnabledRoot('/DATA/Docs/a', roots)?.id).toBe(2)
  })
  it('路径等于根本身也算被覆盖', () => {
    expect(coveringEnabledRoot('/DATA/Docs', roots)?.id).toBe(2)
  })
  it('停用的根不覆盖 —— 回落到更短的启用根', () => {
    expect(coveringEnabledRoot('/DATA/Media/x', roots)?.id).toBe(1)
  })
  it('无任何启用根覆盖时返回 null', () => {
    expect(coveringEnabledRoot('/mnt/x', roots)).toBeNull()
  })
})

describe('planToggle — search 列', () => {
  it('打开:并入并排序', () => {
    const s = snap({ searchRoots: ['/DATA/Z', '/DATA/A'] })
    expect(planToggle('/DATA/M', 'search', true, s)).toEqual([
      { svc: 'search', op: 'putRoots', roots: ['/DATA/A', '/DATA/M', '/DATA/Z'] },
    ])
  })
  it('打开已存在的项:状态已是 on,返回空计划', () => {
    const s = snap({ searchRoots: ['/DATA/A'] })
    expect(planToggle('/DATA/A', 'search', true, s)).toEqual([])
  })
  it('关闭:从列表里剔除', () => {
    const s = snap({ searchRoots: ['/DATA/A', '/DATA/B'] })
    expect(planToggle('/DATA/A', 'search', false, s)).toEqual([
      { svc: 'search', op: 'putRoots', roots: ['/DATA/B'] },
    ])
  })
  it('被祖先继承的项不可操作 —— 返回空计划(inherited-on)', () => {
    const s = snap({ searchRoots: ['/DATA'] })
    expect(planToggle('/DATA/Docs', 'search', false, s)).toEqual([])
  })
  it('服务离线 → 不可操作', () => {
    const s = snap({ offline: { search: true, knowledge: false, ai: false, photos: false } })
    expect(planToggle('/DATA/A', 'search', true, s)).toEqual([])
  })
})

describe('planToggle — photos 列', () => {
  it('打开:并入排序,并带上 needsMaterialize=auto', () => {
    const s = snap({ photos: { auto: true, dirs: ['/DATA/Gallery'], stale: false } })
    expect(planToggle('/DATA/Pics', 'photos', true, s)).toEqual([
      { svc: 'photos', op: 'putWatchDirs', dirs: ['/DATA/Gallery', '/DATA/Pics'], needsMaterialize: true },
    ])
  })
  it('关闭最后一个 → dirs 变空数组(调用方要据此弹「回自动模式」确认)', () => {
    const s = snap({ photos: { auto: false, dirs: ['/DATA/Gallery'], stale: false } })
    expect(planToggle('/DATA/Gallery', 'photos', false, s)).toEqual([
      { svc: 'photos', op: 'putWatchDirs', dirs: [], needsMaterialize: false },
    ])
  })
  it('stale(旧 Photos 后端)→ 不可操作', () => {
    const s = snap({ photos: { auto: true, dirs: [], stale: true } })
    expect(planToggle('/DATA/Pics', 'photos', true, s)).toEqual([])
  })
})

describe('planToggle — ai 列(语义反向:on = 未被拉黑)', () => {
  it('默认未拉黑 → 关闭 = 加 pattern', () => {
    expect(planToggle('/DATA/Secret', 'ai', false, snap())).toEqual([
      { svc: 'ai', op: 'addPattern', pattern: '/DATA/Secret/**' },
    ])
  })
  it('已拉黑 → 打开 = 按 entryId 删 pattern', () => {
    const s = snap({ blacklist: [{ id: 7, pattern: '/DATA/Secret/**' }] })
    expect(planToggle('/DATA/Secret', 'ai', true, s)).toEqual([
      { svc: 'ai', op: 'removePattern', id: 7 },
    ])
  })
  it('祖先已拉黑 → inherited-off,不可操作', () => {
    const s = snap({ blacklist: [{ id: 7, pattern: '/DATA/**' }] })
    expect(planToggle('/DATA/Secret', 'ai', true, s)).toEqual([])
  })
})

describe('planToggle — knowledge 列(三种 kind)', () => {
  it('kind=root:开关直接翻根的 enabled', () => {
    const s = snap({ wikiRoots: [{ id: 2, path: '/DATA/Docs', enabled: false }] })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([
      { svc: 'wiki', op: 'enableRoot', id: 2 },
    ])
    const s2 = snap({ wikiRoots: [{ id: 2, path: '/DATA/Docs', enabled: true }] })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s2)).toEqual([
      { svc: 'wiki', op: 'disableRoot', id: 2 },
    ])
  })
  it('kind=uncovered:打开 = 建根;关闭 = 无事可做', () => {
    expect(planToggle('/mnt/X', 'knowledge', true, snap())).toEqual([
      { svc: 'wiki', op: 'createRoot', path: '/mnt/X' },
    ])
    expect(planToggle('/mnt/X', 'knowledge', false, snap())).toEqual([])
  })
  it('kind=subdir 且当前 on:关闭 = 加 deny 规则', () => {
    const s = snap({ wikiRoots: [{ id: 1, path: '/DATA', enabled: true }] })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('kind=subdir 且已被 deny:打开 = 按 id 删该 deny 规则', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 1, path_glob: '/DATA/Docs/*', action: 'deny' }],
    })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([
      { svc: 'parser', op: 'removeDeny', id: 33 },
    ])
  })
  it('deny 规则挂在别的根上 → 不认(root_id 必须匹配覆盖根)', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 99, path_glob: '/DATA/Docs/*', action: 'deny' }],
    })
    // 当前仍是 on,desired=true → 空计划;desired=false 才加新 deny
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([])
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('action 不是 deny 的规则不算(allow 规则不能当 deny 用)', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 1, path_glob: '/DATA/Docs/*', action: 'allow' }],
    })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('knowledge 离线 → 不可操作', () => {
    const s = snap({ offline: { search: false, knowledge: true, ai: false, photos: false } })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([])
  })
})
