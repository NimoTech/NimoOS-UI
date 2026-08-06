// SP8-P5a Task 12 —— DashboardView 测试。
// Step 2 骨架逐字取自任务 brief（`.superpowers/sdd/p5a-task-12-brief.md` 第
// 20-205 行），本文件在其后补了治理文件 §9「测试质量」要求的高危点判别力
// 断言（每处注释标「补强」），逐条对应任务里点名的 8 条高危点：
//   1) isEmpty 的 `&&` —— brief 只给了纯空/纯满两侧，补一条「wikiRoots 空但
//      indexed_files>0」的混合侧，专门钉住 `&&` 误改成 `||` 的回归。
//   2) [data-on] 渲染值必须是字符串 "true"/"false"（不是布尔）。
//   3) [data-layer] 三色（wiki/vec/note）各自出现，onboarding 侧同理。
//   4) progressPercent/fmtEta 的接线：用会让「参数顺序颠倒」产生不同结果的
//      具体数值钉住实参顺序。
//   5) N2 三个字段缺失时渲染 0/空串（钉子，防「顺手优化成隐藏」）。
//   6) N3 Promise.all+finally 语义（brief 已给,原样保留)。
//   7) inline --g 三处。
//   8) 零硬编码文案 —— 用 grep 在报告里核实，不放在本文件（vitest 断言只能
//      查渲染结果，查不了源码字面量）。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import DashboardView from './DashboardView.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'

const STATS_FULL = {
  queue_depth: { pending: 2, running: 1, failed: 1, done: 5 },
  indexed_files: 57,
  total_vectors_text: 578,
  total_vectors_visual: 3,
  last_cursor_ms: 1,
}
const ROOTS = [
  { id: 'r1', path: '/DATA', level: 'space', watchMode: 'auto', enabled: true, lastScanAt: 1, needsReconcile: false },
  {
    id: 'r2',
    path: '/Backup',
    level: 'space',
    watchMode: 'scan_only',
    enabled: false,
    lastScanAt: 0,
    needsReconcile: true,
  },
] as never
// 【I-3 补强用】两个都启用的根:r3 是 auto(→ .k2-chip data-tone="live"),
// r4 是 scan_only + needsReconcile(→ .k2-chip 无 data-tone 的普通条 + 另一个
// .k2-chip data-tone="warn" 的同步中提示),覆盖 .k2-chip 的三种渲染态。
const ROOTS_MIXED = [
  { id: 'r3', path: '/DATA', level: 'space', watchMode: 'auto', enabled: true, lastScanAt: 1, needsReconcile: false },
  {
    id: 'r4',
    path: '/Proj',
    level: 'project',
    watchMode: 'scan_only',
    enabled: true,
    lastScanAt: 1,
    needsReconcile: true,
  },
] as never

function mountDash() {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/ai/knowledge', component: DashboardView },
      { path: '/ai/knowledge/:tab', component: { template: '<div/>' } },
    ],
  })
  router.push('/ai/knowledge')
  return router.isReady().then(() => mount(DashboardView, { global: { plugins: [router, i18n] } } as never))
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

function stubLoads() {
  const s = useKnowledgeStore()
  vi.spyOn(s, 'loadOverview').mockResolvedValue()
  vi.spyOn(s, 'loadRoots').mockResolvedValue()
  vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
  return s
}

