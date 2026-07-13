import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useHomeUiStore } from '../stores/homeUi'
import SearchDialog from './SearchDialog.vue'

// reka-ui teleports DialogContent to <body>; unmount + wipe body between tests so a
// stale instance (bound to a previous pinia) can't be picked up by querySelector.
let wrapper: VueWrapper | null = null

describe('SearchDialog', () => {
  beforeEach(() => setActivePinia(createPinia()))
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
