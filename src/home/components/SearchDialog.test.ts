import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { initService } from '@nimotech/nimoos-service'
import { useHomeUiStore } from '../stores/homeUi'
import SearchDialog from './SearchDialog.vue'

// reka-ui teleports DialogContent to <body>; unmount + wipe body between tests so a
// stale instance (bound to a previous pinia) can't be picked up by querySelector.
let wrapper: VueWrapper | null = null

describe('SearchDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 渲染结果里的缩略图会走 service.image.thumbUrl(纯 URL 拼接,但要求先 initService)
    initService({
      getToken: () => 'test-token',
      getRefresh: () => 'test-refresh',
      setTokens: () => {},
      onAuthFail: () => {},
      getLang: () => 'en',
    })
  })
  afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

  it('closed by default: no search box in the DOM', async () => {
    wrapper = mount(SearchDialog, { attachTo: document.body })
    await nextTick()
    expect(document.body.querySelector('.searchbox')).toBeNull()
  })

  it('renders the search box + idle suggestions when store opens it', async () => {
    const ui = useHomeUiStore()
    ui.openSearch()
    wrapper = mount(SearchDialog, { attachTo: document.body })
    await nextTick()
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    // idle state shows suggestion chips + hint
    expect(document.body.querySelectorAll('.chip').length).toBeGreaterThan(0)
    expect(document.body.textContent).toContain('输入关键词')
  })

  // 输入查询词并回车,快进过 demo 的 Searching… 延迟
  async function search(q: string): Promise<void> {
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.value = q
    input.dispatchEvent(new Event('input'))
    await nextTick()
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await nextTick()
    vi.advanceTimersByTime(1500)
    await nextTick()
  }

  it('receipts demo: descriptive query → album card of 5 OCR receipts, no doc rows', async () => {
    vi.useFakeTimers()
    try {
      const ui = useHomeUiStore()
      ui.openSearch()
      wrapper = mount(SearchDialog, { attachTo: document.body })
      await nextTick()
      await search('receipts from when I moved house last winter')
      expect(document.body.querySelectorAll('.album-thumb').length).toBe(5)
      expect(document.body.querySelector('.result')).toBeNull() // 无文档行,相册卡排第 1
      expect(document.body.textContent).toContain('OCR')
    } finally {
      vi.useRealTimers()
    }
  })

  it('fish demo still intact: other queries return doc rows + album card', async () => {
    vi.useFakeTimers()
    try {
      const ui = useHomeUiStore()
      ui.openSearch()
      wrapper = mount(SearchDialog, { attachTo: document.body })
      await nextTick()
      await search('fish')
      expect(document.body.querySelectorAll('.result').length).toBeGreaterThan(0)
      expect(document.body.textContent).toContain('fish_recipe.docx')
    } finally {
      vi.useRealTimers()
    }
  })

  it('close button clears searchOpen', async () => {
    const ui = useHomeUiStore()
    ui.openSearch()
    wrapper = mount(SearchDialog, { attachTo: document.body })
    await nextTick()
    const close = document.body.querySelector('.close-btn') as HTMLElement
    close.click()
    await nextTick()
    expect(ui.searchOpen).toBe(false)
  })
})
