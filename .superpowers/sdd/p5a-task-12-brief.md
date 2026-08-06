## Task 12: `DashboardView.vue` + 路由接线

**Files:**
- Create: `src/ai/knowledge/views/DashboardView.vue`
- Create: `src/ai/knowledge/views/DashboardView.test.ts`
- Modify: `src/ai/knowledge/knowledgeRoutes.ts`(`''` 子路由从 `KnowledgeDeferred` 改成 `DashboardView`)
- Modify: `src/ai/knowledge/deferred.ts`(确认 `DEFERRED_TABS` 不含 `dashboard`;T5 已如此,本步只核对)

**Interfaces:**
- Consumes: T3 `KIcon` · T6/T7 store · T9 `progressPercent`/`fmtEta` · T8 i18n · T11 样式

- [ ] **Step 1: 读蓝本**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/DashboardView.vue
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/__tests__/dashboardWikiViews.spec.js
```
四个 surface + onboarding 空态 + 骨架态,逐行对标。`SAMPLE_QUERIES` / `LAYER_INTROS` / `CC_LEVELS` 三个常量逐字照抄。

- [ ] **Step 2: 写失败测试**(移植 Vue2 那条 smoke 的 Dashboard 半 + 拆成可判别的多条)

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import DashboardView from './DashboardView.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'

const STATS_FULL = {
  queue_depth: { pending: 2, running: 1, failed: 1, done: 5 },
  indexed_files: 57, total_vectors_text: 578, total_vectors_visual: 3, last_cursor_ms: 1,
}
const ROOTS = [
  { id: 'r1', path: '/DATA', level: 'space', watchMode: 'auto', enabled: true, lastScanAt: 1, needsReconcile: false },
  { id: 'r2', path: '/Backup', level: 'space', watchMode: 'scan_only', enabled: false, lastScanAt: 0, needsReconcile: true },
]

function mountDash() {
  const router = createRouter({ history: createWebHashHistory('/app/'),
    routes: [{ path: '/ai/knowledge', component: DashboardView },
             { path: '/ai/knowledge/:tab', component: { template: '<div/>' } }] })
  router.push('/ai/knowledge')
  return router.isReady().then(() =>
    mount(DashboardView, { global: { plugins: [router, i18n] } } as never))
}

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

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
    expect(w.findAll('.k2-root')).toHaveLength(1)        // 只渲染启用的根
    expect(w.find('.k2-roots-off').exists()).toBe(true)  // 停用条
    expect(w.find('.k2-live').exists()).toBe(true)
    expect(w.find('.k2-prog').exists()).toBe(true)       // backlog = 3 → 忙
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
    expect(w.findAll('.k2-entry')).toHaveLength(4)       // emptyEntries
    expect(w.findAll('.k2-entry')[0].attributes('data-disabled')).toBe('true')  // Search 禁用
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
    expect(nums[0]).toContain('1')       // enabledRoots.length
    expect(nums[1]).toContain('1,234')
    expect(nums[2]).toContain('5')
  })

  it('N2:后端不下发 rate/eta/done10m 时,速率行落到「等待解析器…」而不是 NaN', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true
    s.stats = STATS_FULL           // ← 实测形状:无 rate_per_min / eta_s / done_last_10m
    s.controlState = { ...s.controlState, paused: false }
    await flushPromises()
    const sub = w.find('.k2-live-sub').text()
    expect(sub).toBe('等待解析器…')
    expect(sub).not.toContain('NaN')
  })

  it('paused 时速率行显示「已暂停」', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true; s.stats = STATS_FULL
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
    s.overviewLoaded = true; s.stats = STATS_FULL
    await flushPromises()
    const chip = w.findAll('.k2-qchip').find((c) => c.element.tagName === 'BUTTON')!
    expect(chip.attributes('data-tone')).toBe('danger')
  })
})

describe('DashboardView — 跳转', () => {
  it('搜索提交带 q 参数跳搜索页;空查询不跳', async () => {
    const s = stubLoads()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true; s.stats = STATS_FULL; s.wikiRoots = ROOTS
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
    s.overviewLoaded = true; s.stats = STATS_FULL; s.wikiRoots = ROOTS
    await flushPromises()
    const push = vi.spyOn(w.vm.$router, 'push')
    const layers = w.findAll('.k2-layer')
    await layers[0].trigger('click'); expect(push).toHaveBeenLastCalledWith('/ai/knowledge/wiki')
    await layers[1].trigger('click'); expect(push).toHaveBeenLastCalledWith('/ai/knowledge/indexed-files')
    await layers[2].trigger('click'); expect(push).toHaveBeenLastCalledWith('/ai/knowledge/notes')
  })
})

describe('DashboardView — 生命周期(N3)', () => {
  it('挂载时三个来源并发拉取;任一失败也把 ready 置起(Promise.all + finally,照抄)', async () => {
    const s = useKnowledgeStore()
    vi.spyOn(s, 'loadOverview').mockResolvedValue()
    vi.spyOn(s, 'loadRoots').mockRejectedValue(new Error('wiki timeout'))
    vi.spyOn(s, 'loadNotesSummary').mockResolvedValue()
    const w = await mountDash()
    await flushPromises()
    s.overviewLoaded = true; s.stats = STATS_FULL; s.wikiRoots = ROOTS
    await flushPromises()
    expect(w.find('.k2-skel-card').exists()).toBe(false)   // ready 已置起
  })
})
```
> 最后那条钉住的正是 N3 的**照抄行为**:`loadRoots` 挂了也要放行,而不是永久骨架。**真机上那 60 秒等待是 axios 超时,单测测不到,验收清单里另有一条。**

