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
    expect(glueIds[0].attributes('style')).toContain('--g: var(--ly-vec)')
    expect(glueIds[1].attributes('style')).toContain('--g: var(--ly-wiki)')
    expect(glueIds[2].attributes('style')).toContain('--g: var(--ly-note)')
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
    expect(nums[0]).toContain('1') // enabledRoots.length
    expect(nums[1]).toContain('1,234')
    expect(nums[2]).toContain('5')
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
    // tsconfig.json 的 `types` 只声明了 `vite/client`/`vitest/globals`,没有
    // `@types/node`,故不能直接引用全局 `process` 的类型 —— 这里只声明用到的
    // 两个方法,经 `globalThis` 窄化访问,不新增 `@types/node` 依赖也不用 `any`。
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
    proc.off('unhandledRejection', swallowExpectedRejection)
  })

  // 【补强 6 续,Promise.all 语义钉子】若把 `Promise.all` 误改成
  // `Promise.allSettled`,`.finally` 的调用点/时机不变(allSettled 从不
  // reject,同样会在全部 settle 后触发 finally),这两种写法在「ready 何时
  // 置真」这件事上不可区分 —— 真正能区分的是:`Promise.all` 一旦有 promise
  // reject,`.then` 链会被跳过(这里用的是 `.finally`,两种写法确实都会执行
  // finally)。因此对本组件外部可观察行为而言,`allSettled` 与
  // `all().finally` 在「三个 loader 都调用一次 + ready 最终为真」这两件事上
  // 完全等价,无法从组件外部区分——这正是为什么 N3 的钉子不能只测「reject
  // 后 ready 仍为真」(那条对两种写法都成立),必须换个角度:测「未 await
  // 三个 promise 全部 settle 之前,ready 仍是 false」(排队顺序:overview
  // resolve 但 roots/notesSummary 还没 resolve 时,骨架仍应在)。
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
