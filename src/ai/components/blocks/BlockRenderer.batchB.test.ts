// SP8-P1b Task 9 — Block renderer batch B smoke tests: TerminalCard(running/success/error
// three states), SemanticSearchCard(use real buildSemanticSearchBlock output to run tab switching +
// thumbnail click opens lightbox), SearchImageLightbox(arrow key moves index / triggers nav event).
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
  it('running state: shows sandbox/shell title and Running badge', () => {
    const w = mount(TerminalCard, {
      props: { command: 'ls -la /work', state: 'running' },
    })
    expect(w.text()).toContain('nimo-sandbox — bash')
    expect(w.text()).toContain('Running')
    expect(w.find('.term-cursor').exists()).toBe(true)
  })

  it('success state: shows Exited 0 and ok ending', () => {
    const w = mount(TerminalCard, {
      props: { command: 'echo hi', state: 'success', exitCode: 0, lines: [{ text: 'hi' }] },
    })
    expect(w.text()).toContain('Exited 0')
    expect(w.text()).toContain('ok')
    expect(w.text()).toContain('hi')
  })

  it('error state: shows Exit <code> and failed ending', () => {
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

  it('render current image title and count', () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 1 }, global: globalOpts })
    expect(w.text()).toContain('Mountain')
    expect(w.text()).toContain('2 / 3')
  })

  it('→ arrow key triggers nav(1) when not at end', async () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 0 }, global: globalOpts })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await w.vm.$nextTick()
    expect(w.emitted('nav')).toEqual([[1]])
  })

  it('← arrow key does not trigger nav when at start', async () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 0 }, global: globalOpts })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await w.vm.$nextTick()
    expect(w.emitted('nav')).toBeUndefined()
  })

  it('Escape triggers close', async () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 0 }, global: globalOpts })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeTruthy()
  })

  it('clicking next button triggers nav(1)', async () => {
    const w = mount(SearchImageLightbox, { props: { photos, index: 0 }, global: globalOpts })
    await w.find('.sil-next').trigger('click')
    expect(w.emitted('nav')).toEqual([[1]])
  })
})

describe('SemanticSearchCard', () => {
  // use real searchMapper to construct fixture, keep data shape consistent with production environment.
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

  it('mapper produces non-empty block, and card renders query/total', () => {
    expect(block).not.toBeNull()
    const w = mountCard()
    expect(w.text()).toContain('sunset lake')
    expect(w.text()).toContain('4')
  })

  it('clicking Photos tab switches to image section', async () => {
    const w = mountCard()
    const tabBtns = w.findAll('.semcard-tab-btn')
    // tabs order: all, image, file, semantic (all non-empty per fixture data)
    expect(tabBtns.length).toBe(4)
    await tabBtns[1].trigger('click')
    expect(w.find('.semcard-image-grid').exists()).toBe(true)
  })

  it('clicking image thumbnail opens lightbox', async () => {
    const w = mountCard()
    expect(w.findComponent(SearchImageLightbox).exists()).toBe(false)
    await w.find('.semcard-img-thumb').trigger('click')
    expect(w.findComponent(SearchImageLightbox).exists()).toBe(true)
    expect(w.find('.sil-overlay').exists()).toBe(true)
  })

  it('clicking file row opens detail drawer', async () => {
    const w = mountCard()
    await w.find('.semcard-filerow-v2').trigger('click')
    expect(w.find('.sfd-modal').exists()).toBe(true)
  })

  it('clicking "view all results" opens SearchFullResults', async () => {
    const w = mountCard()
    await w.find('.semcard-foot-link').trigger('click')
    expect(w.find('.sfr-modal').exists()).toBe(true)
  })
})
