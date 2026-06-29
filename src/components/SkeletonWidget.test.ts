import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import { messages } from '../i18n/zh_cn'
import { useUtilizationStore } from '../stores/utilization'
import SkeletonWidget from './SkeletonWidget.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

function mountWidget() {
  return mount(SkeletonWidget, { global: { plugins: [i18n] } })
}

describe('SkeletonWidget', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows collecting placeholder when no data', () => {
    const w = mountWidget()
    expect(w.text()).toContain('采集中…')
  })

  it('renders cpu and memory percent from the store', async () => {
    const store = useUtilizationStore()
    store.applySocket({ sys_cpu: '{"percent":55}', sys_mem: '{"usedPercent":61}' })
    const w = mountWidget()
    await w.vm.$nextTick()
    expect(w.text()).toContain('55')
    expect(w.text()).toContain('61')
  })
})
