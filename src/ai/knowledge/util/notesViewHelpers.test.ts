// SP8-P5d Task 3 — 1:1 port from Vue2
// `NimoOS-UI`(main@7a6ee6b7) `src/views/AI/Knowledge/notesViewHelpers.js`.
// Inherit from Vue2 existing `__tests__/notesView.spec.js` (3 cases, governance §4.3),
// with finer refinement than blueprint (each branch + both sides of boundaries,
// preventing "sample only mid-range, threshold change undetectable" regression —
// P5a T6 lesson: changing `fmtAgo` `h < 24` to `h < 48`, 16/16 cases still green).
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  NOTE_TYPES,
  noteTypeMeta,
  NOTE_SOURCES,
  noteSourceMeta,
  statusBadge,
  applyFilters,
  relativeTime,
} from './notesViewHelpers'
import { i18n } from '../../../i18n'

// ═══════════════════════════════════════════════════════════════════════════
// K40 —— NOTE_TYPES[*].color 必须是 var(--grad-note-*) token,零色字面量。
// color-guard.test.ts 只扫 .vue 与 .css,压根不扫 .ts —— 这四个值在任何既有守卫下
// 都是裸奔的,这条定向断言是预防式堵法,不是事后补(附录 B §B.5)。
// 🔴 RED 探针(报告里贴):临时把某个 color 改回蓝本色字面量
// `linear-gradient(135deg, #5AC8FA, #007AFF)` → 这条断言必须报红,还原后转绿。
// ═══════════════════════════════════════════════════════════════════════════
describe('K40 — NOTE_TYPES[*].color 全部是 var(--grad-note-*) token', () => {
  it('四个 color 值逐个形如 var(--grad-note-*)', () => {
    expect(NOTE_TYPES.note.color).toBe('var(--grad-note-note)')
    expect(NOTE_TYPES.summary.color).toBe('var(--grad-note-summary)')
    expect(NOTE_TYPES.insight.color).toBe('var(--grad-note-insight)')
    expect(NOTE_TYPES.digest.color).toBe('var(--grad-note-digest)')
    Object.values(NOTE_TYPES).forEach((m) => {
      expect(m.color).toMatch(/^var\(--grad-note-[a-z]+\)$/)
    })
  })

  it('反向:四个 color 值序列化后零 # / rgb( / rgba( / hsla( —— 不许有人把 token 改回色字面量', () => {
    const serialized = JSON.stringify(Object.values(NOTE_TYPES).map((m) => m.color))
    expect(serialized).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(serialized).not.toMatch(/rgba?\(/)
    expect(serialized).not.toMatch(/hsla?\(/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 附录 A §A.4 —— labelKey 字段值必须是 New-UI 键名,且渲染出真实文案而不是键名本身
// (P5b N14 同坑:「英文原串即 key」的 Vue2 巧合在 New-UI 不成立)。
// ═══════════════════════════════════════════════════════════════════════════
describe('NOTE_TYPES / NOTE_SOURCES 的 labelKey 渲染出真实文案(不是键名字面量)', () => {
  it('4 个 NOTE_TYPES.labelKey 渲染出中文文案', () => {
    expect(i18n.global.t(NOTE_TYPES.note.labelKey)).toBe('笔记')
    expect(i18n.global.t(NOTE_TYPES.summary.labelKey)).toBe('摘要')
    expect(i18n.global.t(NOTE_TYPES.insight.labelKey)).toBe('洞见')
    expect(i18n.global.t(NOTE_TYPES.digest.labelKey)).toBe('文摘')
  })

  it('3 个 NOTE_SOURCES.labelKey 渲染出中文文案', () => {
    expect(i18n.global.t(NOTE_SOURCES.human.labelKey)).toBe('手写')
    expect(i18n.global.t(NOTE_SOURCES.agent.labelKey)).toBe('Agent 代写')
    expect(i18n.global.t(NOTE_SOURCES.pipeline.labelKey)).toBe('AI 沉淀')
  })

  it('反向:labelKey 渲染结果不等于键名本身(证明真的走了 i18n 查表,不是巧合返回了键名)', () => {
    expect(i18n.global.t(NOTE_TYPES.note.labelKey)).not.toBe(NOTE_TYPES.note.labelKey)
    expect(i18n.global.t(NOTE_SOURCES.human.labelKey)).not.toBe(NOTE_SOURCES.human.labelKey)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// noteTypeMeta / noteSourceMeta 的兜底分支 —— 未知值 / undefined 都要用例。
// ═══════════════════════════════════════════════════════════════════════════
describe('noteTypeMeta', () => {
  it('已知 type 逐个返回对应元数据', () => {
    expect(noteTypeMeta('insight')).toBe(NOTE_TYPES.insight)
  })
  it('未知 type 兜底到 note', () => {
    expect(noteTypeMeta('bogus-type')).toBe(NOTE_TYPES.note)
  })
  it('undefined / null 都兜底到 note', () => {
    expect(noteTypeMeta(undefined)).toBe(NOTE_TYPES.note)
    expect(noteTypeMeta(null)).toBe(NOTE_TYPES.note)
  })
})

describe('noteSourceMeta', () => {
  it('已知 createdBy 逐个返回对应元数据', () => {
    expect(noteSourceMeta('agent')).toBe(NOTE_SOURCES.agent)
  })
  it('未知 createdBy 兜底到 human', () => {
    expect(noteSourceMeta('bogus-source')).toBe(NOTE_SOURCES.human)
  })
  it('undefined / null 都兜底到 human', () => {
    expect(noteSourceMeta(undefined)).toBe(NOTE_SOURCES.human)
    expect(noteSourceMeta(null)).toBe(NOTE_SOURCES.human)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// statusBadge —— 蓝本 __tests__/notesView.spec.js:6-10。
// 🔴 全仓零生产消费者(协调者已 grep 核实:蓝本模板里徽标是内联 kn-badge 标记,只有
// Vue2 __tests__/notesView.spec.js 引用这个函数)—— 依据治理 §4.3,照抄导出 + 照抄
// 这 3 条用例,故意保留,不因为「没人用」就删(K7 同族:反转不删)。
// ═══════════════════════════════════════════════════════════════════════════
describe('statusBadge(蓝本 spec 原例,零生产消费者、故意保留 —— 治理 §4.3)', () => {
  it('draft → { label: "AI draft", tone: "warn" }', () => {
    expect(statusBadge({ status: 'draft' })).toEqual({ label: 'AI draft', tone: 'warn' })
  })
  it('archived → { label: "Archived", tone: "muted" }', () => {
    expect(statusBadge({ status: 'archived' })).toEqual({ label: 'Archived', tone: 'muted' })
  })
  it('curated(以及其它任何状态)→ null(不出徽标)', () => {
    expect(statusBadge({ status: 'curated' })).toBe(null)
    expect(statusBadge({ status: undefined })).toBe(null)
    expect(statusBadge({})).toBe(null)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// applyFilters —— 蓝本 __tests__/notesView.spec.js:12-21。
// status 三档语义:'' = 全部 · 'active' = 非 archived · 其余 = 精确匹配。
// type 与 status 两个筛选条件各自独立生效。
// ═══════════════════════════════════════════════════════════════════════════
describe('applyFilters', () => {
  const N = (over: Partial<{ id: string; type: string; status: string }>) => ({
    id: 'x',
    type: 'note',
    status: 'curated',
    ...over,
  })

  it('type 与 status 两个筛选条件各自独立生效(蓝本 spec 原例)', () => {
    const list = [N({ id: 'a', type: 'insight', status: 'draft' }), N({ id: 'b', type: 'note' })]
    expect(applyFilters(list, { type: 'insight', status: '' }).map((n) => n.id)).toEqual(['a'])
    expect(applyFilters(list, { type: '', status: 'draft' }).map((n) => n.id)).toEqual(['a'])
    expect(applyFilters(list, { type: '', status: '' }).length).toBe(2)
  })

  it('status="" 表示全部(不过滤 status)', () => {
    const list = [N({ id: 'a', status: 'draft' }), N({ id: 'b', status: 'archived' }), N({ id: 'c', status: 'curated' })]
    expect(applyFilters(list, { type: '', status: '' }).map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })

  it('status="active" 表示非 archived(draft+curated 都算,蓝本 spec 原例)', () => {
    const list = [N({ id: 'a', status: 'draft' }), N({ id: 'b', status: 'curated' }), N({ id: 'c', status: 'archived' })]
    expect(applyFilters(list, { type: '', status: 'active' }).map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('status 为具体值(非 ""/"active")时是精确匹配', () => {
    const list = [N({ id: 'a', status: 'draft' }), N({ id: 'b', status: 'archived' }), N({ id: 'c', status: 'archived' })]
    expect(applyFilters(list, { type: '', status: 'archived' }).map((n) => n.id)).toEqual(['b', 'c'])
  })

  it('type 为空字符串时不过滤 type(独立于 status 生效)', () => {
    const list = [N({ id: 'a', type: 'digest' }), N({ id: 'b', type: 'summary' })]
    expect(applyFilters(list, { type: '', status: '' }).map((n) => n.id)).toEqual(['a', 'b'])
  })

  // 🔴 修复轮 1 —— 补「两个条件同时非空(组合筛)」的用例。前面 6 条每条都只让
  // type/status 其中一个非空,「两个各自测过」不等于「组合起来是 AND 而不是 OR」,
  // 这是筛选函数的经典漏网点(治理 brief §缺口猎)。
  it('组合命中:type 与 status 同时非空,只有同时满足两者的那条留下(结果与任一单条件筛都不同)', () => {
    const list = [
      N({ id: 'a', type: 'insight', status: 'draft' }), // 两者都满足
      N({ id: 'b', type: 'insight', status: 'curated' }), // 只满足 type
      N({ id: 'c', type: 'note', status: 'draft' }), // 只满足 status
    ]
    // 只按 type 筛会拿到 ['a','b'],只按 status 筛会拿到 ['a','c']——组合结果 ['a']
    // 与两者都不同,证明这条用例真的在验证"两个条件一起生效"而不是巧合等于单条件结果。
    expect(applyFilters(list, { type: 'insight', status: '' }).map((n) => n.id)).toEqual(['a', 'b'])
    expect(applyFilters(list, { type: '', status: 'draft' }).map((n) => n.id)).toEqual(['a', 'c'])
    expect(applyFilters(list, { type: 'insight', status: 'draft' }).map((n) => n.id)).toEqual(['a'])
  })

  it('组合落空:分别只满足其中一个条件的笔记都不该出现 —— 真正抓「误写成 OR」的那条', () => {
    const list = [
      N({ id: 'd', type: 'insight', status: 'curated' }), // 满足 type,不满足 status
      N({ id: 'e', type: 'note', status: 'draft' }), // 满足 status,不满足 type
    ]
    // 若把 applyFilters 内部的 && 误写成 ||,d 和 e 各自会因为"至少一个条件为真"
    // 被放进结果——正确的 AND 语义下两者都不满足"两个条件同时为真",结果必须为空。
    expect(applyFilters(list, { type: 'insight', status: 'draft' })).toEqual([])
  })

  it('组合筛纳入 status="active"(非精确匹配)—— 三档语义里它最容易被误写成精确匹配', () => {
    const list = [
      N({ id: 'f', type: 'insight', status: 'draft' }), // type 匹配 + active(非 archived)→ 应命中
      N({ id: 'g', type: 'insight', status: 'archived' }), // type 匹配但 archived → active 语义应排除
      N({ id: 'h', type: 'note', status: 'curated' }), // active 但 type 不匹配 → 应排除
    ]
    expect(applyFilters(list, { type: 'insight', status: 'active' }).map((n) => n.id)).toEqual(['f'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// relativeTime —— 蓝本 :40-49。
// 🔴 unixSec 是"秒"不是毫秒(蓝本注释 :41)—— 喂毫秒会让所有输入都落进第 5 档,
// 4 个边界的用例全部"通过"但一个都没真正测到。本文件全程用整数秒运算,规避此坑。
// 🔴 用 vitest 假时钟(vi.spyOn(Date,'now')),禁真实时间(治理 §9.8)。
// 4 个边界(60/3600/86400/86400*30 秒)两侧都要用例;第 5 档走
// toLocaleDateString(),断言用同式比对,不钉死具体字符串(依赖环境 locale/TZ)。
// ═══════════════════════════════════════════════════════════════════════════
describe('relativeTime', () => {
  // NOW_MS 是 1000 的整数倍,保证 NOW_MS/1000 是精确整数秒,避免浮点误差污染边界判断。
  const NOW_MS = 1_700_000_000_000
  const NOW_SEC = NOW_MS / 1000

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('0 / undefined / null 三个早退输入都返回空字符串(蓝本 :42 `if (!unixSec) return \'\'`)', () => {
    expect(relativeTime(0)).toBe('')
    expect(relativeTime(undefined)).toBe('')
    expect(relativeTime(null)).toBe('')
  })

  it('第 1/2 档边界:d=59 → 刚刚;d=60 → "1 分钟前"(不是"0 分钟前")', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 59)).toBe('刚刚')
    expect(relativeTime(NOW_SEC - 60)).toBe('1 分钟前')
  })

  it('第 1 档中段值:d=30 → 刚刚', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 30)).toBe('刚刚')
  })

  it('第 2/3 档边界:d=3599 → "59 分钟前";d=3600 → "1 小时前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 3599)).toBe('59 分钟前')
    expect(relativeTime(NOW_SEC - 3600)).toBe('1 小时前')
  })

  it('第 2 档中段值:d=120 → "2 分钟前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 120)).toBe('2 分钟前')
  })

  it('第 3/4 档边界:d=86399 → "23 小时前";d=86400 → "1 天前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 86399)).toBe('23 小时前')
    expect(relativeTime(NOW_SEC - 86400)).toBe('1 天前')
  })

  it('第 3 档中段值:d=7200 → "2 小时前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 7200)).toBe('2 小时前')
  })

  it('第 4/5 档边界:d=86400*30-1 → "29 天前";d=86400*30 → 落到 toLocaleDateString() 档', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - (86400 * 30 - 1))).toBe('29 天前')
    const unixSec5th = NOW_SEC - 86400 * 30
    // 🔴 toLocaleDateString() 的输出依赖运行环境 locale/TZ,不许钉死具体字符串,
    // 用"同式比对"(与产品代码同一条表达式)——这条断言的判别力来自"用了正确的
    // unixSec*1000 构造 Date"而不是来自具体的日期文本。
    expect(relativeTime(unixSec5th)).toBe(new Date(unixSec5th * 1000).toLocaleDateString())
  })

  it('第 4 档中段值:d=172800(2 天前)→ "2 天前"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    expect(relativeTime(NOW_SEC - 172800)).toBe('2 天前')
  })

  it('第 5 档(远早于 30 天前)也用同式比对', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
    const unixSecFar = NOW_SEC - 86400 * 400
    expect(relativeTime(unixSecFar)).toBe(new Date(unixSecFar * 1000).toLocaleDateString())
  })
})
