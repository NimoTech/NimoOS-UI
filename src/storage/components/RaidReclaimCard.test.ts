import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { RaidReattachableMember } from '@nimotech/nimoos-service'
import RaidReclaimCard from './RaidReclaimCard.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountCard = (members: RaidReattachableMember[], busy = false) =>
  mount(RaidReclaimCard, { props: { members, busy }, global: { plugins: [i18n] } })

const M = (o: Partial<RaidReattachableMember> = {}): RaidReattachableMember => ({
  path: '/dev/sdc',
  serial: 'WD-XYZ123',
  role: 'Active device 1',
  last_update: 'Wed Aug 12 03:43:02 2026',
  ...o,
})

describe('RaidReclaimCard', () => {
  it('hint sentence includes serial (serial is preferred over path for identity)', () => {
    const w = mountCard([M()])
    expect(w.find('.rrc-hint').text()).toContain('WD-XYZ123')
    expect(w.find('.rrc-hint').text()).not.toContain('/dev/sdc')
    expect(w.find('.rrc-hint').text()).toContain('已插回')
  })
  it('falls back to path when serial is empty', () => {
    const w = mountCard([M({ serial: '' })])
    expect(w.find('.rrc-hint').text()).toContain('/dev/sdc')
    expect(w.find('.rrc-id').text()).toBe('/dev/sdc')
  })
  it('multiple drives: serials joined with commas; each row shows role and last_update (superblock strings only interpolated as text)', () => {
    const w = mountCard([M(), M({ path: '/dev/sdd', serial: 'WD-ABC999', role: 'Active device 2' })])
    expect(w.find('.rrc-hint').text()).toContain('WD-XYZ123, WD-ABC999')
    const rows = w.findAll('.rrc-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Active device 1')
    expect(rows[0].text()).toContain('Wed Aug 12 03:43:02 2026')
  })
  // Superblock fields are untrusted external strings — must render as text, never as DOM (hard line: interpolate with {{ }} only)
  it('HTML inside role renders as text, not injected into the DOM', () => {
    const w = mountCard([M({ role: '<img src=x onerror=alert(1)>' })])
    expect(w.find('.rrc-row img').exists()).toBe(false)
    expect(w.find('.rrc-row').text()).toContain('<img')
  })
  it('clicking the button emits reclaim; the button is disabled while busy', async () => {
    const w = mountCard([M()])
    await w.find('.rrc-btn').trigger('click')
    expect(w.emitted('reclaim')).toHaveLength(1)
    const busy = mountCard([M()], true)
    expect(busy.find('.rrc-btn').attributes('disabled')).toBeDefined()
  })
})
