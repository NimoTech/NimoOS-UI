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

  // 与 PhotosSearchBar.vue 已拍板的"空串也 emit"先例一致(见该文件头注释)——Photos.vue
  // 现有 onSearchSubmit 依赖这个语义区分"提交空串仍导航到预搜索态"与"完全没提交"两种情况
  // (Photos.integration.test.ts 既有断言),本组件延续同一约定,不是照搬 Vue2 PhotosTopbar
  // 自己 submitSearch 的空串 return 守卫(登记为刻意的一致性选择,不是漏改)。
  it('空串也 emit search-submit(与 PhotosSearchBar 既有约定一致,保留 Photos.vue 既有路由语义)', async () => {
    const w = mountTopbar()
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toEqual([['']])
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
