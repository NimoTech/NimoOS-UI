import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SelectionToolbar from './SelectionToolbar.vue'

const i18n = createI18n({
  legacy: false, locale: 'zh_cn',
  messages: { zh_cn: { filesSelectedCount: '已选 {count} 项', filesSelectAll: '全选', filesClearSel: '取消选择', filesCtxCopy: '复制', filesCtxCut: '剪切', filesCtxDownload: '下载', filesCtxDelete: '删除' } },
})

describe('SelectionToolbar', () => {
  it('shows the count and emits select-all / clear', async () => {
    const w = mount(SelectionToolbar, { props: { count: 3, allSelected: false, canShare: false }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('已选 3 项')
    await w.get('.sel-all').trigger('click')
    expect(w.emitted('select-all')).toBeTruthy()
    await w.get('.sel-clear').trigger('click')
    expect(w.emitted('clear')).toBeTruthy()
  })

  it('has a delete button that emits delete', async () => {
    const w = mount(SelectionToolbar, { props: { count: 2, allSelected: false, canShare: false }, global: { plugins: [i18n] } })
    await w.get('.sel-delete').trigger('click')
    expect(w.emitted('delete')).toBeTruthy()
  })

  it('Copy/cut buttons emit copy/cut', async () => {
    const wrapper = mount(SelectionToolbar, {
      props: { count: 2, allSelected: false, canShare: false },
      global: { plugins: [i18n] },
    })
    await wrapper.find('.sel-copy').trigger('click')
    await wrapper.find('.sel-cut').trigger('click')
    expect(wrapper.emitted('copy')).toBeTruthy()
    expect(wrapper.emitted('cut')).toBeTruthy()
  })

  it('Render download button and emit download', async () => {
    const wrapper = mount(SelectionToolbar, { props: { count: 2, allSelected: false, canShare: false }, global: { plugins: [i18n] } })
    const btn = wrapper.find('.sel-download')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.emitted('download')).toBeTruthy()
  })
})
