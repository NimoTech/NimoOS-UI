import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RingGauge from './RingGauge.vue'

describe('RingGauge', () => {
  it('always renders the data-driven gradient', () => {
    const w = mount(RingGauge, { props: { percent: 42, label: 'CPU' } })
    const style = w.get('.ring').attributes('style') ?? ''
    expect(style).toContain('--p: 42')
    // The old three-colour fallback keyed off these hardcoded stops; nothing may
    // select it any more.
    expect(style).not.toContain('68%')
  })

  it('renders an em dash rather than a percentage when there is no reading', () => {
    const w = mount(RingGauge, { props: { percent: null, label: 'CPU' } })
    expect(w.get('.ring').text()).toContain('—')
  })
})
