// SP8-P5f Task 3 —— `wikiViewHelpers.ts` 的守卫。
//
// 承接 Vue2 `NimoOS-UI`(main@7a6ee6b7)
// `src/views/AI/Knowledge/__tests__/wikiViewHelpers.spec.js`(119 行 / 9 条)的**全部行为**
// (治理 §4.3 / 裁定 R10:本期只承接这一份 Vue2 spec),并按治理 §9.16 加细。
//
// 🔴 §9.16 —— `buildWikiTree` 是本刀最容易写成零判别力的地方:
// 同一份「已排好序、层级整齐」的样本上,好几种错实现会给出**相同结果**
// (「用 `lastIndexOf('/')` 直接切一级父」在整齐树上与正确实现同解)。
// 因此本文件的四条判别力用例取自 `p5f-fixtures/wiki-tree.CONSTRUCTED.json` 的
// crossLevel / missingParent / duplicate / unsorted 四种拓扑,并在报告里贴了两组 RED 探针:
//   ① `findParent` 换成「只切一级」→ crossLevel 那条必须报红;
//   ② 删掉 `sort` → unsorted 那条必须报红。
//
// 🔴 §9.15 —— `renderWikiMarkdown` 的 **XSS 用例归 T7 的组件层**(挂载 `WikiView` 后查真实 DOM)。
// 本文件只放一条「就是转发 `renderMarkdown`」的断言,且**不 mock** `renderMarkdown`
// (治理明令:禁止 mock 掉 `renderMarkdown` 之后还声称验过 XSS)。
//
// 🔴 环境坑三条 —— 逐字沿用 `knowledgeStyles.test.ts:1-17` 的既定解法(不是重新踩坑):
// ① 本仓 `package.json` 是 `"type": "module"` ⇒ `__dirname` 在 ESM 下不可用,
//    改用 `import.meta.url` + `fileURLToPath` 的等价写法;
// ② 本仓未装 `@types/node` ⇒ `node:fs` / `node:path` / `node:url` 无类型声明,
//    `vue-tsc --noEmit`(任务门之一)会报 TS2307,逐行 `@ts-expect-error` 抑制;
// ③ 🔴 **不用 Vite 的 `?raw` 替代 `node:fs`** —— vitest 的 CSSEnablerPlugin 会让 `?raw`
//    读出空串,断言对空字符串「假通过」(铁律)。
import { describe, it, expect } from 'vitest'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明,见上方注释
import { readFileSync, readdirSync, statSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明,见上方注释
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明,见上方注释
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
// 🔴 fixture 抄本(治理 P5c §4.4:抄进测试 + 注释标出处 + 程序化逐字节等价校验;
//    **不许在运行时读 `.superpowers/`** —— 它不在构建产物里,`?raw` 在 vitest 下恒空)。
// 🔴 裁定 R14 / fixtures README §0.2:**只取数据字段**,`__meta` 转成注释。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── FIXTURE-COPY-BEGIN: wiki-tree ──────────────────────────────────────────
// 出处:`.superpowers/sdd/p5f-fixtures/wiki-tree.CONSTRUCTED.json`
// 🔴 三级出处标签(`__meta.label`)= **`.CONSTRUCTED`** —— **不是真机数据**,
//    也不许拿它去推翻 N46 的命名结论(fixtures README §0 / 治理 §9.18-2)。
// `__meta.why`:「GET /v1/wiki/tree 本机实测 90 秒超时、0 字节(D1)⇒ 无真机样本。」
// `__meta.built_from`:「NimoOS-Wiki/route/v1/wiki.go:126-132 的匿名 struct `sk`
//    (**snake_case json tag**):path / level / ai_label / user_notes_updated_at / last_modified」
// `__meta.value_units`:「ai_label 空串合法;last_modified 是 RFC3339 本地时区字符串,
//    后端 formatTS(ms<=0) 返回 **空串**(wiki.go:47-52)—— 不是 '1970'」
// `__meta.normalized_shape`:「经 NimoOS-Service/src/wiki.ts:102 normalizeTreeNode →
//    camelCase { path, level, aiLabel, userNotesUpdatedAt, lastModified }。
//    store.loadWikiTree() 出的是**扁平数组**,buildWikiTree 吃的就是它」
// `__meta.topologies`:「三份样本按治理 §9.16 造:normal(整齐树)/ crossLevel(跨级)/
//    missingParent(父缺位)/ duplicate(重复行)/ unsorted(乱序)」
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
// 出处:`.superpowers/sdd/p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json`
// 🔴 三级出处标签(`__meta.label`)= **`.CONSTRUCTED`** —— **不是真机数据**。
// `__meta.why`:「同 wiki-roots.CONSTRUCTED.json —— /roots 本机超时,无真机样本。」
// `__meta.built_from`:「把 wiki-roots.CONSTRUCTED.json 的 raw_response 逐字段过
//    NimoOS-Service/src/wiki.ts:85 normalizeRoot」
// `__meta.shape`:「🔴 camelCase —— 这就是 store.state.wikiRoots 的出口形状,
//    RootsView / WikiView 的 mock 一律照它(N46)」
// `__meta.note`:「enabled 经 `!!r.Enabled` 归一成 boolean;
//    scanIntervalS/createdAt/lastScanAt 经 `|| 0` 兜底」
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
 * fixture 是 **HTTP 原始 snake_case**;`buildWikiTree` 吃的是 **store 出口 camelCase**
 * (`store.loadWikiTree()`,归一化在共享包 `NimoOS-Service/src/wiki.ts:102 normalizeTreeNode`)。
 * 本函数只做**键名对应**,不重新实现归一化逻辑(N46:两种命名风格是本期最容易搞错的一点)。
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

/** Vue2 spec 的样本只写 `{path, level}`;本仓类型是共享包 `WikiTreeNode`(五字段全有)。 */
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
// baseName —— 蓝本 `wikiViewHelpers.js:6-11`
// ═══════════════════════════════════════════════════════════════════════════
describe('baseName', () => {
  // 承接 Vue2 spec `:76-81`「baseName is defensive」四条。
  it('Vue2 spec 承接:/a/b/c → c · /a/b/ → b · / → / · "" → ""', () => {
    expect(baseName('/a/b/c')).toBe('c')
    expect(baseName('/a/b/')).toBe('b')
    expect(baseName('/')).toBe('/')
    expect(baseName('')).toBe('')
  })

  it('空 / 非字符串一律 ""(蓝本 :7 的运行时防御,收窄成 string 就永远测不到)', () => {
    expect(baseName(undefined)).toBe('')
    expect(baseName(null)).toBe('')
    expect(baseName(0)).toBe('')
    expect(baseName(123)).toBe('')
    expect(baseName({ path: '/a' })).toBe('')
    expect(baseName([])).toBe('')
  })

  it('单字符 "/" 不被尾斜杠归一吃掉(蓝本 :8 的 `p.length > 1 ?` 这一支)', () => {
    // length > 1 才 replace ⇒ '/' 原样保留 ⇒ lastIndexOf('/') === 0 ⇒ slice(1) === '' ⇒ `|| s` 兜底回 '/'。
    expect(baseName('/')).toBe('/')
    // 判别力:若把 `p.length > 1 ?` 去掉,'/' 会被 replace 成 '',结果变成 ''。
    expect(baseName('/')).not.toBe('')
  })

  it('多重尾斜杠一并剥掉(蓝本 :8 的 /\\/+$/)', () => {
    expect(baseName('/a/b///')).toBe('b')
    expect(baseName('/DATA//')).toBe('DATA')
  })

  it('无斜杠时整串就是 basename(蓝本 :10 的 `i < 0` 这一支)', () => {
    expect(baseName('DATA')).toBe('DATA')
    expect(baseName('a')).toBe('a')
  })

  it('🔴 `slice(i + 1) || s` 的兜底分支:剥完尾斜杠仍以 / 结尾的串', () => {
    // '//' → length > 1 ⇒ replace(/\/+$/) 把**整串**剥成 '' ⇒ lastIndexOf('/') === -1 ⇒ 走 `i < 0` 回 ''。
    expect(baseName('//')).toBe('')
    // 真正命中 `|| s` 兜底的是「lastIndexOf 命中第 0 位且其后为空」的形态,即单字符 '/'。
    expect(baseName('/')).toBe('/')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// buildWikiTree —— 蓝本 `:18-37` + 模块私有 `findParent`(`:39-47`)
// ═══════════════════════════════════════════════════════════════════════════
describe('buildWikiTree —— Vue2 spec 承接', () => {
  // 逐字取自 Vue2 spec `:8-14` 的 `flat`(乱序,含两棵树)。
  const flat = [
    flatNode('/DATA/Wiki/Work', { level: 'dir' }),
    flatNode('/DATA', { level: 'root' }),
    flatNode('/DATA/Wiki', { level: 'dir' }),
    flatNode('/Backup', { level: 'root' }),
    flatNode('/DATA/Downloads', { level: 'dir' }),
  ]

  it('assembles a forest from the unsorted flat list(Vue2 spec :16-22)', () => {
    const { roots, byPath } = buildWikiTree(flat)
    expect(roots.map((r) => r.path)).toEqual(['/Backup', '/DATA'])
    expect(byPath['/DATA'].children.map((c) => c.path)).toEqual(['/DATA/Downloads', '/DATA/Wiki'])
    expect(byPath['/DATA/Wiki'].children.map((c) => c.path)).toEqual(['/DATA/Wiki/Work'])
  })

  it('顶层根用全路径当 name,子节点用 basename(Vue2 spec :24-28)', () => {
    const { byPath } = buildWikiTree(flat)
    expect(byPath['/DATA'].name).toBe('/DATA')
    expect(byPath['/DATA/Wiki/Work'].name).toBe('Work')
  })

  it('忽略重复与空路径(Vue2 spec :38-44)', () => {
    const { roots } = buildWikiTree([flatNode('/x'), flatNode('/x'), flatNode(''), null])
    expect(roots).toHaveLength(1)
  })

  it('入参为 null / undefined / 空数组一律回空森林(蓝本 :19 的 `(list || [])`)', () => {
    expect(buildWikiTree(null)).toEqual({ roots: [], byPath: {} })
    expect(buildWikiTree(undefined)).toEqual({ roots: [], byPath: {} })
    expect(buildWikiTree([])).toEqual({ roots: [], byPath: {} })
  })

  it('不修改入参数组(蓝本 :21 的 `.slice()` 在 sort 之前)', () => {
    const input = [flatNode('/z'), flatNode('/a')]
    const before = input.map((n) => n.path)
    buildWikiTree(input)
    expect(input.map((n) => n.path)).toEqual(before)
  })
})

describe('buildWikiTree —— 🔴 治理 §9.16:四种「会分辨错实现」的拓扑(取自 .CONSTRUCTED fixture)', () => {
  it('normal(整齐树)—— 三级链路,且扁平节点的其余字段原样带进树节点(蓝本 :28 的 `{ ...n }`)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.normal)
    expect(roots.map((r) => r.path)).toEqual(['/DATA'])
    expect(byPath['/DATA'].children.map((c) => c.path)).toEqual(['/DATA/Documents'])
    expect(byPath['/DATA/Documents'].children.map((c) => c.path)).toEqual(['/DATA/Documents/Specs'])
    // 透传字段(T6 会读 aiLabel / lastModified,蓝本 WikiView.vue:191/:193)。
    expect(byPath['/DATA'].aiLabel).toBe('主数据盘')
    expect(byPath['/DATA'].level).toBe('space')
    expect(byPath['/DATA'].lastModified).toBe('2026-08-05T11:32:01+08:00')
    expect(byPath['/DATA/Documents/Specs'].lastModified).toBe('')
  })

  it('🔴 ② crossLevel:/a 与 /a/b/c 在、/a/b 不在 ⇒ 父是 /a(判据:findParent 换成「只切一级」→ 本条必须报红)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.crossLevel)
    // 「只切一级」的错实现会让 /a/b/c 找不到 byPath['/a/b'] ⇒ 它变成第二个根、name 变全路径。
    expect(roots.map((r) => r.path)).toEqual(['/a'])
    expect(byPath['/a'].children.map((c) => c.path)).toEqual(['/a/b/c'])
    expect(byPath['/a/b/c'].name).toBe('c')
    expect(byPath['/a/b']).toBeUndefined()
  })

  it('🔴 ① missingParent:只有 /x/y/z ⇒ 成为根且 name 是全路径(蓝本 :34 的 `t.name = n.path`)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.missingParent)
    expect(roots).toHaveLength(1)
    expect(roots[0].path).toBe('/x/y/z')
    expect(roots[0].name).toBe('/x/y/z')
    expect(roots[0].name).not.toBe('z') // 不是 basename —— 这正是「顶层根显示全路径」的判别点
    expect(byPath['/x/y/z']).toBe(roots[0])
  })

  it('🔴 ③ duplicate:同 path 两行 ⇒ 只建一个节点,且**先到的**那行胜出(蓝本 :27 的 `continue`)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.duplicate)
    expect(roots).toHaveLength(1)
    expect(Object.keys(byPath)).toEqual(['/dup'])
    // 「后到覆盖」的错实现会给出 'second'。
    expect(byPath['/dup'].aiLabel).toBe('first')
    expect(byPath['/dup'].children).toEqual([])
  })

  it('🔴 ④ unsorted:/u/b 排在 /u 前面 ⇒ 仍只有一个根(判据:删掉 sort → 本条必须报红)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.unsorted)
    // 无 sort 时 /u/b 先被处理,找不到父 ⇒ 自己成根(roots 变 ['/u/b','/u'])。
    expect(roots.map((r) => r.path)).toEqual(['/u'])
    expect(byPath['/u'].children.map((c) => c.path)).toEqual(['/u/a', '/u/b'])
    expect(byPath['/u/b'].name).toBe('b')
  })

  it('🔴 sort 是按 path 字典序,不是「按输入顺序」—— 子节点顺序恒定与输入无关', () => {
    const forward = buildWikiTree(TOPO.unsorted)
    const reversed = buildWikiTree([...TOPO.unsorted].reverse())
    expect(reversed.roots.map((r) => r.path)).toEqual(forward.roots.map((r) => r.path))
    expect(reversed.byPath['/u'].children.map((c) => c.path)).toEqual(['/u/a', '/u/b'])
  })

  it('byPath 里的对象与 roots/children 里的是同一份引用(T6 靠这个做就地选中)', () => {
    const { roots, byPath } = buildWikiTree(TOPO.normal)
    expect(byPath['/DATA']).toBe(roots[0])
    expect(byPath['/DATA/Documents']).toBe(roots[0].children[0])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// trailFor —— 蓝本 `:52-62`
// ═══════════════════════════════════════════════════════════════════════════
describe('trailFor', () => {
  const { byPath } = buildWikiTree(TOPO.normal)

  it('Vue2 spec 承接:祖先链 root-most first,含自身', () => {
    expect(trailFor(byPath, '/DATA/Documents/Specs').map((n) => n.path)).toEqual([
      '/DATA',
      '/DATA/Documents',
      '/DATA/Documents/Specs',
    ])
  })

  it('Vue2 spec 承接:中间节点缺位时被过滤掉,已知的仍在', () => {
    expect(trailFor(byPath, '/DATA/Other/Deep').map((n) => n.path)).toEqual(['/DATA'])
  })

  it('Vue2 spec 承接:空串 → []', () => {
    expect(trailFor(byPath, '')).toEqual([])
  })

  it('非字符串 / undefined / null → []（蓝本 :53 的运行时防御)', () => {
    expect(trailFor(byPath, undefined)).toEqual([])
    expect(trailFor(byPath, null)).toEqual([])
    expect(trailFor(byPath, 42)).toEqual([])
    expect(trailFor(byPath, ['/DATA'])).toEqual([])
  })

  it('整条链都不在索引里 → []', () => {
    expect(trailFor(byPath, '/Nowhere/At/All')).toEqual([])
  })

  it('多余斜杠被 `filter(Boolean)` 吃掉,链路仍能命中(蓝本 :54)', () => {
    expect(trailFor(byPath, '//DATA//Documents//').map((n) => n.path)).toEqual([
      '/DATA',
      '/DATA/Documents',
    ])
  })

  it('返回的是 byPath 里的同一份对象引用,不是拷贝', () => {
    expect(trailFor(byPath, '/DATA')[0]).toBe(byPath['/DATA'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// opToType —— 蓝本 `:65-70`(N58:`modify` + 任何未知值 → 'mod' 兜底照抄)
// ═══════════════════════════════════════════════════════════════════════════
describe('opToType', () => {
  it('Vue2 spec 承接:四分支 + 未知值兜底', () => {
    expect(opToType('create')).toBe('add')
    expect(opToType('modify')).toBe('mod')
    expect(opToType('delete')).toBe('del')
    expect(opToType('rename')).toBe('ren')
    expect(opToType('surprise')).toBe('mod')
  })

  it('🔴 N58:`modify` 与任何未知值都落到同一个 mod 兜底(照抄,不许拆成显式 modify 分支后让未知值另走一支)', () => {
    // `wiki-node.CONSTRUCTED.json` 的 recent_changes 里刻意埋了未知 op `chmod`。
    for (const unknown of ['chmod', '', 'CREATE', 'Delete', 'move', 'modify']) {
      expect(opToType(unknown)).toBe('mod')
    }
  })

  it('大小写敏感 —— 只认全小写(蓝本用的是 ===)', () => {
    expect(opToType('Create')).not.toBe('add')
    expect(opToType('DELETE')).not.toBe('del')
    expect(opToType('Rename')).not.toBe('ren')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// parseTs —— 蓝本 `:73-77`
// 🔴 返回**毫秒**;下游 `fmtAgo(ms)`(`knowledgeStore.ts:190`)吃毫秒。
//    喂错单位不报错,只会静默算成 1970(承 P5d-T3 / P5e §9.13)。
// ═══════════════════════════════════════════════════════════════════════════
describe('parseTs', () => {
  // fixture `wiki-tree.CONSTRUCTED.json` 的 normal[0].last_modified 原值。
  const RFC = '2026-08-05T11:32:01+08:00'
  const EXPECT_MS = Date.UTC(2026, 7, 5, 3, 32, 1) // +08:00 11:32:01 ⇒ 03:32:01 UTC

  it('Vue2 spec 承接:合法 RFC3339 > 0 · "" → 0 · undefined → 0 · 垃圾串 → 0', () => {
    expect(parseTs('2026-07-20T10:00:00+08:00')).toBeGreaterThan(0)
    expect(parseTs('')).toBe(0)
    expect(parseTs(undefined)).toBe(0)
    expect(parseTs('not-a-date')).toBe(0)
  })

  it('null 也走 `!s` 那一支 → 0(后端 formatTS(ms<=0) 回空串,不是 "1970")', () => {
    expect(parseTs(null)).toBe(0)
  })

  it('🔴 单位是毫秒,不是秒 —— 逐位钉死取值', () => {
    expect(parseTs(RFC)).toBe(EXPECT_MS)
    // 毫秒侧:13 位 epoch。
    expect(String(parseTs(RFC))).toHaveLength(13)
    expect(parseTs(RFC)).toBeGreaterThan(1e12)
    // 秒侧:若实现里多除了 1000(或后端换成秒级 epoch 而这里没跟着改),下面这条会成立 —— 必须不成立。
    expect(parseTs(RFC)).not.toBe(EXPECT_MS / 1000)
    expect(String(parseTs(RFC))).not.toHaveLength(10)
  })

  it('时区偏移真的参与换算(同一时刻的两种写法必须同值)', () => {
    expect(parseTs('2026-08-05T11:32:01+08:00')).toBe(parseTs('2026-08-05T03:32:01Z'))
    expect(parseTs('2026-08-05T11:32:01+08:00')).not.toBe(parseTs('2026-08-05T11:32:01Z'))
  })

  it('🔴 `Number.isFinite` 那一支:非法但非空的串一律 0,不许漏出 NaN', () => {
    for (const bad of ['not-a-date', 'xxxx-yy-zz', '2026-13-45T99:99:99+08:00', '不是时间']) {
      const ms = parseTs(bad)
      expect(ms).toBe(0)
      expect(Number.isNaN(ms)).toBe(false)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// rootForPath —— 蓝本 `:82-90`
// mock 层次:`store.state.wikiRoots` = **camelCase**(fixtures README §3 / N46)
// ═══════════════════════════════════════════════════════════════════════════
describe('rootForPath', () => {
  const roots = WIKI_ROOTS_NORMALIZED
  const DATA = roots[0].id
  const DOCS = roots[1].id

  it('Vue2 spec 承接:最长前缀取胜 · 精确相等', () => {
    expect(rootForPath(roots, '/DATA/Documents/Specs')?.id).toBe(DOCS)
    expect(rootForPath(roots, '/DATA/Downloads')?.id).toBe(DATA)
    expect(rootForPath(roots, '/DATA')?.id).toBe(DATA)
    expect(rootForPath(roots, '/DATA/Documents')?.id).toBe(DOCS)
  })

  it('最长取胜与数组顺序无关(蓝本 :86 的 `r.path.length > best.path.length`)', () => {
    expect(rootForPath([...roots].reverse(), '/DATA/Documents/Specs')?.id).toBe(DOCS)
  })

  it('🔴 非前缀但同名开头 —— /DATA2 不该匹配 /DATA(判据:去掉 `.replace(/\\/+$/,"") + "/"` → 本条必须报红)', () => {
    // 少了那个补上的 '/',`'/DATA2/x'.startsWith('/DATA')` 会成立 ⇒ 错认成 /DATA 的下属。
    expect(rootForPath(roots, '/DATA2/x')).toBeNull()
    expect(rootForPath(roots, '/DATA2')).toBeNull()
    expect(rootForPath(roots, '/DATA/DocumentsX/y')?.id).toBe(DATA) // 同名开头只影响到第二层
    expect(rootForPath(roots, '/DATA/DocumentsX/y')?.id).not.toBe(DOCS)
  })

  it('完全不相干的路径 → null(Vue2 spec :113)', () => {
    expect(rootForPath(roots, '/Elsewhere')).toBeNull()
    expect(rootForPath(roots, '')).toBeNull()
  })

  it('root.path 带尾斜杠时归一化后仍能匹配(蓝本 :85 的 replace)', () => {
    // 🔴 本条的 root 是**本文件就地构造**的变体(fixture 里两个 root 都不带尾斜杠),
    //    只改了 path 一个字段,其余字段照 fixture 第一条。
    const trailing: WikiRoot[] = [{ ...roots[0], id: 'trail', path: '/Backup/' }]
    expect(rootForPath(trailing, '/Backup/notes')?.id).toBe('trail')
    expect(rootForPath(trailing, '/Backup/')?.id).toBe('trail') // 精确相等那一支
    expect(rootForPath(trailing, '/Backup2/x')).toBeNull()
    // ⚠️ 蓝本只对 `startsWith` 那一支做归一化,精确相等比的是**原始** path ⇒ 不带斜杠的写法不命中。
    expect(rootForPath(trailing, '/Backup')).toBeNull()
  })

  it('空 roots / null / undefined → null(蓝本 :83 的 `roots || []`)', () => {
    expect(rootForPath([], '/DATA/x')).toBeNull()
    expect(rootForPath(null, '/DATA/x')).toBeNull()
    expect(rootForPath(undefined, '/DATA/x')).toBeNull()
  })

  it('数组里的 null / 无 path 项被跳过而不是抛错(蓝本 :84 的运行时防御)', () => {
    const dirty = [null, { ...roots[0], path: '' }, undefined, roots[0]]
    expect(rootForPath(dirty, '/DATA/x')?.id).toBe(DATA)
  })

  it('返回的是数组里的同一份 root 对象(T6 要用 `root.id` 发 rescan)', () => {
    expect(rootForPath(roots, '/DATA/Downloads')).toBe(roots[0])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// renderWikiMarkdown —— 蓝本 `:94-96`
// 🔴 治理 §9.15:**XSS 用例归 T7 的组件层**(挂载 WikiView 后查真实 DOM)。
//    本块只钉「就是转发」,且**全程不 mock** `renderMarkdown`。
// ═══════════════════════════════════════════════════════════════════════════
describe('renderWikiMarkdown', () => {
  it('🔴 就是转发 renderMarkdown —— 逐个输入的输出与直调完全相同', () => {
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

  it('Vue2 spec 承接:渲染出的确实是 markdown 结构,空串仍是空串', () => {
    const html = renderWikiMarkdown('# Title\n\n- item **bold**\n')
    expect(html).toContain('<h1>')
    expect(html).toContain('<li>')
    expect(html).toContain('<strong>bold</strong>')
    expect(renderWikiMarkdown('')).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 「自动上膛」守卫(治理 §9.19 / 计划书 T3-3)
//
// `views/WikiView.vue` 由 **T6** 建,现在还不存在 ⇒ 本块**现在走惰性分支**
// (断言仍被执行,不是 `it.skip` / `it.todo`);T6 一建文件立刻上膛,
// 强制它 `import ... from '../util/wikiViewHelpers'`。
//
// §9.19 跨刀冲突论证:**不冲突** —— 治理 §5.1 的相对路径表原文就写了
// 「`views/WikiView.vue` → helpers:`import { buildWikiTree, trailFor, opToType,
// parseTs, rootForPath, renderWikiMarkdown } from '../util/wikiViewHelpers'`」,
// 且计划书 T6 的范围就是「逐字移植 WikiView 并写 script imports」
// ⇒ 本守卫不向 T6 索要任何它无权写的东西(与 P5e 的 T5↔T6 冲突形成对照:
// 那次是守卫索要 T6 无权写的 markup,靠裁定 R25 才解开)。
//
// 🔴 谓词禁用裸子串(承裁定 **R19**:T2 就因 `includes('<style')` 命中注释而误诊)——
// 本块的谓词**先剥注释、再行首锚定到 import 语句**,并配「注释里写了但没真 import」
// 的偏态用例。RED 探针(临时建 WikiView.vue → 报红 → 删除还原 → 转绿)见任务报告。
// ═══════════════════════════════════════════════════════════════════════════
const __dirname = dirname(fileURLToPath(import.meta.url))
const VIEWS_DIR = resolve(__dirname, '../views')
const WIKI_VIEW = resolve(VIEWS_DIR, 'WikiView.vue')
const HELPERS_SPEC = '../util/wikiViewHelpers'

/**
 * 把注释内容换成**等量空格**、保留换行(保行版,承 P5e §9 「报行号的断言用保行版」)。
 * 覆盖 `<!-- -->`(模板)· `/* *​/`(script)· 整行 `//`。
 * 🔴 `//` 只处理**整行**行注释 —— 行内的 `//` 要区分字符串里的 `https://`,得不偿失
 * (与 `ParserTest.test.ts:159` 的既定口径同源;`knowledgeStyles.test.ts:2047` 也是整行口径)。
 */
function blankComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * 「这份源码里有没有一条**真的** import 语句从 `spec` 取东西」。
 * 行首锚定,两种书写形态各一条分支:
 *   ① 单行:`import { a, b } from '<spec>'`
 *   ② 多行:`import {\n  a,\n} from '<spec>'` —— from 子句独占一行、以 `}` 开头
 * 允许可选的 `.ts` 后缀。
 */
function importsModule(src: string, spec: string): boolean {
  const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    String.raw`^[ \t]*(?:import\b.*|\}[ \t]*)from[ \t]*['"]${escaped}(?:\.ts)?['"]`,
    'm',
  )
  return re.test(blankComments(src))
}

describe('T3 自动上膛守卫 —— 若 views/WikiView.vue 存在,则它必须 import ../util/wikiViewHelpers', () => {
  // 🔴 防空转①:路径基座必须是真的。少了这条,「文件还不存在」那一支会退化成
  // 「什么都没测」,而且路径写错(少一层 `..`、目录改名)永远发现不了。
  it('防空转① —— views 目录存在且已有 .vue 文件(否则「文件不存在」这一支毫无意义)', () => {
    const vues = readdirSync(VIEWS_DIR).filter((f: string) => f.endsWith('.vue'))
    expect(vues.length, 'views 目录里一个 .vue 都没有 —— 路径基座写错了?').toBeGreaterThan(0)
    expect(vues).toContain('SearchView.vue')
  })

  // 🔴 防空转②:谓词在**真实文件**上双向都有判别力(不是恒 true / 恒 false)。
  //   正例取自本仓真有该 import 的既有视图,不是靠注释文字撑着(裁定 R19 的教训)。
  it('防空转② —— 谓词在真实文件上双向可分辨(SearchView 真 import searchAggregate,但没 import wikiViewHelpers)', () => {
    const src = readFileSync(resolve(VIEWS_DIR, 'SearchView.vue'), 'utf8')
    expect(src.length, 'SearchView.vue 读出来是空的 —— node:fs 读法失效了').toBeGreaterThan(0)
    expect(importsModule(src, '../util/searchAggregate')).toBe(true)
    expect(importsModule(src, HELPERS_SPEC)).toBe(false)
  })

  // 🔴 防空转③:多行 import 形态也必须被认出来(T6 很可能写成多行 —— 蓝本就是多行)。
  it('防空转③ —— 多行 import 形态在真实文件上被认出(IndexedFilesView 的 `} from \'reka-ui\'`)', () => {
    const src = readFileSync(resolve(VIEWS_DIR, 'IndexedFilesView.vue'), 'utf8')
    expect(src.length).toBeGreaterThan(0)
    expect(importsModule(src, 'reka-ui')).toBe(true)
  })

  // 🔴 两种偏态(裁定 R19:注释里写了但没真 import ⇒ 必须判假)。
  it('🔴 偏态 A —— 注释里写了 import 语句但没真 import ⇒ 判假(裸子串谓词会在这里误判)', () => {
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
    // 对照:裸子串谓词在同一份源码上会判真 —— 这正是 R19 要防的形态。
    expect(commentOnly.includes(HELPERS_SPEC)).toBe(true)
  })

  it('🔴 偏态 B —— 真 import(单行 / 多行 / 带 .ts 后缀 / 双引号)一律判真', () => {
    const single = `<script setup lang="ts">\nimport { buildWikiTree } from '${HELPERS_SPEC}'\n</script>`
    const multi = `<script setup lang="ts">\nimport {\n  buildWikiTree,\n  trailFor,\n} from '${HELPERS_SPEC}'\n</script>`
    const withExt = `<script setup lang="ts">\nimport { parseTs } from '${HELPERS_SPEC}.ts'\n</script>`
    const dq = `<script setup lang="ts">\nimport { opToType } from "${HELPERS_SPEC}"\n</script>`
    const typeOnly = `<script setup lang="ts">\nimport type { WikiViewTreeNode } from '${HELPERS_SPEC}'\n</script>`
    for (const src of [single, multi, withExt, dq, typeOnly]) {
      expect(importsModule(src, HELPERS_SPEC)).toBe(true)
    }
    // 错模块名不许蒙混过关。
    expect(importsModule(single, '../util/wikiViewHelpersX')).toBe(false)
  })

  it('🔴 本体条件断言:WikiView.vue 不存在 ⇒ 惰性通过(非 skip/todo);一旦存在则必须真 import', () => {
    let exists = true
    try {
      statSync(WIKI_VIEW)
    } catch {
      exists = false
    }
    if (!exists) {
      // 惰性分支:断言仍被执行到,只是判据真空成立。T6 建文件的那一刻本条自动上膛。
      expect(exists, 'WikiView.vue 尚未创建(T6 的活)—— 本条处于「上膛待发」状态').toBe(false)
      return
    }
    const src = readFileSync(WIKI_VIEW, 'utf8')
    expect(src.length, 'WikiView.vue 读出来是空的 —— node:fs 读法失效了').toBeGreaterThan(0)
    expect(
      importsModule(src, HELPERS_SPEC),
      `WikiView.vue 没有从 ${HELPERS_SPEC} import —— 治理 §5.1 要求 buildWikiTree / trailFor / ` +
        'opToType / parseTs / rootForPath / renderWikiMarkdown 全部走 util,不许在 .vue 里重写一份',
    ).toBe(true)
  })
})
