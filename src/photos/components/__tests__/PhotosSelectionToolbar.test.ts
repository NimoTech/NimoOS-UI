// Plan B Task 7: the timeline selection action bar moves off the P1 Files-style
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
    },
  },
})

describe('PhotosSelectionToolbar', () => {
  it('shows the selected count via photosSelectedCount', () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 3 }, global: { plugins: [i18n] } })
    expect(w.get('.selectbar-count').text()).toBe('已选择 3 项')
  })

  // B-scope button set: Add to Album / Delete / close(x) — no Favorite, no Ask Nimo
  // (owner-registered scope cut, see component header comment).
  it('renders as the Vue2 glass pill .selectbar with exactly three .selectbar-btn buttons', () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    expect(w.find('.selectbar').exists()).toBe(true)
    expect(w.findAll('.selectbar-btn')).toHaveLength(3)
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
  it('"Add to Album" sits between count and delete, non-danger, click only emits add-to-album', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    const btns = w.findAll('.selectbar-btn')
    expect(btns[0]!.attributes('data-test')).toBe('selectbar-add-album')
    expect(btns[1]!.attributes('data-test')).toBe('selectbar-delete')
    expect(btns[2]!.attributes('data-test')).toBe('selectbar-close')
    expect(btns[0]!.attributes('data-danger')).toBeUndefined()
    await btns[0]!.trigger('click')
    expect(w.emitted('add-to-album')).toBeTruthy()
    expect(w.emitted('clear')).toBeUndefined()
    expect(w.emitted('delete')).toBeUndefined()
  })
})