- [ ] **Step 3: 跑测试确认失败**
- [ ] **Step 4: 实现**(逐行移植;`Promise.all(...).finally(ready = true)` 照抄,并在该处注释指明 N3 与设计 §6.3)
- [ ] **Step 5: 路由接线**:`knowledgeRoutes.ts` 的 `''` 子路由改指 `DashboardView`;`knowledgeRoutes.test.ts` 加一条断言 `''` 的 component **不是** `KnowledgeDeferred`(反转 T5 的占位断言 —— **反转,不是删除**,报告里贴改前/改后原文)。
- [ ] **Step 6: 跑测试 + 三门**(新增 1 个 `.vue` → **307 文件**)
- [ ] **Step 7: 提交**

```bash
git add src/ai/knowledge/views/DashboardView.vue src/ai/knowledge/views/DashboardView.test.ts \
        src/ai/knowledge/knowledgeRoutes.ts src/ai/knowledge/knowledgeRoutes.test.ts
git commit -m "feat(knowledge): SP8-P5a DashboardView 四 surface + 路由接线"
```

---

## 收尾:整期终审 + 验收

- [ ] **全支线终审(opus)**:`git diff 99ee99a..HEAD`(New-UI)+ `git diff c8f1919..HEAD`(Service),按 `p5a-common-constraints.md` §11 的评审要求逐项核:K1–K8/P1–P4 十二条偏离是否全部落地且三件套齐全、N1–N8 八条是否原样照抄、i18n 两档零重复零单边零死键、`knowledge.scss` 逐行零色字面量(token 声明层外)、每个 CSS 类真实存在、测试无空转。
- [ ] **修复轮**(一次性,单提交)
- [ ] **重起 dev server**(承 P3a「用户验到陈旧代码」教训):
  ```bash
  ss -ltnp | grep 5288          # 预期见到 P4 遗留的 pid 1355965
  kill <pid>
  cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
  nohup pnpm dev --host --port 5288 > .superpowers/sdd/p5a-dev-5288.log 2>&1 &
  sleep 5 && curl -sI http://127.0.0.1:5288/app/ | head -1    # 预期 200
  ```
- [ ] **交给用户人眼验收**,清单见 §附录 C。

---

## 附录 A:i18n 键表(**新增 96 条 `aiKb*` + 复用 1 条既有键**)

**中文值全部取自 Vue2 `git show main:src/assets/lang/zh_CN.json`,逐字符照抄。英文值 = Vue2 原 key。**
**新增 96 条** = 下方主表 94 条(Vue2 派生)+ 末尾新造 2 条(占位页)。
**复用既有键 1 条**:`aiCfgYou`(zh `你` / en `You`)—— rail 页脚用户名的回落文案,见 K8。写之前先 `grep -n "aiCfgYou" src/i18n/*.ts` 复核值仍是这两个。

