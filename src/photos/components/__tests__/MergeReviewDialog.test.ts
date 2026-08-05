// Task 8 (SP7-P5 人物): MergeReviewDialog.vue —— 合并建议逐条审阅弹窗。逐段照 Vue2
// PhotosPeopleView.vue:364-434(模板)测试:计数/置信度、两列对比的姓名反查不对称、
// 拒绝/接受两个按钮的 emit、主按钮文案随 intoName 有无切换、方形头像(T5 加性扩展)、
// Esc 关闭。index/suggestions 的钳制逻辑不在这里测——那是父组件(PhotosPeople.vue)的
// 职责,本组件只负责 emit,见组件头部注释。
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zhCn from '../../../i18n/zh_cn'
import enUs from '../../../i18n/en_us'
import type { Person } from '../../util/peopleView'

const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn(
      (id: string | number, ver?: string | number | null) =>
        `mock://face/${id}${ver != null && ver !== '' ? `?v=${ver}` : ''}`,
    ),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import MergeReviewDialog, { type MergeSuggestion } from '../MergeReviewDialog.vue'
// 原始源码文本(Vite `?raw`)+ 级联辅助:jsdom 既不做级联样式计算也进不了真实 hover 态,
// 只能解析 <style> 原文自行按 CSS 优先级判胜负。机理与 ClusterActionDialog.test.ts 同源。
import mergeReviewDialogRaw from '../MergeReviewDialog.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: { zh_cn: zhCn, en_us: enUs },
})

function makePerson(over: Partial<Person> = {}): Person {
  return {
    id: 'p1', name: 'Alice', confidence: 0.9, count: 3, favorite: false,
    relation: '', coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null,
    placesCount: 0, ...over,
  }
}

function mountDialog(props: {
  open: boolean
  suggestions: MergeSuggestion[]
  index: number
  people: Person[]
}) {
  return mount(MergeReviewDialog, { props, global: { plugins: [i18n] } })
}

// 保真断言的核心数据:fromId 对应的 people 列表条目名字是 "Old Name From List"(反查得到),
// intoName 是建议快照里的 "Snapshot Name"——两者故意不同,用来证明左右两列真的走了两条
// 不同的取值路径(brief 明确要求照搬这个不对称,不是漏写)。
const suggestions: MergeSuggestion[] = [
  { id: 's1', fromId: 'p1', intoId: 'p2', intoName: 'Snapshot Name', confidence: 0.87 },
  { id: 's2', fromId: 'p3', intoId: 'p4', confidence: 0.6 },
  { id: 's3', fromId: 'p5', intoId: 'p6', intoName: 'Third', confidence: 0.5 },
]
const people: Person[] = [
  makePerson({ id: 'p1', name: 'Old Name From List', coverFaceId: 'face-1' }),
  makePerson({ id: 'p2', name: 'Current Name In List (stale vs intoName)', coverFaceId: 'face-2' }),
]

