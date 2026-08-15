// Task 4(顶栏重刻,D13):PhotosTopbar.vue —— 折叠按钮 + 标题/副行(恒全库计数)+ 搜索框
// 一体的顶栏。结构对应 Vue2 PhotosTopbar.vue:1-34(`.topbar` → 折叠 icon-btn → 标题块
// `.topbar-title`+`.topbar-sub` → flex:1 居中 `.search`),B 期范围收窄:不渲染
// searchMode 返回键 / upload 按钮 / Ask Nimo 按钮(brief 明示"B 期不渲染")。
//
// 副行=恒全库口径(PhotosTimeline.vue:225-234 library 分支同款):
// `t('photosCountSummary', { photos: store.photoCount.toLocaleString(), videos: store.videoCount.toLocaleString() })`,
// 组件自己消费 timeline store,不接受 sub 作为 prop——与 brief 的 Produces 接口骨架一致
// (`<PhotosTopbar :collapsed @toggle-collapse @search-submit>`,没有 sub/title props)。
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosTopbar from '../PhotosTopbar.vue'
import photosTopbarRaw from '../PhotosTopbar.vue?raw'
import { useTimelineStore } from '../../stores/timeline'
import { extractStyleBlock, parseCssRules } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountTopbar(props: Record<string, unknown> = {}) {
  return mount(PhotosTopbar, { props, global: { plugins: [i18n] } })
}

describe('结构', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('渲染 .topbar > 折叠 icon-btn + 标题块 + 居中 search', () => {
    const w = mountTopbar()
    expect(w.find('.topbar').exists()).toBe(true)
    expect(w.find('.topbar .icon-btn').exists()).toBe(true)
    expect(w.find('.topbar-title').exists()).toBe(true)
    expect(w.find('.topbar-sub').exists()).toBe(true)
    expect(w.find('.topbar .search').exists()).toBe(true)
  })

  it('折叠按钮的图标是 panelLeft(svg rect+path,逐字符对 Vue2 PhotosIcon.vue panelLeft 分支)', () => {
    const w = mountTopbar()
    const svg = w.get('.icon-btn svg')
    expect(svg.get('rect').attributes()).toMatchObject({ x: '3', y: '4', width: '18', height: '16', rx: '2' })
    expect(svg.get('path').attributes('d')).toBe('M9 4v16')
  })

  it('标题文案是 photosLibrary("照片库")', () => {
    const w = mountTopbar()
    expect(w.get('.topbar-title').text()).toBe(zh.photosLibrary)
  })

  it('搜索框:search 图标(逐字符对 Vue2 PhotosIcon.vue search 分支)+ input + kbd 提示', () => {
    const w = mountTopbar()
    const search = w.get('.search')
    expect(search.get('svg circle').attributes()).toMatchObject({ cx: '11', cy: '11', r: '7' })
    expect(search.get('svg path').attributes('d')).toBe('m20 20-3.5-3.5')
    expect(search.find('input').exists()).toBe(true)
    expect(search.get('.kbd').text()).toBe('↵')
  })

  it('搜索框 placeholder 是 photosSearchSearchBarPlaceholder 的本地化值', () => {
    const w = mountTopbar()
    expect(w.get('.search input').attributes('placeholder')).toBe(zh.photosSearchSearchBarPlaceholder)
  })

  it('折叠按钮 title 是 photosToggleSidebar("切换侧边栏")', () => {
    const w = mountTopbar()
    expect(w.get('.icon-btn').attributes('title')).toBe(zh.photosToggleSidebar)
  })

  // brief 明示 B 期不渲染 upload 按钮 / Ask Nimo 按钮(Vue2 :26-32)。
  it('不渲染 upload 按钮 / Ask Nimo 按钮(B 期范围收窄)', () => {
    const w = mountTopbar()
    expect(w.find('.btn').exists()).toBe(false)
    expect(w.find('.btn-ai').exists()).toBe(false)
    expect(w.text()).not.toContain('Ask Nimo')
  })
})

