// Task 10(SP7-P6a 地点·地图主视图):PlacesThemeMenu.vue —— 地图工具栏「地图主题」胶囊按钮 +
// 下拉弹层(4 预设 + 自定义两取色器)。逐条对应 task-10-brief.md 的「必含测试清单」。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import PlacesThemeMenu, { type MapThemeSelection } from '../PlacesThemeMenu.vue'
import placesThemeMenuRaw from '../PlacesThemeMenu.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function defaultSelection(overrides: Partial<MapThemeSelection> = {}): MapThemeSelection {
  return { mapTheme: 'default', customDotColor: '#6E5BFF', customGridColor: '#9C8EFF', ...overrides }
}

const mounted: VueWrapper[] = []
function mountMenu(
  props: Partial<InstanceType<typeof PlacesThemeMenu>['$props']> = {},
  i18n = makeI18n(),
) {
  const w = mount(PlacesThemeMenu, {
    props: {
      selection: defaultSelection(),
      isLight: false,
      open: false,
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.innerHTML = ''
})

// ── chip 按钮 ────────────────────────────────────────────────────────────────
describe('chip 按钮', () => {
  it('文案走 i18n 键 photosPlacesMapTheme', () => {
    const w = mountMenu()
    expect(w.get('[data-test="mtm-chip"]').text()).toContain('地图主题')
  })

  it('点 chip → emit update:open 取反', async () => {
    const w = mountMenu({ open: false })
    await w.get('[data-test="mtm-chip"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[true]])
  })
})

// ── 四个预设项 ────────────────────────────────────────────────────────────────
describe('预设列表', () => {
  it('渲染四个 .mtp-item,顺序 default/ocean/sand/mono', () => {
    const w = mountMenu({ open: true })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items).toHaveLength(4)
    expect(items.map((it) => it.attributes('data-theme-id'))).toEqual(['default', 'ocean', 'sand', 'mono'])
  })

  it('当前项(mapTheme 命中的那个)有 .is-active 且含 check 图标,其余没有', () => {
    const w = mountMenu({ open: true, selection: defaultSelection({ mapTheme: 'ocean' }) })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].classes()).toContain('is-active')
    expect(items[1].find('[data-test="mtm-check"]').exists()).toBe(true)
    for (const i of [0, 2, 3]) {
      expect(items[i].classes()).not.toContain('is-active')
      expect(items[i].find('[data-test="mtm-check"]').exists()).toBe(false)
    }
  })

  it('mapTheme=custom 时四个预设项都没有 .is-active(custom 不是任何预设)', () => {
    const w = mountMenu({ open: true, selection: defaultSelection({ mapTheme: 'custom' }) })
    const items = w.findAll('[data-test="mtm-preset"]')
    for (const i of items) expect(i.classes()).not.toContain('is-active')
  })

  it('预设名/描述走 i18n 键(断言中文文案,不是 Ocean 字面)', () => {
    const w = mountMenu({ open: true })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].get('.mtp-name').text()).toBe('海洋')
    expect(items[1].get('.mtp-desc').text()).toBe('青绿调 + 深色背景')
    expect(items[1].text()).not.toContain('Ocean')
  })

  it('.mtp-swatch 背景与内圆点颜色随 isLight 切换', () => {
    const dark = mountMenu({ open: true, isLight: false })
    const darkSwatch = dark.findAll('[data-test="mtm-swatch"]')[1]
    expect(darkSwatch.attributes('style')).toContain('background-color: rgb(10, 18, 26)') // #0a121a
    expect(darkSwatch.get('.mtp-dot').attributes('style')).toContain('background: rgb(90, 200, 250)') // #5AC8FA

    const light = mountMenu({ open: true, isLight: true })
    const lightSwatch = light.findAll('[data-test="mtm-swatch"]')[1]
    expect(lightSwatch.attributes('style')).toContain('oklch(0.97 0.008 230)')
    expect(lightSwatch.get('.mtp-dot').attributes('style')).toContain('background: rgb(10, 132, 194)') // #0A84C2
  })

  it('点预设 → emit update:selection(mapTheme 变该 id,颜色字段原样保留)+ emit update:open(false)', async () => {
    const original = defaultSelection({ customDotColor: '#123456', customGridColor: '#abcdef' })
    const w = mountMenu({ open: true, selection: original })
    await w.get('[data-theme-id="sand"]').trigger('click')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next).toEqual({ ...original, mapTheme: 'sand' })
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

// ── 自定义取色器 ──────────────────────────────────────────────────────────────
describe('自定义取色器', () => {
  it('自定义标题走 i18n 键 photosPlacesMapThemeCustom', () => {
    const w = mountMenu({ open: true })
    expect(w.text()).toContain('自定义')
  })

  it('两个 <input type="color"> 存在', () => {
    const w = mountMenu({ open: true })
    expect(w.get('[data-test="mtm-dot-input"]').attributes('type')).toBe('color')
    expect(w.get('[data-test="mtm-grid-input"]').attributes('type')).toBe('color')
  })

  it('陆地点颜色 @input → emit payload.mapTheme===custom 且 customDotColor 被更新,customGridColor 原样保留', async () => {
    const original = defaultSelection({ mapTheme: 'ocean', customGridColor: '#abcdef' })
    const w = mountMenu({ open: true, selection: original })
    const input = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    input.element.value = '#ff00ff'
    await input.trigger('input')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next.mapTheme).toBe('custom')
    expect(next.customDotColor).toBe('#ff00ff')
    expect(next.customGridColor).toBe('#abcdef')
  })

  it('城市灯颜色 @input → emit payload.mapTheme===custom 且 customGridColor 被更新,customDotColor 原样保留', async () => {
    const original = defaultSelection({ mapTheme: 'sand', customDotColor: '#123456' })
    const w = mountMenu({ open: true, selection: original })
    const input = w.get<HTMLInputElement>('[data-test="mtm-grid-input"]')
    input.element.value = '#00ffff'
    await input.trigger('input')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next.mapTheme).toBe('custom')
    expect(next.customGridColor).toBe('#00ffff')
    expect(next.customDotColor).toBe('#123456')
  })

  it('取色器不关闭弹层(与点预设不同,不 emit update:open)', async () => {
    const w = mountMenu({ open: true })
    const input = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    input.element.value = '#ff00ff'
    await input.trigger('input')
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// ── 浮层规范:document mousedown / keydown(同 T9)───────────────────────────────
describe('浮层规范', () => {
  it('open=true 时 document mousedown 在容器外 → emit update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    outside.remove()
  })

  it('open=true 时 document mousedown 在容器内(弹层内部) → 不 emit', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    w.get('[data-test="mtm-pop"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('Esc(document 级派发,bubbles:true) → emit update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('非 Escape 键不触发关闭', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('open=false 时 document mousedown/keydown 不再触发 emit(监听已摘)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    outside.remove()
  })

  it('卸载后 document 上的监听摘干净(比对函数引用)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    const addedMousedown = addSpy.mock.calls.find((c) => c[0] === 'mousedown') as [string, EventListener] | undefined
    const addedKeydown = addSpy.mock.calls.find((c) => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(addedMousedown).toBeDefined()
    expect(addedKeydown).toBeDefined()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedMousedown![1])
    expect(removeSpy).toHaveBeenCalledWith('keydown', addedKeydown![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// ── 英文 locale sanity ────────────────────────────────────────────────────────
describe('英文 locale sanity', () => {
  it('en_us 下 chip 与预设文案切到英文', () => {
    const w = mountMenu({ open: true }, makeI18n('en_us'))
    expect(w.get('[data-test="mtm-chip"]').text()).toContain('Map theme')
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].get('.mtp-name').text()).toBe('Ocean')
  })
})

// ── theme-exception 注释合规(照 color-guard 的豁免窗口规则)────────────────────
describe('theme-exception 注释合规', () => {
  it('样式块里若出现裸颜色字面量,必被紧邻的 theme-exception 注释豁免窗口覆盖', () => {
    // 逐字复刻 src/styles/color-guard.test.ts 的豁免窗口状态机:exempt 遇到
    // theme-exception 注释后打开,遇到下一个 ; 或 } 就关闭。这里不假设本组件一定需要
    // 例外(与 PlacesMap.vue 那条不同,本组件预期零字面色——全部走 token 或经由 :style
    // 绑定在样式块之外),所以不额外断言 comments.length > 0:若实现里确实一个字面色都
    // 没有,offenders 数组为空即通过,且天然与全仓 color-guard.test.ts 的判定口径一致;
    // 若未来有人往这里加了字面色又忘记豁免注释,这条测试会先于全量 color-guard 抓到它。
    const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(placesThemeMenuRaw)
    expect(m).not.toBeNull()
    const styleText = m![1]
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(rgba?|hsla?)\s*\(/
    let exempt = false
    const offenders: string[] = []
    for (const line of styleText.split('\n')) {
      if (line.includes('theme-exception')) exempt = true
      if (!exempt && (HEX.test(line) || FUNC.test(line))) offenders.push(line)
      if (line.includes(';') || line.includes('}')) exempt = false
    }
    expect(offenders, `裸颜色未被豁免窗口覆盖:\n${offenders.join('\n')}`).toEqual([])
  })
})

// ── 样式级联:.mtp-item.is-active:hover 归属变体(hover 级联铁律)─────────────────
describe('cssCascade: .mtp-item.is-active:hover 归属变体', () => {
  const styleText = extractStyleBlock(placesThemeMenuRaw)

  it('.mtp-item.is-active:hover 背景归属变体规则(优先级更高,而非源码顺序 tie-break)', () => {
    // 同 PlacesFilterMenu.test.ts 的既有教训(T9):若只断言 winner.value 包含期望 token,
    // 在变体自己的 :hover 规则被删掉后,winningHoverBackground 可能靠"同优先级取源码顺序
    // 更靠后那条"的 tie-break 规则,巧合选中同一个 background 值,测试拿不到 RED。这里
    // 额外钉死 winner.selector 必须自带显式 :hover,证明它是靠更高优先级赢的。
    const winner = winningHoverBackground(styleText, ['map-theme-pop', 'mtp-item', 'is-active'])
    expect(winner.selector).toContain('is-active')
    expect(winner.selector).toContain(':hover')
    expect(winner.value).toContain('--accent-soft')
    expect(winner.value).not.toContain('--chip-bg')
  })
})
