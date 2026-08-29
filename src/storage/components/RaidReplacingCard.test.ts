import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import RaidReplacingCard from './RaidReplacingCard.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const task = { arrayId: '1', arrayName: 'Main-storage', oldPath: '/dev/sda', newPath: '/dev/sdd' }
const mountCard = (status?: Record<string, unknown> | null) =>
  mount(RaidReplacingCard, {
    props: { task, status: status as unknown as RaidStatus | null },
    global: { plugins: [i18n] },
  })

describe('RaidReplacingCard', () => {
  it('shows the array name and old drive -> new drive', () => {
    const w = mountCard(null)
    expect(w.text()).toContain('Main-storage')
    expect(w.text()).toContain('/dev/sda')
    expect(w.text()).toContain('/dev/sdd')
    expect(w.text()).toContain('替换中')
  })

  // Hybrid progress, segment one: the kernel hasn't reported numbers yet (rebuild_pct = -1).
  // This must render the indeterminate sweeping bar, never "0%" — showing 0% in the first
  // few seconds after submission would look like it's stuck.
  it('rebuild_pct = -1 -> indeterminate sweeping bar, no percentage number shown', () => {
    const w = mountCard({ rebuild_pct: -1, rebuild_finish: '', rebuild_speed: '' })
    expect(w.find('.rpc-fill-indet').exists()).toBe(true)
    expect(w.find('.rpc-fill-det').exists()).toBe(false)
    expect(w.find('.rpc-pct').exists()).toBe(false)
    expect(w.text()).not.toContain('%')
  })

  it('missing status -> also falls into indeterminate state', () => {
    const w = mountCard(null)
    expect(w.find('.rpc-fill-indet').exists()).toBe(true)
    expect(w.find('.rpc-pct').exists()).toBe(false)
  })

  // Hybrid progress, segment two: the kernel starts reporting numbers -> real percentage bar
  // + number + time remaining + speed
  it('rebuild_pct >= 0 -> determinate progress bar + percentage + time remaining + speed', () => {
    const w = mountCard({ rebuild_pct: 67.4, rebuild_finish: '12.3min', rebuild_speed: '88888K/sec' })
    expect(w.find('.rpc-fill-indet').exists()).toBe(false)
    const det = w.find('.rpc-fill-det')
    expect(det.exists()).toBe(true)
    expect(det.attributes('style')).toContain('width: 67.4%')
    expect(w.find('.rpc-pct').text()).toBe('67.4%')
    expect(w.text()).toContain('12.3min')
    expect(w.text()).toContain('88888K/sec')
  })

  it('rebuild_pct = 0 counts as "already reporting numbers", so it uses the determinate state (distinct from -1)', () => {
    const w = mountCard({ rebuild_pct: 0, rebuild_finish: '', rebuild_speed: '' })
    expect(w.find('.rpc-fill-det').exists()).toBe(true)
    expect(w.find('.rpc-pct').text()).toBe('0%')
  })

  it('percentage is clamped to 0..100 (a bad backend value cannot overflow the progress bar)', () => {
    expect(mountCard({ rebuild_pct: 140 }).find('.rpc-fill-det').attributes('style')).toContain('width: 100%')
  })

  it('the escape-hatch X emits dismiss (lets the user close the dashboard when the rebuild is stuck)', async () => {
    const w = mountCard({ rebuild_pct: -1 })
    await w.find('.rpc-dismiss').trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })
})
