import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InstallBanner from './InstallBanner.vue'
import { i18n } from '../../i18n'

// brief 草稿的中文断言按 zh_cn.sp9.ts 实际值订正(开工前 grep 核对):
// kvmInstallingFromIso 草稿"正在从 ISO 安装" → 实际"正在从光盘安装。完成后请点击："
// kvmFinishedInstalling 草稿"我已安装完成" → 实际"我已完成安装"
const mk = (busy = false) => mount(InstallBanner, { props: { busy }, global: { plugins: [i18n] } })

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
})
