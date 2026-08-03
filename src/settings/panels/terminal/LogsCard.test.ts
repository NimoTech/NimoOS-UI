import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LogsCard from './LogsCard.vue'
import { i18n } from '../../../i18n'

const mountCard = (text: string) =>
  mount(LogsCard, { props: { text }, global: { plugins: [i18n] } })

describe('LogsCard', () => {
  it('日志以纯文本渲染,不当 HTML(移植纪律:Vue2 是 v-html)', () => {
    const w = mountCard('<img src=x onerror=alert(1)> hello')
    expect(w.find('[data-test="logs-pre"]').element.querySelector('img')).toBeNull()
    expect(w.find('[data-test="logs-pre"]').text()).toContain('<img src=x onerror=alert(1)>')
  })
  it('空文本时显示加载提示', () => {
    expect(mountCard('').find('[data-test="logs-pre"]').text()).toBe('正在拉取系统日志...')
  })
  it('全屏按钮切换 class', async () => {
    const w = mountCard('log')
    await w.find('.set-logs-fs').trigger('click')
    expect(w.find('.set-logs-wrap').classes()).toContain('is-fullscreen')
  })
  it('日志复用应用控制台同一套展示壳(LogConsole),而非自成一套外观', () => {
    const w = mountCard('log')
    // 复用证据:深色控制台底类名 .log-console / .log-console-pre 出现(LogsPane 同款),
    // 而不是本期已废弃的 .set-logs 独立外观类。
    expect(w.find('.log-console').exists()).toBe(true)
    expect(w.find('[data-test="logs-pre"]').classes()).toContain('log-console-pre')
  })
  it('tools 具名插槽内容渲染在工具条里(与全屏按钮同排)', () => {
    const w = mount(LogsCard, {
      props: { text: 'log' },
      slots: { tools: '<a data-test="dl" href="/x">下载日志</a>' },
      global: { plugins: [i18n] },
    })
    expect(w.find('[data-test="dl"]').exists()).toBe(true)
  })
})
