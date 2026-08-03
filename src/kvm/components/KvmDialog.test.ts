import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import KvmDialog from './KvmDialog.vue'
import { i18n } from '../../i18n'

let w: VueWrapper | null = null
// 硬约束 8:reka-ui 走 teleport,必须 attachTo body 且显式清理。
//
// ⚠️ 与 brief 逐字稿的申报偏离:brief 给的 `mk` 是同步函数、调用后立即断言。实测
// reka-ui 2.10(本仓库既有版本)的 DialogPortal/DialogContent 首次挂载时,teleport
// 内容要等下一个 microtask(nextTick)才真正落地到 document.body —— 与本仓库
// `src/components/ui/Dialog.test.ts`(全局 Dialog 组件,同样用 reka-ui 原语)已确立
// 的写法完全一致,那个测试文件里凡是断言 teleport 后内容的用例,也都 `await nextTick()`
// 之后再查 DOM。brief 的字面代码在这个真实前置条件下必然全红(不是我实现的组件有
// bug,是 mk 助手缺了一次 tick),所以把 `mk` 改成 async 并在 mount 之后 `await
// nextTick()`,每个用到 mk() 的用例相应改成 async/await——测试意图(6 条用例断言
// 的行为)与 brief 逐字不变,只是让断言真正等到 DOM 落地后再跑。
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
