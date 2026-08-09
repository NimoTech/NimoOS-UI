// SP7-P7a-T5: SmartViewCreateDialog.vue —— 智能视图创建弹窗测试。逐条对应
// task-5-brief.md 「必含用例」清单。挂 Pinia + i18n(真实 zh_cn/en_us 词条),mock 共享包
// @nimotech/nimoos-service(只用到 thumbnailUrl),用真实 usePhotosSmartViews() store——
// 直接读写 store.preview / store.createBusy 驱动右栏与按钮态,createSmartView 用
// vi.spyOn 控制成功/失败(照本区既有先例:AlbumPickerDialog.test.ts 端到端走真实 store,
// 但本组件的"确认创建"结果需要精确控制,直接 spyOn store 方法比再绕一层 service mock
// 更直接)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import SmartViewCreateDialog from '../SmartViewCreateDialog.vue'
import smartViewCreateDialogRaw from '../SmartViewCreateDialog.vue?raw'
import { usePhotosSmartViews, type SmartView } from '../../stores/smartViews'
import { useToast } from '../../../stores/toast'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function mountDialog(
  props: { open?: boolean; embedded?: boolean; initialName?: string } = {},
  i18n = makeI18n(),
) {
  return mount(SmartViewCreateDialog, {
    props: { open: false, ...props },
    global: { plugins: [i18n] },
  })
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
  svc.photos.thumbnailUrl.mockClear()
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
  vi.restoreAllMocks()
})

// ── 结构清点(brief Step1 第一条:6 段左栏 + 4 段右栏 + 5 模板 + foot 两钮)───────────
describe('结构清点', () => {
  it('open:false → scrim 不渲染', () => {
    const w = mountDialog({ open: false })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
  })

  it('open:true → scrim 渲染,且左栏 6 段 / 右栏 4 段 / 5 模板 / foot 两钮都存在', async () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    // 左栏 6 段
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-desc-textarea"]').exists()).toBe(true)
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunset in tokyo')
    expect(w.find('.sv-suggest').exists()).toBe(true) // 建议区(desc 非空时出现)
    expect(w.find('.sv-chip-bin').exists()).toBe(true)
    expect(w.find('[data-test="pts-range"]').exists()).toBe(true)
    expect(w.findAll('.sv-switch')).toHaveLength(2)
    // 右栏 4 段
    expect(w.find('.sv-preview-head').exists()).toBe(true)
    expect(w.find('.sv-preview-count').exists()).toBe(true)
    expect(w.find('.sv-preview-grid').exists()).toBe(true)
    expect(w.find('.sv-preview-help').exists()).toBe(true)
    // 5 模板
    expect(w.findAll('.sv-template-row')).toHaveLength(5)
    // foot 两钮
    expect(w.find('.sv-btn-ghost').exists()).toBe(true)
    expect(w.find('[data-test="sv-confirm-btn"]').exists()).toBe(true)
  })
})

// ── 持久挂载坑:draft 重置走 watch,不走 onMounted ──────────────────────────────
describe('draft 重置走 watch(持久挂载坑)', () => {
  it('打开→填 name→关闭→再打开 → name 已重置为空', async () => {
    const w = mountDialog({ open: false })
    await w.setProps({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('My View')
    expect((w.find('[data-test="sv-name-input"]').element as HTMLInputElement).value).toBe('My View')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="sv-name-input"]').element as HTMLInputElement).value).toBe('')
  })
})

// ── Nimo 建议 chips ──────────────────────────────────────────────────────────
describe('Nimo 建议', () => {
  it('desc = "sunset in tokyo" → 出现 scene: sunset 与 place: Japan 两条建议', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunset in tokyo')
    const chips = w.findAll('.sv-suggest-chip').map((c) => c.text())
    expect(chips).toContain('+ scene: sunset')
    expect(chips).toContain('+ place: Japan')
  })

  it('点一个建议 → 进 chip-bin 且从建议区消失,refreshPreview 被调', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunset in tokyo')
    spy.mockClear()
    const chip = w.findAll('.sv-suggest-chip').find((c) => c.text() === '+ scene: sunset')
    expect(chip).toBeDefined()
    await chip!.trigger('click')
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: sunset'))).toBe(true)
    expect(w.findAll('.sv-suggest-chip').some((c) => c.text() === '+ scene: sunset')).toBe(false)
    expect(spy).toHaveBeenCalled()
  })
})

