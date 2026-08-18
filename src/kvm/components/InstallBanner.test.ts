import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InstallBanner from './InstallBanner.vue'
import { i18n } from '../../i18n'

// Brief draft's Chinese assertions corrected per zh_cn.sp9.ts actual values (grep verified before starting):
// kvmInstallingFromIso draft "Installing from ISO" → actual "Installing from optical disc. After completion, please click:"
// kvmFinishedInstalling draft "I have completed installation" → actual "I have completed installation"
const mk = (busy = false, errorKey = '') =>
  mount(InstallBanner, { props: { busy, errorKey }, global: { plugins: [i18n] } })

describe('InstallBanner', () => {
  it('Show hint text and button', () => {
    const t = mk().text()
    expect(t).toContain('正在从光盘安装')
    expect(t).toContain('我已完成安装')
  })

  it('Click button emit finish', async () => {
    const w = mk()
    await w.get('.banner-btn').trigger('click')
    expect(w.emitted('finish')).toHaveLength(1)
  })

  it('Button adds is-loading class when busy and cannot be clicked repeatedly', async () => {
    const w = mk(true)
    expect(w.get('.banner-btn').classes()).toContain('is-loading')
    await w.get('.banner-btn').trigger('click')
    expect(w.emitted('finish')).toBeUndefined()
  })

  // Review Important #1 supplementary test: inline error display when eject fails (Vue2 doesn't have this element, newly added
  // display location — previously failure was completely silent, review confirmed it's a real defect).
  describe('errorKey (review Important #1: eject failure inline hint)', () => {
    it('Do not render error row when there is no errorKey', () => {
      expect(mk().find('.banner-error').exists()).toBe(false)
    })

    it('errorKey is a registered i18n key → show translated Chinese, not the key name', () => {
      const w = mk(false, 'kvmEjectFailed')
      const err = w.get('.banner-error')
      expect(err.text()).toBe('弹出安装介质失败')
      expect(err.text()).not.toContain('kvmEjectFailed')
    })

    it('errorKey is raw backend text (not i18n key) → display as is', () => {
      const w = mk(false, 'disk is busy, try again later')
      expect(w.get('.banner-error').text()).toBe('disk is busy, try again later')
    })
  })
})