| 键 | Vue2 原 key(= 英文值) | 中文值 |
|---|---|---|
| `aiKbKnowledgeBase` | `Knowledge Base` | 知识库 |
| `aiKbBrowse` | `Browse` | 浏览 |
| `aiKbStatus` | `Status` | 状态 |
| `aiKbIndexer` | `Indexer` | 索引服务 |
| `aiKbLastSynced` | `Last synced` | 上次同步 |
| `aiKbRefresh` | `Refresh` | 刷新 |
| `aiKbRefreshed` | `Refreshed` | 已刷新 |
| `aiKbOffline` | `Offline` | 离线 |
| `aiKbPaused` | `Paused` | 已暂停 |
| `aiKbRunningIndexed` | `Running · {n} indexed` | 运行中 · {n} 已收录 |
| `aiKbMore` | `More` | 浏览更多 |
| `aiKbServiceOfflineBanner` | `The index service is temporarily offline — some features may be unavailable.` | 索引服务暂时离线，部分功能可能不可用 |
| `aiKbNavDashboard` | `Dashboard` | 概览 |
| `aiKbNavSearch` | `Search` | 搜索 |
| `aiKbNavWiki` | `Wiki` | Wiki 导航 |
| `aiKbNavNotes` | `Notes` | 笔记 |
| `aiKbNavIndexedFiles` | `Indexed Files` | 已收录文件 |
| `aiKbNavQueue` | `Queue` | 任务 |
| `aiKbNavRoots` | `Index Roots` | 索引目录 |
| `aiKbNavAllowlist` | `Allowlist` | 索引范围 |
| `aiKbNavSettings` | `Settings` | 系统设置 |
| `aiKbTitleWikiMap` | `Wiki map` | Wiki 导航 |
| `aiKbTitleJobQueue` | `Job Queue` | 任务队列 |
| `aiKbTitleAdvancedSettings` | `Advanced Settings` | 高级设置 |
| `aiKbJustNow` | `just now` | 刚刚 |
| `aiKbMinAgo` | `{m} min ago` | {m} 分钟前 |
| `aiKbHrAgo` | `{h} hr ago` | {h} 小时前 |
| `aiKbDaysAgo` | `{d} days ago` | {d} 天前 |
| `aiKbOpFailed` | `Operation failed` | 操作失败 |
| `aiKbOnboardTitle` | `Turn your NAS into a second brain` | 把 NAS 变成你的第二大脑 |
| `aiKbOnboardBody` | `Add your first knowledge root — Nimo parses and indexes its documents, builds a browsable wiki, and distills notes as you go.` | 添加第一个知识根,Nimo 会解析、索引其中的文档,生成可浏览的 Wiki,并在使用中自动沉淀笔记。 |
| `aiKbAddRoot` | `Add knowledge root` | 添加知识根 |
| `aiKbCheckScopeFirst` | `Check the index scope first` | 先看看索引范围 |
| `aiKbGoDeeper` | `Go deeper` | 深入 |
| `aiKbSearchPlaceholder` | `Search your knowledge base — documents · wiki · notes…` | 搜索你的知识库 — 文档 · Wiki · 笔记… |
| `aiKbThreeLayersTip` | `Covers all three layers: wiki · vectors · notes` | 同时覆盖三层:Wiki · 向量 · 笔记 |
| `aiKbSearch` | `Search` | 搜索 |
| `aiKbTry` | `Try` | 试试 |
| `aiKbWhatsInside` | `What's inside` | 里面有什么 |
| `aiKbWikiMap` | `Wiki map` | Wiki 导航 |
| `aiKbKnowledgeRootsSuffix` | `knowledge roots` | 个知识根 |
| `aiKbWatchSplit` | `{a} live watch · {b} periodic scan` | {a} 实时监视 · {b} 定期扫描 |
| `aiKbSemanticVectors` | `Semantic vectors` | 语义检索 |
| `aiKbDocumentsSuffix` | `documents` | 文档 |
| `aiKbVectorChunks` | `{n} vector chunks` | {n} 向量块 |
| `aiKbVectorSplit` | `{t} text · {v} visual vectors` | {t} 文本 · {v} 视觉向量 |
| `aiKbDistilledNotes` | `Distilled notes` | 沉淀笔记 |
| `aiKbNotesSuffix` | `notes` | 条笔记 |
| `aiKbToConfirm` | `{n} to confirm` | {n} 待确认 |
| `aiKbNotesSplit` | `{c} curated · {d} draft · {a} archived` | {c} 已确认 · {d} 草稿 · {a} 归档 |
| `aiKbGlueTitle` | `Three layers, joined by three ids` | 三层由三个 id 串联 |
| `aiKbGlueFileId` | `vectors ↔ physical files` | 向量 ↔ 物理文件 |
| `aiKbGlueRootId` | `knowledge attribution` | 知识归属 |
| `aiKbGlueSessionId` | `note provenance` | 笔记溯源 |
| `aiKbLayerWikiDesc` | `One .wiki.md summary per folder — browse like a wiki, your visible long-term memory.` | 每个目录一份 .wiki.md 摘要,像维基一样浏览 — 可见的长期记忆。 |
| `aiKbLayerVecDesc` | `Documents are chunked and embedded — find them in natural language; duplicate copies dedupe by file_id.` | 切块嵌入,自然语言即可命中;同文件多副本按 file_id 自动去重。 |
| `aiKbLayerNoteDesc` | `AI distills insights from your chats — [[backlinked]] and traceable back to the source session.` | AI 从对话自动提炼,[[双链]] 关联,session_id 溯源回原对话。 |
| `aiKbHowOrganized` | `How it's organized` | 怎么组织的 |
| `aiKbManageRoots` | `Manage roots` | 管理知识根 |
| `aiKbLevelSpace` | `Space` | 空间 |
| `aiKbLevelProject` | `Project` | 项目 |
| `aiKbRealtimeWatch` | `Real-time watch` | 实时监视 |
| `aiKbScheduledScanOnly` | `Scheduled scan only` | 仅定时扫描 |
| `aiKbReconciling` | `Reconciling` | 同步中 |
| `aiKbLastScan` | `Last scan:` | 上次扫描: |
| `aiKbNever` | `never` | 从未 |
| `aiKbDisabledRoots` | `Disabled {n} roots:` | 已停用 {n} 个根: |
| `aiKbRestoreInRootMgmt` | `Restore in root management` | 在根管理中恢复 |
| `aiKbWhatsHappening` | `What's happening now` | 现在在发生什么 |
| `aiKbIndexingNFiles` | `Indexing {n} files` | 正在索引 {n} 个文件 |
| `aiKbFilesPerMin` | `files/min` | 个/分钟 |
| `aiKbEta` | `ETA` | 预计 |
| `aiKbWaitingForParser` | `Waiting for parser…` | 等待解析器… |
| `aiKbAllSynced` | `All synced` | 已全部同步 |
| `aiKbDoneLast10m` | `{n} done in last 10 min` | 近 10 分钟完成 {n} 个 |
| `aiKbThrottle` | `Throttle` | 限速档位 |
| `aiKbAutoIndexPaused` | `Auto-indexing paused` | 已暂停自动索引 |
| `aiKbAdjustInAdvanced` | `Adjust in Advanced Settings` | 在高级设置中调整 |
| `aiKbCcPowerSaver` | `Power saver` | 省电 |
| `aiKbCcBalanced` | `Balanced` | 平衡 |
| `aiKbCcFullSpeed` | `Full speed` | 全力 |
| `aiKbQueueHealth` | `Queue health` | 队列健康 |
| `aiKbPending` | `Pending` | 待处理 |
| `aiKbRunning` | `Running` | 运行中 |
| `aiKbFailed` | `Failed` | 已失败 |
| `aiKbAutoDistill` | `Auto-distill` | 自动沉淀 |
| `aiKbDistilledRecently` | `Distilled {n} insights recently` | 近期提炼了 {n} 条洞见 |
| `aiKbDistillFromChats` | `From your chats with Nimo — pending review` | 来自你与 Nimo 的对话,待确认 |
| `aiKbNoNewInsights` | `No new insights recently` | 暂无新的沉淀 |
| `aiKbSampleThyroid` | `thyroid` | 甲状腺 |
| `aiKbSamplePythonAsync` | `Python async` | Python 异步 |
| `aiKbSampleContract` | `contract from last year` | 去年的合同 |
| `aiKbSampleIphone` | `iPhone setup` | iPhone 配置 |
| `aiKbSampleSkating` | `figure skating` | 羽生结弦 |

