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
// 原始源码文本(Vite `?raw`),仅用于下方"覆盖控件默认透明"一组测试——jsdom 不做级联
// 样式计算,mount 后读不出真实 hover 态的 opacity,只能对 <style> 文本做结构断言
// (同 color-guard.test.ts 读 <style> 原文的既有先例)。
import personAssetGridRaw from '../PersonAssetGrid.vue?raw'
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

  // 协调者裁定(Vue2 :874-880 onTileClick 单一入口内分支,不下推给容器):组件已收
  // selectionMode prop,判断权留在组件内部——理由见 fix 报告 §「整格点击分支收回组件内部」。
  it('selectionMode=true 时点整格 → emit toggle-select 带该 id,且不 emit open(负向断言)', async () => {
    const p = photo('a')
    const months = [month('2026-07', 'July 2026', [p])]
    const w = mountGrid({ months, selected: [], selectionMode: true })
    await w.get('.tile').trigger('click')
    expect(w.emitted('toggle-select')?.[0]).toEqual(['a'])
    expect(w.emitted('open')).toBeUndefined()
  })

  it('selectionMode=false 时点整格 → emit open 带该 photo,且不 emit toggle-select(负向断言)', async () => {
    const p = photo('a')
    const months = [month('2026-07', 'July 2026', [p])]
    const w = mountGrid({ months, selected: [], selectionMode: false })
    await w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([p])
    expect(w.emitted('toggle-select')).toBeUndefined()
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

// 覆盖控件(.tile-check/.tile-detach)默认态透明,只在 hover/选择态可见——照 Vue2
// PhotosPersonDetail.vue:1148-1216 逐条对照,同本仓已确立先例 PhotosGrid.vue:374-376
// (.tile-check-box)。jsdom 不做级联样式计算(mount 后读不出真实 hover 结果),所以这组
// 测试直接解析 <style> 原文里的 CSS 规则结构断言,而不是断言 getComputedStyle。
interface CssRule { selectors: string[]; body: string }

function parseCssRules(styleText: string): CssRule[] {
  const rules: CssRule[] = []
  const re = /([^{}]+)\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(styleText))) {
    rules.push({
      selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean),
      body: m[2],
    })
  }
  return rules
}

function extractStyleBlock(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('未找到样式块')
  // 先剥 CSS 注释:parseCssRules 把 `{` 之前的一切当选择器列表,规则上方的注释会被并进
  // selectors,使 ownRuleBody 的"选择器列表恰好等于某一个"判定失效(终审 Minor 3 加注释时踩到)。
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '')
}

// 找到"选择器列表恰好等于给定单个选择器"的那条规则的 body(用于找元素自身默认态样式,
// 不是被其他组合选择器覆盖的可见态规则)。
function ownRuleBody(rules: CssRule[], selector: string): string {
  const hit = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === selector)
  if (!hit) throw new Error(`未找到独立规则:${selector}`)
  return hit.body
}

// 找到"选择器列表包含所有给定选择器"的那条组合规则的 body(用于找 hover/选择态强制
// 可见的那条组合规则,不要求选择器列表完全相等,允许额外选择器一起分组)。
function findRuleBodyContainingAll(rules: CssRule[], required: string[]): string | undefined {
  const hit = rules.find((r) => required.every((sel) => r.selectors.includes(sel)))
  return hit?.body
}

describe('PersonAssetGrid.vue — 覆盖控件默认态透明,仅 hover/选择态可见(照 Vue2 :1148-1216)', () => {
  const rules = parseCssRules(extractStyleBlock(personAssetGridRaw))

  it('.tile-check 默认 opacity:0(照 Vue2 :1199)', () => {
    expect(ownRuleBody(rules, '.tile-check')).toMatch(/opacity:\s*0\b/)
  })

  it('.tile-detach 默认 opacity:0(照 Vue2 :1162)', () => {
    expect(ownRuleBody(rules, '.tile-detach')).toMatch(/opacity:\s*0\b/)
  })

  it('.tile:hover 时 .tile-check 强制可见(照 Vue2 :1203-1208)', () => {
    const body = findRuleBodyContainingAll(rules, ['.tile:hover .tile-check'])
    expect(body).toBeDefined()
    expect(body).toMatch(/opacity:\s*1\b/)
  })

  it('.tile:hover 时 .tile-detach 强制可见(照 Vue2 :1168-1171)', () => {
    const body = findRuleBodyContainingAll(rules, ['.tile:hover .tile-detach'])
    expect(body).toBeDefined()
    expect(body).toMatch(/opacity:\s*1\b/)
  })

  it('selectionMode 或已选中时 .tile-check 也强制可见,不依赖 hover(照 Vue2 :1204-1205)', () => {
    const body = findRuleBodyContainingAll(rules, [
      '.tile:hover .tile-check',
      '.tile[data-selection-mode="true"] .tile-check',
      '.tile[data-selected="true"] .tile-check',
    ])
    expect(body).toBeDefined()
    expect(body).toMatch(/opacity:\s*1\b/)
  })

  it('.tile-detach 没有 selectionMode/selected 强制可见规则(照 Vue2 原文只给 tile-check 加了那两条,tile-detach 没有——照搬,不是遗漏)', () => {
    expect(findRuleBodyContainingAll(rules, ['.tile[data-selection-mode="true"] .tile-detach'])).toBeUndefined()
    expect(findRuleBodyContainingAll(rules, ['.tile[data-selected="true"] .tile-detach'])).toBeUndefined()
  })
})

