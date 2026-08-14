// SP7-P7a-T15: PhotosSearchGrid.vue —— 搜索结果双档网格(最佳匹配 + 折叠长尾)+
// 无限滚动 sentinel。逐条对应 task-15-brief.md「必含测试清单」B 段(除已挪去
// SearchResultTile.test.ts 的 tile 级断言外)。只 mock @nimotech/nimoos-service 的
// thumbnailUrl;IntersectionObserver 用 stub(afterEach 复原,防渗漏到别的测试文件)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { ScoredPhoto } from '../../util/searchSort'
import { assetToPhoto, type Photo } from '../../util/assetToPhoto'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PhotosSearchGrid from '../PhotosSearchGrid.vue'
import photosSearchGridRaw from '../PhotosSearchGrid.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function photo(id: string, overrides: Partial<Photo> = {}): Photo {
  return { ...assetToPhoto({ id, mimeType: 'image/jpeg' }), ...overrides }
}

function scored(id: string, score: number | null = 0.9, overrides: Partial<Photo> = {}): ScoredPhoto {
  return { p: photo(id, overrides), score }
}

function mountGrid(
  props: Partial<{
    best: ScoredPhoto[]
    more: ScoredPhoto[]
    moreExpanded: boolean
    showSentinel: boolean
    loadingMore: boolean
  }> = {},
  i18n = makeI18n(),
) {
  return mount(PhotosSearchGrid, {
    props: {
      best: [], more: [], moreExpanded: false, showSentinel: false, loadingMore: false,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

let ioInstances: Array<{ cb: (e: { isIntersecting: boolean }[]) => void; observeCalls: number; disconnectCalls: number }>

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
  ioInstances = []
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    inst: { cb: (e: { isIntersecting: boolean }[]) => void; observeCalls: number; disconnectCalls: number }
    constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
      this.inst = { cb, observeCalls: 0, disconnectCalls: 0 }
      ioInstances.push(this.inst)
    }
    observe() { this.inst.observeCalls++ }
    disconnect() { this.inst.disconnectCalls++ }
  }
})

afterEach(() => {
  delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
})

describe('最佳匹配网格', () => {
  it('best 3 条 → 第一个 .grid 下 3 个 .tile', () => {
    const w = mountGrid({ best: [scored('1'), scored('2'), scored('3')] })
    const grids = w.findAll('.grid')
    expect(grids).toHaveLength(1)
    expect(grids[0].findAll('.tile')).toHaveLength(3)
  })

  it('more 为空 → 无 .more-results-bar、无第二个 grid', () => {
    const w = mountGrid({ best: [scored('1')], more: [] })
    expect(w.find('.more-results-bar').exists()).toBe(false)
    expect(w.findAll('.grid')).toHaveLength(1)
  })
})

describe('折叠长尾(more-results-bar)', () => {
  it('more 2 条 + moreExpanded:false → 折叠条在,文案含 2,无第二个 grid、无 sentinel', () => {
    const w = mountGrid({ more: [scored('a'), scored('b')], moreExpanded: false })
    expect(w.find('.more-results-bar').exists()).toBe(true)
    expect(w.get('.more-results-bar').text()).toContain('2')
    // best 的第一个 .grid 是无条件渲染的容器(即使 best 为空、里面没有 tile),
    // 只有 more 的第二个 .grid 受 moreExpanded 门控——折叠时应恰好只有 1 个 .grid。
    expect(w.findAll('.grid')).toHaveLength(1)
    expect(w.findAll('.tile')).toHaveLength(0)
    expect(w.find('.load-more-sentinel').exists()).toBe(false)
  })

  it('best 非空 + more 非空 + 折叠 → 只有一个 grid(best 的),第二个未渲染', () => {
    const w = mountGrid({ best: [scored('x')], more: [scored('a'), scored('b')], moreExpanded: false })
    expect(w.findAll('.grid')).toHaveLength(1)
  })

  it('点折叠条 → emit update:moreExpanded 带 true', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: false })
    w.get('.more-results-bar').trigger('click')
    expect(w.emitted('update:moreExpanded')?.[0]).toEqual([true])
  })

  it('moreExpanded:true 时再点一次 → emit update:moreExpanded 带 false', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true })
    w.get('.more-results-bar').trigger('click')
    expect(w.emitted('update:moreExpanded')?.[0]).toEqual([false])
  })

  it('moreExpanded:true → 第二个 grid 有 2 个 tile', () => {
    const w = mountGrid({ more: [scored('a'), scored('b')], moreExpanded: true })
    const grids = w.findAll('.grid')
    // best 的第一个 .grid 恒渲染(此处 best 为空、无 tile),展开后 more 的第二个
    // .grid 才出现——共 2 个 .grid 容器,tile 全在第二个里。
    expect(grids).toHaveLength(2)
    expect(grids[1].findAll('.tile')).toHaveLength(2)
  })

  // fix round 1 · I1(评审 Important 必修):折叠条的 chevD/chevR 只测过存在与否,
  // 从未断言过 `d` 属性字符串本身——评审变异把 chevD 的 `d` 末位 `6-6`→`6-5` 后 50 例
  // 全绿,证明这条护栏此前不存在。glyph `d` 逐字符抄自 Vue2 PhotosIcon.vue 对应分支
  // (chevD: `m6 9 6 6 6-6`;chevR: `m9 6 6 6-6 6`),两态各断一次。
  it('moreExpanded:false → chevR 的 path d 与 PhotosIcon.vue 逐字符一致', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: false })
    expect(w.get('.more-results-bar svg path').attributes('d')).toBe('m9 6 6 6-6 6')
  })
  it('moreExpanded:true → chevD 的 path d 与 PhotosIcon.vue 逐字符一致', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true })
    expect(w.get('.more-results-bar svg path').attributes('d')).toBe('m6 9 6 6 6-6')
  })
})

