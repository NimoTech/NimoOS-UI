import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import FilesShell from './FilesShell.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

describe('FilesShell', () => {
  beforeEach(() => { setActivePinia(createPinia()); push.mockClear() })

  it('renders title, slot content, and back-home button that routes to /', async () => {
    const w = mount(FilesShell, {
      global: { plugins: [i18n] },
      slots: { default: '<div class="probe">hi</div>' },
    })
    expect(w.get('.probe').text()).toBe('hi')
    expect(w.text()).toContain('文件')
    await w.get('.files-home-btn').trigger('click')
    expect(push).toHaveBeenCalledWith('/')
  })
})
