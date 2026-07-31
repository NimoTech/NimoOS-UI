// SP7-P7a-T7: SmartViewConditionEditor.vue —— 条件 chips + 加条件弹层测试。逐条对应
// task-7-brief.md「必含用例」清单。组件不碰 store,只挂 i18n(真实 zh_cn/en_us 词条)。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import SmartViewConditionEditor from '../SmartViewConditionEditor.vue'
import raw from '../SmartViewConditionEditor.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'
import { COND_SUGGESTIONS } from '../../util/smartViewSuggest'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function mountEditor(props: { conds: string[]; busy?: boolean }, i18n = makeI18n()) {
  return mount(SmartViewConditionEditor, { props, global: { plugins: [i18n] } })
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ── chips 数量 ────────────────────────────────────────────────────────────
describe('chips 渲染', () => {
  it('conds 3 条 → 3 个 .sv-cond-removable + 1 个 .sv-cond-add', () => {
    const w = mountEditor({ conds: ['scene: sunset', 'place: Japan', 'year: 2026'] })
    expect(w.findAll('.sv-cond-removable').length).toBe(3)
    expect(w.findAll('.sv-cond-add').length).toBe(1)
  })
  it('conds 为 [] → 0 个 removable + 1 个 add', () => {
    const w = mountEditor({ conds: [] })
    expect(w.findAll('.sv-cond-removable').length).toBe(0)
    expect(w.findAll('.sv-cond-add').length).toBe(1)
  })
})

// ── 删除 chip ─────────────────────────────────────────────────────────────
describe('删除条件', () => {
  it('点 chip 任意处(不是点叉)→ remove 事件带该 chip 文本', async () => {
    const w = mountEditor({ conds: ['scene: sunset', 'place: Japan'] })
    await w.findAll('[data-test="sv-cond-chip"]')[0].trigger('click')
    expect(w.emitted('remove')).toEqual([['scene: sunset']])
  })
  it('点叉(.sv-cond-x)→ 同样触发 remove(冒泡到整个 chip)', async () => {
    const w = mountEditor({ conds: ['scene: sunset'] })
    await w.find('.sv-cond-x').trigger('click')
    expect(w.emitted('remove')).toEqual([['scene: sunset']])
  })
})

// ── 弹层开关 + 聚焦 ────────────────────────────────────────────────────────
describe('弹层开关', () => {
  it('点「添加条件」→ 弹层出现,input 自动聚焦;再点 → 关闭', async () => {
    const w = mountEditor({ conds: [] }, makeI18n())
    document.body.appendChild(w.element)
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(false)
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true)
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(w.find('[data-test="sv-cond-pop-input"]').element)
    })
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(false)
    w.element.remove()
  })
})

// ── 提交条件 ──────────────────────────────────────────────────────────────
describe('提交条件', () => {
  async function openAnd(w: ReturnType<typeof mountEditor>) {
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
  }

  it("输入 'scene: x' + Enter → add 事件带 'scene: x';弹层仍开着、input 已清空;连续再输一条 → 第二个 add 事件", async () => {
    const w = mountEditor({ conds: [] })
    await openAnd(w)
    const input = w.find<HTMLInputElement>('[data-test="sv-cond-pop-input"]')
    await input.setValue('scene: x')
    await input.trigger('keydown.enter')
    expect(w.emitted('add')).toEqual([['scene: x']])
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true) // 弹层仍开
    expect(input.element.value).toBe('') // input 已清空

    await input.setValue('place: Y')
    await input.trigger('keydown.enter')
    expect(w.emitted('add')).toEqual([['scene: x'], ['place: Y']])
  })

  it('输入空白 + Enter → 无 add 事件且弹层关闭', async () => {
    const w = mountEditor({ conds: [] })
    await openAnd(w)
    const input = w.find<HTMLInputElement>('[data-test="sv-cond-pop-input"]')
    await input.setValue('   ')
    await input.trigger('keydown.enter')
    expect(w.emitted('add')).toBeUndefined()
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(false)
  })

  it('输入一条已存在的条件 + Enter → 无 add 事件(去重);input 清空、弹层仍开', async () => {
    const w = mountEditor({ conds: ['scene: sunset'] })
    await openAnd(w)
    const input = w.find<HTMLInputElement>('[data-test="sv-cond-pop-input"]')
    await input.setValue('scene: sunset')
    await input.trigger('keydown.enter')
    expect(w.emitted('add')).toBeUndefined()
    expect(input.element.value).toBe('')
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true)
  })
})

