import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidCreateProgressModal from './RaidCreateProgressModal.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const task = (o = {}) => ({ taskId: 't', name: 'md0', level: 5, filesystem: 'btrfs', diskCount: 4, step: 3, stepName: '', progress: 55, elapsedSeconds: 30, error: '', status: 'creating', ...o })

describe('RaidCreateProgressModal', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  it('open 时渲染 6 步 + 进度值', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task() }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    const body = document.body.textContent || ''
    expect(body).toContain(zh.raidStep1)
    expect(body).toContain(zh.raidStep6)
    expect(body).toContain('55') // progress
  })
  it('step<current → done;== current → active(creating)', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task({ step: 3, status: 'creating' }) }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    expect(document.body.querySelectorAll('.rpm-step.done').length).toBe(2) // 步 1,2
    expect(document.body.querySelectorAll('.rpm-step.active').length).toBe(1) // 步 3
  })
  it('failed:当前步标记 failed', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task({ step: 3, status: 'failed' }) }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    expect(document.body.querySelectorAll('.rpm-step.failed').length).toBe(1)
  })
  it('done:全部步 done', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task({ status: 'done', step: 6 }) }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    expect(document.body.querySelectorAll('.rpm-step.done').length).toBe(6)
  })
  it('step=0(尚未进入首个真实步骤)→ 当前步标签回退 raidPreparing,而非字面量 raidStep0', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task({ step: 0, status: 'creating' }) }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    const body = document.body.textContent || ''
    expect(body).toContain(zh.raidPreparing)
    expect(body).not.toContain('raidStep0')
  })
})