**Vue2 语言包里没有、本期新造的 2 条**(占位页,设计已授权):

| 键 | 英文值 | 中文值 |
|---|---|---|
| `aiKbDeferredTitle` | `Coming soon` | 即将上线 |
| `aiKbDeferredHint` | `This page is still being migrated to the new UI.` | 这个页面还在迁移到新界面。 |

> **实现者注意**:`aiKbNavWiki` 与 `aiKbTitleWikiMap`/`aiKbWikiMap` 的中文值都是「Wiki 导航」而英文值不同(`Wiki` vs `Wiki map`)—— Vue2 如此,**照抄,不许合并成一个键**。`aiKbNavSearch`/`aiKbSearch` 同理(两处都是「搜索」,但一个是 rail 项、一个是按钮/标题)。

---

## 附录 B:`.knowledge-app` token 映射表(偏离 K2)

**规则**:全局 `theme.css` 有同语义 token 的 → 写 `var(--全局token)`(浅色档才有意义,故只在浅色档这么写);没有同语义的 → 落字面值并在行尾注释出处。暗色档一律落 AI `tokens.scss` 暗色块的字面值(它是本仓已有的暗色调色板)。**结构量(`--r-*`/`--font-*`/`--shadow-*`)两档共享,只写在基础块。**

### 基础块 `.knowledge-app`(= 暗色档,New-UI 默认 `<html>` 无 `data-theme`)

