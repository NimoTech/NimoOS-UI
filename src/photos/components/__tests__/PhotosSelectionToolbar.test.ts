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

  it('renders as the Files-style .selection-toolbar with exactly two .sel-btn buttons', () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    expect(w.find('.selection-toolbar').exists()).toBe(true)
    expect(w.findAll('.sel-btn')).toHaveLength(2)
  })

  it('clicking the clear button emits clear (not delete)', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    await w.get('.sel-clear').trigger('click')
    expect(w.emitted('clear')).toBeTruthy()
    expect(w.emitted('delete')).toBeUndefined()
  })

  it('clicking the delete button (styled .danger) emits delete (not clear)', async () => {
    const w = mount(PhotosSelectionToolbar, { props: { count: 2 }, global: { plugins: [i18n] } })
    const del = w.get('.sel-delete')
    expect(del.classes()).toContain('danger')
    await del.trigger('click')
    expect(w.emitted('delete')).toBeTruthy()
    expect(w.emitted('clear')).toBeUndefined()
  })
})
