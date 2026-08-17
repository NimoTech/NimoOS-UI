import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import AreaShell from './AreaShell.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('AreaShell', () => {
  beforeEach(() => { setActivePinia(createPinia()); push.mockClear() })

  it('Renders title prop and slot content; home button click pushes /', async () => {
    const w = mount(AreaShell, {
      props: { title: '应用' },
      global: { plugins: [i18n] },
      slots: { default: '<div class="probe">hi</div>' },
    })
    expect(w.get('.probe').text()).toBe('hi')
    expect(w.text()).toContain('应用')
    await w.get('.area-home-btn').trigger('click')
    expect(push).toHaveBeenCalledWith('/')
  })
})