| token | 值 | 出处 |
|---|---|---|
| `--bg-app` / `--bg-canvas` | `#1C1C1E` | AI tokens 暗色 |
| `--bg-elevated` | `#242426` | 同上 |
| `--bg-sunken` | `#161617` | 同上 |
| `--bg-chip` | `#2A2A2C` | 同上 |
| `--glass-strong` / `--glass-medium` / `--glass-weak` | `rgba(28,28,30,0.82)` / `0.6` / `0.45` | 同上 |
| `--text-primary` | `#E9E7E3` | 同上 |
| `--text-secondary` | `#A3A09A` | 同上 |
| `--text-tertiary` | `#6E6C68` | 同上 |
| `--text-quaternary` | `#4D4B48` | 同上 |
| `--text-on-accent` | `#ffffff` | 同上 |
| `--accent` | `#5E97F2` | 同上 |
| `--accent-hover` | `#7AABF5` | 同上 |
| `--accent-soft` | `rgba(94,151,242,0.14)` | 同上 |
| `--accent-softer` | `rgba(94,151,242,0.10)` | 同上 |
| `--success` | `#4FB870` | 同上 |
| `--warning` | `#E0A53B` | 同上 |
| `--danger` | `#F0776B` | 同上 |
| `--purple` | `#AF52DE` | AI tokens(两档同值) |
| `--pink` | `#FF2D55` | 同上 |
| `--teal` | `#30B0C7` | 同上 |
| `--line` | `#2E2E31` | AI tokens 暗色 |
| `--line-strong` | `#3A3A3D` | 同上 |
| `--line-faint` | `#262628` | 同上 |
| `--ly-wiki` / `-soft` / `-line` | `oklch(0.78 0.11 80)` / `oklch(0.78 0.11 80 / 0.15)` / `oklch(0.78 0.11 80 / 0.35)` | **蓝本 `:2445` 暗色值**(三层身份色,与 `.ic-*` 品牌渐变同类,两档各一份) |
| `--ly-vec` / `-soft` / `-line` | `oklch(0.76 0.10 210)` / `… / 0.15` / `… / 0.35` | 蓝本 `:2446` |
| `--ly-note` / `-soft` / `-line` | `oklch(0.76 0.12 300)` / `… / 0.15` / `… / 0.35` | 蓝本 `:2447` |
| `--r-xs…--r-pill` | `6px/10px/14px/18px/24px/32px/999px` | 蓝本原值(与 AI tokens 一致) |
| `--shadow-xs/sm/md/lg` | AI tokens 的四条(`rgba(40,35,25,…)` 暖投影) | AI tokens `:107-110` |
| `--font-sans` / `--font-mono` | 蓝本原值(与 AI tokens 逐字相同) | 蓝本 `:56-57` |
| `--grad-iri` / `--grad-iri-soft` | AI tokens `:119-120` 的两条 | 与 Agent 区同族 |

### 浅色档 `:root[data-theme="light"] .knowledge-app`

| token | 值 | 说明 |
|---|---|---|
| `--bg-app` / `--bg-canvas` | `var(--bg)` | 主页浅色纸底 `#f7f5ef` |
| `--bg-elevated` | `var(--card-bg)` | `#ffffff` |
| `--bg-sunken` | `var(--tool-bg)` | `#f0eee8`,比 canvas 深一档 |
| `--bg-chip` | `var(--tool-bg-hi)` | `#e7e3d9`,再深一档 |
| `--glass-strong` / `--glass-medium` / `--glass-weak` | `rgba(247,245,239,0.82)` / `0.6` / `0.45` | `--bg` 的 RGB 加透明;全局无 glass 语义 |
| `--text-primary` | `var(--fg)` | |
| `--text-secondary` | `var(--fg-muted)` | |
| `--text-tertiary` | `var(--fg-faint)` | |
| `--text-quaternary` | `#BCB8AD` | 全局只有三档文字;取 AI tokens 浅色第四档(同族暖中性) |
| `--text-on-accent` | `var(--on-accent)` | |
| `--accent` | `var(--accent)` | `#3b5bdb` |
| `--accent-hover` | `var(--accent-text)` | `#3550c4`,全局的"更深强调"档 |
| `--accent-soft` | `var(--accent-soft)` | `rgba(59,91,219,0.11)` |
| `--accent-softer` | `rgba(59, 91, 219, 0.06)` | 全局最淡档是 0.11,蓝本要 0.06 |
| `--success` | `var(--success)` | `#15754c` |
| `--warning` | `var(--toast-warn-fg)` | `#92600c`(全局无 `--warning`,这是它的警告前景色) |
| `--danger` | `var(--toast-danger-fg)` | `#c0392b`(同上) |
| `--purple` / `--pink` / `--teal` | `#AF52DE` / `#FF2D55` / `#30B0C7` | 全局无;取 AI tokens 浅色值 |
| `--line` | `var(--card-border)` | `#e7e3d9` |
| `--line-strong` | `#D8D3C7` | 全局无 strong 档;AI tokens 浅色值 |
| `--line-faint` | `#EEEBE3` | 同上 |
| `--ly-wiki` / `-soft` / `-line` | `oklch(0.60 0.12 75)` / `oklch(0.60 0.12 75 / 0.11)` / `oklch(0.60 0.12 75 / 0.32)` | **蓝本 `:2287` 浅色值** |
| `--ly-vec` / `-soft` / `-line` | `oklch(0.56 0.11 210)` / `… / 0.11` / `… / 0.32` | 蓝本 `:2288` |
| `--ly-note` / `-soft` / `-line` | `oklch(0.55 0.13 300)` / `… / 0.11` / `… / 0.32` | 蓝本 `:2289` |

