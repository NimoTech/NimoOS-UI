// P6b-T7: PlaceCoverPicker.vue —— 地点详情"设置封面"全屏弹层(标签页/搜索/8 列候选
// 网格/分页/恢复默认)。逐条对应 task-7-brief.md「必含测试清单」。纯展示 + emit,
// 不碰 store——只 mock @nimotech/nimoos-service 的 thumbnailUrl(照 PlaceSpotDialog.test.ts
// / PlacesRail.test.ts 的既有 mock 手法)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { CoverCandidates } from '../../stores/places'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceCoverPicker from '../PlaceCoverPicker.vue'
// 原始源码文本(Vite `?raw`):hover 级联 + 颜色合规两组测试要解析 <style> 原文——
// jsdom 既不做级联样式计算也无法进入真实 hover 态(同 PlacesRail.test.ts 既有先例)。
import placeCoverPickerRaw from '../PlaceCoverPicker.vue?raw'
import { extractStyleBlock, hoverBackgroundRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function candidates(over: Partial<CoverCandidates> = {}): CoverCandidates {
  return {
    tabs: [
      { id: 'recent', label: 'Recent', icon: 'clock', count: 12 },
      { id: 'top', label: 'Top rated', icon: 'sparkles', count: 34 },
      { id: 'fav', label: 'Favorited', icon: 'star', count: 5 },
      { id: 'all', label: 'All', icon: 'grid', count: 120 },
    ],
    items: ['a1', 'a2', 'a3'],
    page: 0,
    totalPages: 5,
    total: 88,
    ...over,
  }
}

function mountPicker(props: Partial<InstanceType<typeof PlaceCoverPicker>['$props']> = {}, i18n = makeI18n()) {
  return mount(PlaceCoverPicker, {
    props: {
      open: true,
      city: 'Hangzhou',
      totalCount: 100,
      currentAssetId: '',
      candidates: candidates(),
      tab: 'recent',
      search: '',
      page: 0,
      busy: false,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

// ── open 开关 ───────────────────────────────────────────────────────────
describe('open 开关', () => {
  it('open=false → 整层不渲染', () => {
    const w = mountPicker({ open: false })
    expect(w.find('.cp-scrim').exists()).toBe(false)
  })

  it('open=true → .cp-scrim 与 .cp-shell 都在', () => {
    const w = mountPicker({ open: true })
    expect(w.find('.cp-scrim').exists()).toBe(true)
    expect(w.find('.cp-shell').exists()).toBe(true)
  })
})

// ── 结构清点 ─────────────────────────────────────────────────────────────
describe('结构清点', () => {
  it('head:thumb / title / sub / close 各就位', () => {
    const w = mountPicker()
    expect(w.find('.cp-head-thumb').exists()).toBe(true)
    expect(w.find('.cp-head-title').exists()).toBe(true)
    expect(w.find('.cp-head-sub').exists()).toBe(true)
    expect(w.find('.cp-close-btn').exists()).toBe(true)
  })

  it('tabs 数 = candidates.tabs.length,search input 就位', () => {
    const w = mountPicker()
    expect(w.findAll('[data-test="cp-tab"]').length).toBe(4)
    expect(w.find('.cp-search input').exists()).toBe(true)
  })

  it('grid:cell 数 = items 长度', () => {
    const w = mountPicker({ candidates: candidates({ items: ['a1', 'a2', 'a3', 'a4'] }) })
    expect(w.findAll('[data-test="cp-cell"]').length).toBe(4)
  })

  it('foot:reset / info / 两个 pager 各就位', () => {
    const w = mountPicker()
    expect(w.find('.cp-reset-btn').exists()).toBe(true)
    expect(w.find('.cp-foot-info').exists()).toBe(true)
    expect(w.find('[data-test="cp-page-prev"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-page-next"]').exists()).toBe(true)
  })

  it('currentAssetId 为空时,头部缩略图不渲染 img', () => {
    const w = mountPicker({ currentAssetId: '' })
    expect(w.find('.cp-head-thumb img').exists()).toBe(false)
  })

  it('currentAssetId 非空时,头部缩略图渲染 img', () => {
    const w = mountPicker({ currentAssetId: 'hero-1' })
    expect(w.find('.cp-head-thumb img').exists()).toBe(true)
  })
})

// ── 标题/副标题插值 ───────────────────────────────────────────────────────
describe('标题/副标题插值', () => {
  it("city='杭州'、totalCount=12345 → 标题含杭州、副标题含千分位 12,345", () => {
    const w = mountPicker({ city: '杭州', totalCount: 12345 })
    expect(w.find('.cp-head-title').text()).toContain('杭州')
    expect(w.find('.cp-head-sub').text()).toContain('12,345')
  })
})

// ── 标签文案回落链(照搬 Vue2 :374-377)───────────────────────────────────
describe('标签文案回落链三档', () => {
  it("t.id='recent' → 中文「近期」", () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 1 }] }),
    })
    expect(w.find('[data-test="cp-tab"]').text()).toContain('近期')
  })

  it("t.id='zzz', label='Zzz'(无对应 i18n 键)→ 回落 label", () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'zzz', label: 'Zzz', icon: 'clock', count: 1 }] }),
    })
    expect(w.find('[data-test="cp-tab"]').text()).toContain('Zzz')
  })

  it("t.id='zzz' 无 label → 回落 id 本身", () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'zzz', label: '', icon: 'clock', count: 1 }] }),
    })
    expect(w.find('[data-test="cp-tab"]').text()).toContain('zzz')
  })
})