describe('sentinel(v-if 门控,拆卸即断开观察器的手段)', () => {
  it('showSentinel:true + expanded → sentinel 在', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: true })
    expect(w.find('.load-more-sentinel').exists()).toBe(true)
  })
  it('showSentinel:false → sentinel 不在', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: false })
    expect(w.find('.load-more-sentinel').exists()).toBe(false)
  })
  it('loadingMore:true → .load-more-status 在,文案正确', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: true, loadingMore: true })
    expect(w.get('.load-more-status').text()).toBe('正在加载更多…')
  })
  it('loadingMore:false → .load-more-status 不在', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: true, loadingMore: false })
    expect(w.find('.load-more-status').exists()).toBe(false)
  })
})

describe('sentinel 触发 → load-more(useInfiniteScroll 接线,onHit 直接 emit,不额外节流)', () => {
  it('IO 回调 isIntersecting:true → emit load-more', async () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: true })
    await w.vm.$nextTick()
    expect(ioInstances).toHaveLength(1)
    ioInstances[0].cb([{ isIntersecting: true }])
    expect(w.emitted('load-more')).toHaveLength(1)
  })
})

describe('打开照片:tile 的 open 事件透传', () => {
  it('点击 best 网格里的 tile → emit open 带对应 photo', () => {
    const r = scored('55')
    const w = mountGrid({ best: [r] })
    w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([r.p])
  })

  // best 网格与 more 网格是两处独立的 @open 绑定(两份 SearchResultTile v-for),
  // 只测 best 那份测不出 more 那份漏绑/接错——两处都要各测一次。
  it('点击 more 网格(展开态)里的 tile → emit open 带对应 photo', () => {
    const r = scored('66')
    const w = mountGrid({ more: [r], moreExpanded: true })
    w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([r.p])
  })
})

describe('thumbnailUrl 尺寸口径', () => {
  it("传给 thumbnailUrl 的尺寸参数是 'small'(plan 明文规定)", () => {
    mountGrid({ best: [scored('9')] })
    expect(thumbnailUrl).toHaveBeenCalledWith('9', 'small')
  })
})

// ── 两条腿审计:滚动容器 + more-results-bar hover + 死 CSS 未迁 ──────────────
describe('样式', () => {
  const styleText = extractStyleBlock(photosSearchGridRaw)

  it('样式文本非空(防守卫静默空转)', () => {
    expect(styleText.trim().length).toBeGreaterThan(0)
  })

  it('.photos-wrap 规则体含 overflow-y: auto / position: relative(先锚定规则体再断言属性)', () => {
    const m = /\.photos-wrap\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .photos-wrap 规则体').toBeTruthy()
    expect(m![1]).toMatch(/overflow-y:\s*auto/)
    // fix round 1 · M-1(评审并入):D7 原文漏了 photos.scss:300 的 position:relative,
    // 补齐后钉住,防再次静默丢弃。
    expect(m![1]).toMatch(/position:\s*relative/)
  })

  it('.photos-wrap::-webkit-scrollbar 规则体含 display: none(M-1,滚动条隐藏,手法对齐本仓既有惯例而非 Vue2 字面 width:0)', () => {
    const m = /\.photos-wrap::-webkit-scrollbar\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .photos-wrap::-webkit-scrollbar 规则体').toBeTruthy()
    expect(m![1]).toMatch(/display:\s*none/)
  })

  it('.grid 规则体照 PhotosGrid.vue 的默认(comfortable)列宽策略——D2 偏离登记:不是 Vue2 固定 7 列', () => {
    const m = /(?<!\[data-density[^{]*)\.grid\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .grid 规则体').toBeTruthy()
    expect(m![1]).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(140px,\s*1fr\)\)/)
    expect(m![1]).toMatch(/gap:\s*4px/)
  })

  // 2026-08-13 回退(Fix-3 item 7 追加执行):.more-results-bar(+:hover)/.load-more-sentinel/
  // .load-more-status 已从本组件的 scoped style 里整体删除,交给 vue2-parity/photos.scss 的
  // 裸选择器接管——原地断言这套规则已经不在本组件里,hover 的保障改为核对共享 parity 文件。
  it('本组件 scoped style 不再含 .more-results-bar/.load-more-sentinel/.load-more-status 规则(已整体移交 parity)', () => {
    const selectors = [...styleText.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim())
    expect(selectors.some((s) => s.includes('more-results-bar'))).toBe(false)
    expect(selectors.some((s) => s.includes('load-more-sentinel'))).toBe(false)
    expect(selectors.some((s) => s.includes('load-more-status'))).toBe(false)
  })

  it('parity scss:.more-results-bar hover 时生效的 background 是 --surface-3', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const win = winningHoverBackground(parityScss, ['more-results-bar'])
    expect(win.selector).toContain(':hover')
    expect(win.value).toContain('--surface-3')
  })

  it('.match-badge 不在样式块里(死 CSS,scss:2728-2738 未迁,反向断言)', () => {
    expect(styleText).not.toMatch(/\.match-badge/)
  })
})
