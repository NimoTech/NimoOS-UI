import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotBanner from './SnapshotBanner.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const INFO = { mount: '/DATA', snapshotName: '20260713T061900Z_manual_改版前', relPath: 'Photos' }
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(SnapshotBanner, {
    props: { info: INFO, restoring: false, canRestore: true, ...props },
    global: { plugins: [i18n] },
  })

describe('SnapshotBanner', () => {
  it('do not render banner when info is null', () => {
    expect(mountIt({ info: null }).find('.snap-banner').exists()).toBe(false)
  })
  it('show human-readable parsed time, not raw snapshot name', () => {
    const text = mountIt().text()
    expect(text).not.toContain('20260713T061900Z')
    expect(text).toContain('只读')
  })
  it('when snapshot name cannot be parsed, fall back to raw name (do not leave empty)', () => {
    const w = mountIt({ info: { ...INFO, snapshotName: 'weird' } })
    expect(w.text()).toContain('weird')
  })
  it('hint row always visible (not one-time toast)', () => {
    expect(mountIt().find('.snap-banner-hint').text()).toContain('恢复')
  })
  it('clicking exit emits exit', async () => {
    const w = mountIt()
    await w.find('.snap-banner-exit').trigger('click')
    expect(w.emitted('exit')).toHaveLength(1)
  })
  it('clicking restore emits restore', async () => {
    const w = mountIt()
    await w.find('.snap-banner-restore').trigger('click')
    expect(w.emitted('restore')).toHaveLength(1)
  })
  it('when no restorable items are selected, restore button is disabled and does not emit', async () => {
    const w = mountIt({ canRestore: false })
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeDefined()
    await w.find('.snap-banner-restore').trigger('click')
    expect(w.emitted('restore')).toBeUndefined()
  })
  it('while restore is in progress, button is disabled and shows busy state', async () => {
    const w = mountIt({ restoring: true })
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeDefined()
    expect(w.find('.snap-banner-restore').classes()).toContain('is-busy')
  })

  // Fix-wave I4: this banner's restore button fires the exact same
  // `browse.restore(...)` as SnapshotSelectionToolbar's, and is the only
  // restore entry point that stays clickable when the user picked a batch
  // (canRestore only turns true for a multi-select) -- it must show the same
  // running count instead of just going gray while its sibling shows progress.
  it('shows the running count while a batch restore is in flight, reusing the toolbar\'s own text', () => {
    const w = mountIt({ restoring: true, restoreProgress: { done: 3, total: 40 } })
    const text = w.find('.snap-banner-restore').text()
    expect(text).toContain('3')
    expect(text).toContain('40')
  })

  // Review fix (Critical 1 bonus): the `.snapshots` container directory itself has no specific
  // snapshot name; info is always null; in the original implementation, the banner would not
  // render at all — the read-only lock is in effect yet shows no hint, like "locked but nobody
  // told you".
  describe('.snapshots container directory (info is null, isContainer is true)', () => {
    it('show guidance text without time, no restore/exit buttons', () => {
      const w = mountIt({ info: null, isContainer: true })
      expect(w.find('.snap-banner').exists()).toBe(true)
      expect(w.text()).toContain('请选择一个快照')
      expect(w.find('.snap-banner-restore').exists()).toBe(false)
      expect(w.find('.snap-banner-exit').exists()).toBe(false)
    })
    it('when isContainer is false and info is null, banner still does not render (container hint does not show every time info is null)', () => {
      expect(mountIt({ info: null, isContainer: false }).find('.snap-banner').exists()).toBe(false)
    })
  })
})
