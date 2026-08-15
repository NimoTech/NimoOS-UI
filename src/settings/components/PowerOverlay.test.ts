import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import PowerOverlay from './PowerOverlay.vue'
import type { PowerPhase } from '../util/powerFlow'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

// Mount the six overlay states directly on the pure presentational PowerOverlay —
// it only takes a phase prop, so no test-only production hooks like __setPhase on PowerFlow.
describe('PowerOverlay six overlay states', () => {
  // The task brief originally typed this as (phase: string), which is incompatible with
  // the prop's PowerPhase type under vue-tsc strict (TS2322) — tightened to PowerPhase, same behavior.
  const mountOverlay = (phase: PowerPhase) =>
    mount(PowerOverlay, { props: { phase }, global: { plugins: [i18n] } })

  it('shutting', () => expect(mountOverlay('shutting').text()).toContain('请等待约 30 秒'))
  it('offline', () => expect(mountOverlay('offline').text()).toContain('可以安全断电'))
  it('restarting', () => expect(mountOverlay('restarting').text()).toContain('正在发送重启指令'))
  it('reconnecting', () => expect(mountOverlay('reconnecting').text()).toContain('自动重新连接'))
  it('done', () => expect(mountOverlay('done').text()).toContain('正在跳转'))
  it('appUpdating', () => expect(mountOverlay('appUpdating').text()).toContain('系统正在更新'))

  it('every state has a translated title (no bare key rendered)', () => {
    for (const ph of ['shutting', 'offline', 'restarting', 'reconnecting', 'done', 'appUpdating', 'fallback'] as const) {
      expect(mountOverlay(ph).find('.pf-card-title').text()).not.toMatch(/^settings/)
    }
  })

  it('fallback has a warning color and a reload button', () => {
    const w = mountOverlay('fallback')
    expect(w.find('.set-warn').exists()).toBe(true)
    expect(w.find('.pf-reload').exists()).toBe(true)
  })

  it('offline and fallback can be closed, clicking close emits close (other waiting states get no close button)', async () => {
    for (const ph of ['offline', 'fallback'] as const) {
      const w = mountOverlay(ph)
      expect(w.find('.pf-close').exists()).toBe(true)
      await w.find('.pf-close').trigger('click')
      expect(w.emitted('close')).toHaveLength(1)
    }
    for (const ph of ['shutting', 'restarting', 'reconnecting', 'done', 'appUpdating'] as const) {
      expect(mountOverlay(ph).find('.pf-close').exists()).toBe(false)
    }
  })

  it('renders nothing when idle', () => {
    expect(mountOverlay('idle').find('.pf-overlay').exists()).toBe(false)
  })
})
