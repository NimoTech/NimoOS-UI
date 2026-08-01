// SP7-P7a-T12: PhotosFilterPopover.vue —— 列表型筛选弹层基元。
// 弹层标记逐字比对结论(PhotosSearchView.vue:124-147 vs PhotosFilterBar.vue:25-63,任务
// 报告里有完整版):真实差异一条——滚动容器 max-height 搜索侧 280px / FilterBar 侧 260px,
// 以搜索侧为准取 280(本测试断言 280),260 的差异登记交给 P7b/T16。其余(empty 文案来源、
// label 转换来源、cancelPop 参数)New-UI 接口层面已经用 emptyHint/labelFor prop 统一抹平。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosFilterPopover from '../PhotosFilterPopover.vue'
import photosFilterPopoverRaw from '../PhotosFilterPopover.vue?raw'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

type Props = {
  title: string
  items: string[]
  selected: string[]
  searchPlaceholder: string
  emptyHint: string
  width?: number
  multiple?: boolean
  labelFor?: (item: string) => string
}

function mountPop(props: Props) {
  return mount(PhotosFilterPopover, { props, global: { plugins: [i18n] } })
}

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    title: 'File type',
    items: ['Photo', 'Video', 'RAW', 'Screenshot', 'GIF'],
    selected: [],
    searchPlaceholder: 'Search…',
    emptyHint: 'Nothing here yet',
    ...overrides,
  }
}

describe('结构', () => {
  it('渲染 .fpop / .fpop-title / .fpop-search / 列表 / 两个脚按钮', () => {
    const w = mountPop(baseProps())
    expect(w.find('.fpop').exists()).toBe(true)
    expect(w.get('.fpop-title').text()).toBe('File type')
    expect(w.find('.fpop-search').exists()).toBe(true)
    expect(w.findAll('.nav-item').length).toBe(5)
    expect(w.get('.fpop-foot').findAll('button').length).toBe(2)
  })

  it('width 默认 260;传 240 → 行内 style 是 240px', () => {
    const wDefault = mountPop(baseProps())
    expect(wDefault.get('.fpop').attributes('style')).toContain('width: 260px')
    const w240 = mountPop(baseProps({ width: 240 }))
    expect(w240.get('.fpop').attributes('style')).toContain('width: 240px')
  })

  it('items 5 条 → 5 个 .nav-item;selected 含第 2 条 → 它 data-active=true 且有 check 图标,其余 false 且无 check', () => {
    const w = mountPop(baseProps({ selected: ['Video'] }))
    const rows = w.findAll('.nav-item')
    expect(rows).toHaveLength(5)
    rows.forEach((row, i) => {
      const isVideo = baseProps().items[i] === 'Video'
      expect(row.attributes('data-active')).toBe(isVideo ? 'true' : 'false')
      expect(row.find('svg').exists()).toBe(isVideo)
    })
  })

  it('搜索过滤:输入过滤词 → 列表变短;大小写不敏感;过滤到 0 条 → 空态文案出现且列表 0 条', async () => {
    const w = mountPop(baseProps())
    await w.get('.fpop-search').setValue('vid')
    expect(w.findAll('.nav-item')).toHaveLength(1)
    expect(w.get('.nav-item').text()).toBe('Video')

    await w.get('.fpop-search').setValue('VID')
    expect(w.findAll('.nav-item')).toHaveLength(1)

    await w.get('.fpop-search').setValue('nonexistent-xyz')
    expect(w.findAll('.nav-item')).toHaveLength(0)
    expect(w.get('.fpop-empty').text()).toBe('Nothing here yet')
  })

  it('labelFor 生效:传 it => "X" + it → 渲染文本含 X', () => {
    const w = mountPop(baseProps({ labelFor: (it) => `X${it}` }))
    expect(w.get('.nav-item').text()).toContain('XPhoto')
  })
})

describe('multiple: true(默认)—— 数组增删,不原地改 prop', () => {
  it('点未选项 → update:selected 带 [...原, it]', async () => {
    const w = mountPop(baseProps({ selected: ['Photo'] }))
    const rows = w.findAll('.nav-item')
    await rows[1]!.trigger('click') // Video
    expect(w.emitted('update:selected')).toEqual([[['Photo', 'Video']]])
  })

  it('点已选项 → update:selected 带移除后的数组;原 prop 数组内容未被原地改', async () => {
    const original = ['Photo', 'Video']
    const originalSnapshot = [...original]
    const w = mountPop(baseProps({ selected: original }))
    const rows = w.findAll('.nav-item')
    await rows[0]!.trigger('click') // Photo,已选 → 移除
    expect(w.emitted('update:selected')).toEqual([[['Video']]])
    expect(original).toEqual(originalSnapshot) // 没被就地 push/splice
  })
})

describe('multiple: false —— 单选语义(照搬 Vue2 toggleDraftItem 的 v === it ? null : it)', () => {
  it('点未选项 → [it]', async () => {
    const w = mountPop(baseProps({ multiple: false, selected: [] }))
    const rows = w.findAll('.nav-item')
    await rows[2]!.trigger('click') // RAW
    expect(w.emitted('update:selected')).toEqual([[['RAW']]])
  })

  it('点已选项 → []', async () => {
    const w = mountPop(baseProps({ multiple: false, selected: ['RAW'] }))
    const rows = w.findAll('.nav-item')
    await rows[2]!.trigger('click')
    expect(w.emitted('update:selected')).toEqual([[[]]])
  })
})

describe('脚部按钮 + 冒泡', () => {
  it('点 Cancel → emit cancel;点 Apply → emit apply', async () => {
    const w = mountPop(baseProps())
    const buttons = w.get('.fpop-foot').findAll('button')
    await buttons[0]!.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    await buttons[1]!.trigger('click')
    expect(w.emitted('apply')).toHaveLength(1)
  })

  it('取消/应用按钮文案来自通用键 photosCancel / photosSearchApply(非写死"应用"二字,B3 裁定)', () => {
    const w = mountPop(baseProps())
    const buttons = w.get('.fpop-foot').findAll('button')
    expect(buttons[0]!.text()).toBe(zh.photosCancel)
    expect(buttons[1]!.text()).toBe(zh.photosSearchApply)
  })

  it('点弹层内部空白不冒泡到宿主(根 @click.stop;派发 bubbles:true 的 click 到 .fpop)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let hostClicked = false
    host.addEventListener('click', () => { hostClicked = true })
    const w = mount(PhotosFilterPopover, {
      props: baseProps(),
      global: { plugins: [i18n] },
      attachTo: host,
    })
    w.get('.fpop').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(hostClicked).toBe(false)
    w.unmount()
    host.remove()
  })
})

describe('样式', () => {
  it('cssCascade:.btn.btn-primary 的 hover 胜出规则含 :hover 且含 -primary', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['btn', 'btn-primary'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('-primary')
  })

  it('cssCascade(B4 补的第三处硬约束):.nav-item[data-active="true"] 的 hover 胜出规则含 :hover 且含 data-active', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const winner = winningHoverBackground(style, ['nav-item'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-active')
  })

  it('滚动容器(.fpop-list)有 max-height: 280px 与 overflow-y: auto(先锚定规则体,不做全文件级 toContain)', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-list')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('max-height: 280px')
    expect(rule?.body).toContain('overflow-y: auto')
  })
})