describe('DashboardView — 三态', () => {
  it('骨架态:搜索框在,三层卡不在', async () => {
    stubLoads()
    const w = await mountDash()
    expect(w.find('.k2-search').exists()).toBe(true)
    expect(w.find('.k2-skel-card').exists()).toBe(true)
    expect(w.find('.k2-layer').exists()).toBe(false)
  })

  it('有数据:四个 surface 全在(3 层卡 / glue / 根卡 / 停用条 / live / 7 个入口)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    expect(w.findAll('.k2-layer')).toHaveLength(3)
    expect(w.find('.k2-glue').exists()).toBe(true)
    expect(w.findAll('.k2-root')).toHaveLength(1) // 只渲染启用的根
    expect(w.find('.k2-roots-off').exists()).toBe(true) // 停用条
    expect(w.find('.k2-live').exists()).toBe(true)
    expect(w.find('.k2-prog').exists()).toBe(true) // backlog = 3 → 忙
    expect(w.findAll('.k2-entry')).toHaveLength(7)
  })

  it('空库:出 onboarding,不出零值卡', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    expect(w.find('.k2-onboard').exists()).toBe(true)
    expect(w.find('.k2-layer').exists()).toBe(false)
    expect(w.findAll('.k2-entry')).toHaveLength(4) // emptyEntries
    expect(w.findAll('.k2-entry')[0].attributes('data-disabled')).toBe('true') // Search 禁用
  })

  // 【补强 1】isEmpty 判据是 `wikiRoots.length === 0 && indexed_files === 0`
  // 的 `&&`——上面两条只测了「两侧都空」与「两侧都满」，抓不到 `&&` 被误改
  // 成 `||` 的回归（那样只要有一侧为空就会误判 isEmpty）。这里用「wikiRoots
  // 空但 indexed_files=57(非零)」的混合态，正确行为应仍是非空库、渲染正常
  // 仪表盘（Wiki 后端 404/超时是设备常见现状——见附录 C 第 3 条「Wiki 导航卡
  // 显示 0 个知识根」，不能因为 Wiki 侧空就整页误判成新装 onboarding）。
  // RED 探针见文件末尾说明。
  it('补强:wikiRoots 空但 indexed_files>0(Wiki 侧无数据,Parser 侧有数据)—— 不是 onboarding', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 57 }
    await flushPromises()
    expect(w.find('.k2-onboard').exists()).toBe(false)
    expect(w.findAll('.k2-layer')).toHaveLength(3)
  })

  // 【补强 1 续】反过来:wikiRoots 非空但 indexed_files=0,同样不该是 onboarding。
  it('补强:wikiRoots 非空但 indexed_files=0 —— 同样不是 onboarding', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = ROOTS
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    expect(w.find('.k2-onboard').exists()).toBe(false)
    expect(w.findAll('.k2-layer')).toHaveLength(3)
  })
})

