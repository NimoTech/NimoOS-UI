// SP7-P7a-T7: SmartViewConditionEditor.vue —— 条件 chips + 加条件弹层测试。逐条对应
// task-7-brief.md「必含用例」清单。组件不碰 store,只挂 i18n(真实 zh_cn/en_us 词条)。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import SmartViewConditionEditor from '../SmartViewConditionEditor.vue'
import raw from '../SmartViewConditionEditor.vue?raw'
import { extractStyleBlock, hoverBackgroundRules, parseCssRules, winningHoverBackground } from './cssCascade'
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

  // fix round 1 · M1:busy 期间 submit()/addSuggestion() 内部的 `if (props.busy) return`
  // 此前零覆盖(评审变异实测:分别删掉,20 例全绿)。primary 按钮的 `disabled` 拦不住
  // input 上的 keydown.enter(disabled 只挡鼠标/触屏点击这条路径),这两条补上能证伪的
  // 键盘/建议点击路径。
  it('busy: true → input 里按 Enter 不发 add(disabled 挡不住键盘路径)', async () => {
    const w = mountEditor({ conds: ['scene: sunset'], busy: true })
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    const input = w.find<HTMLInputElement>('[data-test="sv-cond-pop-input"]')
    await input.setValue('object: dog')
    await input.trigger('keydown.enter')
    expect(w.emitted('add')).toBeUndefined()
  })

  it('busy: true → 点建议 chip 不发 add', async () => {
    const w = mountEditor({ conds: [], busy: true })
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    await w.find('[data-test="sv-cond-suggestion"]').trigger('click')
    expect(w.emitted('add')).toBeUndefined()
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

  // fix round 1 · I1:原先这里断言 winningHoverBackground(['sv-cond-add']) 的
  // specificity===2,是一条零价值恒真断言——旧版 cssCascade.ts 有 vacuous-truth 漏洞
  // (纯属性选择器没有伪类,pseudoHits 空数组 `.every()` 恒真,被误收进"hover 候选"),
  // 且 classSpecificity 不给方括号计分,于是不管 [data-open="true"] 那条规则写什么、
  // 甚至整条删掉,`winningHoverBackground` 永远只看得见 `.sv-cond-add:hover` 自己,
  // 断言在反复验证自己。真正该钉的是 Vue2 scss:294-303 编码的不变量——
  // `.sv-cond-add:hover` 与 `.sv-cond-add[data-open="true"]` 两条规则体逐字相同
  // (background/border-color 都一样),这里改成直接锚定两条规则体、断言属性相等。
  it('.sv-cond-add[data-open="true"] 与 :hover 态的 background/border-color 一致(Vue2 三条声明逐字相同的不变量)', () => {
    const style = extractStyleBlock(raw)
    const rules = parseCssRules(style)
    const hoverRule = rules.find((r) => r.selectors.includes('.sv-cond-add:hover'))
    const openRule = rules.find((r) => r.selectors.includes('.sv-cond-add[data-open="true"]'))
    expect(hoverRule).toBeTruthy()
    expect(openRule).toBeTruthy() // 整条规则被删掉时,这一句先炸
    const bgOf = (body: string) => /background\s*:\s*([^;]+)/.exec(body)?.[1].trim()
    const borderColorOf = (body: string) => /border-color\s*:\s*([^;]+)/.exec(body)?.[1].trim()
    expect(bgOf(openRule!.body)).toBeTruthy()
    expect(bgOf(openRule!.body)).toBe(bgOf(hoverRule!.body))
    expect(borderColorOf(openRule!.body)).toBeTruthy()
    expect(borderColorOf(openRule!.body)).toBe(borderColorOf(hoverRule!.body))
  })
})

// fix round 1 · I1:上面那条不变量测试不再经过 winningHoverBackground/hoverBackgroundRules
// (改用 parseCssRules 直接锚定规则体),所以 cssCascade.ts 里那两处 1 行修复本身在本组件
// 的真实场景下没有被直接练到——本组件与其余 13 个既有消费方都是"值恰好相同"或"纯类
// 变体",不会暴露这两个 bug。这里用合成 CSS 字符串给 cssCascade.ts 的修复本身补两条独立
// 回归测试,与本组件的样式解耦。
describe('cssCascade.ts 共享 helper 回归(fix round 1 · I1,合成 CSS,不依赖本组件样式)', () => {
  it('vacuous-truth 修复:纯类选择器(无 :hover)不再被误收进 hover 候选', () => {
    // classSpecificity('.a:hover')=2(类+伪类),classSpecificity('.a.b')=2(两个类)——
    // 修复前两者同分,靠 order 决胜:.a.b 写在后面就会被误判成"胜出的 hover 规则"
    // (win.selector 根本不含 :hover)。修复后 .a.b 在候选阶段就被过滤掉。
    const synthetic = '.a:hover { background: green; } .a.b { background: red; }'
    const rules = hoverBackgroundRules(synthetic, ['a', 'b'])
    expect(rules.length).toBe(1)
    expect(rules[0].selector).toBe('.a:hover')
    expect(winningHoverBackground(synthetic, ['a', 'b']).selector).toBe('.a:hover')
  })

  it('属性选择器计分修复:[data-flag]:hover 的 specificity 现在算上属性选择器', () => {
    // 修复前 classSpecificity 只数 .class 和 :pseudo,方括号不计分 ⇒
    // .y[data-flag="true"]:hover 与 .y:hover 同算 2 分,由 order 决胜。这里把带属性的
    // 规则写在前面、纯类规则写在后面:修复前 order 决胜选中后写的 .y:hover;修复后带
    // 属性的规则 specificity=3 > 2,应稳定胜出,与书写顺序无关。
    const synthetic = '.y[data-flag="true"]:hover { background: blue; } .y:hover { background: red; }'
    const win = winningHoverBackground(synthetic, ['y'])
    expect(win.selector).toBe('.y[data-flag="true"]:hover')
    expect(win.specificity).toBe(3)
  })
})
