import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import PreInstallTips from './PreInstallTips.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('PreInstallTips', () => {
  it('markdown rendering + clicking continue emits confirm (portal to body, attachTo real DOM)', async () => {
    const w = mount(PreInstallTips, {
      props: { open: true, text: '先配置 **端口**' },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await nextTick()
    const body = document.body.innerHTML
    expect(body).toContain('<strong>端口</strong>')
    const btns = Array.from(document.body.querySelectorAll('button'))
    const confirm = btns.find((b) => b.textContent?.includes('继续安装'))!
    confirm.click()
    await nextTick()
    expect(w.emitted('confirm')).toBeTruthy()
    w.unmount()
  })
})