describe('MergeReviewDialog', () => {
  it('渲染 idx/total 计数与置信度百分比', () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    expect(w.get('[data-test="mrd-title"]').text()).toBe('可能的合并 1 / 3')
    expect(w.get('[data-test="mrd-confidence"]').text()).toBe('置信度 87%')
  })

  it('idx/total 随 index 变化(第二条建议时是 2 / 3)', () => {
    const w = mountDialog({ open: true, suggestions, index: 1, people })
    expect(w.get('[data-test="mrd-title"]').text()).toBe('可能的合并 2 / 3')
  })

  it('保真断言:左侧从 people 反查姓名(走 PersonAvatar 的 name prop 影响首字母兜底），\
右侧直接用 intoName,两者取值不同即证明走的是两条不同路径', () => {
    // 两侧都不给真实头像(mock URL 始终返回值,但我们要看 fallback 首字母),所以强制
    // img 报错触发 fallback,再比较两侧首字母是否分别来自 people 反查 vs intoName。
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    const fromImgs = w.get('[data-test="mrd-side-from"]').findAll('[data-test="avatar-img"]')
    const intoImgs = w.get('[data-test="mrd-side-into"]').findAll('[data-test="avatar-img"]')
    expect(fromImgs).toHaveLength(1)
    expect(intoImgs).toHaveLength(1)
    return Promise.all([fromImgs[0].trigger('error'), intoImgs[0].trigger('error')]).then(() => {
      // 左侧:people 里 p1 的 name 是 'Old Name From List' → 首字母 'O'
      expect(w.get('[data-test="mrd-side-from"] [data-test="avatar-initial"]').text()).toBe('O')
      // 右侧:suggestion.intoName 是 'Snapshot Name' → 首字母 'S'(不是 people 里 p2 的 'C')
      expect(w.get('[data-test="mrd-side-into"] [data-test="avatar-initial"]').text()).toBe('S')
    })
  })

  it('左侧 fromId 在 people 里查不到时姓名兜底为空串(不崩,同 Vue2 `|| ""`)', async () => {
    const w = mountDialog({ open: true, suggestions: [suggestions[1]], index: 0, people: [] })
    // suggestions[1] 没有 intoName、fromId=p3 也不在 people 里 → 两侧的 name 都归一为
    // 空串。personId 本身非空(p3/p4),PersonAvatar 三级兜底的第一级仍会先尝试真图,
    // 触发 error 后才落到「personInitial('') === '' → person 图标」这一级。
    await w.get('[data-test="mrd-side-from"] [data-test="avatar-img"]').trigger('error')
    await w.get('[data-test="mrd-side-into"] [data-test="avatar-img"]').trigger('error')
    expect(w.find('[data-test="mrd-side-from"] [data-test="avatar-icon"]').exists()).toBe(true)
    expect(w.find('[data-test="mrd-side-into"] [data-test="avatar-icon"]').exists()).toBe(true)
  })

  it('两侧头像是方形(shape=square,验证 T5 的加性扩展生效)', () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    const avatars = w.findAll('.person-avatar')
    expect(avatars).toHaveLength(2)
    for (const a of avatars) expect(a.classes()).toContain('is-square')
  })

  it('点 Not a match → emit reject 带当前建议 id', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.get('[data-test="mrd-reject"]').trigger('click')
    expect(w.emitted('reject')).toEqual([['s1']])
    expect(w.emitted('accept')).toBeUndefined()
  })

  it('点主按钮 → emit accept 带当前建议 id', async () => {
    const w = mountDialog({ open: true, suggestions, index: 1, people })
    await w.get('[data-test="mrd-accept"]').trigger('click')
    expect(w.emitted('accept')).toEqual([['s2']])
    expect(w.emitted('reject')).toBeUndefined()
  })

  it('主按钮文案:intoName 存在 → "合并为 {name}"', () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    expect(w.get('[data-test="mrd-accept"]').text()).toContain('合并为 Snapshot Name')
  })

  it('主按钮文案:intoName 缺失 → 用 "同一个人" 填充', () => {
    const w = mountDialog({ open: true, suggestions, index: 1, people })
    expect(w.get('[data-test="mrd-accept"]').text()).toContain('合并为 同一个人')
  })

  it('点遮罩(click.self)→ emit update:open(false)', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.get('[data-test="mrd-overlay"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('点关闭按钮 → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.get('[data-test="mrd-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('Esc(document 级,bubbles:true)→ emit update:open(false),且 stopPropagation 挡住继续向上冒泡到 window', () => {
    // document 冒泡的下一站是 window(同 AlbumPickerDialog.vue:70-100 先例里灯箱在 window
    // 上挂监听的场景)——把 spy 放在 document 上不能验证 stopPropagation,因为同一 target
    // 上的其它监听器不受 stopPropagation 影响,只有「继续向上冒泡到父级」才会被挡。
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(windowSpy).not.toHaveBeenCalled()
    window.removeEventListener('keydown', windowSpy)
  })

  it('open=false 时不渲染;index 越界(suggestions 已空)时也不渲染,不崩', () => {
    const w = mountDialog({ open: false, suggestions, index: 0, people })
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)

    const w2 = mountDialog({ open: true, suggestions: [], index: 0, people })
    expect(w2.find('[data-test="mrd-overlay"]').exists()).toBe(false)
  })

  it('关闭后(open=false→拆掉监听)Esc 不再触发 emit(回归:监听没摘干净会重复触发)', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.setProps({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// 与 ClusterActionDialog 同款的优先级坑(全仓扫描只余这一处):基类 `.mrd-btn:hover`
// 带伪类 (0,2,0),压过只有一个类的 `.mrd-btn-primary` (0,1,0),hover 时把 accent 实底
// 换成近白的 --chip-bg-hi,文字仍是 --on-accent → 「合并」键整颗看不见。原来的
// `.mrd-btn-primary:hover` 里只有 filter、没有 background,所以拦不住。
describe('MergeReviewDialog.vue — hover 态下主行动键的背景不被 .mrd-btn:hover 夺走', () => {
  const styleText = extractStyleBlock(mergeReviewDialogRaw)

  it('合并键 hover 时生效的 background 仍是 --accent,不是 --chip-bg-hi', () => {
    const win = winningHoverBackground(styleText, ['mrd-btn', 'mrd-btn-primary'])
    expect(win.value).toContain('--accent')
    expect(win.value).not.toContain('--chip-bg-hi')
  })

  it('「不是同一个人」键(只有基类)hover 时才该拿到 --chip-bg-hi', () => {
    const win = winningHoverBackground(styleText, ['mrd-btn'])
    expect(win.value).toContain('--chip-bg-hi')
  })
})