### 规则段落里的裸色 → token 对照(T4/T11 用)

蓝本规则里出现的裸色一律按语义换成上表的 token 的**透明变体 token**,New-UI 已有的直接用:
`rgba(52,199,89,0.1x)` → `var(--success-soft)` · `rgba(52,199,89,0.2x)` → `var(--success-soft-border)` ·
`rgba(255,59,48,0.0x)` → `var(--danger-soft-faint)` · `rgba(255,59,48,0.1x)` → `var(--danger-soft)` ·
`rgba(255,59,48,0.2x~0.3x)` → `var(--danger-soft-border)` · `rgba(255,149,0,0.1x)` → `var(--warning-soft)` ·
`rgba(255,149,0,0.2x~0.3x)` → `var(--warning-soft-border)` · `rgba(175,82,222,0.1x)` → `var(--purple-soft)` ·
`rgba(0,122,255,0.2x)` → ⚠️ **`--accent-soft-2` 只存在于全局 `theme.css`(`:60` 暗色 `rgba(138,180,255,0.24)` / `:275` 浅色 `rgba(59,91,219,0.2)`),AI `tokens.scss` 里没有** —— 而 `.knowledge-app` 的 token 声明层是自成一档的,`var(--accent-soft-2)` 在两档里都能解析到全局值(知识库跟随全局主题,这是本期唯一能直接借全局 token 的好处)。**可以直接用 `var(--accent-soft-2)`,不需要新增 token,也不要退回 `--accent-soft`(透明度差一倍)。** ·
`#1f9c47`/`#5BD876` → `var(--success)` · `#d8362b` → `var(--danger)` · `#9a3fd0` → `var(--purple)` ·
`white`/`#fff`(前景)→ `var(--text-on-accent)` · `rgba(255,255,255,0.1~0.2)`(暗色下的浅底)→ `var(--bg-chip)` ·
`rgba(15,20,30,0.32)`(遮罩)→ `var(--modal-scrim)`。
**表里没有的、或换完视觉明显不对的 → 停下写 `NEEDS_CONTEXT`,不许自己发明新 token。**

---

## 附录 C:用户验收清单(`:5288`,浏览器登录态)

