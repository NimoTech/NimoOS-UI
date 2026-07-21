import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import InstallingAppCard from './InstallingAppCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const base = { id: 'jellyfin', title: 'Jellyfin', icon: '', percent: 42, state: 'installing' as const, message: '' }

describe('InstallingAppCard', () => {
  it('installing:标题 + 进度条 42%', () => {
    const w = mount(InstallingAppCard, { props: { task: base }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('Jellyfin')
    expect(w.find('.op-progress-fill').attributes('style')).toContain('42%')
    expect(w.find('.iac-dismiss').exists()).toBe(false)
  })

  it('error:后端 message + dismiss;message 空用 i18n 兜底', async () => {
    const w = mount(InstallingAppCard, {
      props: { task: { ...base, state: 'error', message: 'pull failed' } },
      global: { plugins: [i18n] },
    })
    expect(w.text()).toContain('pull failed')
    await w.find('.iac-dismiss').trigger('click')
    expect(w.emitted('dismiss')).toBeTruthy()
    const w2 = mount(InstallingAppCard, {
      props: { task: { ...base, state: 'error', message: '' } },
      global: { plugins: [i18n] },
    })
    expect(w2.text()).toContain('安装失败') // appsInstallFailed 兜底
  })
})
