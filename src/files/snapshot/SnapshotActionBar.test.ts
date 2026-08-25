import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotActionBar from './SnapshotActionBar.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountIt(props: Record<string, unknown> = {}) {
  return mount(SnapshotActionBar, { props: { count: 0, restoring: false, ...props }, global: { plugins: [i18n] } })
}

describe('SnapshotActionBar (final review Important 4, Ruling F-1)', () => {
  it('renders nothing when the selection is empty', () => {
    const w = mountIt({ count: 0 })
    expect(w.find('.tm-action-bar').exists()).toBe(false)
  })

  it('shows the "{n} selected" count and both Restore/Download buttons once selection is non-empty', () => {
    const w = mountIt({ count: 3 })
    expect(w.find('.tm-action-bar').exists()).toBe(true)
    expect(w.find('.tm-action-bar-label').text()).toContain('3')
    expect(w.find('.tm-action-bar-btn--restore').exists()).toBe(true)
    expect(w.find('.tm-action-bar-btn--download').exists()).toBe(true)
  })

  it('Restore emits restore', async () => {
    const w = mountIt({ count: 2 })
    await w.find('.tm-action-bar-btn--restore').trigger('click')
    expect(w.emitted('restore')).toHaveLength(1)
  })

  it('Download emits download', async () => {
    const w = mountIt({ count: 2 })
    await w.find('.tm-action-bar-btn--download').trigger('click')
    expect(w.emitted('download')).toHaveLength(1)
  })

  // Vue2 parity: `:disabled="restoring"` on the Restore verb only (`.snapshot-action-bar__item--busy`,
  // Restore's own toolbar-item) -- Download stays clickable while a restore is in flight.
  it('disables Restore (not Download) while a restore is in flight', async () => {
    const w = mountIt({ count: 2, restoring: true })
    expect(w.find('.tm-action-bar-btn--restore').attributes('disabled')).toBeDefined()
    expect(w.find('.tm-action-bar-btn--download').attributes('disabled')).toBeUndefined()
    await w.find('.tm-action-bar-btn--restore').trigger('click')
    expect(w.emitted('restore')).toBeUndefined()
  })
})