// ── cp-tab-count 千分位缩写(照搬 Vue2 :1284)──────────────────────────────
describe('cp-tab-count 缩写', () => {
  // 偏离登记(回源核对):brief 给的手算"Math.round(1234/100)/10 = 12.3"有误——
  // 1234/100=12.34,Math.round(12.34)=12,12/10=1.2,真实结果是 "1.2k"。已按 Vue2
  // 源码 :1284 的公式原样照搬实现,以源码为准,这里改用手算校对过的正确期望值。
  it('count=1234 → 文本 1.2k(Math.round(1234/100)/10 = 1.2,回源核对已登记)', () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 1234 }] }),
    })
    expect(w.find('.cp-tab-count').text()).toBe('1.2k')
  })

  it('count=999 → 原样显示 999(边界,不进 k 分支)', () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 999 }] }),
    })
    expect(w.find('.cp-tab-count').text()).toBe('999')
  })
})

// ── 图标分支(后端契约 clock/sparkles/star/grid,未知回落通用图标)───────────
describe('标签图标分支', () => {
  it('四个已知 icon 名各命中对应 data-test,未知值回落 fallback', () => {
    const w = mountPicker({
      candidates: candidates({
        tabs: [
          { id: 'a', label: 'A', icon: 'clock', count: 1 },
          { id: 'b', label: 'B', icon: 'sparkles', count: 1 },
          { id: 'c', label: 'C', icon: 'star', count: 1 },
          { id: 'd', label: 'D', icon: 'grid', count: 1 },
          { id: 'e', label: 'E', icon: 'mystery-icon', count: 1 },
        ],
      }),
    })
    expect(w.find('[data-test="cp-tab-ico-clock"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-tab-ico-sparkles"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-tab-ico-star"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-tab-ico-grid"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-tab-ico-fallback"]').exists()).toBe(true)
  })
})

// ── 当前封面打勾(String 归一守卫)─────────────────────────────────────────
describe('当前封面打勾', () => {
  it('currentAssetId 为数字 7、items 含字符串 "7" → 该 cell 有 .is-active 且含 .cp-cell-check', () => {
    const w = mountPicker({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 刻意传入数字模拟外部越界输入(brief 要求)
      currentAssetId: 7 as any,
      candidates: candidates({ items: ['6', '7', '8'] }),
    })
    const cells = w.findAll('[data-test="cp-cell"]')
    expect(cells[1].classes()).toContain('is-active')
    expect(cells[1].find('.cp-cell-check').exists()).toBe(true)
    expect(cells[0].classes()).not.toContain('is-active')
    expect(cells[2].classes()).not.toContain('is-active')
  })
})