// ── chip 增删 ──────────────────────────────────────────────────────────────
describe('chip 增删', () => {
  it('输入 "scene: x" + Enter → chip-bin 多一项、input 清空,refreshPreview 被调', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    spy.mockClear()
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: x')
    await input.trigger('keydown.enter')
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: x'))).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(spy).toHaveBeenCalled()
  })

  it('输入含逗号 → 同样提交一个 chip', async () => {
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: y')
    await input.trigger('keydown', { key: ',' })
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: y'))).toBe(true)
  })

  it('重复输入同一条 → chip 不重复', async () => {
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: z')
    await input.trigger('keydown.enter')
    await input.setValue('scene: z')
    await input.trigger('keydown.enter')
    expect(w.findAll('.sv-chip-item').filter((c) => c.text().includes('scene: z'))).toHaveLength(1)
  })

  it('点 .sv-chip-x → 移除该 chip,refreshPreview 被调', async () => {
    const store = usePhotosSmartViews()
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: gone')
    await input.trigger('keydown.enter')
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: gone'))).toBe(true)
    const spy = vi.spyOn(store, 'refreshPreview')
    await w.find('.sv-chip-x').trigger('click')
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: gone'))).toBe(false)
    expect(spy).toHaveBeenCalled()
  })
})

// ── 占位文案二态 + hint ────────────────────────────────────────────────────
describe('chip 输入占位文案二态', () => {
  it('chips 为空 → 占位是 photosSvTypeConditionEG,hint 出现', () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="sv-chip-input"]').attributes('placeholder')).toBe(zh.photosSvTypeConditionEG)
    expect(w.text()).toContain(zh.photosSvPressEnterAddPick.replace('{enter}', 'Enter'))
  })

  it('chips 非空 → 占位变成 photosSvAddAnother,hint 消失', async () => {
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: a')
    await input.trigger('keydown.enter')
    expect(w.find('[data-test="sv-chip-input"]').attributes('placeholder')).toBe(zh.photosSvAddAnother)
    expect(w.text()).not.toContain(zh.photosSvPressEnterAddPick.replace('{enter}', 'Enter'))
  })
})

// ── 阈值滑块 + preview-help 三档 ───────────────────────────────────────────
describe('阈值滑块', () => {
  it('拖到 92 → .sv-thresh-val 显示 ≥ 92%,refreshPreview 被调', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    spy.mockClear()
    const range = w.find('[data-test="pts-range"]')
    await range.setValue('92')
    expect(w.find('.sv-thresh-val').text()).toContain('92%')
    expect(spy).toHaveBeenCalled()
  })

  it('92 → strict 文案;60 → loose 文案;75(与边界 88/65)→ balanced 文案', async () => {
    const w = mountDialog({ open: true })
    const range = w.find('[data-test="pts-range"]')
    await range.setValue('92')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvStrictOnlyHighestConfidence)
    await range.setValue('60')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvLooseExpectSomeFalse)
    await range.setValue('75')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvBalancedHealthyMixCertainty)
    // 边界:88 与 65 都落 balanced(else 分支)
    await range.setValue('88')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvBalancedHealthyMixCertainty)
    await range.setValue('65')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvBalancedHealthyMixCertainty)
  })
})

// ── threshMuted:空表单不算失效 ─────────────────────────────────────────────
describe('threshMuted', () => {
  it('thresholdActive=false + chips/desc 都空 → hint 不出现', () => {
    const store = usePhotosSmartViews()
    store.preview = { count: 0, seeds: [], thresholdActive: false }
    const w = mountDialog({ open: true })
    expect(w.text()).not.toContain(zh.photosSvCurrentConditionsMatchExactly)
  })

  it('同样 thresholdActive=false,但加一条 chip → hint 出现', async () => {
    const store = usePhotosSmartViews()
    store.preview = { count: 0, seeds: [], thresholdActive: false }
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: x')
    await input.trigger('keydown.enter')
    expect(w.text()).toContain(zh.photosSvCurrentConditionsMatchExactly)
  })
})

