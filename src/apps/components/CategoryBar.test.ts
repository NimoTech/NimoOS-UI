import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import CategoryBar from './CategoryBar.vue'
import { ALL } from '../stores/appstore'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

describe('CategoryBar', () => {
  it('首 chip=全部;后端分类带 count;当前项高亮;点击 emit select(name)', async () => {
    const w = mount(CategoryBar, {
      props: { categories: [{ id: 1, name: 'Media', count: 3 }], current: 'Media' },
      global: { plugins: [i18n] },
    })
    const chips = w.findAll('.cate-chip')
    expect(chips[0].text()).toContain('全部')
    expect(chips[1].text()).toContain('Media')
    expect(chips[1].text()).toContain('3')
    expect(chips[1].classes()).toContain('active')
    await chips[0].trigger('click')
    expect(w.emitted('select')![0]).toEqual([ALL])
    await chips[1].trigger('click')
    expect(w.emitted('select')![1]).toEqual(['Media'])
  })
})
