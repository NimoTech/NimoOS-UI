import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import PowerOverlay from './PowerOverlay.vue'
import type { PowerPhase } from '../util/powerFlow'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

// 六个浮层态直接挂纯展示组件 PowerOverlay —— 它只吃一个 phase prop,
// 不需要在 PowerFlow 上开 __setPhase 这类只为测试存在的生产接口。
describe('PowerOverlay 六个浮层态', () => {
  // 任务简报原稿把这里标成 (phase: string),vue-tsc strict 下与 prop 的
  // PowerPhase 类型不兼容(TS2322)——按 PowerPhase 收紧,行为不变。
  const mountOverlay = (phase: PowerPhase) =>
    mount(PowerOverlay, { props: { phase }, global: { plugins: [i18n] } })

  it('shutting', () => expect(mountOverlay('shutting').text()).toContain('请等待约 30 秒'))
  it('offline', () => expect(mountOverlay('offline').text()).toContain('可以安全断电'))
  it('restarting', () => expect(mountOverlay('restarting').text()).toContain('正在发送重启指令'))
  it('reconnecting', () => expect(mountOverlay('reconnecting').text()).toContain('自动重新连接'))
  it('done', () => expect(mountOverlay('done').text()).toContain('正在跳转'))
  it('appUpdating', () => expect(mountOverlay('appUpdating').text()).toContain('系统正在更新'))

  it('每个态的标题都有译文(没渲染出裸 key)', () => {
    for (const ph of ['shutting', 'offline', 'restarting', 'reconnecting', 'done', 'appUpdating', 'fallback'] as const) {
      expect(mountOverlay(ph).find('.pf-card-title').text()).not.toMatch(/^settings/)
    }
  })

  it('fallback 带警示色与刷新按钮', () => {
    const w = mountOverlay('fallback')
    expect(w.find('.set-warn').exists()).toBe(true)
    expect(w.find('.pf-reload').exists()).toBe(true)
  })

  it('offline 与 fallback 可关闭,点关闭 emit close(其余等待态不给关闭按钮)', async () => {
    for (const ph of ['offline', 'fallback'] as const) {
      const w = mountOverlay(ph)
      expect(w.find('.pf-close').exists()).toBe(true)
      await w.find('.pf-close').trigger('click')
      expect(w.emitted('close')).toHaveLength(1)
    }
    for (const ph of ['shutting', 'restarting', 'reconnecting', 'done', 'appUpdating'] as const) {
      expect(mountOverlay(ph).find('.pf-close').exists()).toBe(false)
    }
  })

  it('idle 时什么都不渲染', () => {
    expect(mountOverlay('idle').find('.pf-overlay').exists()).toBe(false)
  })
})
