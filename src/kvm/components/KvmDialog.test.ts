import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import KvmDialog from './KvmDialog.vue'
import { i18n } from '../../i18n'

let w: VueWrapper | null = null
// Hard constraint 8: reka-ui uses teleport, so we must attachTo body and clean up explicitly.
//
// ⚠️ Declared deviation from the brief's verbatim draft: the brief's `mk` is a sync
// function that asserts immediately after the call. In practice, with reka-ui 2.10
// (the version already in this repo), DialogPortal/DialogContent on first mount only
// lands the teleported content in document.body on the next microtask (nextTick) —
// exactly matching the established pattern in this repo's
// `src/components/ui/Dialog.test.ts` (the global Dialog component, also built on
// reka-ui primitives), where every test asserting post-teleport content also queries
// the DOM only after `await nextTick()`. The brief's literal code is guaranteed all-red
// under this real precondition (not a bug in my component implementation — the mk
// helper is just missing one tick), so `mk` was made async with `await nextTick()`
// after mount, and every test using mk() was made async/await accordingly — the test
// intent (behavior asserted by the 6 cases) stays verbatim from the brief; the
// assertions simply run after the DOM has actually landed.
const mk = async (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) => {
  w = mount(KvmDialog, {
    props: { open: true, title: '创建新虚拟机', ...props },
    slots: { default: '<p class="probe">身体</p>', ...slots },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await nextTick()
  return w
}
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })

describe('KvmDialog', () => {
  it('open 时把标题与默认插槽渲染到 body(teleport)', async () => {
    await mk()
    expect(document.body.textContent).toContain('创建新虚拟机')
    expect(document.body.querySelector('.probe')).not.toBeNull()
    expect(document.body.querySelector('.create-vm-body')).not.toBeNull()
  })

  it('open=false 时不渲染任何内容', async () => {
    await mk({ open: false })
    expect(document.body.querySelector('.create-vm-modal')).toBeNull()
  })

  it('点关闭按钮 emit update:open=false,且带 aria-label', async () => {
    const wr = await mk()
    const btn = document.body.querySelector('.create-vm-close') as HTMLButtonElement
    expect(btn.getAttribute('aria-label')).toBeTruthy()
    btn.click()
    await wr.vm.$nextTick()
    expect(wr.emitted('update:open')).toEqual([[false]])
  })

  it('没传 footer 插槽时不渲染 create-vm-foot(创建/设置弹窗有脚,快照 tab 没有)', async () => {
    await mk()
    expect(document.body.querySelector('.create-vm-foot')).toBeNull()
  })

  it('传了 footer 与 tabs 插槽时各自渲染到位', async () => {
    await mk({}, { footer: '<button class="f">保存</button>', tabs: '<div class="t">tabs</div>' })
    expect(document.body.querySelector('.create-vm-foot .f')).not.toBeNull()
    expect(document.body.querySelector('.t')).not.toBeNull()
  })

  it('zBase 落到遮罩与内容的 z-index 上(OSSelector 要叠在创建弹窗之上)', async () => {
    await mk({ zBase: 920 })
    const overlay = document.body.querySelector('.kvm-dialog-overlay') as HTMLElement
    const content = document.body.querySelector('.kvm-dialog-content') as HTMLElement
    expect(overlay.style.zIndex).toBe('920')
    expect(content.style.zIndex).toBe('921')
  })
})