describe('DashboardView — 属性态(交接项 1/2/3)', () => {
  it('[data-on] 渲染值是字符串 "true"/"false"(交接项 1,选择器比的是字符串)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.controlState = { ...s.controlState, concurrency: 2, paused: false }
    await flushPromises()
    const ccButtons = w.findAll('.k2-cc button')
    expect(ccButtons).toHaveLength(3)
    // CC_LEVELS = [1, 2, 4] — concurrency=2 命中第二档
    expect(ccButtons[0].attributes('data-on')).toBe('false')
    expect(ccButtons[1].attributes('data-on')).toBe('true')
    expect(ccButtons[2].attributes('data-on')).toBe('false')
    // 【RED 探针记录,报告里详述】去掉模板里的 `String(...)` 重跑本用例 ——
    // 结果仍然全绿:Vue 3 的 `patchAttr` 对不在 `isSpecialBooleanAttr` 名单里
    // 的自定义 `data-*` 属性,`el.setAttribute(key, value)` 会把布尔值隐式转
    // 成字符串 "true"/"false"(与 Vue2「布尔值会整卸载属性」的行为不同,那条
    // 规则只对 Vue 内置的真布尔属性名单生效,`data-on` 不在名单里)。也就是说
    // 本仓这个 Vue3 版本下 `String()` 对 `data-on` 的渲染结果是幂等的 ——
    // 但依然跟随 T10/`k-rail-item[data-active]` 与治理文件交接项 1 的既定写
    // 法保留 `String()`(防将来 Vue 版本升级或换成真布尔属性名单成员时的行为
    // 漂移,属于防御性一致性而非本用例可钉住的差异)。
  })

  it('[data-layer] 三色各自出现在对应的层卡上(补强:三个值都要对照,不能只测一个)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    const layers = w.findAll('.k2-layer')
    expect(layers.map((l) => l.attributes('data-layer'))).toEqual(['wiki', 'vec', 'note'])
  })

  it('onboarding 侧 [data-layer] 三色同样各自出现(k2-ob-layer)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    const obLayers = w.findAll('.k2-ob-layer')
    expect(obLayers.map((l) => l.attributes('data-layer'))).toEqual(['wiki', 'vec', 'note'])
  })

  it('交接项 3:k2-layer-num 的 second/suffix、k2-live-ico 的 spin、k2-drafts 是子元素 class', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 1, done: 5 } }
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    // vec 层(第二张)带 .second 子元素
    const vecLayer = w.findAll('.k2-layer')[1]
    expect(vecLayer.find('.k2-layer-num .second').exists()).toBe(true)
    expect(vecLayer.find('.k2-layer-num .suffix').exists()).toBe(true)
    // notes 层(第三张)draft>0 出 .k2-drafts
    const noteLayer = w.findAll('.k2-layer')[2]
    expect(noteLayer.find('.k2-drafts').exists()).toBe(true)
    // backlog>0 → spinner 帶 .spin
    expect(w.find('.k2-live-ico .spin').exists()).toBe(true)
  })

  // 【评审 Critical/Important 修复:开放发现 2,I-3】以下补齐此前零覆盖的
  // [data-ok] 与三个 [data-tone] 宿主(.k2-chip / .k2-entry-ico /
  // .k2-entry-badge,此前只测过 .k2-qchip 一个宿主)。评审探针实测:删掉
  // `data-ok="true"`、把某个 tone 取值改错,原有用例集**全绿**——这正是
  // C-1(onboarding 第 2 磁贴掉了 `tone: 'wiki'`)能溜进来的原因。

  it('[data-ok] 仅在 all-synced 分支静态渲染 "true",忙碌分支完全没有该属性', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    // 忙碌:backlog=3>0
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 1, done: 5 } }
    await flushPromises()
    expect(w.find('.k2-live-ico').attributes('data-ok')).toBeUndefined()

    // all-synced:backlog=0
    s.stats = { ...STATS_FULL, queue_depth: { pending: 0, running: 0, failed: 0, done: 5 } }
    await flushPromises()
    expect(w.find('.k2-live-ico').attributes('data-ok')).toBe('true')
  })

  it('[data-tone] on .k2-chip:auto→"live"、scan_only 且无 reconcile→无该属性、needsReconcile→另一个 chip 是 "warn"', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS_MIXED
    await flushPromises()
    const roots = w.findAll('.k2-root')
    expect(roots).toHaveLength(2)
    // r3(auto,不 reconcile):只有一个 chip,data-tone="live"
    const r3Chips = roots[0].findAll('.k2-chip')
    expect(r3Chips).toHaveLength(1)
    expect(r3Chips[0].attributes('data-tone')).toBe('live')
    // r4(scan_only,needsReconcile):两个 chip —— 第一个(定期扫描)没有
    // data-tone 属性,第二个(同步中)data-tone="warn"
    const r4Chips = roots[1].findAll('.k2-chip')
    expect(r4Chips).toHaveLength(2)
    expect(r4Chips[0].attributes('data-tone')).toBeUndefined()
    expect(r4Chips[1].attributes('data-tone')).toBe('warn')
  })

  it('[data-tone] on .k2-entry-ico:非空库 7 个入口逐一核对(含 C-1 的 wiki 修复点)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    const icoTones = w.findAll('.k2-entries .k2-entry-ico').map((el) => el.attributes('data-tone'))
    // 顺序即 entries() 数组顺序:search/wiki/indexed-files/notes/roots/queue/settings
    expect(icoTones).toEqual(['accent', 'wiki', 'vec', 'note', 'wiki', undefined, undefined])
  })

  it('[data-tone] on .k2-entry-ico:空库 onboarding 4 个入口(C-1 钉子 —— roots 磁贴必须是 "wiki",不是灰色兜底)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    const icoTones = w.findAll('.k2-entries .k2-entry-ico').map((el) => el.attributes('data-tone'))
    // 顺序即 emptyEntries() 数组顺序:search/roots/allowlist/settings
    // 【C-1 修复钉子】icoTones[1] 必须是 'wiki'——蓝本 :342 `tone: 'wiki'`
    // 曾在移植时手滑漏掉,导致这个磁贴的图标命中 knowledge.scss:759 的灰色
    // 兜底而不是 :761 的琥珀色(肉眼可见的配色回归)。
    expect(icoTones).toEqual(['accent', 'wiki', undefined, undefined])
  })

  it('[data-tone] on .k2-entry-badge:notes 徽标是 "note",queue 徽标没有 data-tone(默认红底)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    // failed>0 且 draft>0,让两个徽标都渲染出来
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 1, done: 5 } }
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    const entries = w.findAll('.k2-entries .k2-entry')
    const notesEntry = entries[3] // entries() 数组第 4 项 = notes
    const queueEntry = entries[5] // 第 6 项 = queue
    expect(notesEntry.find('.k2-entry-badge').attributes('data-tone')).toBe('note')
    expect(notesEntry.find('.k2-entry-badge').text()).toBe('2')
    expect(queueEntry.find('.k2-entry-badge').attributes('data-tone')).toBeUndefined()
    expect(queueEntry.find('.k2-entry-badge').text()).toBe('1')
  })

  it('[data-disabled] 补 false 侧(M-2):emptyEntries 里没有 disabled 字段的项渲染 "false",不是只测过 true 那一侧', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    const entries = w.findAll('.k2-entries .k2-entry')
    expect(entries).toHaveLength(4)
    expect(entries[0].attributes('data-disabled')).toBe('true') // search:disabled:true
    expect(entries[1].attributes('data-disabled')).toBe('false') // roots:无 disabled 字段
    expect(entries[2].attributes('data-disabled')).toBe('false') // allowlist
    expect(entries[3].attributes('data-disabled')).toBe('false') // settings
  })
})

