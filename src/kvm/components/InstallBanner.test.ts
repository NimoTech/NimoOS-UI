import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InstallBanner from './InstallBanner.vue'
import { i18n } from '../../i18n'

// brief 草稿的中文断言按 zh_cn.sp9.ts 实际值订正(开工前 grep 核对):
// kvmInstallingFromIso 草稿"正在从 ISO 安装" → 实际"正在从光盘安装。完成后请点击："
// kvmFinishedInstalling 草稿"我已安装完成" → 实际"我已完成安装"
const mk = (busy = false, errorKey = '') =>
  mount(InstallBanner, { props: { busy, errorKey }, global: { plugins: [i18n] } })

describe('InstallBanner', () => {
  it('显示提示文案与按钮', () => {
    const t = mk().text()
    expect(t).toContain('正在从光盘安装')
    expect(t).toContain('我已完成安装')
  })

  it('点按钮 emit finish', async () => {
    const w = mk()
    await w.get('.banner-btn').trigger('click')
    expect(w.emitted('finish')).toHaveLength(1)
  })

  it('busy 时按钮加 is-loading 类且不可重复点', async () => {
    const w = mk(true)
    expect(w.get('.banner-btn').classes()).toContain('is-loading')
    await w.get('.banner-btn').trigger('click')
    expect(w.emitted('finish')).toBeUndefined()
  })

  // 评审 Important #1 补测:eject 失败时的内联错误展示(Vue2 没有这个元素,是新补的
  // 展示位——原先失败完全静默,评审已核实是真缺陷)。
  describe('errorKey(评审 Important #1:eject 失败内联提示)', () => {
    it('没有 errorKey 时不渲染错误行', () => {
      expect(mk().find('.banner-error').exists()).toBe(false)
    })

    it('errorKey 是已注册的 i18n key → 显示翻译后的中文,不是键名', () => {
      const w = mk(false, 'kvmEjectFailed')
      const err = w.get('.banner-error')
      expect(err.text()).toBe('弹出安装介质失败')
      expect(err.text()).not.toContain('kvmEjectFailed')
    })

    it('errorKey 是后端原文(非 i18n key)→ 原样显示', () => {
      const w = mk(false, 'disk is busy, try again later')
      expect(w.get('.banner-error').text()).toBe('disk is busy, try again later')
    })
  })
})
