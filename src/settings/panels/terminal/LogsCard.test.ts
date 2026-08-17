import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LogsCard from './LogsCard.vue'
import { i18n } from '../../../i18n'

const mountCard = (text: string) =>
  mount(LogsCard, { props: { text }, global: { plugins: [i18n] } })

describe('LogsCard', () => {
  it('renders logs as plain text, not HTML (porting discipline: Vue2 uses v-html)', () => {
    const w = mountCard('<img src=x onerror=alert(1)> hello')
    expect(w.find('[data-test="logs-pre"]').element.querySelector('img')).toBeNull()
    expect(w.find('[data-test="logs-pre"]').text()).toContain('<img src=x onerror=alert(1)>')
  })
  it('shows a loading hint when text is empty', () => {
    expect(mountCard('').find('[data-test="logs-pre"]').text()).toBe('正在拉取系统日志...')
  })
  it('fullscreen button toggles the class', async () => {
    const w = mountCard('log')
    await w.find('.set-logs-fs').trigger('click')
    expect(w.find('.set-logs-wrap').classes()).toContain('is-fullscreen')
  })
  it('logs reuse the same display shell as the app console (LogConsole), rather than a separate look of its own', () => {
    const w = mountCard('log')
    // Evidence of reuse: the dark console base class names .log-console / .log-console-pre
    // show up (same as LogsPane), rather than the standalone .set-logs class this iteration
    // has already retired.
    expect(w.find('.log-console').exists()).toBe(true)
    expect(w.find('[data-test="logs-pre"]').classes()).toContain('log-console-pre')
  })
  it('tools named-slot content renders in the toolbar (same row as the fullscreen button)', () => {
    const w = mount(LogsCard, {
      props: { text: 'log' },
      slots: { tools: '<a data-test="dl" href="/x">下载日志</a>' },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-test="dl"]').exists()).toBe(true)
  })
})
