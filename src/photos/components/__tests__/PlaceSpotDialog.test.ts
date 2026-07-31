// P6b-T4: PlaceSpotDialog.vue —— 地点详情的拍摄点弹窗(内嵌卡片,非浮层)。
// 逐条对应 task-4-brief.md「必含测试清单」。纯展示 + emit,不碰 store——只 mock
// @nimotech/nimoos-service 的 thumbnailUrl(照 PlacesRail.test.ts / PersonHero.test.ts
// 的既有 mock 手法)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { PlaceSpot } from '../../stores/places'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceSpotDialog from '../PlaceSpotDialog.vue'
import placeSpotDialogRaw from '../PlaceSpotDialog.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function spot(overrides: Partial<PlaceSpot> = {}): PlaceSpot {
  return {
    key: 's1', name: 'West Lake', lon: 120.1551, lat: 30.2741, count: 12, thumb: 't-1',
    ...overrides,
  }
}

function mountDialog(props: { spot?: PlaceSpot, busy?: boolean } = {}, i18n = makeI18n()) {
  return mount(PlaceSpotDialog, {
    props: { spot: spot(), busy: false, ...props },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

// ── 结构清点(结构规格 A.1-A.7)───────────────────────────────────────────
describe('结构清点', () => {
  it('渲染 head / 关闭钮 / 名字行 / 铅笔钮 / 坐标行 / stat 行 / thumbs / 底部整行按钮', () => {
    const w = mountDialog()
    expect(w.find('.spot-dialog-head').exists()).toBe(true)
    expect(w.find('.icon-btn').exists()).toBe(true)
    expect(w.find('.spot-dialog-name').exists()).toBe(true)
    expect(w.find('.spot-rename-btn').exists()).toBe(true)
    expect(w.find('.spot-dialog-coords').exists()).toBe(true)
    expect(w.find('.spot-dialog-stat').exists()).toBe(true)
    expect(w.find('.spot-dialog-thumbs').exists()).toBe(true)
    expect(w.find('.spot-dialog-btn').exists()).toBe(true)
  })
})

// ── 坐标行:formatSpotCoords(偏离登记 16)────────────────────────────────
describe('坐标行走 formatSpotCoords', () => {
  it('北半球东经 → N · E', () => {
    const w = mountDialog({ spot: spot({ lat: 30.2741, lon: 120.1551 }) })
    expect(w.find('.spot-dialog-coords').text()).toContain('30.274° N · 120.155° E')
  })

  it('南半球西经 → S 与 W(组件侧守卫,不照搬 Vue2 写死 N/E)', () => {
    const w = mountDialog({ spot: spot({ lat: -33.8688, lon: -43.1729 }) })
    const t = w.find('.spot-dialog-coords').text()
    expect(t).toContain('33.869° S')
    expect(t).toContain('43.173° W')
  })

  it('lat=NaN → 坐标行整行不渲染', () => {
    const w = mountDialog({ spot: spot({ lat: Number.NaN }) })
    expect(w.find('.spot-dialog-coords').exists()).toBe(false)
  })
})

// ── 编辑态进入/退出 ──────────────────────────────────────────────────────
describe('铅笔进编辑态', () => {
  it('点铅笔 → input 出现、初值等于当前名、非编辑态那一行消失', async () => {
    const w = mountDialog({ spot: spot({ name: 'West Lake' }) })
    await w.find('.spot-rename-btn').trigger('click')
    expect(w.find('.spot-dialog-name').exists()).toBe(false)
    const input = w.find('.spot-rename-input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('West Lake')
  })
})

describe('编辑态:disabled 规则', () => {
  it('空白名(仅空格)时保存钮 disabled', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('   ')
    expect((w.find('.spot-rename-save').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('busy=true 时保存钮与恢复默认钮都 disabled', async () => {
    const w = mountDialog({ busy: true })
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    expect((w.find('.spot-rename-save').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('.spot-dialog-reset').element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('提交/取消/Esc', () => {
  it('回车提交 emit rename 带 trim 后的名字', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('  New Name  ')
    await w.find('.spot-rename-input').trigger('keyup.enter')
    expect(w.emitted('rename')).toEqual([['New Name']])
  })

  it('点保存同样 emit rename 带 trim 后的名字', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('  New Name  ')
    await w.find('.spot-rename-save').trigger('click')
    expect(w.emitted('rename')).toEqual([['New Name']])
  })

  it('点取消 → 回非编辑态且不 emit', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    await w.find('.spot-rename-cancel').trigger('click')
    expect(w.find('.spot-dialog-name').exists()).toBe(true)
    expect(w.find('.spot-rename-input').exists()).toBe(false)
    expect(w.emitted('rename')).toBeUndefined()
  })

  it('按 Esc → 回非编辑态且不 emit', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    await w.find('.spot-rename-input').trigger('keyup.esc')
    expect(w.find('.spot-dialog-name').exists()).toBe(true)
    expect(w.find('.spot-rename-input').exists()).toBe(false)
    expect(w.emitted('rename')).toBeUndefined()
  })
})

describe('props.spot.key 变化时退出编辑态(照 Vue2 watch :303)', () => {
  it('先进编辑态,再换一个 spot → input 消失', async () => {
    const w = mountDialog({ spot: spot({ key: 's1', name: 'A' }) })
    await w.find('.spot-rename-btn').trigger('click')
    expect(w.find('.spot-rename-input').exists()).toBe(true)
    await w.setProps({ spot: spot({ key: 's2', name: 'B' }) })
    expect(w.find('.spot-rename-input').exists()).toBe(false)
    expect(w.find('.spot-dialog-name').exists()).toBe(true)
  })
})

describe('不持副本(偏离登记 7)', () => {
  it('改名后 props.spot.name 变化,非编辑态直接显示新名', async () => {
    const w = mountDialog({ spot: spot({ key: 's1', name: 'Old Name' }) })
    expect(w.find('.spot-dialog-name .one-line').text()).toBe('Old Name')
    await w.setProps({ spot: spot({ key: 's1', name: '新名' }) })
    expect(w.find('.spot-dialog-name .one-line').text()).toBe('新名')
  })
})

// ── D8:恢复默认名(net-new,Vue2 无对应)───────────────────────────────
describe('D8 恢复默认名', () => {
  it('点「恢复默认名」→ emit reset-name,零参数', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-dialog-reset').trigger('click')
    expect(w.emitted('reset-name')).toEqual([[]])
  })

  it('按钮文案取 photosPlacesSpotResetName', async () => {
    const w = mountDialog({}, makeI18n('en_us'))
    await w.find('.spot-rename-btn').trigger('click')
    expect(w.find('.spot-dialog-reset').text()).toBe('Reset to default name')
  })
})

// ── 缩略图 ──────────────────────────────────────────────────────────────
describe('缩略图', () => {
  it('点缩略图 → emit open-photo 带 spot.thumb', async () => {
    const w = mountDialog({ spot: spot({ thumb: 'thumb-x' }) })
    await w.find('.spot-dialog-thumbs img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['thumb-x']])
  })

  it('thumb 为空串时 img 不渲染', () => {
    const w = mountDialog({ spot: spot({ thumb: '' }) })
    expect(w.find('.spot-dialog-thumbs img').exists()).toBe(false)
  })

  it('缩略图 src 来自 service.photos.thumbnailUrl', () => {
    mountDialog({ spot: spot({ thumb: 'thumb-x' }) })
    expect(thumbnailUrl).toHaveBeenCalledWith('thumb-x', 'small')
  })
})

// ── 底部按钮 / 关闭 ─────────────────────────────────────────────────────
describe('底部整行按钮 / 关闭', () => {
  it('点底部整行按钮 → emit open-library', async () => {
    const w = mountDialog()
    await w.find('.spot-dialog-btn').trigger('click')
    expect(w.emitted('open-library')).toHaveLength(1)
  })

  it('点关闭 → emit close', async () => {
    const w = mountDialog()
    await w.find('.icon-btn').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})

// ── hover 级联(.spot-dialog-btn)───────────────────────────────────────
describe('hover 态背景', () => {
  it('.spot-dialog-btn 的 hover 背景归属含 :hover 的规则', () => {
    const style = extractStyleBlock(placeSpotDialogRaw)
    const win = winningHoverBackground(style, ['spot-dialog-btn'])
    expect(win.selector).toContain(':hover')
  })
})