// ── 终审 Minor 3:两个覆盖控件的**自身** hover 反馈 + 选中压暗 + 几何回源对齐 ──────
// 原实现只有"整格 hover → 按钮淡入",鼠标压在按钮本体上零反馈;叠上「移出」按钮又没有
// Vue2 的危险色,终审原话:这几项叠加会让**破坏性**的移出「×」认不出是删除键。
describe('PersonAssetGrid.vue — 控件自身 hover 与选中态(照 Vue2 :1148-1222)', () => {
  const rules = parseCssRules(extractStyleBlock(personAssetGridRaw))

  it('.tile-check:hover 自身变深(Vue2 :1209-1212 background + border-color)', () => {
    const body = ownRuleBody(rules, '.tile-check:hover')
    expect(body).toMatch(/background:/)
    expect(body).toMatch(/border-color:/)
  })

  it('.tile-detach:hover 自身变危险色(Vue2 :1172-1177:实底危险红 + 白图标 + 描边透明)', () => {
    const body = ownRuleBody(rules, '.tile-detach:hover')
    expect(body).toMatch(/background:\s*var\(--remove-bg\)/)
    expect(body).toMatch(/border-color:\s*transparent/)
    expect(body).toMatch(/color:/)
  })

  it('两个控件的 transition 覆盖 background(否则 hover 变色是硬切,Vue2 :1163,1202)', () => {
    expect(ownRuleBody(rules, '.tile-check')).toMatch(/transition:[^;]*background/)
    expect(ownRuleBody(rules, '.tile-detach')).toMatch(/transition:[^;]*background/)
  })

  it('选中的瓦片把图压暗 opacity .85(Vue2 :1222)', () => {
    expect(ownRuleBody(rules, '.tile[data-selected="true"] img')).toMatch(/opacity:\s*0?\.85\b/)
  })

  it('几何照 Vue2 生效值:check 20px/偏移 6px/2px 描边,detach 22px/偏移 6px + backdrop-filter', () => {
    const check = ownRuleBody(rules, '.tile-check')
    expect(check).toMatch(/width:\s*20px/)
    expect(check).toMatch(/height:\s*20px/)
    expect(check).toMatch(/top:\s*6px/)
    expect(check).toMatch(/left:\s*6px/)
    expect(check).toMatch(/border:\s*2px\s+solid/)

    const detach = ownRuleBody(rules, '.tile-detach')
    expect(detach).toMatch(/width:\s*22px/)
    expect(detach).toMatch(/height:\s*22px/)
    expect(detach).toMatch(/top:\s*6px/)
    expect(detach).toMatch(/right:\s*6px/)
    expect(detach).toMatch(/backdrop-filter:/)
  })

  it('图标标称尺寸照 Vue2 生效值:勾 12px,x 15px', () => {
    const w = mountGrid({ months: [month('2026-05', '2026 年 5 月', [photo('a1')])], selected: ['a1'], selectionMode: true })
    const check = w.get('.tile-check-icon')
    expect(check.attributes('width')).toBe('12')
    expect(check.attributes('height')).toBe('12')

    const w2 = mountGrid({ months: [month('2026-05', '2026 年 5 月', [photo('a1')])], selected: [], selectionMode: false })
    const x = w2.get('.tile-detach svg')
    expect(x.attributes('width')).toBe('15')
    expect(x.attributes('height')).toBe('15')
  })
})