// ── 点击/忙碌态 ───────────────────────────────────────────────────────────
describe('点 cell / busy 态', () => {
  it('点 cell → emit pick 带 String(assetId)', async () => {
    const w = mountPicker({ candidates: candidates({ items: ['a1', 'a2'] }) })
    await w.findAll('[data-test="cp-cell"]')[1].trigger('click')
    expect(w.emitted('pick')).toEqual([['a2']])
  })

  it('busy=true 时所有 cell 与 reset 钮 disabled', () => {
    const w = mountPicker({ busy: true, candidates: candidates({ items: ['a1', 'a2'] }) })
    for (const cell of w.findAll('[data-test="cp-cell"]'))
      expect((cell.element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('.cp-reset-btn').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('点 reset 钮 → emit reset', async () => {
    const w = mountPicker()
    await w.find('.cp-reset-btn').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })
})

// ── 空态 ─────────────────────────────────────────────────────────────────
describe('空态', () => {
  it('items=[] → .cp-empty 出现且文案含查询词,.cp-grid 不渲染', () => {
    const w = mountPicker({ search: '西湖', candidates: candidates({ items: [] }) })
    expect(w.find('.cp-empty').exists()).toBe(true)
    expect(w.find('.cp-empty').text()).toContain('西湖')
    expect(w.find('.cp-grid').exists()).toBe(false)
  })
})

// ── 分页 ─────────────────────────────────────────────────────────────────
describe('分页', () => {
  it('page=0 → 上一页 disabled', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ totalPages: 5 }) })
    expect((w.find('[data-test="cp-page-prev"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('page = totalPages - 1 → 下一页 disabled', () => {
    const w = mountPicker({ page: 4, candidates: candidates({ totalPages: 5 }) })
    expect((w.find('[data-test="cp-page-next"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('点下一页 → emit update:page 带 page+1', async () => {
    const w = mountPicker({ page: 2, candidates: candidates({ totalPages: 5 }) })
    await w.find('[data-test="cp-page-next"]').trigger('click')
    expect(w.emitted('update:page')).toEqual([[3]])
  })

  it('点上一页 → emit update:page 带 page-1', async () => {
    const w = mountPicker({ page: 2, candidates: candidates({ totalPages: 5 }) })
    await w.find('[data-test="cp-page-prev"]').trigger('click')
    expect(w.emitted('update:page')).toEqual([[1]])
  })

  it('totalPages=1 时两个 pager 都 disabled', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ totalPages: 1 }) })
    expect((w.find('[data-test="cp-page-prev"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-test="cp-page-next"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  // 删码清单 ④:钳制 Math.max(0, page - 1) 的专项断言。原生 disabled 按钮在真实浏览器里
  // 挡得住点击,但组件处理函数本身也必须夹紧——这里绕开 vue-test-utils 的 trigger()(它对
  // disabled 元素不派发),改用原生 dispatchEvent 直接触发 click 监听器,与"是否 disabled"
  // 这件事解耦,专门验证钳制逻辑本身(brief 删码清单 ④ 的兜底方案:disabled 属性 + emit
  // 参数一起钉)。
  it('page=0 时强制派发 click(绕过 disabled)→ emit 的 page 不为负(Math.max 钳制)', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ totalPages: 5 }) })
    w.find('[data-test="cp-page-prev"]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const emitted = w.emitted('update:page')
    expect(emitted).toEqual([[0]])
  })
})

// ── 页码信息 ─────────────────────────────────────────────────────────────
describe('页码信息', () => {
  it('total=88, page=0, totalPages=5 → 文本含 88、1、5(page 显示 +1)', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ total: 88, totalPages: 5 }) })
    const text = w.find('.cp-foot-info').text()
    expect(text).toContain('88')
    expect(text).toContain('1')
    expect(text).toContain('5')
  })
})

// ── 搜索 / 标签点击 ───────────────────────────────────────────────────────
describe('搜索与标签', () => {
  it('输入西湖 → emit update:search 带西湖', async () => {
    const w = mountPicker()
    await w.find('.cp-search input').setValue('西湖')
    expect(w.emitted('update:search')).toEqual([['西湖']])
  })

  it('点标签 → emit update:tab 带 t.id', async () => {
    const w = mountPicker()
    const tabs = w.findAll('[data-test="cp-tab"]')
    await tabs[2].trigger('click')
    expect(w.emitted('update:tab')).toEqual([['fav']])
  })
})

