// Task 11 (SP7-P5 人物): PersonAssetGrid.vue —— 人物详情页按月资产网格
// (多选 / 移出 / 每月展开全部)。纯展示 + emit,不碰 store,只 mock
// @nimotech/nimoos-service 的 thumbnailUrl(同 PhotosGrid.test.ts / PersonHero.test.ts
// 的既有 mock 方式)。逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPersonDetail.vue:
// 132-154(网格模板)、:760-763(assetThumb,size=large)、:868-883(选择逻辑)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PersonAssetGrid from '../PersonAssetGrid.vue'
import { assetToPhoto, type Month, type Photo } from '../../util/assetToPhoto'

function photo(
  id: string | number,
  opts: Partial<{ isVideo: boolean; durationMs: number; placeName: string }> = {},
): Photo {
  return assetToPhoto({
    id,
    mimeType: opts.isVideo ? 'video/mp4' : 'image/jpeg',
    durationMs: opts.durationMs,
    placeName: opts.placeName,
  })
}

function month(key: string, title: string, photos: Photo[]): Month {
  return { key, title, loc: '', photos }
}

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

const mounted: VueWrapper[] = []
function mountGrid(props: { months: Month[]; selected: Array<string | number>; selectionMode: boolean }) {
  const w = mount(PersonAssetGrid, { props, global: { plugins: [makeI18n()] } })
  mounted.push(w)
  return w
}

beforeEach(() => {
  svc.photos.thumbnailUrl.mockClear()
})
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

describe('PersonAssetGrid.vue — 月份头', () => {
  it('渲染 m.title 与真实总数(photosPeoplePhotosCount);首张有 place 时附加显示', () => {
    const months = [month('2026-07', 'July 2026', [photo('a', { placeName: 'Paris' }), photo('b')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.get('.person-month-head .title').text()).toBe('July 2026')
    expect(w.get('.person-month-head .sub').text()).toContain('2 张照片')
    expect(w.get('.person-month-head .sub').text()).toContain('Paris')
  })

  it('该月首张照片没有 place → 不渲染 place 段', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.get('.person-month-head .sub').text()).not.toContain('·')
  })
})

describe('PersonAssetGrid.vue — 每月展开全部(计划登记第 8 条)', () => {
  it('20 张 → 默认渲染 16 个瓦片 + 出现"查看全部 20 张";点击后渲染 20 个且文案变收起;再点回到 16', async () => {
    const photos = Array.from({ length: 20 }, (_, i) => photo(`p${i}`))
    const months = [month('2026-07', 'July 2026', photos)]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.findAll('.tile')).toHaveLength(16)
    const btn = w.get('[data-test="show-all-toggle"]')
    expect(btn.text()).toBe('查看全部 20 张')

    await btn.trigger('click')
    expect(w.findAll('.tile')).toHaveLength(20)
    expect(w.get('[data-test="show-all-toggle"]').text()).toBe('收起')

    await w.get('[data-test="show-all-toggle"]').trigger('click')
    expect(w.findAll('.tile')).toHaveLength(16)
  })

  it('恰好 16 张(边界)→ 不出现"查看全部"按钮,16 张全渲', () => {
    const photos = Array.from({ length: 16 }, (_, i) => photo(`p${i}`))
    const months = [month('2026-07', 'July 2026', photos)]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.find('[data-test="show-all-toggle"]').exists()).toBe(false)
    expect(w.findAll('.tile')).toHaveLength(16)
  })
})

describe('PersonAssetGrid.vue — 缩略图 URL', () => {
  it('瓦片 img.src 用 thumbnailUrl(id, "large"),不是 small', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('a', 'large')
    expect(w.get('.tile img').attributes('src')).toBe('mock://thumb/a/large')
  })
})

describe('PersonAssetGrid.vue — 点击与 .stop 隔离', () => {
  it('点瓦片 → emit open 带该 photo', async () => {
    const p = photo('a')
    const months = [month('2026-07', 'July 2026', [p])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    await w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([p])
  })

  it('点勾选圈 → emit toggle-select 且不 emit open(.stop 回归)', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    await w.get('.tile-check').trigger('click')
    expect(w.emitted('toggle-select')?.[0]).toEqual(['a'])
    expect(w.emitted('open')).toBeUndefined()
  })

  it('点移出按钮 → emit detach([id]) 且不 emit open(.stop 回归)', async () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    await w.get('.tile-detach').trigger('click')
    expect(w.emitted('detach')?.[0]).toEqual([['a']])
    expect(w.emitted('open')).toBeUndefined()
  })

  it('勾选圈 title 随选中状态在"选择"/"取消选择"间切换', () => {
    const months = [month('2026-07', 'July 2026', [photo('a'), photo('b')])]
    const w = mountGrid({ months, selected: ['a'], selectionMode: false })
    const boxes = w.findAll('.tile-check')
    expect(boxes[0].attributes('title')).toBe('取消选择')
    expect(boxes[1].attributes('title')).toBe('选择')
  })
})

describe('PersonAssetGrid.vue — selectionMode 时移出按钮不渲染(负向断言)', () => {
  it('selectionMode===true → 不渲染 .tile-detach;selectionMode===false → 渲染', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const wOn = mountGrid({ months, selected: [], selectionMode: true })
    expect(wOn.find('.tile-detach').exists()).toBe(false)

    const wOff = mountGrid({ months, selected: [], selectionMode: false })
    expect(wOff.find('.tile-detach').exists()).toBe(true)
  })
})

describe('PersonAssetGrid.vue — 铁律:selected 与 photo.id 类型交叉比较', () => {
  it('selected 传数字、photo.id 是字符串 → 仍判定为选中', () => {
    const months = [month('2026-07', 'July 2026', [photo('42')])]
    const w = mountGrid({ months, selected: [42], selectionMode: false })
    expect(w.get('.tile').attributes('data-selected')).toBe('true')
  })

  it('selected 传字符串、photo.id 是数字 → 仍判定为选中(反向)', () => {
    const months = [month('2026-07', 'July 2026', [photo(42)])]
    const w = mountGrid({ months, selected: ['42'], selectionMode: false })
    expect(w.get('.tile').attributes('data-selected')).toBe('true')
  })

  it('selected 为空数组 → 不判定为选中', () => {
    const months = [month('2026-07', 'July 2026', [photo('a')])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    expect(w.get('.tile').attributes('data-selected')).toBe('false')
  })
})

describe('PersonAssetGrid.vue — 空态', () => {
  it('months 为空 → 渲染 photosPersonNoPhotos 空态文案', () => {
    const w = mountGrid({ months: [], selected: [], selectionMode: false })
    expect(w.text()).toContain('这个人还没有照片')
    expect(w.find('.tile').exists()).toBe(false)
  })
})