describe('副行:恒全库计数', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('渲染 store.photoCount/videoCount 的 photosCountSummary,不带 toLocaleString 时数字原样', async () => {
    const w = mountTopbar()
    const store = useTimelineStore()
    store.timelineGroups = [
      { year: 2026, month: 7, assets: [{ id: 'a', mimeType: 'image/jpeg', originalName: 'a.jpg' }] },
    ]
    await Promise.resolve()
    await w.vm.$nextTick()
    expect(w.get('.topbar-sub').text()).toBe(
      zh.photosCountSummary.replace('{photos}', String(store.photoCount)).replace('{videos}', String(store.videoCount)),
    )
  })

  // 千分位锚定:toLocaleString 在数字 >= 1000 时插入分隔符,验证组件确实调用了它而不是
  // 直接拼原始数字(brief 明确要求"with toLocaleString")。
  it('数字 >= 1000 时用 toLocaleString 千分位格式化(不是原始数字直拼)', async () => {
    const w = mountTopbar()
    const store = useTimelineStore()
    // bucketMode 分支下 photoCount/videoCount 来自 buckets 汇总(BucketMeta: year/month/
    // count/videoCount,timelineBuckets.ts:7-12)——直接铺 buckets 更贴近真实全库计数来源
    // (timeline.ts:131-145),比拼一堆 asset 更直接、也不依赖 legacy 分支细节。
    store.buckets = [{ year: 2026, month: 7, count: 1234, videoCount: 234 }]
    store.bucketMode = true
    await Promise.resolve()
    expect(store.photoCount).toBe(1000)
    expect(store.videoCount).toBe(234)
    expect(w.get('.topbar-sub').text()).toBe(
      zh.photosCountSummary.replace('{photos}', '1,000').replace('{videos}', '234'),
    )
  })
})

describe('折叠按钮 emit', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('点击折叠按钮 → emit toggle-collapse', async () => {
    const w = mountTopbar()
    await w.get('.icon-btn').trigger('click')
    expect(w.emitted('toggle-collapse')).toHaveLength(1)
  })
})

describe('搜索 submit', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('Enter → emit search-submit 带 trim 后的值', async () => {
    const w = mountTopbar()
    await w.get('.search input').setValue('  sunset  ')
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toEqual([['sunset']])
  })

  // fix round 1 · Important(owner 裁决 ledger-六-2,覆盖第一版"空串也 emit"的选择):
  // 时间线顶栏空串 Enter = 无动作,照 Vue2 自己 submitSearch(:65-69)的空串 return 守卫。
  // 只覆盖这个顶栏——PhotosSearchBar.vue 自己(PhotosSearch.vue 独立搜索页用的那个框)的
  // "空串也 emit"约定不受影响,范围不同,不是同一件事改了两次。
  it('空串 Enter → 不 emit search-submit(ledger-六-2,照 Vue2 submitSearch 空串守卫)', async () => {
    const w = mountTopbar()
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toBeUndefined()
  })

  it('全是空白 Enter → 同样不 emit(trim 后为空)', async () => {
    const w = mountTopbar()
    await w.get('.search input').setValue('   ')
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toBeUndefined()
  })
})

// Fix-1 item 1 (owner acceptance, 2026-08-13): additive title/sub/showSearch prop overrides,
// used by the five re-shelled album/for-you pages (Vue2 truth: PhotosTimeline.vue mounts the
// SAME <PhotosTopbar> for every non-people/places/upload nav, PhotosTimeline.vue:957-971, just
// feeding it per-nav title/sub and show-search — it is not a library-exclusive component).
describe('title/sub/showSearch props(额外覆盖,Fix-1 item 1)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('不传 title/sub → 保持默认行为不变(向后兼容,Photos.vue 的既有用法)', () => {
    const w = mountTopbar()
    expect(w.get('.topbar-title').text()).toBe(zh.photosLibrary)
  })

  it('传 title → 覆盖默认 photosLibrary 文案', () => {
    const w = mountTopbar({ title: zh.photosAlbumsTitle })
    expect(w.get('.topbar-title').text()).toBe(zh.photosAlbumsTitle)
  })

  it('传 sub → 覆盖默认的全库计数副行', () => {
    const w = mountTopbar({ sub: '9 个相册' })
    expect(w.get('.topbar-sub').text()).toBe('9 个相册')
  })

  it('showSearch 默认 true → 渲染搜索框(向后兼容)', () => {
    const w = mountTopbar()
    expect(w.find('.search').exists()).toBe(true)
  })

  it('showSearch=false → 不渲染搜索框,但居中包裹层仍在', () => {
    const w = mountTopbar({ showSearch: false })
    expect(w.find('.search').exists()).toBe(false)
    expect(w.find('.topbar-title').exists()).toBe(true)
  })
})

