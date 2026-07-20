import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import UninstallConfirm from './UninstallConfirm.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

describe('UninstallConfirm', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('默认不勾删数据 → confirm(false);勾选后 → confirm(true)', async () => {
    const w = mount(UninstallConfirm, {
      props: { open: true, name: 'Jellyfin' },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    // reka-ui teleports AlertDialogContent to <body> asynchronously (Presence);
    // one tick is enough for it to land in jsdom (AlertDialog.test.ts precedent).
    await nextTick()
    expect(document.body.textContent).toContain('确定要卸载 Jellyfin 吗')
    const confirmBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('卸载'))!
    confirmBtn.click()
    expect(w.emitted('confirm')![0]).toEqual([false])

    const box = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    box.click()
    confirmBtn.click()
    expect(w.emitted('confirm')![1]).toEqual([true])
  })
})
