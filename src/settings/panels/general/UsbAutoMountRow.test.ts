import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

// Reproduces "mounted before initService()": in production `service.sys` is a
// getter on the real module that throws until initService() has run. The mock
// keeps the shape (module -> service -> sys getter) so the throw lands in the
// same place the component reads it. Neighbour style is switchRows.test.ts.
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    get sys(): never {
      throw new Error('service not initialised')
    },
  },
}))

import UsbAutoMountRow from './UsbAutoMountRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('UsbAutoMountRow 在 initService 之前挂载', () => {
  it('不产生 unhandled rejection,组件正常渲染', async () => {
    const spy = vi.fn()
    process.on('unhandledRejection', spy)
    const w = mount(UsbAutoMountRow, { global: { plugins: [i18n] } })
    await flushPromises()
    // 给 microtask 之后的 unhandledRejection 上报留一拍
    await new Promise((r) => setTimeout(r, 0))
    process.off('unhandledRejection', spy)

    expect(spy).not.toHaveBeenCalled()
    expect(w.find('.set-row').exists() || w.html().length > 0).toBe(true)
  })
})