1. 浏览器进 `http://<设备IP>:5288/app/#/ai/knowledge` → 左栏 **9 项**导航、顶栏「概览 / Dashboard · /ai/knowledge」、右下角无 toast 残留
2. **仪表盘先转一段骨架再出数(可能长达 60 秒)** —— 这是**预期行为**,不是卡死:Wiki 后端数据库 38 GB 挂死,`loadRoots` 要等 axios 超时;设计 §6.3 / N3 已登记,用户明示本期不修
3. 出数后:「语义检索」卡显示真实文档数与向量块数(设备当前 8 篇 / 5592 块);「沉淀笔记」卡显示真实笔记数与草稿数;**「Wiki 导航」卡显示 0 个知识根 —— 预期**(Wiki API 不可用)
4. 「现在在发生什么」区:显示正在索引的积压数(设备当前 338 待处理 + 1 运行),**速率与 ETA 空着是后端不下发这三个字段(N2),不是缺陷**;限速档位显示「已暂停」(Parser 是 paused 模式拉起的)
5. 左栏「任务」项的失败徽标:设备当前 failed=0 → **不应出现徽标**
6. 左栏「笔记」项:草稿数 > 0 时出橙色徽标,数字与「沉淀笔记」卡一致
7. 左栏底部「索引服务」块:圆点为**橙色 paused**、文案「已暂停」、下面一行「上次同步 X 分钟前」
8. 顶栏刷新按钮 → 数据刷新 + 右下角出「已刷新」toast(**注意 toast 是 New-UI 全局那个胶囊,不是 Vue2 那个带绿勾的**,偏离 K3)
9. 点搜索框输入任意词回车 → 跳到 `#/ai/knowledge/search`,**出「即将上线」占位页**(P5e 才做真页)
10. 依次点左栏其余 7 项 → 全部出占位页,顶栏标题/副标题跟着变;**点「系统设置」时左栏写「系统设置」而顶栏标题写「高级设置」是 Vue2 原样(N8)**
11. 桌面切**浅色主题**后回到知识库 → 整区变纸感浅色(米白底 + 深色字),`原生下拉/输入框`内部也是浅色;切回暗色 → 整区变暗,**没有白底黑字或黑底黑字的死角**
12. 窄屏(浏览器缩到 ~600px 宽)→ 左栏收起、底部出 5 个 tab(前 4 项 + 浏览更多),点「浏览更多」跳「索引范围」
13. 直接在地址栏敲 `#/ai/knowledge/notes`、`#/ai/parser`、`#/ai/parser/test` → 都能进(占位页),刷新不 404
14. 浏览器控制台:**无红色报错**(尤其无 `Failed to resolve component`、无 `var(--…)` 解析失败导致的透明块)

---

## 附录 D:CSS 类白名单(T4 / T11 的切档判据)

从蓝本 `KnowledgeLayout.vue` 与 `DashboardView.vue` 的 `<template>` 里程序化抽取(`class="…"` 与 `:class` 里的字面量),**共 98 个 `k*` 类 + 6 个修饰类**。这就是 P5a 需要的全部样式,一个不多一个不少。

### D.1 T4 负责(壳 + 通用原语,32 个)
```
knowledge-app
k-rail  k-rail-head  k-rail-title  k-rail-sub  k-rail-section  k-rail-nav
k-rail-item  k-rail-item-label  k-rail-item-cn  k-rail-item-en
k-rail-svc  k-rail-svc-row  k-rail-svc-dot  k-rail-svc-name  k-rail-svc-meta
k-rail-foot
k-main  k-topbar  k-topbar-title  k-topbar-sub  k-topbar-spacer
k-banner  k-banner-icon
k-mobile-tabs  k-mobile-tab
k-badge  k-badge-dot
k-btn
k-scroll  k-scroll-inner
k-skel
```
**不搬**:`k-toast`、`k-toast-ico`(偏离 K3,改走全局 toast)。

### D.2 T11 负责(仪表盘,65 个)
```
k-suggest-chip
k2-search  k2-search-dots  k2-suggest  k2-suggest-label
k2-sec-head  k2-sec-title  k2-sec-en  k2-sec-link
k2-onboard  k2-onboard-orb  k2-onboard-cta  k2-onboard-layers
k2-ob-layer  k2-ob-name  k2-ob-desc  k2-tag
k2-layers  k2-layer  k2-layer-top  k2-layer-name  k2-layer-name-en  k2-layer-chev
k2-layer-num  k2-layer-bar  k2-layer-sub  k2-layer-desc  k2-drafts
k2-glue  k2-glue-id
k2-roots  k2-root  k2-root-top  k2-root-ico  k2-root-path  k2-root-level
k2-root-badges  k2-root-meta  k2-root-add  k2-roots-off  k2-chip
k2-live  k2-live-top  k2-live-ico  k2-live-title  k2-live-sub
k2-live-grid  k2-live-cell  k2-cell-label
k2-prog  k2-prog-pct  k2-paused-note  k2-cc
k2-qrow  k2-qchip
k2-distill  k2-distill-sub
k2-entries  k2-entry  k2-entry-ico  k2-entry-cn  k2-entry-en  k2-entry-badge
k2-skel-card
```
(含 `k2-*` 64 个 + `k-suggest-chip`)

### D.3 修饰类(跟着各自的基类搬)
`k-btn` 的 `ghost` / `outline` / `primary`(T4)· `k2-layer-num` 里的 `second` / `suffix`(T11)· `k2-live-ico` 里的 `spin`(T11)。
另有一批**属性选择器态**,搬基类时必须一并搬:`[data-active]`(rail 项 / 移动端 tab / `k2-cc` 按钮 / `kw-node`)·`[data-tone]`(`k-badge` / `k-badge-dot` / `k-banner` / `k2-chip` / `k2-entry-ico` / `k2-entry-badge` / `k2-qchip`)·`[data-state]`(`k-rail-svc-dot` 的 error/paused/running 三态)·`[data-layer]`(`k2-layer` / `k2-ob-layer` 的 wiki/vec/note 三色)·`[data-disabled]`(`k2-entry`)·`[data-ok]`(`k2-live-ico`)。
**这些态是 1:1 的关键**:`data-state="paused"` 的橙点、`data-tone="warn"` 的橙徽标、`data-layer` 的三层配色,漏一个就是可见回归,而单测只查属性值不查颜色。