// ── 建议区 ────────────────────────────────────────────────────────────────
describe('建议区', () => {
  it('conds 含 scene: sunset → 建议里不含它', async () => {
    const w = mountEditor({ conds: ['scene: sunset'] })
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    const texts = w.findAll('[data-test="sv-cond-suggestion"]').map((b) => b.text())
    expect(texts.some((t) => t.includes('scene: sunset'))).toBe(false)
  })

  it('建议最多 8 条', async () => {
    const w = mountEditor({ conds: [] })
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    expect(w.findAll('[data-test="sv-cond-suggestion"]').length).toBe(8)
  })

  it('点一条建议 → add 事件 + 弹层仍开', async () => {
    const w = mountEditor({ conds: [] })
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    const first = w.findAll('[data-test="sv-cond-suggestion"]')[0]
    const label = first.text().replace(/^\+\s*/, '')
    await first.trigger('click')
    expect(w.emitted('add')).toEqual([[label]])
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true)
  })

  it('conds 覆盖了 12 条中的 12 条 → 建议区整块不渲染', async () => {
    const w = mountEditor({ conds: [...COND_SUGGESTIONS] })
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    expect(w.find('.sv-cond-pop-sugg-head').exists()).toBe(false)
    expect(w.find('.sv-cond-pop-sugg').exists()).toBe(false)
  })
})

// ── busy ──────────────────────────────────────────────────────────────────
describe('busy', () => {
  it('busy: true → primary 按钮 disabled、chip 的删除点击不发 remove', async () => {
    const w = mountEditor({ conds: ['scene: sunset'], busy: true })
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    await w.find('[data-test="sv-cond-pop-input"]').setValue('place: Y')
    expect(w.find('[data-test="sv-cond-submit"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="sv-cond-chip"]').trigger('click')
    expect(w.emitted('remove')).toBeUndefined()
  })
})

// ── 点外部关闭 ────────────────────────────────────────────────────────────
describe('点外部关闭', () => {
  it('点外部(mousedown 打在 body 上)→ 关闭', async () => {
    const w = mountEditor({ conds: [] })
    document.body.appendChild(w.element)
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(false)
    w.element.remove()
  })

  it('点弹层内部 → 不关', async () => {
    const w = mountEditor({ conds: [] })
    document.body.appendChild(w.element)
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    w.find('[data-test="sv-cond-pop"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true)
    w.element.remove()
  })

  it('点「添加条件」按钮本身 → 走 toggle 不走点外部(钉住 addBtn.contains 判据)', async () => {
    const w = mountEditor({ conds: [] })
    document.body.appendChild(w.element)
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true)
    // 单独一个 mousedown 打在按钮自己身上:addBtn.contains(target) 为真,不该被
    // "点外部"逻辑关掉。
    w.find('[data-test="sv-cond-add-btn"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true) // 仍开:mousedown 没关它
    // 真正的关闭来自 click 触发的 toggleOpen。
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(false)
    w.element.remove()
  })
})

// ── Esc ───────────────────────────────────────────────────────────────────
describe('Esc', () => {
  it('Esc → 关闭', async () => {
    const w = mountEditor({ conds: [] })
    document.body.appendChild(w.element)
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(false)
    w.element.remove()
  })

  it('onDocumentKeydown 源码里 return 只出现在非 Escape 分支(禁早退)', () => {
    const m = /function onDocumentKeydown\(e: KeyboardEvent\): void \{([\s\S]*?)\n\}/.exec(raw)
    expect(m).toBeTruthy()
    const body = m![1]
    const returns = [...body.matchAll(/\breturn\b/g)]
    expect(returns.length).toBe(1)
    expect(body).toMatch(/if \(e\.key !== 'Escape'\) return/)
  })
})

// ── cssCascade:hover 归属变体 ─────────────────────────────────────────────
describe('cssCascade', () => {
  it('.sv-cond-removable 的 hover 生效且选择器含 :hover、归属变体自身', () => {
    const style = extractStyleBlock(raw)
    const win = winningHoverBackground(style, ['sv-cond-removable'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('sv-cond-removable')
  })

  it('.sv-cond-add[data-open="true"] 不劫持 hover——胜出规则仍是 .sv-cond-add:hover(具体 specificity=2)', () => {
    const style = extractStyleBlock(raw)
    const win = winningHoverBackground(style, ['sv-cond-add'])
    expect(win.selector).toContain(':hover')
    expect(win.specificity).toBe(2)
  })
})
