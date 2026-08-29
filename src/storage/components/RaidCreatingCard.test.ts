import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidCreatingCard from './RaidCreatingCard.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const task = (o = {}) => ({ taskId: 't', name: 'md0', level: 5, filesystem: 'btrfs', diskCount: 4, step: 3, stepName: '创建 RAID 阵列', progress: 55, elapsedSeconds: 30, error: '', status: 'creating', ...o })

describe('RaidCreatingCard', () => {
  it('creating: shows the name + Creating label + Details button', () => {
    const w = mount(RaidCreatingCard, { props: { task: task() }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('md0')
    expect(w.text()).toContain(zh.raidCreating)
    expect(w.find('.rcc-details').exists()).toBe(true)
  })
  it('clicking Details emits open-modal', async () => {
    const w = mount(RaidCreatingCard, { props: { task: task() }, global: { plugins: [i18n] } })
    await w.find('.rcc-details').trigger('click')
    expect(w.emitted('open-modal')).toBeTruthy()
  })
  it('failed: shows the failed state + dismiss button', async () => {
    const w = mount(RaidCreatingCard, { props: { task: task({ status: 'failed' }) }, global: { plugins: [i18n] } })
    expect(w.text()).toContain(zh.raidCreateFailed)
    await w.find('.rcc-dismiss').trigger('click')
    expect(w.emitted('dismiss')).toBeTruthy()
  })
})