describe('DashboardView — 图标名守卫(评审 Important I-2)', () => {
  // 评审探针 B 实测:把 `sparkle` 改成 `sparkleXX`、把 entries 里的
  // `file`→`fileXX` 后,原有用例集全绿——KIcon.vue:79 对未命中的 name 静默
  // 返回空 svg(可见的空白图标),但没有任何断言查过 svg 内容。这里照 T10
  // (KnowledgeLayout.test.ts)已确立的做法补上:遍历渲染出的所有 svg,
  // 断言 innerHTML 非空。覆盖静态 11 个 + 动态 8 个(entries/emptyEntries 的
  // icon 字段 + root 的 drive/folder 二选一)共 19 个 glyph 名。
  it('遍历骨架态之外各状态渲染出的所有 svg 图标,innerHTML 均非空', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()

    function assertAllSvgsNonEmpty(label: string): void {
      const svgs = w.findAll('svg')
      expect(svgs.length, `${label}: 应至少渲染一个 svg`).toBeGreaterThan(0)
      svgs.forEach((svg, idx) => {
        expect(
          svg.element.innerHTML,
          `${label}: 第 ${idx} 个 svg 图标渲染为空(icon 名可能手滑成 KIcon.PATHS 里不存在的 glyph)`,
        ).not.toBe('')
      })
    }

    // 空库 onboarding:orb(layers)、CTA(plus)、emptyEntries 4 个(search/drive/folder/settings)
    s.overviewLoaded = true
    s.wikiRoots = []
    s.stats = { ...STATS_FULL, indexed_files: 0 }
    await flushPromises()
    assertAllSvgsNonEmpty('onboarding')

    // 非空库、忙碌(backlog>0)、有停用根、草稿>0、未暂停:
    // search/arrowRight/chev(×3)/clock/eye/plus(root-add)/spinner/sparkle +
    // entries 7 个(search/layers/file/edit/drive/history/settings)+ root 图标(drive/folder)
    s.wikiRoots = ROOTS
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 1, done: 5 } }
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    s.controlState = { ...s.controlState, paused: false }
    await flushPromises()
    assertAllSvgsNonEmpty('非空库-忙碌-未暂停')

    // 已全部同步(backlog=0):check
    s.stats = { ...STATS_FULL, queue_depth: { pending: 0, running: 0, failed: 0, done: 5 } }
    await flushPromises()
    assertAllSvgsNonEmpty('已全部同步')

    // 暂停:pause
    s.controlState = { ...s.controlState, paused: true }
    await flushPromises()
    assertAllSvgsNonEmpty('已暂停')
  })
})

