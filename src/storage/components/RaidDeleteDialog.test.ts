import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidDeleteDialog from './RaidDeleteDialog.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Instances mounted with attachTo: document.body don't auto-unmount between tests (the Dialog
// content is also Teleported into body via reka-ui's Portal, detached from the wrapper's root
// node) — without clearing it, the next test's querySelector would hit the previous test's
// leftover node in body first. FormatDialog.test.ts / UnmountDialog.test.ts in this same
// directory both handle it with this same beforeEach; we follow the same pattern here.
beforeEach(() => {
  document.body.innerHTML = ''
})

describe('RaidDeleteDialog', () => {
  const mountIt = () => mount(RaidDeleteDialog, {
    props: { open: true, name: 'vault' }, global: { plugins: [i18n] },
    attachTo: document.body,
  })
  it('input not equal to the array name -> delete button is disabled', async () => {
    const w = mountIt()
    // The Dialog's base (reka-ui's DialogPortal) Teleporting content into body is async (it
    // flips isMounted inside onMounted, triggering an extra render pass) — after mounting you
    // must await one nextTick before content is queryable; FormatDialog.test.ts /
    // UnmountDialog.test.ts in this same directory both follow this pattern. The sample test
    // code given in the brief was missing this await before its first query, which testing
    // showed makes querySelector always return null (regardless of whether the name matches),
    // so it's added here without changing any assertion intent.
    await w.vm.$nextTick()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vaul'; input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    const ok = document.body.querySelector('.rdd-ok') as HTMLButtonElement
    expect(ok.disabled).toBe(true)
  })
  it('input equal to the array name -> enabled; clicking emits confirm (no payload)', async () => {
    const w = mountIt()
    await w.vm.$nextTick()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vault'; input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    const ok = document.body.querySelector('.rdd-ok') as HTMLButtonElement
    expect(ok.disabled).toBe(false)
    ok.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([])
  })
  it('clears input on both open and close', async () => {
    const w = mountIt()
    await w.vm.$nextTick()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vault'; input.dispatchEvent(new Event('input'))
    await w.setProps({ open: false }); await w.setProps({ open: true })
    await w.vm.$nextTick()
    expect((document.body.querySelector('.rdd-input') as HTMLInputElement).value).toBe('')
  })
})