// ── 两个开关:accessible name + live 不触发/videos 触发 refreshPreview ───────
describe('两个开关', () => {
  it('都有 role=switch / aria-checked / aria-label,且随状态变', async () => {
    const w = mountDialog({ open: true })
    const live = w.find('[data-test="sv-switch-live"]')
    expect(live.attributes('role')).toBe('switch')
    expect(live.attributes('aria-checked')).toBe('true') // draft.live 默认 true
    expect(live.attributes('aria-label')).toBeTruthy()
    await live.trigger('click')
    expect(live.attributes('aria-checked')).toBe('false')

    const videos = w.find('[data-test="sv-switch-videos"]')
    expect(videos.attributes('role')).toBe('switch')
    expect(videos.attributes('aria-checked')).toBe('false') // 默认 false
    expect(videos.attributes('aria-label')).toBeTruthy()
  })

  it('点 includeVideos → refreshPreview 被调', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    spy.mockClear()
    await w.find('[data-test="sv-switch-videos"]').trigger('click')
    expect(spy).toHaveBeenCalled()
  })

  it('点 live → refreshPreview 未被调(照搬 Vue2 :127)', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    spy.mockClear()
    await w.find('[data-test="sv-switch-live"]').trigger('click')
    expect(spy).not.toHaveBeenCalled()
  })
})

// ── 模板:descEn 契约(T1) ───────────────────────────────────────────────────
describe('模板', () => {
  it('点第 1 个模板行 → name/desc 变 i18n 值、thresh 变 75、chips 由 descEn 推出(含 family gathering)', async () => {
    const w = mountDialog({ open: true })
    await w.findAll('.sv-template-row')[0]!.trigger('click')
    expect((w.find('[data-test="sv-name-input"]').element as HTMLInputElement).value).toBe(zh.photosSvFamilyWeekends)
    expect((w.find('[data-test="sv-desc-textarea"]').element as HTMLTextAreaElement).value).toBe(zh.photosSvFamilyWeekendsPark)
    expect(w.find('.sv-thresh-val').text()).toContain('75%')
    const chipTexts = w.findAll('.sv-chip-item').map((c) => c.text())
    expect(chipTexts.length).toBeGreaterThan(0)
    expect(chipTexts.length).toBeLessThanOrEqual(4)
    expect(chipTexts.some((c) => c.includes('scene: family gathering'))).toBe(true)
  })
})

