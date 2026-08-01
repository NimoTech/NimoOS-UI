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

type Props = { open: boolean; query: string; conditions: string[]; defaultName: string }

function baseProps(overrides: Partial<Props> = {}): Props {
  return { open: false, query: 'sunset in tokyo', conditions: ['scene: sunset', 'place: Japan'], defaultName: 'Sunset Trips', ...overrides }
}

function mountDialog(props: Partial<Props> = {}, i18n = makeI18n()) {
  return mount(SearchSaveSmartView, { props: baseProps(props), global: { plugins: [i18n] } })
}

function fullSv(overrides: Partial<SmartView> = {}): SmartView {
  return {
    id: 'sv-new', name: 'X', description: '', conds: [], threshold: 80, live: true, includeVideos: false,
    count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: new Array(10).fill(0),
    evaluatedAt: '', ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
  vi.restoreAllMocks()
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

    expect(w.emitted('saved')).toEqual([['sv-abc']])
    expect(w.emitted('update:open')).toEqual([[false]])
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

describe('前景色合规:.save-pop-icon 是 accent 实底 + --on-accent', () => {
  it('正向断言', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--accent)')
    expect(rule?.body).toContain('color: var(--on-accent)')
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
