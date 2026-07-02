import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SelectionToolbar from './SelectionToolbar.vue'

const i18n = createI18n({
  legacy: false, locale: 'zh_cn',
  messages: { zh_cn: { filesSelectedCount: '已选 {count} 项', filesSelectAll: '全选', filesClearSel: '清空' } },
})

describe('SelectionToolbar', () => {
  it('shows the count and emits select-all / clear', async () => {
    const w = mount(SelectionToolbar, { props: { count: 3, allSelected: false }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('已选 3 项')
    await w.get('.sel-all').trigger('click')
    expect(w.emitted('select-all')).toBeTruthy()
    await w.get('.sel-clear').trigger('click')
    expect(w.emitted('clear')).toBeTruthy()
  })
})
