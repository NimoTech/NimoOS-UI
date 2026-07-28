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

  // Task 9 起工具栏第三个按钮「加入相册」落地(取消/加入相册/删除),不再是两钮。
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

  // Task 9: 「加入相册」按钮在「取消」与「删除」之间,非 danger 样式,emit add-to-album,
  // 不影响既有 clear/delete 契约(回归)。
  it('「加入相册」位于取消与删除之间、非 danger、click 只 emit add-to-album', async () => {
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
