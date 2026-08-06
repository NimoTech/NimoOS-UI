// SP8-P1b Task 9 —— 块渲染器批次 B 冒烟测试:TerminalCard(running/success/error
// 三态)、SemanticSearchCard(用真实 buildSemanticSearchBlock 输出跑 tabs 切换 +
// 缩略图点击开灯箱)、SearchImageLightbox(方向键移动 index / 触发 nav 事件)。
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import { buildSemanticSearchBlock } from '../../services/searchMapper'
import TerminalCard from './TerminalCard.vue'
import SemanticSearchCard from './SemanticSearchCard.vue'
import SearchImageLightbox from './SearchImageLightbox.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const globalOpts = { plugins: [i18n] }

describe('TerminalCard', () => {
  it('running 态:显示 sandbox/shell 标题与 Running 徽标', () => {
    const w = mount(TerminalCard, {
      props: { command: 'ls -la /work', state: 'running' },
    })
    expect(w.text()).toContain('nimo-sandbox — bash')
    expect(w.text()).toContain('Running')
    expect(w.find('.term-cursor').exists()).toBe(true)
  })

  it('success 态:显示 Exited 0 与 ok 结尾', () => {
    const w = mount(TerminalCard, {
      props: { command: 'echo hi', state: 'success', exitCode: 0, lines: [{ text: 'hi' }] },
    })
    expect(w.text()).toContain('Exited 0')
    expect(w.text()).toContain('ok')
    expect(w.text()).toContain('hi')
  })

  it('error 态:显示 Exit <code> 与 failed 结尾', () => {
    const w = mount(TerminalCard, {
      props: { command: 'false', state: 'error', exitCode: 2 },
    })
    expect(w.text()).toContain('Exit 2')
    expect(w.text()).toContain('failed')
  })
})

describe('SearchImageLightbox', () => {
  const photos = [
    { id: 'p1', title: 'Sunset' },
    { id: 'p2', title: 'Mountain' },
    { id: 'p3', title: 'Lake' },
  ]

  it('渲染当前图片标题与计数', () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 1 }, global: globalOpts })
    expect(w.text()).toContain('Mountain')
    expect(w.text()).toContain('2 / 3')
  })

  it('→ 方向键在非末尾时触发 nav(1)', async () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 0 }, global: globalOpts })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await w.vm.$nextTick()
    expect(w.emitted('nav')).toEqual([[1]])
  })

  it('← 方向键在起始位置不触发 nav', async () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 0 }, global: globalOpts })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await w.vm.$nextTick()
    expect(w.emitted('nav')).toBeUndefined()
  })

  it('Escape 触发 close', async () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 0 }, global: globalOpts })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeTruthy()
  })

  it('点击下一张按钮触发 nav(1)', async () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 0 }, global: globalOpts })
    await w.find('.sil-next').trigger('click')
    expect(w.emitted('nav')).toEqual([[1]])
  })
})

describe('SemanticSearchCard', () => {
  // 用真实 searchMapper 构造 fixture,与生产环境的数据形状保持一致。
  const parsed = {
    groups: {
      images: [
        { asset_id: 'a1', name: 'sunset.jpg', path: '/Gallery/sunset.jpg', score: 0.95, taken_at: '2026-06-01', thumbnail_url: '/thumb/a1' },
        { asset_id: 'a2', name: 'lake.jpg', path: '/Gallery/lake.jpg', score: 0.88, taken_at: '2026-06-02', thumbnail_url: '/thumb/a2' },
      ],
      filenames: [
        { name: 'invoice.pdf', path: '/Documents/invoice.pdf', ext: 'pdf', match: 0.8, size: 1024, mtime_ms: 1, is_dir: false },
      ],
      semantic: [
        { paths: [{ path: '/Documents/notes.md' }], file_id: 'f1', mime: 'text/markdown', score: 0.91, preview: { text: 'some matching passage text' } },
      ],
    },
    stats: { total_candidates: 4, fileindex_status: 'ready' },
    warnings: [],
  }
  const block = buildSemanticSearchBlock(parsed, 'sunset lake')!

  function mountCard() {
    // block.type is not a prop of SemanticSearchCard — strip it like BlockRenderer's v-bind would still pass it through harmlessly (extra attr).
    return mount(SemanticSearchCard, { props: block as unknown as Record<string, unknown>, global: globalOpts })
  }

  it('mapper 产出非空 block,且卡片渲染 query/total', () => {
    expect(block).not.toBeNull()
    const w = mountCard()
    expect(w.text()).toContain('sunset lake')
    expect(w.text()).toContain('4')
  })

  it('点击 Photos tab 切换到 image 分区', async () => {
    const w = mountCard()
    const tabBtns = w.findAll('.semcard-tab-btn')
    // tabs 顺序:all, image, file, semantic(按 fixture 数据都非空)
    expect(tabBtns.length).toBe(4)
    await tabBtns[1].trigger('click')
    expect(w.find('.semcard-image-grid').exists()).toBe(true)
  })

  it('点击图片缩略图打开灯箱', async () => {
    const w = mountCard()
    expect(w.findComponent(SearchImageLightbox).exists()).toBe(false)
    await w.find('.semcard-img-thumb').trigger('click')
    expect(w.findComponent(SearchImageLightbox).exists()).toBe(true)
    expect(w.find('.sil-overlay').exists()).toBe(true)
  })

  it('点击文件行打开详情抽屉', async () => {
    const w = mountCard()
    await w.find('.semcard-filerow-v2').trigger('click')
    expect(w.find('.sfd-modal').exists()).toBe(true)
  })

  it('点击"查看全部结果"打开 SearchFullResults', async () => {
    const w = mountCard()
    await w.find('.semcard-foot-link').trigger('click')
    expect(w.find('.sfr-modal').exists()).toBe(true)
  })
})
