// SP7-P7a-T14: SearchSaveSmartView.vue —— 「保存为智能视图」弹层测试(D12 接线做真)。
// 挂 Pinia + i18n,真实 usePhotosSmartViews() store,createSmartView 用 vi.spyOn 精确控制
// 成功/失败(同 SmartViewCreateDialog.test.ts 的既定手法)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {},
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import SearchSaveSmartView from '../SearchSaveSmartView.vue'
import searchSaveSmartViewRaw from '../SearchSaveSmartView.vue?raw'
import { usePhotosSmartViews, type SmartView } from '../../stores/smartViews'
import { useToast } from '../../../stores/toast'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

type Props = { open: boolean; query: string; conditions: string[]; defaultName: string; ignoreEl?: HTMLElement | null }

function baseProps(overrides: Partial<Props> = {}): Props {
  return { open: false, query: 'sunset in tokyo', conditions: ['scene: sunset', 'place: Japan'], defaultName: 'Sunset Trips', ...overrides }
}

function mountDialog(props: Partial<Props> = {}, i18n = makeI18n()) {
  return mount(SearchSaveSmartView, { props: baseProps(props), global: { plugins: [i18n] } })
}

// fix round 1 · I1:点外部 mousedown 关闭的用例需要真实挂到 document 上,事件才能从
// 目标节点冒泡到 document 级监听器(同 PlacesThemeMenu.test.ts 的既定手法)。
function mountDialogAttached(props: Partial<Props> = {}, i18n = makeI18n()) {
  return mount(SearchSaveSmartView, { props: baseProps(props), global: { plugins: [i18n] }, attachTo: document.body })
}