// ── canSubmit ────────────────────────────────────────────────────────────
describe('canSubmit', () => {
  it('name 空 → primary disabled', () => {
    const w = mountDialog({ open: true })
    expect((w.find('[data-test="sv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('name 有值但 chips 与 desc 都空 → 仍 disabled', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    expect((w.find('[data-test="sv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('name + desc → 可点', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    await w.find('[data-test="sv-desc-textarea"]').setValue('bar')
    expect((w.find('[data-test="sv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('store.createBusy = true → disabled(即便其余条件满足)', async () => {
    const store = usePhotosSmartViews()
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    await w.find('[data-test="sv-desc-textarea"]').setValue('bar')
    store.createBusy = true
    await w.vm.$nextTick()
    expect((w.find('[data-test="sv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})

// ── confirm 成功/失败 ───────────────────────────────────────────────────────
describe('confirm', () => {
  it('成功:createSmartView 收到的对象逐字段断言(含 description: undefined),emit created + update:open(false)', async () => {
    const store = usePhotosSmartViews()
    const created = fullSv({ id: 'sv-123' })
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(created)
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('  Foo  ')
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: a')
    await input.trigger('keydown.enter')
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledWith({
      name: 'Foo',
      description: undefined,
      conds: ['scene: a'],
      threshold: 80,
      live: true,
      includeVideos: false,
    })
    expect(w.emitted('created')).toEqual([['sv-123']])
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('desc 非空时 description 是 trim 后的字符串,不是 undefined', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv())
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    await w.find('[data-test="sv-desc-textarea"]').setValue('  bar desc  ')
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ description: 'bar desc' }))
  })

  it('失败:createSmartView reject → toast.show 被调、update:open 未发出(弹窗不关)', async () => {
    const store = usePhotosSmartViews()
    vi.spyOn(store, 'createSmartView').mockRejectedValue(new Error('boom'))
    const toastSpy = vi.spyOn(useToast(), 'show')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    await w.find('[data-test="sv-desc-textarea"]').setValue('bar')
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    // 直接断言 toast.show 被调(不是只靠"没有 update:open"这种间接信号)——删掉 confirm()
    // 的 catch 会让这里从"确实调用了 toast"变成"promise 未处理地 reject",这条断言能
    // 干净地抓住那个差异,而不必依赖 vitest 的 unhandled-rejection 检测(那个检测虽然也会
    // 让整个测试文件以非零退出码收场,但不会挂在某一条具体断言上)。
    expect(toastSpy).toHaveBeenCalledWith(zh.photosAlbumCreateFailed)
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    errSpy.mockRestore()
  })
})

// ── 关闭入口 ────────────────────────────────────────────────────────────────
describe('关闭', () => {
  it('点关闭按钮 → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-close-btn"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('点 Cancel → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('.sv-btn-ghost').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('点 scrim 自身(click.self)→ emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-modal-scrim"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

// ── hover 级联(cssCascade)───────────────────────────────────────────────────
describe('hover 态背景', () => {
  it('.sv-btn-primary 的 hover 背景归属含 :hover 且含 -primary 的规则', () => {
    const style = extractStyleBlock(smartViewCreateDialogRaw)
    const win = winningHoverBackground(style, ['sv-btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-primary')
  })

  it('.sv-btn-ghost 的 hover 背景归属含 :hover 且含 -ghost 的规则', () => {
    const style = extractStyleBlock(smartViewCreateDialogRaw)
    const win = winningHoverBackground(style, ['sv-btn-ghost'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-ghost')
  })
})

// ── 前景色合规:.sv-modal-icon 是本组件里唯一按 brief 字面要求正向断言的 --on-accent
// 用法(其余两处 --on-accent 用法——.sv-switch[data-on] 的滑块、.sv-btn-primary 的文字——
// 是本任务的回源发现/既有先例延伸,已在组件文件头注释与任务报告里登记,不在此重复断言,
// 避免断言与"文件头注释"重复维护两套真相)。其余压照片的元素本组件没有
// (.sv-preview-grid img 是纯图,无覆盖文字)。────────────────────────────────
describe('前景色合规', () => {
  it('.sv-modal-icon 用 --accent 实底 + --on-accent 前景', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-modal-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--accent)')
    expect(rule?.body).toContain('color: var(--on-accent)')
  })
})

// ── 窄屏规则 ────────────────────────────────────────────────────────────────
describe('窄屏规则', () => {
  it('样式块含 max-width: 768px,且 .sv-modal-body 在该媒体块内改单列', () => {
    expect(smartViewCreateDialogRaw).toContain('max-width: 768px')
    const m = /@media \(max-width: 768px\)\s*\{([\s\S]*?)\n\}/.exec(smartViewCreateDialogRaw)
    expect(m, '未找到窄屏媒体块').not.toBeNull()
    const rules = parseCssRules(m![1])
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-modal-body')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('grid-template-columns: 1fr')
  })
})

// ══════════════════════════════ Fix round 1 ══════════════════════════════

// ── I2:模板行 sparkles 图标色 ────────────────────────────────────────────────
describe('模板行图标色(fix round 1 · I2)', () => {
  it('.sv-template-row svg 用 --accent-text,不是继承容器前景色(容器自己是 --fg)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-template-row svg')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('color: var(--accent-text)')
  })
})

// ── I3:另两处 --on-accent 正向断言(.sv-modal-icon 那条已在「前景色合规」describe 里)──
describe('前景色合规补充(fix round 1 · I3:另两处 --on-accent 正向断言)', () => {
  it('.sv-switch[data-on="true"] 用 --accent 实底,::after 滑块用 --on-accent 前景', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const bgRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]')
    expect(bgRule).toBeDefined()
    expect(bgRule?.body).toContain('background: var(--accent)')
    const knobRule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(knobRule).toBeDefined()
    expect(knobRule?.body).toContain('background: var(--on-accent)')
  })

  it('.sv-btn-primary 用 --accent 实底 + --on-accent 前景', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-btn-primary')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--accent)')
    expect(rule?.body).toContain('color: var(--on-accent)')
  })
})

// ── M1:Esc 关闭(此前未申报的 net-new,已补登记 + 用例)───────────────────────
describe('Esc 关闭(fix round 1 · M1)', () => {
  it('open:true 时按 Esc → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('open:false 时按 Esc → 不 emit(document 监听器只在打开时挂载)', async () => {
    const w = mountDialog({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// ── M5:.sv-preview-grid 的 img 渲染路径此前零覆盖(33 例里 seeds 恒为空)───────
describe('preview-grid 渲染(fix round 1 · M5)', () => {
  it('store.preview.seeds 非空 → 渲染对应数量 img,src 来自 thumbnailUrl(seed,"large"),带 loading=lazy', () => {
    const store = usePhotosSmartViews()
    store.preview = { count: 2, seeds: ['seed-a', 'seed-b'], thresholdActive: true }
    const w = mountDialog({ open: true })
    const imgs = w.findAll('.sv-preview-grid img')
    expect(imgs).toHaveLength(2)
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('seed-a', 'large')
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('seed-b', 'large')
    expect(imgs[0]!.attributes('loading')).toBe('lazy')
  })
})

// ── M6:自动聚焦(brief 结构规格第 3 条明写)+ 键盘可操作性此前零断言 ───────────
describe('自动聚焦(fix round 1 · M6)', () => {
  it('open:true → 名称输入框自动获得焦点', async () => {
    const w = mount(SmartViewCreateDialog, {
      props: { open: true },
      global: { plugins: [makeI18n()] },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.find('[data-test="sv-name-input"]').element)
    w.unmount()
  })
})

describe('开关键盘可操作性(fix round 1 · M6,自加的 tabindex + Enter/Space)', () => {
  it('两个开关都有 tabindex=0,且 Enter/Space 都能切换', async () => {
    const w = mountDialog({ open: true })
    const live = w.find('[data-test="sv-switch-live"]')
    expect(live.attributes('tabindex')).toBe('0')
    await live.trigger('keydown.enter')
    expect(live.attributes('aria-checked')).toBe('false')
    await live.trigger('keydown.space')
    expect(live.attributes('aria-checked')).toBe('true')
  })
})

// ── M7:onUnmounted 此前没调 store.cancelPreview()(离开路由时孤儿预览请求)───
describe('卸载(fix round 1 · M7)', () => {
  it('组件卸载 → store.cancelPreview() 被调', () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'cancelPreview')
    const w = mountDialog({ open: true })
    w.unmount()
    expect(spy).toHaveBeenCalled()
  })
})

// ══════════════════════════════ Fix round 2(task-8 评审同批发现,控制器授权连本文件
// 一起补)══════════════════════════════

// ── M1:.sv-switch 漏了 photos.scss:2819-2820 那份低优先级规则贡献的 transition/box-shadow ──
describe('.sv-switch 轨道过渡 + 拇指投影(fix round 2 · M1)', () => {
  it('.sv-switch 轨道背景色变化带 transition', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('transition: background 0.15s')
  })

  it('.sv-switch::after 拇指带投影(color-mix 复刻,不是字面 rgba)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/box-shadow:\s*0 1px 3px color-mix\(/)
  })
})

// ══════════════════════════ SP15-P2b Task 4: embedded mode ══════════════════════════
// Vue2 939a7d3a:PhotosSmartAlbumCreate.vue:20-21 (two-layer wrapper), :232-241 (props),
// :271-277 (effectiveName/canSubmit), :325 (onScrimClick). The Albums page mounts this
// dialog embedded in place of its own footer when the "Let Nimo draft it" fill option is
// picked; standalone mode (PhotosSmartViews.vue's own mount) is untouched.
describe('embedded mode (SP15-P2b Task 4)', () => {
  it('embedded mode drops its own scrim, header and name field', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-close-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(false)
  })

  // Final fix wave: focus went to nameInputRef unconditionally, and in embedded mode that ref
  // is null (the name field is v-if="!embedded"), so opening the fused panel focused nothing.
  it('focuses the description in embedded mode, the name field otherwise', async () => {
    const embedded = mount(SmartViewCreateDialog, {
      props: { open: false, embedded: true, initialName: 'Trip' },
      global: { plugins: [makeI18n()] },
      attachTo: document.body,
    })
    await embedded.setProps({ open: true })
    await nextTick()
    expect(document.activeElement).toBe(embedded.find('[data-test="sv-desc-textarea"]').element)
    embedded.unmount()

    const standalone = mount(SmartViewCreateDialog, {
      props: { open: false },
      global: { plugins: [makeI18n()] },
      attachTo: document.body,
    })
    await standalone.setProps({ open: true })
    await nextTick()
    expect(document.activeElement).toBe(standalone.find('[data-test="sv-name-input"]').element)
    standalone.unmount()
  })

  it('embedded mode submits the host-supplied name, live as the host edits it', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: '' })
    // Empty host name => cannot submit even with a description present.
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunsets')
    expect(w.find('[data-test="sv-confirm-btn"]').attributes('disabled')).toBeDefined()
    // The host field is the single source of truth, not a copy seeded on open, so a name
    // typed after picking the nimo option still arrives.
    await w.setProps({ initialName: 'Trip' })
    expect(w.find('[data-test="sv-confirm-btn"]').attributes('disabled')).toBeUndefined()
    const store = usePhotosSmartViews()
    const createSmartView = vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv())
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    expect(createSmartView).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trip' }))
  })

  it('standalone mode still owns its scrim, header and name field', () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(true)
  })

  it('embedded mode does not close on a click inside its own root', async () => {
    // The host panel owns the scrim; a stray self-click here must not shut the panel.
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    await w.find('[data-test="sv-embed-host"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('embedded mode leaves Escape to the host', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    // Also assert 'close' was never emitted, not just 'update:open': dismiss() itself already
    // branches on embedded and would emit 'close' if this listener fired, so checking
    // update:open alone cannot tell "the listener never fired" apart from "it fired and took
    // the embedded branch" -- both leave update:open undefined either way.
    expect(w.emitted('close')).toBeUndefined()
  })

  it('embedded mode emits close (not update:open) on successful create', async () => {
    const store = usePhotosSmartViews()
    vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv({ id: 'sv-embed-1' }))
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunsets')
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeTruthy()
    expect(w.emitted('created')).toEqual([['sv-embed-1']])
    expect(w.emitted('update:open')).toBeUndefined()
  })

  // SP15-P2b Task 4 review fix round 1 · Important: in embedded mode the ghost Cancel
  // button is the *only* way to back out without submitting -- it is not gated by
  // v-if="!embedded" the way the header close button and Name field are, and the Escape
  // listener is never attached in embedded mode (see the test above), so it cannot cover
  // this path either. This was previously untested: dismiss()'s embedded branch and
  // confirm()'s success-path embedded branch used to be two separately-written copies of
  // the same decision, and only the confirm() copy had a test.
  it('embedded mode emits close (not update:open) when Cancel is clicked', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    await w.find('.sv-btn-ghost').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('embedded mode uses the "Create Smart Album" label, standalone keeps "Create Smart View"', () => {
    const embedded = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    expect(embedded.find('[data-test="sv-confirm-btn"]').text()).toContain(zh.photosSvCreateSmartAlbum)
    const standalone = mountDialog({ open: true })
    expect(standalone.find('[data-test="sv-confirm-btn"]').text()).toContain(zh.photosSvCreateSmartView)
  })
})