describe('DashboardView — inline --g(交接项 2)', () => {
  it('三个 id 说明条各自的 style 里带对应的 --g 值', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    const glueIds = w.findAll('.k2-glue-id')
    expect(glueIds).toHaveLength(3)
    // 【M-3 一并扫描时顺手强化】style 是静态单属性字符串,`.toContain` 在这里
    // 恰好等价于精确匹配,但为了和其余数字/文案断言的严格度保持一致,统一
    // 换成 `.toBe(...)` 精确匹配。
    expect(glueIds[0].attributes('style')).toBe('--g: var(--ly-vec);')
    expect(glueIds[1].attributes('style')).toBe('--g: var(--ly-wiki);')
    expect(glueIds[2].attributes('style')).toBe('--g: var(--ly-note);')
  })
})

describe('DashboardView — 数值与文案', () => {
  it('三层卡分别显示根数 / 文档数 / 笔记数,数字带千分位', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, indexed_files: 1234 }
    s.wikiRoots = ROOTS
    s.notesSummary = { total: 5, draft: 2, curated: 2, archived: 1 }
    await flushPromises()
    const nums = w.findAll('.k2-layer-num').map((n) => n.text())
    // 【评审 Minor M-3,已修正】原来这里是 `.toContain('1')`/`.toContain('5')`
    // 这类子串弱断言——数字随便变成别的含"1"/"5"的值(比如 21、15)依然会
    // 通过。改成对整块文本做精确 `.toBe(...)` 全文匹配(先用临时探针跑出真实
    // 渲染文本,再钉成断言,而不是凭感觉猜)。
    expect(nums[0]).toBe('1个知识根') // enabledRoots.length + suffix
    expect(nums[1]).toBe('1,234文档578 向量块') // indexed_files + suffix + second(vector chunks)
    expect(nums[2]).toBe('5条笔记2 待确认') // notesSummary.total + suffix + k2-drafts(draft>0)
  })

  it('N2:后端不下发 rate/eta/done10m 时,速率行落到「等待解析器…」而不是 NaN', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL // ← 实测形状:无 rate_per_min / eta_s / done_last_10m
    s.controlState = { ...s.controlState, paused: false }
    await flushPromises()
    const sub = w.find('.k2-live-sub').text()
    expect(sub).toBe('等待解析器…')
    expect(sub).not.toContain('NaN')
  })

  // 【补强 5,N2 钉子】显式断言「done_last_10m 缺失时渲染 0、eta 缺失时渲染
  // 空串」——这是钉住「照抄不改」的那根钉子:防后续有人把 `|| 0` 兜底顺手
  // 优化成「没有数据就隐藏这一块」。backlog=0 走 all-synced 分支才会渲染
  // done10m 这个数字。
  it('N2 钉子:done_last_10m 缺失时 all-synced 行渲染数字 0(不是隐藏这一块)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, queue_depth: { pending: 0, running: 0, failed: 0, done: 5 } }
    await flushPromises()
    expect(w.find('.k2-live').exists()).toBe(true)
    // 【弱断言教训】早期版本这里写的是 `.toContain('0')`——看似钉住了
    // done10m 渲染 0,实际是假钉子:字面文案「近 10 分钟完成」本身就含一个
    // "0"(来自「10」),就算 done10m 是 `undefined`(interpolation 空串,
    // 双空格)这条 `.toContain('0')` 依然会通过。改成对整行做精确全文匹配,
    // "完成 0 个"(单个空格)与 "完成  个"(空串占位、双空格)才是真正可
    // 分辨的两种渲染结果。RED 探针见报告:把 `done10m` 的 `|| 0` 换成
    // `as number` 直通(不兜底),本用例改用精确匹配后会报红。
    expect(w.find('.k2-live-sub').text()).toBe('上次同步 — · 近 10 分钟完成 0 个')
  })

  it('paused 时速率行显示「已暂停」', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.controlState = { ...s.controlState, paused: true }
    await flushPromises()
    expect(w.find('.k2-live-sub').text()).toBe('已暂停')
  })

  it('backlog 为 0 时换成「已全部同步」分支', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, queue_depth: { pending: 0, running: 0, failed: 0, done: 5 } }
    await flushPromises()
    expect(w.find('.k2-live-title').text()).toBe('已全部同步')
    expect(w.find('.k2-prog').exists()).toBe(false)
  })

  it('failed > 0 时队列健康里那个 chip 可点并跳带 filter 的队列页', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    await flushPromises()
    const chip = w.findAll('.k2-qchip').find((c) => c.element.tagName === 'BUTTON')!
    expect(chip.attributes('data-tone')).toBe('danger')
  })

  // 【补强 4】progressPercent 的接线:用一组「参数顺序颠倒会得到不同结果」的
  // 具体数值钉住实参顺序 —— backlogPeak=10、backlog=3(pending2+running1)。
  // 正序 progressPercent(3,10) = round((1-3/10)*100) = 70。
  // 若被颠倒成 progressPercent(10,3),结果会被 Math.max(0,...) 夹到 0,与
  // 70 判然不同,足以抓到调换。
  it('补强:progressPercent 接线 —— backlogPeak 与 backlog 传参顺序不能颠倒', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, queue_depth: { pending: 2, running: 1, failed: 0, done: 5 } } // backlog=3
    s.backlogPeak = 10
    await flushPromises()
    expect(w.find('.k2-prog-pct').text()).toBe('70%')
  })

  // 【补强 4 续】fmtEta/rate 的接线:后端假设性地下发了 rate_per_min/eta_s
  // (真机不会,见 N2,但组件必须在字段存在时正确渲染,否则就是死代码)——
  // eta_s=90 → fmtEta 应输出 "1m"(90s = 1 分钟出头,floor 到 1m),
  // rate_per_min=2.5 → toFixed(1) 应输出 "2.5"。两个数字都要出现在同一行,
  // 且顺序不能错位(rate 在前、eta 在后)。
  it('补强:rate_per_min/eta_s 字段存在时正确渲染(fmtEta 接线,假设性覆盖,非真机现状)', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = { ...STATS_FULL, rate_per_min: 2.5, eta_s: 90 } as never
    await flushPromises()
    const sub = w.find('.k2-live-sub').text()
    expect(sub).toBe('2.5 个/分钟 · 预计 1m')
  })
})