### D.4 自检命令(T4 / T11 各自跑一次,结果贴报告)
```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# ① 白名单里的类是否都已落地(应无输出)
for c in <把上面对应小节的类名粘进来>; do
  grep -q "\.$c\b" src/ai/styles/knowledge.scss || echo "MISSING .$c"
done
# ② 是否搬多了(白名单外的 k-/k2- 类)——人工看这份清单,凡不在 D.1/D.2 里的都要删回
grep -oE '\.k2?-[a-z0-9-]+' src/ai/styles/knowledge.scss | sort -u
```

---

## Self-Review

**二轮自审(2026-07-31,回权威源核实后修的 6 处)**:① K8 原写「换 `useUserProfile()`」是错的 —— 那个 store(`src/stores/userProfile.ts`)里只有 `avatarVersion`/`bumpAvatarVersion`,**没有用户名**;真正的先例是 `SettingsRail.vue:75-86` 读 `localStorage.user`,已改写 ② 回落文案**复用既有 `aiCfgYou`**(实测 zh `你` / en `You`),不再新增 `aiKbYou` ③ 附录 A 的条数由「88」纠正为**新增 96 + 复用 1**(主表 94 + 新造 2;原数字是估的,现按表逐行数过)④ `--accent-soft-2` 只在全局 `theme.css` 有、AI `tokens.scss` 没有 —— 但知识库跟随全局主题,可直接 `var()`,已在附录 B 末尾写明,不要退回 `--accent-soft`(透明度差一倍)⑤ `src/router/index.test.ts` 已确认存在,T5 的条件分支删掉 ⑥ **新增附录 D:98 个类的白名单 + 6 个修饰类 + 6 组属性态 + 自检命令** —— T4/T11 原来的切档判据是「拿不准的留给后续批次」,太软,2561 行里靠感觉切必出漏。

**Spec coverage** —— 设计 §4 P5a 那格逐项对账:11 条路由(T5)· `KnowledgeLayout` 五件(T10)· `knowledgeStore` 三来源(T6+T7)· `DashboardView`+`dashboardHelpers`(T12+T9)· `knowledge.scss` token 层+壳段+`k2-*`段+keyframes(T4+T11)· 占位机制(T5,T12 反转)· `KIcon`(T3)· Service 两域(T1+T2)· i18n(T8)。设计 §5.4 主题方案 → 附录 B。设计 §7 的 K1–K8 与 N1–N8 → 计划同名两节 + T0 写进公共约束。设计 §8 测试与验收 → Global Constraints + 附录 C。**无遗漏。**

**Placeholder scan** —— 全文无 TBD/TODO/「类似 Task N」;每个代码步骤都带可运行代码或精确的 `git show` 取源命令 + 逐条规则。T4/T11 不内联 2561 行 scss(承 P4 T1 先例),但给了行范围、token 映射表、裸色对照表与「不许发明新 token,停下写 `NEEDS_CONTEXT`」的硬边界。

**Type consistency** —— `useKnowledgeStore` / `DISTILL_JOBS_LIMIT` / `fmtAgo` 在 T6 定义、T7/T10/T12 引用,名字一致;`DEFERRED_TABS`/`isDeferred`/`KnowledgeTabId` 在 T5 定义、T12 核对;`createNotes`/`createWiki` 及其纯函数在 T1/T2 定义、T7 通过 `service.notes`/`service.wiki` 消费;`summarizeNotes` 在 T9 定义、T7 消费;`fmtAgo` 的中文断言依赖 T8 的键 —— 这两条跨任务依赖已提炼成文首的 **🔴 执行顺序** 块(`T0→T1→T2→T3→T4→T5→T8→T6→T9→T7→T10→T11→T12`),派工按那条链走。共享包方法名 `patchParserAllowlistExtensions` / `addParserAllowlistFolder` / `deleteParserAllowlistFolder` / `parserFiles` / `parserReindexFiles` / `searchText` / `searchChunk` 已逐个回 `.sp8/NimoOS-Service/src/ai.ts` 核实存在,不是凭记忆写的。