// ── 关闭三路 ─────────────────────────────────────────────────────────────
describe('关闭三路', () => {
  it('点 .cp-close-btn → emit close', async () => {
    const w = mountPicker()
    await w.find('.cp-close-btn').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('点 scrim 空白处(click.self)→ emit close', async () => {
    const w = mountPicker()
    await w.find('.cp-scrim').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('点 .cp-shell 内部 → 不 emit close', async () => {
    const w = mountPicker()
    await w.find('.cp-shell').trigger('click')
    expect(w.emitted('close')).toBeUndefined()
  })

  it('Esc(document 派发,bubbles:true)→ emit close', async () => {
    const w = mountPicker()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('非 Escape 键不触发关闭', async () => {
    const w = mountPicker()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeUndefined()
  })
})

// ── Esc 监听生命周期 ─────────────────────────────────────────────────────
describe('Esc 监听生命周期', () => {
  it('open 由 true→false 后再派发 Esc 不再 emit', async () => {
    const w = mountPicker({ open: true })
    await w.setProps({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeUndefined()
  })

  it('unmount() 后同样不 emit(断言 removeEventListener 被调)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountPicker({ open: true })
    const added = addSpy.mock.calls.find(c => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(added).toBeDefined()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', added![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// ── cssCascade:hover 态背景不被基类规则夺走 ────────────────────────────────
describe('hover 态背景不被基类规则夺走(删码 ⑦)', () => {
  it('.cp-tab.is-active 的 hover 背景归属含 :hover 的变体规则', () => {
    const styleText = extractStyleBlock(placeCoverPickerRaw)
    const win = winningHoverBackground(styleText, ['cp-tab', 'is-active'])
    expect(win.selector).toContain('is-active')
    expect(win.selector).toContain(':hover')
  })

  it('.cp-tab.is-active 有一条专属 :hover 规则,优先级严格高于基类 .cp-tab:hover', () => {
    const styleText = extractStyleBlock(placeCoverPickerRaw)
    const rules = hoverBackgroundRules(styleText, ['cp-tab', 'is-active'])
    const baseHover = rules.find(r => r.selector === '.cp-tab:hover')
    const activeHover = rules.find(r => r.selector !== '.cp-tab:hover' && r.selector.includes('is-active') && r.selector.includes(':hover'))
    expect(baseHover).toBeDefined()
    expect(activeHover).toBeDefined()
    expect(activeHover!.specificity).toBeGreaterThan(baseHover!.specificity)
  })

  it('.cp-cell.is-active 的 hover 背景归属含 :hover 的变体规则', () => {
    const styleText = extractStyleBlock(placeCoverPickerRaw)
    const win = winningHoverBackground(styleText, ['cp-cell', 'is-active'])
    expect(win.selector).toContain('is-active')
    expect(win.selector).toContain(':hover')
  })

  it('.cp-cell.is-active 有一条专属 :hover 规则,优先级严格高于基类 .cp-cell:hover', () => {
    const styleText = extractStyleBlock(placeCoverPickerRaw)
    const rules = hoverBackgroundRules(styleText, ['cp-cell', 'is-active'])
    const baseHover = rules.find(r => r.selector === '.cp-cell:hover')
    const activeHover = rules.find(r => r.selector !== '.cp-cell:hover' && r.selector.includes('is-active') && r.selector.includes(':hover'))
    expect(baseHover).toBeDefined()
    expect(activeHover).toBeDefined()
    expect(activeHover!.specificity).toBeGreaterThan(baseHover!.specificity)
  })
})

// ── 颜色合规 ─────────────────────────────────────────────────────────────
describe('颜色合规', () => {
  it('.cp-cell-check 规则含 --on-accent(背景为 accent 实底,允许用法)', () => {
    const style = extractStyleBlock(placeCoverPickerRaw)
    const m = /\.cp-cell-check\s*\{([^}]*)\}/.exec(style)
    expect(m, '未找到 .cp-cell-check 规则').not.toBeNull()
    expect(m![1]).toContain('--on-accent')
  })

  it('全样式块无字面 #/rgba(/rgb( 字面量(除带 theme-exception 的行——本组件预期不需要任何豁免)', () => {
    const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(placeCoverPickerRaw)
    expect(styleMatch).not.toBeNull()
    const lines = styleMatch![1].split('\n')
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(?:rgba?|hsla?)\s*\(/
    function stripVar(s: string): string {
      let out = ''; let i = 0
      while (i < s.length) {
        if (s.startsWith('var(', i)) {
          let depth = 0; let j = i + 3
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') { depth--; if (depth === 0) { j++; break } }
          }
          i = j
        } else { out += s[i]; i++ }
      }
      return out
    }
    let exempt = false
    lines.forEach((line, idx) => {
      if (line.includes('theme-exception')) exempt = true
      const bare = stripVar(line)
      if (HEX.test(bare) || FUNC.test(bare))
        expect(exempt, `L${idx + 1} 裸颜色字面量缺 theme-exception 豁免: ${line.trim()}`).toBe(true)
      if (line.includes(';') || line.includes('}')) exempt = false
    })
  })
})

// ── 英文 locale sanity ───────────────────────────────────────────────────
describe('英文 locale sanity', () => {
  it('en_us 下标题/副标题/占位符切到英文', () => {
    const w = mountPicker({ city: 'Hangzhou', totalCount: 100 }, makeI18n('en_us'))
    expect(w.find('.cp-head-title').text()).toContain('Hangzhou')
    expect(w.find('.cp-search input').attributes('placeholder')).toBeTruthy()
  })
})