function fullSv(overrides: Partial<SmartView> = {}): SmartView {
  return {
    id: 'sv-new', name: 'X', description: '', conds: [], threshold: 80, live: true, includeVideos: false,
    count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: new Array(10).fill(0),
    evaluatedAt: '', createdAt: '', ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('结构清点', () => {
  it('open:false → 不渲染', () => {
    const w = mountDialog({ open: false })
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(false)
  })

  it('open:true → 渲染 4 段(head/body 三字段+开关/foot)', () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    expect(w.find('.save-pop-icon').exists()).toBe(true)
    expect(w.find('[data-test="ssv-name-input"]').exists()).toBe(true)
    expect(w.find('.save-pop-conds').exists()).toBe(true)
    expect(w.find('[data-test="pts-range"]').exists()).toBe(true)
    expect(w.find('[data-test="ssv-switch-live"]').exists()).toBe(true)
    expect(w.find('[data-test="ssv-cancel-btn"]').exists()).toBe(true)
    expect(w.find('[data-test="ssv-confirm-btn"]').exists()).toBe(true)
  })
})

describe('open 变真时重置走 watch(持久挂载坑守卫)', () => {
  it('改过 name 后关闭再打开 → name 回到 defaultName;thresh 回到 75', async () => {
    const w = mountDialog({ open: false, defaultName: 'Sunset Trips' })
    await w.setProps({ open: true })
    expect((w.find('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe('Sunset Trips')
    await w.find('[data-test="ssv-name-input"]').setValue('My Custom Name')
    await w.find('[data-test="pts-range"]').setValue('92')
    expect(w.find('.save-pop-thresh-val').text()).toContain('92%')

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe('Sunset Trips')
    expect(w.find('.save-pop-thresh-val').text()).toContain('75%')
  })
})

describe('自动聚焦', () => {
  it('打开后名称输入框自动聚焦', async () => {
    const w = mount(SearchSaveSmartView, {
      props: baseProps({ open: true }),
      global: { plugins: [makeI18n()] },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.find('[data-test="ssv-name-input"]').element)
    w.unmount()
  })
})

describe('条件回显', () => {
  it('conditions 非空 → N 个 .save-pop-cond', () => {
    const w = mountDialog({ open: true, conditions: ['scene: sunset', 'place: Japan', 'people: Sara'] })
    expect(w.findAll('.save-pop-cond')).toHaveLength(3)
    expect(w.find('.save-pop-conds-empty').exists()).toBe(false)
  })

  it('conditions 为空 → 提示文案', () => {
    const w = mountDialog({ open: true, conditions: [] })
    expect(w.findAll('.save-pop-cond')).toHaveLength(0)
    expect(w.get('.save-pop-conds-empty').text()).toBe(zh.photosSearchNoActiveFiltersSaves)
  })
})

describe('primary 禁用态', () => {
  it('name 为空(trim 后)→ disabled', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-name-input"]').setValue('   ')
    expect((w.find('[data-test="ssv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('store.createBusy=true → disabled(即便 name 有值)', async () => {
    const store = usePhotosSmartViews()
    const w = mountDialog({ open: true })
    store.createBusy = true
    await w.vm.$nextTick()
    expect((w.find('[data-test="ssv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('confirm 真调 store(D12)', () => {
  it('成功:createSmartView 收到逐字段对象(conds 是拷贝非同引用),saved 事件带 id,update:open 发 false', async () => {
    const store = usePhotosSmartViews()
    const created = fullSv({ id: 'sv-abc' })
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(created)
    const conditions = ['scene: sunset', 'place: Japan']
    const w = mountDialog({ open: true, query: 'sunset in tokyo', conditions })
    await w.find('[data-test="pts-range"]').setValue('88')
    await w.find('[data-test="ssv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()

    expect(spy).toHaveBeenCalledTimes(1)
    const arg = spy.mock.calls[0]![0]
    expect(arg.name).toBe('Sunset Trips')
    expect(arg.description).toBe('sunset in tokyo')
    expect(arg.conds).toEqual(['scene: sunset', 'place: Japan'])
    expect(arg.threshold).toBe(88)
    expect(arg.live).toBe(true)
    expect(arg.includeVideos).toBe(false)

    // 拷贝而非同一引用的可证伪验证(删码验证清单③已用这条实测过):不能直接
    // `expect(arg.conds).not.toBe(conditions)` 比较——Vue 的 props 是 reactive() 包出来的
    // Proxy,即使实现改成 `conds: props.conditions`(不展开),读到的值本来就是包着原始
    // 数组的 Proxy、不是原始数组本身,这条引用比较对"有没有展开"这件事没有区分力(已实测:
    // 删掉展开后这样写仍然全绿)。真正有区分力的是"调用之后原数组被就地修改,已经发出去的
    // 这份 conds 会不会跟着变"——展开产生的是当时那一刻的快照,后续对原数组的原地 push
    // 不会反映到快照里;不展开则 arg.conds 是原数组的活代理,原地 push 会立刻可见。
    conditions.push('people: Sara')
    expect(arg.conds).toEqual(['scene: sunset', 'place: Japan']) // 未被之后的原地修改污染

    // fix 波 F1:emit 契约加了第二参 name(宿主要拼保存成功 toast 文案)——这里跟着契约走,
    // 不是弱化断言:name.value 在 open 变真时被 watch 设成 props.defaultName('Sunset
    // Trips'),本用例没有改过名称输入框,所以第二个参数就是这个默认名。
    expect(w.emitted('saved')).toEqual([['sv-abc', 'Sunset Trips']])
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  // fix round 1 · M5:query 为空(或全空白)时 description 必须是 undefined,不是空字符串
  // ——`CreateSmartViewInput.description?` 的既定语义是"空描述不传字段"(T5 同一口径)。
  it('query 为空白字符串时 → description 是 undefined,不是空字符串(fix round 1 · M5)', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv())
    const w = mountDialog({ open: true, query: '   ' })
    await w.find('[data-test="ssv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ description: undefined }))
  })

  it('失败:reject → toast 被调、update:open 未发出、saved 未发出、弹层不关', async () => {
    const store = usePhotosSmartViews()
    vi.spyOn(store, 'createSmartView').mockRejectedValue(new Error('boom'))
    const toastSpy = vi.spyOn(useToast(), 'show')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.vm.$nextTick()

    expect(toastSpy).toHaveBeenCalledWith(zh.photosAlbumCreateFailed)
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.emitted('saved')).toBeUndefined()
    // fix round 1 · M7(评审查实):这条本身是恒真断言——`open` 是父控 prop,本组件在任何
    // 实现下都不可能自己把 v-if 的条件改掉,测试也从未 setProps({ open: false }),所以
    // "弹层还在"这件事跟 confirm() 有没有正确处理失败完全无关。真正钉住"失败时弹层不关"
    // 这条行为的是上面 `emitted('update:open')).toBeUndefined()`——如果实现在失败路径也
    // emit 了 update:open(false),那条才会变红。这行只保留作可读性锚点(明确写出"我们
    // 期望的是弹层还渲染着"这句人话),不再当作有效的行为守卫。
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    errSpy.mockRestore()
  })
})

describe('开关', () => {
  it('role=switch + aria-checked 随状态 + aria-label 存在', async () => {
    const w = mountDialog({ open: true })
    const sw = w.find('[data-test="ssv-switch-live"]')
    expect(sw.attributes('role')).toBe('switch')
    expect(sw.attributes('aria-checked')).toBe('true') // 默认 live=true
    expect(sw.attributes('aria-label')).toBeTruthy()
    await sw.trigger('click')
    expect(sw.attributes('aria-checked')).toBe('false')
  })
})

describe('关闭入口', () => {
  it('点关闭按钮 → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-close-btn"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('点 Cancel → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-cancel-btn"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

describe('Esc 关闭(不提交)', () => {
  it('open:true 时按 Esc → emit update:open(false),createSmartView 未被调', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'createSmartView')
    const w = mountDialog({ open: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(spy).not.toHaveBeenCalled()
  })

  it('open:false 时按 Esc → 不 emit(document 监听器只在打开时挂载)', async () => {
    const w = mountDialog({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// fix round 1 · I1(评审查实的漏渲染,fix round 2 · N2 修正行号):Vue2 `_onDoc`(整体
// :819-832,保存弹层那半判据在 :820-822)的 mousedown 判据——
// "pop 与 btn 都不 contains(target) 才关"。之前只做了 Esc,这里补齐点外部关闭 + 新增
// `ignoreEl` prop 覆盖触发按钮那一半判据。
describe('点外部 mousedown 关闭(fix round 1 · I1)', () => {
  it('点弹层内部 → 不关', async () => {
    const w = mountDialogAttached({ open: true })
    w.get('[data-test="ssv-root"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    w.unmount()
  })

  it('点弹层外 → emit update:open(false)', async () => {
    const w = mountDialogAttached({ open: true })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    outside.remove()
    w.unmount()
  })

  it('传了 ignoreEl 时点 ignoreEl 内部 → 不关(新 prop 的主守卫)', async () => {
    const triggerBtn = document.createElement('button')
    document.body.appendChild(triggerBtn)
    const w = mountDialogAttached({ open: true, ignoreEl: triggerBtn })
    triggerBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    triggerBtn.remove()
    w.unmount()
  })

  it('不传 ignoreEl 时点"本该是触发按钮"的外部节点 → 仍然会关(退化行为,交接段已注明宿主必须传 ignoreEl)', async () => {
    const triggerBtn = document.createElement('button')
    document.body.appendChild(triggerBtn)
    const w = mountDialogAttached({ open: true }) // 不传 ignoreEl
    triggerBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    triggerBtn.remove()
    w.unmount()
  })

  it('open:false 时点外部 → 不 emit(监听器只在打开时挂载)', async () => {
    const w = mountDialogAttached({ open: false })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    outside.remove()
    w.unmount()
  })

  it('宿主把 open 收回 false 后再点外部 → 不再触发(监听器随 watch(open) 摘除)', async () => {
    const w = mountDialogAttached({ open: true })
    // 独立 mount 不会像真实父子组件那样自动把 emit 的 update:open 接回 props——这里
    // 显式 setProps 模拟宿主收到 emit 后真的把 open 收回 false,监听器应随之摘除。
    await w.setProps({ open: false })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined() // 监听器已摘,不会再发
    outside.remove()
    w.unmount()
  })

  it('卸载时清掉 document 监听(mousedown 与 keydown 都摘除)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const w = mountDialogAttached({ open: true })
    const addedMousedown = addSpy.mock.calls.find((c) => c[0] === 'mousedown') as [string, EventListener] | undefined
    expect(addedMousedown).toBeDefined()
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedMousedown![1])
  })
})

describe('前景色合规:.save-pop-icon 是 accent 实底 + --on-accent', () => {
  it('正向断言', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--accent)')
    expect(rule?.body).toContain('color: var(--on-accent)')
  })

  // fix round 1 · I2(评审变异实证):此前 28×28/9px 零断言——把它改成 T5 .sv-modal-icon
  // 的 32×32/10px 之前 23 例仍然全绿。C11 专门点名"这两处尺寸独立核实,不能互相套用",
  // 补一条反向锚定断言钉住,防止下一次复制粘贴把两者焊到一起。
  it('.save-pop-icon 尺寸是 28×28、border-radius:9px(不是 T5 .sv-modal-icon 的 32×32/10px)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 28px')
    expect(rule?.body).toContain('height: 28px')
    expect(rule?.body).toContain('border-radius: 9px')
  })
})

// fix round 1 · I2(评审查实的第二处零断言):.save-pop 的定位/层级/尺寸契约此前没有任何
// 程序化断言(plan 明文要求非颜色视觉属性要补断言)。
describe('.save-pop 定位契约', () => {
  it('width: 360px / z-index: 50 / top: calc(100% + 8px) / right: 0', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 360px')
    expect(rule?.body).toContain('z-index: 50')
    expect(rule?.body).toContain('top: calc(100% + 8px)')
    expect(rule?.body).toContain('right: 0')
  })
})

// fix round 1 · I2(评审查实的第三处零断言,与 T12-I1 同型):三处 sparkles/x 的 glyph `d`
// 字符串此前没有任何断言钉住——"svg 存在"不足以抓住"复制粘贴时 path 抄错一个字符"这类
// 缺陷(T12-I1 的教训:改一个字符、15 例照样全绿)。逐字符核对 PhotosIcon.vue:21-22(
// sparkles)/:52(x)后钉住。
describe('glyph d 字符串(fix round 1 · I2,同 T12-I1 教训)', () => {
  it('两处 sparkles(head 28×28 图标块 + primary 按钮)与一处 x(关闭按钮)的 path d 逐字符正确', () => {
    const sparklesD = 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1'
    const xD = 'm6 6 12 12M18 6 6 18'
    const sparklesCount = searchSaveSmartViewRaw.split(sparklesD).length - 1
    expect(sparklesCount).toBe(2) // head 图标块 + primary 按钮各一处
    expect(searchSaveSmartViewRaw).toContain(xD)
    // sparkles 的 <circle> 中心圆同样逐字核对(PhotosIcon.vue:22 的第二个几何元素)。
    const circleCount = searchSaveSmartViewRaw.split('<circle cx="12" cy="12" r="3" />').length - 1
    expect(circleCount).toBe(2)
  })
})

describe('hover 级联(cssCascade)', () => {
  it('.sv-btn-primary 的 hover 胜出规则含 :hover 且含 -primary', () => {
    const style = extractStyleBlock(searchSaveSmartViewRaw)
    const win = winningHoverBackground(style, ['sv-btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-primary')
  })

  it('.sv-btn-ghost 的 hover 胜出规则含 :hover 且含 -ghost', () => {
    const style = extractStyleBlock(searchSaveSmartViewRaw)
    const win = winningHoverBackground(style, ['sv-btn-ghost'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-ghost')
  })
})

describe('C7:save-pop 过渡动画(Vue3 类名 -enter-from,不是 Vue2 的 -enter)', () => {
  it('样式块含 -enter-from/-leave-active 规则,且不含 Vue2 的裸 -enter 类', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const active = rules.find((r) => r.selectors.includes('.save-pop-enter-active') && r.selectors.includes('.save-pop-leave-active'))
    expect(active).toBeDefined()
    expect(active?.body).toContain('opacity 0.16s ease')
    expect(active?.body).toContain('transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)')
    expect(active?.body).toContain('transform-origin: top right')

    const enterFrom = rules.find((r) => r.selectors.includes('.save-pop-enter-from') && r.selectors.includes('.save-pop-leave-to'))
    expect(enterFrom).toBeDefined()
    expect(enterFrom?.body).toContain('opacity: 0')
    expect(enterFrom?.body).toContain('translateY(-4px) scale(0.97)')

    // 反向断言:不应出现 Vue2 的裸 `.save-pop-enter {`(没有 -from 后缀)——这是 T6 fix
    // round 教训过的静默失效坑。
    expect(searchSaveSmartViewRaw).not.toMatch(/\.save-pop-enter\s*[,{]/)
  })

  it('Transition 组件的 name 是 "save-pop"', () => {
    expect(searchSaveSmartViewRaw).toContain('name="save-pop"')
  })
})

describe('.sv-switch 轨道过渡 + 拇指投影(C5 的 T8 M1 修复,别再丢一次)', () => {
  it('.sv-switch 轨道背景色变化带 transition', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('transition: background 0.15s')
  })

  it('.sv-switch::after 拇指带投影(color-mix,不是字面 rgba)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/box-shadow:\s*0 1px 3px color-mix\(/)
  })

  it('.sv-switch 尺寸是 32×18、拇指 14×14、[data-on]::after left:16px(photos-smartview.scss 那份生效值,不是 photos.scss:2817-2825 的 36×20/left:18px)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const track = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(track?.body).toContain('width: 32px')
    expect(track?.body).toContain('height: 18px')
    const thumb = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(thumb?.body).toContain('width: 14px')
    expect(thumb?.body).toContain('height: 14px')
    const onThumb = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onThumb?.body).toContain('left: 16px')
  })
})
