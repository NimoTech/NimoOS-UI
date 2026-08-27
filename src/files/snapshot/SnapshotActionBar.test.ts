import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

  // Fix wave A2 (audit-stage.md #14, priority list item 9): Vue2 renders icon-only buttons
  // (`<b-icon>`), not text labels -- the earlier build's `{{ t('tmRestoreSelection') }}`/
  // `{{ t('filesCtxDownload') }}` text content is gone, replaced by an inline SVG glyph; the
  // hover tooltip is the existing native `:title` attribute (house style, Vue2's own `<b-tooltip>`
  // equivalent).
  it('Vue2 parity: buttons are icon-only (an <svg>, no text label) with a native title tooltip', () => {
    const w = mountIt({ count: 2 })
    const restore = w.find('.tm-action-bar-btn--restore')
    const download = w.find('.tm-action-bar-btn--download')
    expect(restore.find('svg').exists()).toBe(true)
    expect(download.find('svg').exists()).toBe(true)
    expect(restore.text()).toBe('')
    expect(download.text()).toBe('')
    expect(restore.attributes('title')).toBeTruthy()
    expect(download.attributes('title')).toBeTruthy()
  })

  // Fix wave A2 (audit-stage.md #14, priority list item 8): the whole bar previously popped
  // in/out instantly (`v-if`, no `<Transition>` wrapper at all). Now wrapped in Vue2's own
  // `up-fade` transition (ported as `tm-up-fade`, see this component's own <style> comment for the
  // full derivation) -- jsdom applies no CSS and cannot exercise an actual mid-transition frame, so
  // this is a hook-presence check on the component's own source (same technique
  // TimeMachineRail.test.ts already uses for its own CSS-only assertions): it would fail if the
  // `<Transition>` wrapper or either of its two CSS class pairs were ever silently removed again.
  it('wraps the bar in the up-fade enter/leave transition (Vue2 parity)', () => {
    const src = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './SnapshotActionBar.vue'),
      'utf8',
    )
    expect(src).toMatch(/<Transition\s+name="tm-up-fade">/)
    expect(src).toContain('.tm-up-fade-enter-active')
    expect(src).toContain('.tm-up-fade-enter-from')
    expect(src).toContain('translateY(50px)')
  })
})
