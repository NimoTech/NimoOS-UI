import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotSelectionToolbar from './SnapshotSelectionToolbar.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(SnapshotSelectionToolbar, { props: { count: 2, restoring: false, ...props }, global: { plugins: [i18n] } })

describe('SnapshotSelectionToolbar', () => {
  it('Only restore and download verbs (no delete/cut/copy/share)', () => {
    const w = mountIt()
    expect(w.find('.snap-sel-restore').exists()).toBe(true)
    expect(w.find('.snap-sel-download').exists()).toBe(true)
    expect(w.findAll('button')).toHaveLength(3) // restore + download + clear selection
    expect(w.text()).not.toContain('删除')
  })
  it('Show count of selected items', () => { expect(mountIt({ count: 3 }).text()).toContain('3') })
  it('Clicking respectively emits restore / download / clear', async () => {
    const w = mountIt()
    await w.find('.snap-sel-restore').trigger('click')
    await w.find('.snap-sel-download').trigger('click')
    await w.find('.snap-sel-clear').trigger('click')
    expect(w.emitted('restore')).toHaveLength(1)
    expect(w.emitted('download')).toHaveLength(1)
    expect(w.emitted('clear')).toHaveLength(1)
  })
  it('Disabled and does not emit when restore is in progress', async () => {
    const w = mountIt({ restoring: true })
    expect(w.find('.snap-sel-restore').attributes('disabled')).toBeDefined()
    await w.find('.snap-sel-restore').trigger('click')
    expect(w.emitted('restore')).toBeUndefined()
  })
  // Task 11: a batch restore is serial (backend takes one path per call), so
  // picking forty items meant a disabled button with no sign of life. Once a
  // batch is in flight, the button shows "Restoring N/total" instead.
  it('shows the running count while a batch restore is in flight', () => {
    const w = mountIt({ restoring: true, restoreProgress: { done: 2, total: 5 } })
    expect(w.text()).toContain('2')
    expect(w.text()).toContain('5')
  })
})
