// The timeline selection action bar moves off the earlier Files-style
// `.selection-toolbar` rectangle onto the Vue2 pixel-parity floating glass pill
// (`.selectbar`/`.selectbar-count`/`.selectbar-btn`, parity scss
// src/photos/styles/vue2-parity/photos.scss:444-468).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PhotosSelectionToolbar from '../PhotosSelectionToolbar.vue'

const i18n = createI18n({
  legacy: false, locale: 'zh_cn',
  messages: {
    zh_cn: {
      photosSelectedCount: '已选择 {count} 项',
      photosDelete: '删除',
      photosAddToAlbum: '加入相册',
      photosClose: '关闭',
      photosAskNimo: '问 Nimo',
    },
  },
})

describe('PhotosSelectionToolbar', () => {
  it('shows the selected count via photosSelectedCount', () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 3 }, global: { plugins: [i18n] } })
    expect(w.get('.selectbar-count').text()).toBe('已选择 3 项')
  })

  // Button set: Add to Album / Delete / Ask Nimo /
  // close(x) — no Favorite (deliberately cut from scope, see component header comment).
  it('renders as the Vue2 glass pill .selectbar with exactly four .selectbar-btn buttons', () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    expect(w.find('.selectbar').exists()).toBe(true)
    expect(w.findAll('.selectbar-btn')).toHaveLength(4)
  })

  // Vue2's close (x) icon button replaces P1's leading text "Cancel" button, but keeps
  // emitting `clear` (renaming the emit is a host-contract change, out of scope here).
  it('clicking the close (x) button emits clear (not delete/add-to-album)', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    await w.get('[data-test="selectbar-close"]').trigger('click')
    expect(w.emitted('clear')).toBeTruthy()
    expect(w.emitted('delete')).toBeUndefined()
    expect(w.emitted('add-to-album')).toBeUndefined()
  })

  it('clicking the delete button (data-danger) emits delete (not clear/add-to-album)', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    const del = w.get('[data-test="selectbar-delete"]')
    expect(del.attributes('data-danger')).toBe('true')
    await del.trigger('click')
    expect(w.emitted('delete')).toBeTruthy()
    expect(w.emitted('clear')).toBeUndefined()
    expect(w.emitted('add-to-album')).toBeUndefined()
  })

  // The "Add to Album" button sits between count and delete, non-danger; click only emits add-to-album (regression).
  // Order: Add to Album → Delete → Ask Nimo → close — matches Vue2
  // PhotosGrid.vue:114-126 with Favorite (already cut in this repo) removed from the front.
  it('"Add to Album" sits between count and delete, non-danger, click only emits add-to-album', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    const btns = w.findAll('.selectbar-btn')
    expect(btns[0]!.attributes('data-test')).toBe('selectbar-add-album')
    expect(btns[1]!.attributes('data-test')).toBe('selectbar-delete')
    expect(btns[2]!.attributes('data-test')).toBe('selectbar-ask-nimo')
    expect(btns[3]!.attributes('data-test')).toBe('selectbar-close')
    expect(btns[0]!.attributes('data-danger')).toBeUndefined()
    await btns[0]!.trigger('click')
    expect(w.emitted('add-to-album')).toBeTruthy()
    expect(w.emitted('clear')).toBeUndefined()
    expect(w.emitted('delete')).toBeUndefined()
  })

  // Ask Nimo button — data-ai="true" (Vue2 PhotosGrid.vue:120), emits
  // ask-nimo only, not clear/delete/add-to-album.
  it('clicking the Ask Nimo button (data-ai) emits ask-nimo (not clear/delete/add-to-album)', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    const ask = w.get('[data-test="selectbar-ask-nimo"]')
    expect(ask.attributes('data-ai')).toBe('true')
    await ask.trigger('click')
    expect(w.emitted('ask-nimo')).toBeTruthy()
    expect(w.emitted('clear')).toBeUndefined()
    expect(w.emitted('delete')).toBeUndefined()
    expect(w.emitted('add-to-album')).toBeUndefined()
  })
})

// Minimal repro (uses the globally-installed real i18n plugin from
// vitest.setup.ts, not the local zh_cn stub above — photosAskNimo already exists in
// src/i18n/*.photos.ts, pre-staged earlier).
describe('PhotosSelectionToolbar — ask-nimo action', () => {
  it('renders an Ask Nimo button that emits ask-nimo on click', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 3 } })
    await w.find('[data-test="selectbar-ask-nimo"]').trigger('click')
    expect(w.emitted('ask-nimo')).toBeTruthy()
  })
})