describe('DashboardView — 跳转', () => {
  it('搜索提交带 q 参数跳搜索页;空查询不跳', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    const push = vi.spyOn(w.vm.$router, 'push')
    await w.find('.k2-search input').setValue('  ')
    await w.find('.k2-search input').trigger('keydown.enter')
    expect(push).not.toHaveBeenCalled()
    await w.find('.k2-search input').setValue(' 甲状腺 ')
    await w.find('.k2-search input').trigger('keydown.enter')
    expect(push).toHaveBeenCalledWith({ path: '/ai/knowledge/search', query: { q: '甲状腺' } })
  })

  it('三层卡各自跳 wiki / indexed-files / notes', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    const push = vi.spyOn(w.vm.$router, 'push')
    const layers = w.findAll('.k2-layer')
    await layers[0].trigger('click')
    expect(push).toHaveBeenLastCalledWith('/ai/knowledge/wiki')
    await layers[1].trigger('click')
    expect(push).toHaveBeenLastCalledWith('/ai/knowledge/indexed-files')
    await layers[2].trigger('click')
    expect(push).toHaveBeenLastCalledWith('/ai/knowledge/notes')
  })
})

describe('DashboardView — 生命周期(N3)', () => {
  it('挂载时三个来源并发拉取;任一失败也把 ready 置起(Promise.all + finally,照抄)', async () => {
    // 【测试脚手架说明,非production行为改动】生产里 loadRoots/loadOverview/
    // loadNotesSummary 各自内部 try/catch,真实场景里这三个 promise 永不
    // reject(N3 描述的「Wiki 挂死」是「很慢才 resolve」,不是 reject)——这里
    // 用 mockRejectedValue 强行模拟一次 reject,只是为了不用真等 60s 就能
    // 断言 `Promise.all(...).finally(...)` 的「任一 settle 异常也放行」语义。
    // 副作用:`onMounted` 里那条 `.finally()` 链没有 `.catch`(照抄蓝本,
    // 不许加),派生出的最终 promise 无人消费,会被 Node 判定成 unhandled
    // rejection——这条兜底监听器只是把这一次已知、预期内的 harness 噪声吞掉,
    // 不影响本用例任何断言的判定结果。
    const swallowExpectedRejection = (reason: unknown): void => {
      if (reason instanceof Error && reason.message === 'wiki timeout') return
      throw reason
    }
    // 【SP8-P6 T10 订正 —— 原注释「本仓没有 `@types/node`,故不能直接引用全局 `process`
    // 的类型」已不成立】合流后 `@types/node` 已装,且全仓有 7 个文件写了
    // `/// <reference types="node" />`(`color-guard.test.ts` 等),该指令是**程序级**的:
    // 它把 `@types/node/globals.d.ts` 拉进整个编译程序,其中 `declare var process: NodeJS.Process`
    // 于是对**所有**源文件可见。`tsconfig` 的 `types` 数组只挡「自动包含」,挡不住显式 reference。
    // 实证(T10 双向探针):新建一个既不 import `node:` 也无 reference 的文件,只写
    // `export const b = process.platform` → `vue-tsc --noEmit` **exit 0**;同一文件加一行
    // `const wrong: number = 'string'` → **TS2322 exit 2** ⇒ 前一次的 exit 0 不是空过。
    // ⇒ 下面这段 `globalThis` 窄化在类型上**已经不是必需的**,直接写 `process.on(...)` 也能编译。
    // 本刀只订正注释、不改实现(T10 纪律:只动注释)。它仍有一点独立价值:显式列出用到的两个
    // 方法,不依赖「某个别的文件恰好写了 reference 指令」这条隐式链路 —— 那 7 个 reference
    // 一旦被删光,裸 `process` 会立刻编译不过,而这段窄化不会。
    const proc = (globalThis as unknown as {
      process: {
        on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
        off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
      }
    }).process
    proc.on('unhandledRejection', swallowExpectedRejection)
    const s = useKnowledgeStore()
    const loadOverview = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    const loadRoots = vi.spyOn(s, 'loadRoots').mockRejectedValue(new Error('wiki timeout'))
    const loadNotesSummary = vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL
    s.wikiRoots = ROOTS
    await flushPromises()
    expect(w.find('.k2-skel-card').exists()).toBe(false) // ready 已置起
    // 【补强 6】三个 loader 都确实被调用过一次(不是只调了其中一部分就侥幸通过)。
    expect(loadOverview).toHaveBeenCalledTimes(1)
    expect(loadRoots).toHaveBeenCalledTimes(1)
    expect(loadNotesSummary).toHaveBeenCalledTimes(1)
    // 验收反馈修正(2026-08-01):概览页的 loadRoots 是**后台**加载,必须静默失败,
    // 否则 Wiki 挂死时会在 60 s 后于任意页面弹出「操作失败」。
    expect(loadRoots).toHaveBeenCalledWith({ silent: true })
    proc.off('unhandledRejection', swallowExpectedRejection)
  })

  // 【评审 Important I-1,已修正】上一版这里写的注释断言「`Promise.all` 与
  // `Promise.allSettled` 在『三个 loader 都调用一次 + ready 最终为真』这两件
  // 事上完全等价,无法从组件外部区分」——**这个判断是错的**。`Promise.all`
  // 是 **fail-fast**:任意一个输入 reject,`Promise.all(...)` 返回的组合
  // promise立刻 reject(不等其余输入 settle),`.finally` 因此立刻触发,
  // `ready` 立刻置真——哪怕还有输入(比如 `loadOverview`)永远不会 resolve。
  // `Promise.allSettled` 则相反:它永不 reject,必须等**全部**输入 settle
  // (无论 fulfilled 还是 rejected)才会 resolve,`.finally` 因此要等到那一刻
  // 才触发——如果其中一个输入永远悬着,`allSettled` 版本的 `ready` 也永远
  // 不会置真,骨架永远卡住。这正是 N3 那 60 秒骨架现象的部分成因:即使
  // Wiki 挂死导致 `loadRoots` 很慢,只要它最终 settle(无论成功失败),
  // `Promise.all` 就会跟着 settle——但如果没有这层 fail-fast 特性(比如误改成
  // allSettled),某个 loader 一旦真的永久悬挂,骨架会比现在更糟、永远出不来。
  // 下面这条钉子直接利用 fail-fast 这个可观察差异:`loadRoots` 立即 reject、
  // `loadOverview` 永久悬挂(mock 一个永不 settle 的 promise)——
  //   `Promise.all(...).finally(...)`(现状,照抄蓝本)→ 立刻因 reject 触发
  //     `.finally`,`ready` 立刻置真,骨架立刻消失。
  //   `Promise.allSettled(...).finally(...)`(误改版)→ 永远等不到
  //     `loadOverview` settle,`ready` 永远不会置真,骨架永远卡住。
  // 两者在这个场景下的外部可观察结果判然不同,可分辨。
  it('N3 钉子:Promise.all 是 fail-fast —— loadRoots 立即 reject 时,即使 loadOverview 永久悬挂,骨架也会消失', async () => {
    const swallowExpectedRejection = (reason: unknown): void => {
      if (reason instanceof Error && reason.message === 'wiki timeout') return
      throw reason
    }
    const proc = (globalThis as unknown as {
      process: {
        on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
        off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
      }
    }).process
    proc.on('unhandledRejection', swallowExpectedRejection)

    const s = useKnowledgeStore()
    // loadOverview 永久悬挂:故意返回一个永不 settle 的 promise。
    vi.spyOn(s, 'loadOverview').mockReturnValue(new Promise<void>(() => {}))
    vi.spyOn(s, 'loadRoots').mockRejectedValue(new Error('wiki timeout'))
    vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
    const w = await mountDash()
    await flushPromises()
    // fail-fast:哪怕 loadOverview 从未 resolve,骨架也已经消失。
    // 若被误改成 Promise.allSettled,这条断言会报红(骨架永远卡在 true)。
    expect(w.find('.k2-skel-card').exists()).toBe(false)

    proc.off('unhandledRejection', swallowExpectedRejection)
  })

  it('补强:三个来源里只要有一个还没 settle,骨架仍在(不是任一个 resolve 就提前放行)', async () => {
    const s = useKnowledgeStore()
    vi.spyOn(s, 'loadOverview').mockResolvedValue()
    let resolveRoots!: () => void
    vi.spyOn(s, 'loadRoots').mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRoots = resolve
      }),
    )
    vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
    const w = await mountDash()
    await flushPromises()
    // loadOverview/loadNotesSummary 已 resolve,但 loadRoots 还悬着 → 骨架仍在
    expect(w.find('.k2-skel-card').exists()).toBe(true)
    resolveRoots()
    await flushPromises()
    expect(w.find('.k2-skel-card').exists()).toBe(false)
  })
})
