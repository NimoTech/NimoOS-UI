// P1 restyle: the timeline selection action bar moved from a floating
// bottom-center bar (PhotosGrid's old `.selectbar`) to a top bar styled like
// the Files region's SelectionToolbar.vue.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PhotosSelectionToolbar from '../PhotosSelectionToolbar.vue'

const i18n = createI18n({
  legacy: false, locale: 'zh_cn',
  messages: { zh_cn: { photosSelectedCount: '已选择 {count} 项', photosDelete: '删除', photosCancel: '取消' } },
})

describe('PhotosSelectionToolbar', () => {
  it('shows the selected count via photosSelectedCount', () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 3 }, global: { plugins: [i18n] } })
    expect(w.get('.sel-count').text()).toBe('已选择 3 项')
  })

  // As of Task 9, the third toolbar button "Add to album" is implemented (cancel/add to album/delete), not just two buttons anymore.
  it('renders as the Files-style .selection-toolbar with exactly three .sel-btn buttons', () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    expect(w.find('.selection-toolbar').exists()).toBe(true)
    expect(w.findAll('.sel-btn')).toHaveLength(3)
  })

  it('clicking the clear button emits clear (not delete/add-to-album)', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    await w.get('.sel-clear').trigger('click')
    expect(w.emitted('clear')).toBeTruthy()
    expect(w.emitted('delete')).toBeUndefined()
    expect(w.emitted('add-to-album')).toBeUndefined()
  })

  it('clicking the delete button (styled .danger) emits delete (not clear/add-to-album)', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    const del = w.get('.sel-delete')
    expect(del.classes()).toContain('danger')
    await del.trigger('click')
    expect(w.emitted('delete')).toBeTruthy()
    expect(w.emitted('clear')).toBeUndefined()
    expect(w.emitted('add-to-album')).toBeUndefined()
  })

  // Task 9: the "Add to album" button is positioned between "Cancel" and "Delete",
  // not danger-styled, emits add-to-album without affecting the existing clear/delete
  // contract (regression test).
  it('"Add to album" is positioned between Cancel and Delete, not danger-styled, click only emits add-to-album', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    const btns = w.findAll('.sel-btn')
    expect(btns[0]!.classes()).toContain('sel-clear')
    expect(btns[1]!.classes()).toContain('sel-add-album')
    expect(btns[2]!.classes()).toContain('sel-delete')
    expect(btns[1]!.classes()).not.toContain('danger')
    await btns[1]!.trigger('click')
    expect(w.emitted('add-to-album')).toBeTruthy()
    expect(w.emitted('clear')).toBeUndefined()
    expect(w.emitted('delete')).toBeUndefined()
  })
})