// Fix round 1 · Important 1 (Plan E Task 1 review, 2026-08-14): PhotosPlaceAssets.vue needs a
// clean way to render "no subtitle at all" (Vue2 has no topbar/sub concept for that detail
// context — see that file's own header comment). Omitting `sub` doesn't do it: the computed
// `sub` falls back to the library-wide count summary (line 87-90 above), so an omitted prop on
// a non-library page would render a wrong, stray subtitle — a real regression vs. the old
// AreaShell shell (which had no subtitle at all there). Controller ruling: an explicit empty
// string is the opt-out — `sub=""` means "render no `.topbar-sub` node", distinct from omitting
// the prop (which still means "use the library default"). This is an additive contract on a
// shared photos-area component: every existing caller that never passes `sub=''` is unaffected.
describe('sub="" 显式抑制副行(fix round 1 · Important 1,与"不传 sub"语义不同)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('sub="" → 不渲染 .topbar-sub 节点(显式 opt-out,不是"用空字符串当文案渲染出来")', () => {
    const w = mountTopbar({ sub: '' })
    expect(w.find('.topbar-sub').exists()).toBe(false)
    // 标题块本身还在,只是副行这一行被抑制,不是整个标题块都被吞掉。
    expect(w.find('.topbar-title').exists()).toBe(true)
  })

  it('不传 sub(省略)→ 与显式空串不同——仍走默认全库计数回落,.topbar-sub 照常渲染(库页行为不受影响)', () => {
    const w = mountTopbar()
    expect(w.find('.topbar-sub').exists()).toBe(true)
    expect(w.get('.topbar-sub').text()).toBe(zh.photosCountSummary.replace('{photos}', '0').replace('{videos}', '0'))
  })
})

// Fix-4 item 2 (owner acceptance, 2026-08-13): `back` prop had zero test coverage in Fix-3 —
// every other prop added that wave (title/sub/showSearch, Fix-1 item 1) got one, this one didn't.
// Mirrors Vue2 PhotosTopbar.vue:6-12's searchMode swap: `v-if="back"` renders a second icon-btn
// (chevL) in place of the title/sub block (`v-if="!back"`), emits `back` on click.
describe('back prop(额外覆盖,Fix-4 item 2)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('back 缺省(未传)→ 保持默认行为不变:标题/副行渲染,不出现返回键', () => {
    const w = mountTopbar()
    expect(w.find('.topbar-title').exists()).toBe(true)
    expect(w.find('.topbar-sub').exists()).toBe(true)
    // 折叠按钮之外只有一个 .icon-btn(没有第二个返回键)。
    expect(w.findAll('.icon-btn')).toHaveLength(1)
  })

  it('back=true → 渲染 chevL 返回键(第二个 .icon-btn),标题/副行被抑制', () => {
    const w = mountTopbar({ back: true })
    expect(w.find('.topbar-title').exists()).toBe(false)
    expect(w.find('.topbar-sub').exists()).toBe(false)
    const icons = w.findAll('.icon-btn')
    expect(icons).toHaveLength(2)
    // 逐字符对 Vue2 PhotosIcon.vue chevL 分支(SearchDatePopover.vue 的 cal-nav "上个月" 按钮
    // 已用过同一条 path,先例一致)。
    expect(icons[1]!.get('path').attributes('d')).toBe('m15 6-6 6 6 6')
  })

  it('back=true 时点第二个 .icon-btn → emit back', async () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    await icons[1]!.trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('back=true 的返回键 title 是 photosSearchBackToLibrary 的本地化值', () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    expect(icons[1]!.attributes('title')).toBe(zh.photosSearchBackToLibrary)
  })

  it('back=true 时折叠按钮(第一个 .icon-btn)仍照常 emit toggle-collapse,不受 back 影响', async () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    await icons[0]!.trigger('click')
    expect(w.emitted('toggle-collapse')).toHaveLength(1)
    expect(w.emitted('back')).toBeUndefined()
  })
})

// 非颜色视觉属性锚定(与 PhotosSearchBar.test.ts 同一约定,I5):组件自身 scoped style 里
// 唯一允许存在的规则是搜索框 FILL 的已拍板玻璃质感偏离(chip-bg/chip-border),不应该出现
// 任何 Vue2 已在 parity scss 里给出的其它视觉属性(高度/圆角/尺寸等一律让 parity 生效)。
describe('样式:scoped 块最小化(仅 FILL 偏离)', () => {
  it('.search 规则只声明 background/border-color(FILL 偏离),不重复 parity 已给的 height/border-radius', () => {
    const style = extractStyleBlock(photosTopbarRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.search')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--chip-bg)')
    expect(rule?.body).toContain('border-color: var(--chip-border)')
    expect(rule?.body).not.toContain('height')
    expect(rule?.body).not.toContain('border-radius')
  })
})
