import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LogsCard from './LogsCard.vue'
import { i18n } from '../../../i18n'

const mountCard = (text: string) =>
  mount(LogsCard, { props: { text }, global: { plugins: [i18n] } })

describe('LogsCard', () => {
  it('日志以纯文本渲染,不当 HTML(移植纪律:Vue2 是 v-html)', () => {
    const w = mountCard('<img src=x onerror=alert(1)> hello')
    expect(w.find('.set-logs').element.querySelector('img')).toBeNull()
    expect(w.find('.set-logs').text()).toContain('<img src=x onerror=alert(1)>')
  })
  it('空文本时显示加载提示', () => {
    expect(mountCard('').text()).toContain('正在拉取系统日志...')
  })
  it('全屏按钮切换 class', async () => {
    const w = mountCard('log')
    await w.find('.set-logs-fs').trigger('click')
    expect(w.find('.set-logs-wrap').classes()).toContain('is-fullscreen')
  })
})
